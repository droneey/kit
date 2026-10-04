import { describe, expect, test } from 'bun:test';

import { ErrorKind } from '@droneey/eros';

import { NEST_HTTP_EXCEPTION_KINDS } from '../http-exception-kinds.constants';

describe('NEST_HTTP_EXCEPTION_KINDS', () => {
  test('should give each status of the kinds its kind', () => {
    // Arrange
    // Act
    const kinds = NEST_HTTP_EXCEPTION_KINDS;

    // Assert
    expect(kinds).toStrictEqual(
      new Map([
        [
          400,
          ErrorKind.Validation,
        ],
        [
          401,
          ErrorKind.Unauthorized,
        ],
        [
          403,
          ErrorKind.Forbidden,
        ],
        [
          404,
          ErrorKind.NotFound,
        ],
        [
          409,
          ErrorKind.Conflict,
        ],
        [
          410,
          ErrorKind.Expired,
        ],
        [
          413,
          ErrorKind.PayloadTooLarge,
        ],
        [
          422,
          ErrorKind.Violation,
        ],
        [
          429,
          ErrorKind.RateLimited,
        ],
        [
          503,
          ErrorKind.Unavailable,
        ],
        [
          504,
          ErrorKind.Timeout,
        ],
        [
          500,
          ErrorKind.Internal,
        ],
      ]),
    );
  });
});
