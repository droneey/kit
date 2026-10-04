import { describe, expect, test } from 'bun:test';

import type { ErosError } from '@droneey/eros';
import { NotFoundError, UnexpectedError, ValidationError, ViolationError } from '@droneey/eros';

import parseFixtures from '../../../../../common/fixtures/parse.json' with { type: 'json' };
import type { Case, FixtureFile } from '../../__tests__/cases.fixtures';
import { rowsOf } from '../../__tests__/cases.fixtures';
import { kindOf } from '../../__tests__/descriptors.fixtures';
import type { FetchResponse } from '../parse-problem.utils';
import { parseProblem, parseProblemResponse } from '../parse-problem.utils';

type ParseCase = Case<
  {
    readonly body: unknown;
    readonly status: number;
  },
  unknown
>;

const parses: FixtureFile<ParseCase> = parseFixtures;

const notFoundBody = {
  type: 'about:blank',
  title: 'Not Found',
  status: 404,
  detail: 'Order 42 not found.',
  code: 'orders/order/not-found',
  isRetryable: false,
};

/** What parse.json compares: the kind by class, and the retry delay in seconds. */
const summaryOfParsed = (error: ErosError): unknown => ({
  kind: kindOf(error),
  code: error.code,
  message: error.message,
  isRetryable: error.isRetryable,
  ...(error.details === undefined
    ? {}
    : {
        details: error.details,
      }),
  ...(error.retryAfter === undefined
    ? {}
    : {
        retryAfterSeconds: error.retryAfter.total({
          unit: 'seconds',
        }),
      }),
});

/** A response whose body cannot be read: its read rejects with the failure given. */
const unreadableResponse = (
  failure: Error,
  overrides: Partial<FetchResponse> = {},
): FetchResponse => ({
  status: 502,
  text: () => Promise.reject(failure),
  ...overrides,
});

describe('parseProblemResponse', () => {
  test('should parse the JSON body when the response holds a problem', async () => {
    // Arrange
    const response = new Response(JSON.stringify(notFoundBody), {
      status: 404,
    });

    // Act
    const error = await parseProblemResponse(response);

    // Assert
    expect({
      isNotFound: error instanceof NotFoundError,
      code: error.code,
      message: error.message,
    }).toStrictEqual({
      isNotFound: true,
      code: 'orders/order/not-found',
      message: 'Order 42 not found.',
    });
  });

  test('should keep the text as the body when the response is not JSON', async () => {
    // Arrange
    const response = new Response('<html>Bad Gateway</html>', {
      status: 502,
    });

    // Act
    const error = await parseProblemResponse(response);

    // Assert
    expect(error.details).toStrictEqual({
      status: 502,
      body: '<html>Bad Gateway</html>',
    });
  });

  test('should give an UnexpectedError with the status and the failure as its cause when the body cannot be read', async () => {
    // Arrange
    const failure = new TypeError('Body already used');
    const response = unreadableResponse(failure);

    // Act
    const error = await parseProblemResponse(response);

    // Assert
    expect({
      isUnexpected: error instanceof UnexpectedError,
      message: error.message,
      details: error.details,
      cause: error.cause,
    }).toStrictEqual({
      isUnexpected: true,
      message: 'Unreadable response with status 502.',
      details: {
        status: 502,
      },
      cause: failure,
    });
  });
});

