from contextlib import suppress
from functools import partial
from typing import Annotated

import pytest
from fastmcp import Client, Context, FastMCP
from fastmcp.exceptions import ToolError
from fastmcp.exceptions import ValidationError as ArgumentsError
from mcp import MCPError
from mcp.types import ErrorData, TextContent
from pydantic import Field

from droneey_eros import (
  ErrorEvent,
  ErrorMeta,
  NotFoundError,
  ValidationError,
  ValidationFailure,
)
from droneey_eros_fastmcp import ErrorMiddleware


class OrderNotFoundError(NotFoundError):
  meta = ErrorMeta(module='orders', entity='order')


MASKED = {
  'type': 'about:blank',
  'title': 'Internal Server Error',
  'status': 500,
  'detail': 'An unexpected error occurred.',
  'code': 'internal',
  'isRetryable': False,
  'traceId': '4bf92f35',
}


# The default lifespan of FastMCP yields an empty dict.
type OrdersServer = FastMCP[dict[str, object]]


def trace_id_of(context: Context | None) -> str | None:
  return '4bf92f35' if context is not None else None


def build_server(middleware: ErrorMiddleware) -> OrdersServer:
  server: OrdersServer = FastMCP('orders', mask_error_details=True)
  server.add_middleware(middleware)

  @server.tool
  def find_order(order_id: Annotated[int, Field(description='The id of the order.')]) -> str:
    """Finds an order by its id; call it to read one order."""
    message = f'Order {order_id} not found.'
    raise OrderNotFoundError(message)

  @server.tool
  def broken() -> str:
    """Fails with an error that is not of eros."""
    message = 'password=hunter2'
    raise RuntimeError(message)

  @server.tool
  def refuse() -> str:
    """Fails with fastmcp's own ToolError."""
    message = 'Refused by the tool.'
    raise ToolError(message)

  @server.tool
  def check() -> str:
    """Fails with fastmcp's error of the arguments, raised by its own code."""
    message = 'The order is not ready to check.'
    raise ArgumentsError(message)

  @server.tool
  def answer_in_json_rpc() -> str:
    """Fails with a JSON-RPC error of its own."""
    raise MCPError(code=-32001, message='Chosen by the tool.')

  @server.resource('orders://{order_id}')
  def order(order_id: str) -> str:
    message = f'Order {order_id} not found.'
    raise OrderNotFoundError(message)

  @server.resource('reports://broken')
  def broken_report() -> str:
    message = 'password=hunter2'
    raise RuntimeError(message)

  @server.prompt
  def summarise(order_id: str) -> str:
    failure = ValidationFailure(
      pointer='#/order_id', code='invalid-format', detail='must be digits'
    )
    raise ValidationError(errors=[failure]) from LookupError(order_id)

  return server


@pytest.fixture
def events() -> list[ErrorEvent]:
  return []


@pytest.fixture
def server(events: list[ErrorEvent]) -> OrdersServer:
  return build_server(ErrorMiddleware(on_error=events.append, get_trace_id=trace_id_of))


async def test_should_return_an_expected_error_as_the_tools_result(server: OrdersServer) -> None:
  # Arrange
  async with Client(server) as client:
    # Act
    result = await client.call_tool('find_order', {'order_id': 42}, raise_on_error=False)

  # Assert
  assert (result.is_error, result.structured_content, result.content) == (
    True,
    {
      'type': 'about:blank',
      'title': 'Not Found',
      'status': 404,
      'detail': 'Order 42 not found.',
      'code': 'orders/order/not-found',
      'isRetryable': False,
      'traceId': '4bf92f35',
    },
    [
      TextContent(
        type='text',
        text=(
          '{"type": "about:blank", "title": "Not Found", "status": 404,'
          ' "detail": "Order 42 not found.", "code": "orders/order/not-found",'
          ' "isRetryable": false, "traceId": "4bf92f35"}'
        ),
      ),
    ],
  )


