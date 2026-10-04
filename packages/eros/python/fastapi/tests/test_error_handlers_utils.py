from datetime import timedelta
from functools import partial
from typing import TYPE_CHECKING, Final

import pytest
from fastapi import (
  FastAPI,
  HTTPException,  # noqa: TID251 -- a route raises it for the handlers to translate
  Request,
)
from fastapi.exceptions import RequestValidationError
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel, ConfigDict

from droneey_eros import (
  ErrorEvent,
  ErrorKind,
  ErrorMeta,
  NotFoundError,
  RateLimitedError,
  UnexpectedError,
)
from droneey_eros_fastapi import HTTP_EXCEPTION_KINDS, GetTraceId, add_error_handlers
from error_record_fixtures import without_stacks

if TYPE_CHECKING:
  from collections.abc import AsyncIterator, Mapping


class OrderNotFoundError(NotFoundError):
  meta = ErrorMeta(module='orders', entity='order')


class Item(BaseModel):
  model_config = ConfigDict(extra='forbid', strict=True, frozen=True)

  quantity: int


class Order(BaseModel):
  model_config = ConfigDict(extra='forbid', strict=True, frozen=True)

  items: list[Item]


MASKED = {
  'type': 'https://errors.example.com/internal',
  'title': 'Internal Server Error',
  'status': 500,
  'detail': 'An unexpected error occurred.',
  'code': 'internal',
  'isRetryable': False,
}


# The failures of a RequestValidationError an app raises itself, which need not have FastAPI's
# shape.
RAISED_FAILURES: Final[dict[str, dict[str, object]]] = {
  'location-not-a-path': {'loc': 'body', 'type': 'missing'},
  'no-type-or-message': {'loc': ('query', 'limit')},
}


def trace_id_of(request: Request) -> str | None:
  return request.headers.get('x-trace-id')


def place_order(order: Order) -> Order:
  return order


def build_app(
  events: list[ErrorEvent],
  *,
  http_exceptions: Mapping[int, ErrorKind] | None = HTTP_EXCEPTION_KINDS,
  get_trace_id: GetTraceId | None = trace_id_of,
  type_base: str | None = 'https://errors.example.com',
) -> FastAPI:
  app = FastAPI()
  add_error_handlers(
    app,
    on_error=events.append,
    http_exceptions=http_exceptions,
    get_trace_id=get_trace_id,
    type_base=type_base,
  )

  @app.get('/orders/{order_id}')
  def find_order(order_id: int) -> None:
    message = f'Order {order_id} not found.'
    raise OrderNotFoundError(message)

  # A partial has no source FastAPI can read, so its RequestValidationError names the route
  # and no path of this machine.
  app.post('/orders')(partial(place_order))

  @app.get('/orders')
  def list_orders(limit: int) -> list[Order]:
    return [] * limit

  @app.get('/raised/{shape}')
  def raise_validation(shape: str) -> None:
    raise RequestValidationError([RAISED_FAILURES[shape]])

  @app.get('/limited')
  def limited() -> None:
    message = 'Slow down.'
    raise RateLimitedError(message, retry_after=timedelta(seconds=1.2))

  @app.get('/http/{status}')
  def http_failure(status: int) -> None:
    raise HTTPException(status, detail='As the route said.', headers={'X-Why': 'test'})

  @app.get('/broken')
  def broken() -> None:
    message = 'password=hunter2'
    raise RuntimeError(message)

  @app.get('/impossible')
  def impossible() -> None:
    message = 'Order 42 has no items.'
    raise UnexpectedError(message)

  return app


@pytest.fixture
def events() -> list[ErrorEvent]:
  return []


def client_of(app: FastAPI) -> AsyncClient:
  # Starlette answers an error of no handler's class, then raises it again for the server.
  transport = ASGITransport(app=app, raise_app_exceptions=False)
  return AsyncClient(transport=transport, base_url='http://orders.test')


@pytest.fixture
async def client(events: list[ErrorEvent]) -> AsyncIterator[AsyncClient]:
  async with client_of(build_app(events)) as client:
    yield client


async def test_should_answer_an_expected_error_with_its_problem(client: AsyncClient) -> None:
  # Arrange
  # Act
  response = await client.get('/orders/42', headers={'x-trace-id': '4bf92f35'})

  # Assert
  assert (response.status_code, response.headers['content-type'], response.json()) == (
    404,
    'application/problem+json',
    {
      'type': 'https://errors.example.com/orders/order/not-found',
      'title': 'Not Found',
      'status': 404,
      'detail': 'Order 42 not found.',
      'code': 'orders/order/not-found',
      'isRetryable': False,
      'traceId': '4bf92f35',
    },
  )