describe('parseProblem', () => {
  test.each(rowsOf(parses))('should %s', (_name, { input, expected }) => {
    // Arrange
    const { status, body } = input;

    // Act
    const error = parseProblem(status, body);

    // Assert
    expect(summaryOfParsed(error)).toStrictEqual(expected);
  });

  test.each([
    [
      'a status of the kinds',
      404,
      'NotFoundError',
    ],
    [
      'a 4xx status outside the kinds',
      418,
      'ViolationError',
    ],
  ])(
    'should name the error after the class of its kind when it parses %s',
    (_condition, status, name) => {
      // Arrange
      // Act
      const error = parseProblem(status, notFoundBody);

      // Assert
      expect(error.name).toBe(name);
    },
  );

  test.each([
    [
      'the status is a success',
      200,
      notFoundBody,
    ],
    [
      'the status is a redirect',
      302,
      notFoundBody,
    ],
    [
      'the code is empty',
      404,
      {
        ...notFoundBody,
        code: '',
      },
    ],
    [
      'the code is not text',
      404,
      {
        ...notFoundBody,
        code: 42,
      },
    ],
    [
      'the detail is not text',
      404,
      {
        ...notFoundBody,
        detail: 42,
      },
    ],
  ])('should give an UnexpectedError when %s', (_condition, status, body) => {
    // Arrange
    // Act
    const error = parseProblem(status, body);

    // Assert
    expect({
      isUnexpected: error instanceof UnexpectedError,
      details: error.details,
    }).toStrictEqual({
      isUnexpected: true,
      details: {
        status,
        body,
      },
    });
  });

  test.each([
    [
      'it is not a whole number',
      1.5,
    ],
    [
      'it is negative',
      -1,
    ],
    [
      'it is text',
      '30',
    ],
  ])('should leave the retry delay out when %s', (_condition, retryAfterSeconds) => {
    // Arrange
    const body = {
      ...notFoundBody,
      retryAfterSeconds,
    };

    // Act
    const { retryAfter } = parseProblem(429, body);

    // Assert
    expect(retryAfter).toBeUndefined();
  });

  test('should keep a retry delay of zero when the body sets zero', () => {
    // Arrange
    const body = {
      ...notFoundBody,
      retryAfterSeconds: 0,
    };

    // Act
    const { retryAfter } = parseProblem(429, body);

    // Assert
    expect(
      retryAfter?.total({
        unit: 'seconds',
      }),
    ).toBe(0);
  });

  test.each([
    [
      'the body has no errors',
      undefined,
      [],
    ],
    [
      'the errors are not a list',
      'invalid',
      [],
    ],
    [
      'some errors lack a member',
      [
        {
          pointer: '#/email',
          code: 'required',
          detail: 'is required',
        },
        {
          pointer: '#/name',
          code: 'required',
        },
        {
          code: 'required',
          detail: 'is required',
        },
        {
          pointer: '#/age',
          detail: 'is required',
        },
        {
          pointer: 'email',
          code: 'required',
          detail: 'is required',
        },
        {
          pointer: 7,
          code: 'required',
          detail: 'is required',
        },
        {
          pointer: '#/age',
          code: 7,
          detail: 'is required',
        },
        {
          pointer: '#/age',
          code: 'required',
          detail: 7,
        },
        'required',
        undefined,
      ],
      [
        {
          pointer: '#/email',
          code: 'required',
          detail: 'is required',
        },
      ],
    ],
  ])('should keep only the well-formed errors when %s', (_condition, errors, kept) => {
    // Arrange
    const body = {
      detail: 'Validation failed.',
      code: 'validation',
      errors,
    };

    // Act
    const error = parseProblem(400, body);

    // Assert
    expect({
      isValidation: error instanceof ValidationError,
      details: error.details,
    }).toStrictEqual({
      isValidation: true,
      details: {
        errors: kept,
      },
    });
  });

  test('should ignore errors in the body when the kind is not Validation', () => {
    // Arrange
    const body = {
      ...notFoundBody,
      errors: [
        {
          pointer: '#/email',
          code: 'required',
          detail: 'is required',
        },
      ],
    };

    // Act
    const { details } = parseProblem(422, body);

    // Assert
    expect(details).toBeUndefined();
  });

  test('should ignore an isRetryable that is not a boolean', () => {
    // Arrange
    const body = {
      ...notFoundBody,
      isRetryable: 'yes',
    };

    // Act
    const error = parseProblem(503, body);

    // Assert
    expect({
      isRetryable: error.isRetryable,
      isViolation: error instanceof ViolationError,
    }).toStrictEqual({
      isRetryable: true,
      isViolation: false,
    });
  });

  test('should keep the detail as the message when the status is 500', () => {
    // Arrange
    const body = {
      detail: 'The database is down.',
      code: 'internal',
    };

    // Act
    const error = parseProblem(500, body);

    // Assert
    expect({
      isUnexpected: error instanceof UnexpectedError,
      message: error.message,
    }).toStrictEqual({
      isUnexpected: true,
      message: 'The database is down.',
    });
  });
});