async def test_should_hand_the_hook_each_error_once(
  server: OrdersServer, events: list[ErrorEvent]
) -> None:
  # Arrange
  async with Client(server) as client:
    # Act
    await client.call_tool('find_order', {'order_id': 42}, raise_on_error=False)

  # Assert
  assert (len(events), repr(events[0].error)) == (1, "OrderNotFoundError('Order 42 not found.')")


@pytest.mark.parametrize(
  ('arguments', 'expected'),
  [
    pytest.param(
      {'order_id': 'forty-two'},
      {
        'type': 'about:blank',
        'title': 'Bad Request',
        'status': 400,
        'detail': 'Validation failed.',
        'code': 'validation',
        'isRetryable': False,
        'errors': [
          {
            'pointer': '#/order_id',
            'code': 'int-parsing',
            'detail': 'Input should be a valid integer, unable to parse string as an integer',
          },
        ],
        'traceId': '4bf92f35',
      },
      id='should point at an argument of the wrong type',
    ),
    pytest.param(
      {},
      {
        'type': 'about:blank',
        'title': 'Bad Request',
        'status': 400,
        'detail': 'Validation failed.',
        'code': 'validation',
        'isRetryable': False,
        'errors': [
          {
            'pointer': '#/order_id',
            'code': 'missing-argument',
            'detail': 'Missing required argument',
          },
        ],
        'traceId': '4bf92f35',
      },
      id='should point at a missing argument',
    ),
  ],
)
async def test_should_return_a_validation_problem_when_the_arguments_fail(
  server: OrdersServer, arguments: dict[str, object], expected: dict[str, object]
) -> None:
  # Arrange
  async with Client(server) as client:
    # Act
    result = await client.call_tool('find_order', arguments, raise_on_error=False)

  # Assert
  assert (result.is_error, result.structured_content) == (True, expected)


async def test_should_keep_the_rejected_arguments_out_of_the_record_of_a_validation(
  server: OrdersServer, events: list[ErrorEvent]
) -> None:
  # Arrange
  async with Client(server) as client:
    # Act
    await client.call_tool('find_order', {'order_id': 'forty-two'}, raise_on_error=False)

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
          'pointer': '#/order_id',
          'code': 'int-parsing',
          'detail': 'Input should be a valid integer, unable to parse string as an integer',
        },
      ],
    },
    'cause': {
      'name': 'ValidationError',
      'message': (
        "[{'type': 'int_parsing', 'loc': ('order_id',),"
        " 'msg': 'Input should be a valid integer, unable to parse string as an integer'}]"
      ),
    },
  }


@pytest.mark.parametrize(
  'tool',
  [
    pytest.param('broken', id='should mask an error a tool raised'),
    pytest.param('refuse', id='should mask a ToolError, which is not of eros either'),
    pytest.param(
      'check',
      id="should mask an error of the arguments when the tool's own code raised it",
    ),
    pytest.param(
      'answer_in_json_rpc',
      id='should mask a JSON-RPC error a tool raised, which fastmcp wraps too',
    ),
  ],
)
async def test_should_answer_an_unexpected_error_with_a_masked_json_rpc_error(
  server: OrdersServer, tool: str
) -> None:
  # Arrange
  async with Client(server) as client:
    # Act
    act = partial(client.call_tool, tool, {}, raise_on_error=False)

    # Assert
    with pytest.raises(MCPError) as raised:
      await act()
    assert raised.value.error == ErrorData(
      code=-32603, message='An unexpected error occurred.', data=MASKED
    )


async def test_should_hand_the_hook_the_error_under_fastmcps_wrapper_as_an_unexpected_one(
  server: OrdersServer, events: list[ErrorEvent]
) -> None:
  # Arrange
  async with Client(server) as client:
    # Act
    with suppress(MCPError):
      await client.call_tool('broken', {}, raise_on_error=False)

  # Assert
  assert (repr(events[0].error), repr(events[0].error.__cause__)) == (
    "UnexpectedError('An unexpected error occurred.')",
    "RuntimeError('password=hunter2')",
  )