async def test_should_hand_the_hook_each_error_once(
  client: AsyncClient, events: list[ErrorEvent]
) -> None:
  # Arrange
  # Act
  await client.get('/orders/42')

  # Assert
  assert (len(events), repr(events[0].error)) == (1, "OrderNotFoundError('Order 42 not found.')")


async def test_should_set_retry_after_in_whole_seconds_when_the_error_has_one(
  client: AsyncClient,
) -> None:
  # Arrange
  # Act
  response = await client.get('/limited')

  # Assert
  assert (response.status_code, response.headers['retry-after'], response.json()) == (
    429,
    '2',
    {
      'type': 'https://errors.example.com/rate-limited',
      'title': 'Too Many Requests',
      'status': 429,
      'detail': 'Slow down.',
      'code': 'rate-limited',
      'isRetryable': True,
      'retryAfterSeconds': 2,
    },
  )


async def test_should_point_at_each_failed_member_when_the_body_breaks_the_contract(
  client: AsyncClient,
) -> None:
  # Arrange
  # Act
  response = await client.post(
    '/orders', json={'items': [{'quantity': 1}, {'quantity': 'many'}, {}]}
  )

  # Assert
  assert (response.status_code, response.json()) == (
    400,
    {
      'type': 'https://errors.example.com/validation',
      'title': 'Bad Request',
      'status': 400,
      'detail': 'Validation failed.',
      'code': 'validation',
      'isRetryable': False,
      'errors': [
        {
          'pointer': '#/items/1/quantity',
          'code': 'int-type',
          'detail': 'Input should be a valid integer',
        },
        {'pointer': '#/items/2/quantity', 'code': 'missing', 'detail': 'Field required'},
      ],
    },
  )


async def test_should_keep_the_rejected_values_out_of_the_record_of_a_validation(
  client: AsyncClient, events: list[ErrorEvent]
) -> None:
  # Arrange
  # Act
  await client.post('/orders', json={'items': [{'quantity': 'many'}]})

  # Assert
  assert events[0].record == {
    'code': 'validation',
    'kind': 'validation',
    'category': 'expected',
    'title': 'Bad Request',
    'message': 'Validation failed.',
    'isRetryable': False,
    'details': {
      'errors': [
        {
          'pointer': '#/items/0/quantity',
          'code': 'int-type',
          'detail': 'Input should be a valid integer',
        },
      ],
    },
    'cause': {
      'name': 'RequestValidationError',
      'message': (
        '1 validation error:\n'
        "  {'type': 'int_type', 'loc': ('body', 'items', 0, 'quantity'),"
        " 'msg': 'Input should be a valid integer'}\n"
        '\n'
        '  Endpoint: POST /orders'
      ),
    },
  }


async def test_should_point_at_the_whole_body_when_it_is_not_json(client: AsyncClient) -> None:
  # Arrange
  # Act
  response = await client.post(
    '/orders', content=b'{', headers={'content-type': 'application/json'}
  )

  # Assert
  assert (response.status_code, response.json()) == (
    400,
    {
      'type': 'https://errors.example.com/validation',
      'title': 'Bad Request',
      'status': 400,
      'detail': 'Validation failed.',
      'code': 'validation',
      'isRetryable': False,
      'errors': [{'pointer': '#', 'code': 'json-invalid', 'detail': 'JSON decode error'}],
    },
  )


async def test_should_name_the_location_in_the_pointer_when_a_parameter_fails(
  client: AsyncClient,
) -> None:
  # Arrange
  # Act
  response = await client.get('/orders')

  # Assert
  assert (response.status_code, response.json()) == (
    400,
    {
      'type': 'https://errors.example.com/validation',
      'title': 'Bad Request',
      'status': 400,
      'detail': 'Validation failed.',
      'code': 'validation',
      'isRetryable': False,
      'errors': [{'pointer': '#/query/limit', 'code': 'missing', 'detail': 'Field required'}],
    },
  )


