import { describe, expect, test } from 'bun:test';

import type { ErosError } from '@droneey/eros';
import { ErrorKind, NotFoundError } from '@droneey/eros';
import { HttpException, NotFoundException } from '@nestjs/common';

import { NEST_HTTP_EXCEPTION_KINDS } from '../../constants';
import { toErosError } from '../exception.utils';

interface Translation {
  readonly cause: unknown;
  readonly code: string;
  readonly kind: ErrorKind;
  readonly message: string;
  readonly name: string;
}

const translationOf = (error: ErosError): Translation => ({
  name: error.name,
  kind: error.kind,
  code: error.code,
  message: error.message,
  cause: error.cause,
});

describe('toErosError', () => {
  test.each([
    {
      status: 400,
      kind: ErrorKind.Validation,
      code: 'validation',
      name: 'ValidationError',
      message: 'Validation failed.',
    },
    {
      status: 401,
      kind: ErrorKind.Unauthorized,
      code: 'unauthorized',
      name: 'UnauthorizedError',
      message: 'Authentication is required.',
    },
    {
      status: 403,
      kind: ErrorKind.Forbidden,
      code: 'forbidden',
      name: 'ForbiddenError',
      message: 'Access is forbidden.',
    },
    {
      status: 404,
      kind: ErrorKind.NotFound,
      code: 'not-found',
      name: 'NotFoundError',
      message: 'Resource not found.',
    },
    {
      status: 409,
      kind: ErrorKind.Conflict,
      code: 'conflict',
      name: 'ConflictError',
      message: 'Resource conflict.',
    },
    {
      status: 410,
      kind: ErrorKind.Expired,
      code: 'expired',
      name: 'ExpiredError',
      message: 'Resource expired.',
    },
    {
      status: 413,
      kind: ErrorKind.PayloadTooLarge,
      code: 'payload-too-large',
      name: 'PayloadTooLargeError',
      message: 'Payload is too large.',
    },
    {
      status: 422,
      kind: ErrorKind.Violation,
      code: 'violation',
      name: 'ViolationError',
      message: 'A business rule was violated.',
    },
    {
      status: 429,
      kind: ErrorKind.RateLimited,
      code: 'rate-limited',
      name: 'RateLimitedError',
      message: 'Too many requests.',
    },
    {
      status: 503,
      kind: ErrorKind.Unavailable,
      code: 'unavailable',
      name: 'UnavailableError',
      message: 'Service is unavailable.',
    },
    {
      status: 504,
      kind: ErrorKind.Timeout,
      code: 'timeout',
      name: 'TimeoutError',
      message: 'A dependency did not answer in time.',
    },
    {
      status: 500,
      kind: ErrorKind.Internal,
      code: 'internal',
      name: 'UnexpectedError',
      message: 'An unexpected error occurred.',
    },
  ])(
    'should give a $status exception as an error of $kind with its default text and its bare code when the table holds the status',
    ({ status, kind, code, name, message }) => {
      // Arrange
      const exception = new HttpException('Nest says no.', status);

      // Act
      const error = toErosError(exception, NEST_HTTP_EXCEPTION_KINDS);

      // Assert
      expect(translationOf(error)).toStrictEqual({
        name,
        kind,
        code,
        message,
        cause: exception,
      });
    },
  );

  test.each([
    [
      'no table is given',
      new NotFoundException('Cannot GET /orders'),
      undefined,
    ],
    [
      'the table does not hold the status',
      new HttpException('I am a teapot.', 418),
      NEST_HTTP_EXCEPTION_KINDS,
    ],
    [
      'the exception is not of Nest',
      new TypeError('order.items is undefined'),
      NEST_HTTP_EXCEPTION_KINDS,
    ],
    [
      'the thrown value is not an error',
      'boom',
      NEST_HTTP_EXCEPTION_KINDS,
    ],
  ])(
    'should wrap what was thrown in an UnexpectedError when %s',
    (_condition, thrown, httpExceptions) => {
      // Arrange
      // Act
      const error = toErosError(thrown, httpExceptions);

      // Assert
      expect(translationOf(error)).toStrictEqual({
        name: 'UnexpectedError',
        kind: ErrorKind.Internal,
        code: 'internal',
        message: 'An unexpected error occurred.',
        cause: thrown,
      });
    },
  );

  test('should translate only by the table it is given when the table holds some statuses', () => {
    // Arrange
    const exception = new NotFoundException('Cannot GET /orders');
    const httpExceptions = new Map([
      [
        404,
        ErrorKind.Expired,
      ],
    ]);

    // Act
    const error = toErosError(exception, httpExceptions);

    // Assert
    expect(translationOf(error)).toStrictEqual({
      name: 'ExpiredError',
      kind: ErrorKind.Expired,
      code: 'expired',
      message: 'Resource expired.',
      cause: exception,
    });
  });

  test('should give back an error of eros as it is when it is thrown', () => {
    // Arrange
    const thrown = new NotFoundError();

    // Act
    const error = toErosError(thrown, NEST_HTTP_EXCEPTION_KINDS);

    // Assert
    expect(error).toBe(thrown);
  });
});