async def test_should_keep_fastmcps_answer_to_an_unknown_tool(server: OrdersServer) -> None:
  # Arrange
  async with Client(server) as client:
    # Act
    result = await client.call_tool('unknown', {}, raise_on_error=False)

  # Assert
  assert (result.is_error, result.structured_content, result.content) == (
    True,
    None,
    [TextContent(type='text', text="Unknown tool: 'unknown'")],
  )


async def test_should_hand_the_hook_nothing_when_fastmcp_answers_an_unknown_tool(
  server: OrdersServer, events: list[ErrorEvent]
) -> None:
  # Arrange
  async with Client(server) as client:
    # Act
    await client.call_tool('unknown', {}, raise_on_error=False)

  # Assert
  assert events == []


async def test_should_answer_a_resources_expected_error_as_an_invalid_request(
  server: OrdersServer,
) -> None:
  # Arrange
  async with Client(server) as client:
    # Act
    act = partial(client.read_resource, 'orders://42')

    # Assert
    with pytest.raises(MCPError) as raised:
      await act()
    assert raised.value.error == ErrorData(
      code=-32600,
      message='Order 42 not found.',
      data={
        'type': 'about:blank',
        'title': 'Not Found',
        'status': 404,
        'detail': 'Order 42 not found.',
        'code': 'orders/order/not-found',
        'isRetryable': False,
        'traceId': '4bf92f35',
      },
    )


async def test_should_mask_a_resources_unexpected_error(server: OrdersServer) -> None:
  # Arrange
  async with Client(server) as client:
    # Act
    act = partial(client.read_resource, 'reports://broken')

    # Assert
    with pytest.raises(MCPError) as raised:
      await act()
    assert raised.value.error == ErrorData(
      code=-32603, message='An unexpected error occurred.', data=MASKED
    )


async def test_should_answer_a_prompts_validation_error_as_invalid_params(
  server: OrdersServer,
) -> None:
  # Arrange
  async with Client(server) as client:
    # Act
    act = partial(client.get_prompt, 'summarise', {'order_id': 'forty-two'})

    # Assert
    with pytest.raises(MCPError) as raised:
      await act()
    assert raised.value.error == ErrorData(
      code=-32602,
      message='Validation failed.',
      data={
        'type': 'about:blank',
        'title': 'Bad Request',
        'status': 400,
        'detail': 'Validation failed.',
        'code': 'validation',
        'isRetryable': False,
        'errors': [
          {'pointer': '#/order_id', 'code': 'invalid-format', 'detail': 'must be digits'},
        ],
        'traceId': '4bf92f35',
      },
    )


async def test_should_answer_without_a_trace_or_a_type_base(events: list[ErrorEvent]) -> None:
  # Arrange
  async with Client(build_server(ErrorMiddleware(on_error=events.append))) as client:
    # Act
    result = await client.call_tool('find_order', {'order_id': 42}, raise_on_error=False)

  # Assert
  assert result.structured_content == {
    'type': 'about:blank',
    'title': 'Not Found',
    'status': 404,
    'detail': 'Order 42 not found.',
    'code': 'orders/order/not-found',
    'isRetryable': False,
  }


async def test_should_type_the_problem_by_its_code_when_it_is_given_a_type_base(
  events: list[ErrorEvent],
) -> None:
  # Arrange
  middleware = ErrorMiddleware(on_error=events.append, type_base='https://errors.example.com')
  async with Client(build_server(middleware)) as client:
    # Act
    result = await client.call_tool('find_order', {'order_id': 42}, raise_on_error=False)

  # Assert
  assert result.structured_content == {
    'type': 'https://errors.example.com/orders/order/not-found',
    'title': 'Not Found',
    'status': 404,
    'detail': 'Order 42 not found.',
    'code': 'orders/order/not-found',
    'isRetryable': False,
  }