@pytest.mark.parametrize(
  ('shape', 'expected'),
  [
    pytest.param(
      'location-not-a-path',
      {
        'type': 'https://errors.example.com/validation',
        'title': 'Bad Request',
        'status': 400,
        'detail': 'Validation failed.',
        'code': 'validation',
        'isRetryable': False,
        'errors': [{'pointer': '#', 'code': 'missing', 'detail': ''}],
      },
      id='should point at the whole input when the location is not a path',
    ),
    pytest.param(
      'no-type-or-message',
      {
        'type': 'https://errors.example.com/validation',
        'title': 'Bad Request',
        'status': 400,
        'detail': 'Validation failed.',
        'code': 'validation',
        'isRetryable': False,
        'errors': [{'pointer': '#/query/limit', 'code': '', 'detail': ''}],
      },
      id='should leave the code and the detail empty when the failure names neither',
    ),
  ],
)
async def test_should_answer_a_request_validation_error_the_app_raises_itself(
  client: AsyncClient, shape: str, expected: dict[str, object]
) -> None:
  # Arrange
  # Act
  response = await client.get(f'/raised/{shape}')

  # Assert
  assert (response.status_code, response.json()) == (400, expected)


@pytest.mark.parametrize(
  ('status', 'expected'),
  [
    pytest.param(
      400,
      {
        'type': 'https://errors.example.com/validation',
        'title': 'Bad Request',
        'status': 400,
        'detail': 'Validation failed.',
        'code': 'validation',
        'isRetryable': False,
        'errors': [],
      },
      id='should give validation for 400',
    ),
    pytest.param(
      401,
      {
        'type': 'https://errors.example.com/unauthorized',
        'title': 'Unauthorized',
        'status': 401,
        'detail': 'Authentication is required.',
        'code': 'unauthorized',
        'isRetryable': False,
      },
      id='should give unauthorized for 401',
    ),
    pytest.param(
      403,
      {
        'type': 'https://errors.example.com/forbidden',
        'title': 'Forbidden',
        'status': 403,
        'detail': 'Access is forbidden.',
        'code': 'forbidden',
        'isRetryable': False,
      },
      id='should give forbidden for 403',
    ),
    pytest.param(
      404,
      {
        'type': 'https://errors.example.com/not-found',
        'title': 'Not Found',
        'status': 404,
        'detail': 'Resource not found.',
        'code': 'not-found',
        'isRetryable': False,
      },
      id='should give not-found for 404',
    ),
    pytest.param(
      409,
      {
        'type': 'https://errors.example.com/conflict',
        'title': 'Conflict',
        'status': 409,
        'detail': 'Resource conflict.',
        'code': 'conflict',
        'isRetryable': False,
      },
      id='should give conflict for 409',
    ),
    pytest.param(
      410,
      {
        'type': 'https://errors.example.com/expired',
        'title': 'Gone',
        'status': 410,
        'detail': 'Resource expired.',
        'code': 'expired',
        'isRetryable': False,
      },
      id='should give expired for 410',
    ),
    pytest.param(
      413,
      {
        'type': 'https://errors.example.com/payload-too-large',
        'title': 'Content Too Large',
        'status': 413,
        'detail': 'Payload is too large.',
        'code': 'payload-too-large',
        'isRetryable': False,
      },
      id='should give payload-too-large for 413',
    ),
    pytest.param(
      422,
      {
        'type': 'https://errors.example.com/violation',
        'title': 'Unprocessable Content',
        'status': 422,
        'detail': 'A business rule was violated.',
        'code': 'violation',
        'isRetryable': False,
      },
      id='should give violation for 422',
    ),
    pytest.param(
      429,
      {
        'type': 'https://errors.example.com/rate-limited',
        'title': 'Too Many Requests',
        'status': 429,
        'detail': 'Too many requests.',
        'code': 'rate-limited',
        'isRetryable': True,
      },
      id='should give rate-limited for 429',
    ),
    pytest.param(
      503,
      {
        'type': 'https://errors.example.com/unavailable',
        'title': 'Service Unavailable',
        'status': 503,
        'detail': 'Service is unavailable.',
        'code': 'unavailable',
        'isRetryable': True,
      },
      id='should give unavailable for 503',
    ),
    pytest.param(
      504,
      {
        'type': 'https://errors.example.com/timeout',
        'title': 'Gateway Timeout',
        'status': 504,
        'detail': 'A dependency did not answer in time.',
        'code': 'timeout',
        'isRetryable': True,
      },
      id='should give timeout for 504',
    ),
  ],
)
async def test_should_translate_an_http_exception_by_the_table_it_is_given(
  client: AsyncClient, status: int, expected: dict[str, object]
) -> None:
  # Arrange
  # Act
  response = await client.get(f'/http/{status}')

  # Assert
  assert (response.status_code, response.json()) == (status, expected)


async def test_should_drop_the_headers_of_a_translated_http_exception(
  client: AsyncClient,
) -> None:
  # Arrange
  # Act
  response = await client.get('/http/409')

  # Assert
  assert dict(response.headers) == {
    'content-length': '146',
    'content-type': 'application/problem+json',
  }


async def test_should_hand_the_hook_the_detail_of_a_translated_http_exception(
  client: AsyncClient, events: list[ErrorEvent]
) -> None:
  # Arrange
  # Act
  await client.get('/http/409')

  # Assert
  assert without_stacks(events[0].record) == {
    'code': 'conflict',
    'kind': 'conflict',
    'category': 'expected',
    'title': 'Conflict',
    'message': 'Resource conflict.',
    'isRetryable': False,
    'cause': {'name': 'HTTPException', 'message': '409: As the route said.'},
  }


@pytest.mark.parametrize(
  'status',
  [
    pytest.param(500, id='should mask an HTTPException of 500'),
    pytest.param(405, id='should mask an HTTPException whose status is not in the table'),
    pytest.param(502, id='should mask an HTTPException of a server status not in the table'),
  ],
)
async def test_should_mask_an_http_exception_the_table_does_not_translate(
  client: AsyncClient, status: int
) -> None:
  # Arrange
  # Act
  response = await client.get(f'/http/{status}')

  # Assert
  assert (response.status_code, response.json()) == (500, MASKED)


async def test_should_mask_every_http_exception_when_it_is_given_no_table(
  events: list[ErrorEvent],
) -> None:
  # Arrange
  app = build_app(events, http_exceptions=None)

  # Act
  async with client_of(app) as client:
    response = await client.get('/nowhere')

  # Assert
  assert (response.status_code, response.json()) == (500, MASKED)


async def test_should_answer_an_unknown_route_with_not_found_when_it_is_given_the_table(
  client: AsyncClient,
) -> None:
  # Arrange
  # Act
  response = await client.get('/nowhere')

  # Assert
  assert (response.status_code, response.json()) == (
    404,
    {
      'type': 'https://errors.example.com/not-found',
      'title': 'Not Found',
      'status': 404,
      'detail': 'Resource not found.',
      'code': 'not-found',
      'isRetryable': False,
    },
  )


async def test_should_mask_an_error_that_is_not_of_eros(client: AsyncClient) -> None:
  # Arrange
  # Act
  response = await client.get('/broken')

  # Assert
  assert (response.status_code, response.headers['content-type'], response.json()) == (
    500,
    'application/problem+json',
    MASKED,
  )


async def test_should_hand_the_hook_an_error_not_of_eros_as_the_cause_of_an_unexpected_one(
  client: AsyncClient, events: list[ErrorEvent]
) -> None:
  # Arrange
  # Act
  await client.get('/broken')

  # Assert
  assert (repr(events[0].error), repr(events[0].error.__cause__)) == (
    "UnexpectedError('An unexpected error occurred.')",
    "RuntimeError('password=hunter2')",
  )


async def test_should_mask_an_unexpected_error_of_eros(client: AsyncClient) -> None:
  # Arrange
  # Act
  response = await client.get('/impossible')

  # Assert
  assert (response.status_code, response.json()) == (500, MASKED)


async def test_should_hand_the_hook_the_message_of_an_unexpected_error_of_eros(
  client: AsyncClient, events: list[ErrorEvent]
) -> None:
  # Arrange
  # Act
  await client.get('/impossible')

  # Assert
  assert without_stacks(events[0].record) == {
    'code': 'internal',
    'kind': 'internal',
    'category': 'unexpected',
    'title': 'Internal Server Error',
    'message': 'Order 42 has no items.',
    'isRetryable': False,
  }


async def test_should_answer_without_a_trace_or_a_type_base(events: list[ErrorEvent]) -> None:
  # Arrange
  app = build_app(events, get_trace_id=None, type_base=None)

  # Act
  async with client_of(app) as client:
    response = await client.get('/orders/42', headers={'x-trace-id': '4bf92f35'})

  # Assert
  assert response.json() == {
    'type': 'about:blank',
    'title': 'Not Found',
    'status': 404,
    'detail': 'Order 42 not found.',
    'code': 'orders/order/not-found',
    'isRetryable': False,
  }
