import { describe, expect, expectTypeOf, test } from 'bun:test';

import { codedRows, rejectedRows } from '../../__tests__/cases.fixtures';
import { createDescriptorBuilder } from '../../__tests__/descriptors.fixtures';
import { codeOf, thrownBy } from '../../__tests__/outcomes.fixtures';
import { ErrorKind } from '../../constants';
import { ConflictError } from '../conflict.error';
import type { ErosError } from '../eros.error';
import type { ExpectedError } from '../expected.error';
import { ExpiredError } from '../expired.error';
import { ForbiddenError } from '../forbidden.error';
import { NotFoundError } from '../not-found.error';
import { PayloadTooLargeError } from '../payload-too-large.error';
import { RateLimitedError } from '../rate-limited.error';
import { TimeoutError } from '../timeout.error';
import { UnauthorizedError } from '../unauthorized.error';
import { UnavailableError } from '../unavailable.error';
import { UnexpectedError } from '../unexpected.error';
import { ValidationError } from '../validation.error';
import { ViolationError } from '../violation.error';

class OrderAlreadyPaidError extends ViolationError {
  public constructor() {
    super({
      meta: {
        module: 'orders',
        entity: 'order',
        reason: 'already-paid',
      },
    });
  }
}

const errorsOfKinds: readonly (readonly [
  ErrorKind,
  ErosError,
  string,
])[] = [
  [
    ErrorKind.Validation,
    new ValidationError(),
    'ValidationError',
  ],
  [
    ErrorKind.Unauthorized,
    new UnauthorizedError(),
    'UnauthorizedError',
  ],
  [
    ErrorKind.Forbidden,
    new ForbiddenError(),
    'ForbiddenError',
  ],
  [
    ErrorKind.NotFound,
    new NotFoundError(),
    'NotFoundError',
  ],
  [
    ErrorKind.Conflict,
    new ConflictError(),
    'ConflictError',
  ],
  [
    ErrorKind.Expired,
    new ExpiredError(),
    'ExpiredError',
  ],
  [
    ErrorKind.PayloadTooLarge,
    new PayloadTooLargeError(),
    'PayloadTooLargeError',
  ],
  [
    ErrorKind.Violation,
    new ViolationError(),
    'ViolationError',
  ],
  [
    ErrorKind.RateLimited,
    new RateLimitedError(),
    'RateLimitedError',
  ],
  [
    ErrorKind.Unavailable,
    new UnavailableError(),
    'UnavailableError',
  ],
  [
    ErrorKind.Timeout,
    new TimeoutError(),
    'TimeoutError',
  ],
  [
    ErrorKind.Internal,
    new UnexpectedError(),
    'UnexpectedError',
  ],
];

describe('ErosError', () => {
  test.each(errorsOfKinds)(
    'should be named after the class of its kind when the kind is %s',
    (_kind, error, className) => {
      // Arrange
      // Act
      const { name } = error;

      // Assert
      expect(name).toBe(className);
    },
  );

  test('should be named after its class when a feature declares one', () => {
    // Arrange
    const error = new OrderAlreadyPaidError();

    // Act
    const { name } = error;

    // Assert
    expect(name).toBe('OrderAlreadyPaidError');
  });

  test('should keep what it is given when it is created with every option', () => {
    // Arrange
    const cause = new Error('Connection reset.');
    const retryAfter = Temporal.Duration.from({
      seconds: 5,
    });

    // Act
    const error: ErosError = new UnavailableError({
      message: 'Payments are unavailable.',
      cause,
      meta: {
        module: 'payments',
        entity: 'gateway',
      },
      details: {
        gateway: 'stripe',
      },
      isRetryable: false,
      retryAfter,
    });

    // Assert
    expect({
      message: error.message,
      cause: error.cause,
      meta: error.meta,
      details: error.details,
      isRetryable: error.isRetryable,
      retryAfter: error.retryAfter,
    }).toStrictEqual({
      message: 'Payments are unavailable.',
      cause,
      meta: {
        module: 'payments',
        entity: 'gateway',
      },
      details: {
        gateway: 'stripe',
      },
      isRetryable: false,
      retryAfter,
    });
  });

  test('should hold no cause when it is created without one', () => {
    // Arrange
    const error = new NotFoundError();

    // Act
    const hasCause = Object.hasOwn(error, 'cause');

    // Assert
    expect(hasCause).toBe(false);
  });

  test('should hold an empty list of errors when a ValidationError is created without any', () => {
    // Arrange
    // Act
    const { details } = new ValidationError();

    // Assert
    expect(details).toStrictEqual({
      errors: [],
    });
  });

  test('should take a retry delay of zero when the error sets zero', () => {
    // Arrange
    const retryAfter = Temporal.Duration.from({
      seconds: 0,
    });

    // Act
    const error = new RateLimitedError({
      retryAfter,
    });

    // Assert
    expect(error.retryAfter).toBe(retryAfter);
  });

  test('should keep every word of a segment when it holds several hyphens', () => {
    // Arrange
    // Act
    const { code } = new ViolationError({
      meta: {
        module: 'billing-v2',
        entity: 'credit-note-line',
        reason: 'paid-in-full',
      },
    });

    // Assert
    expect(code).toBe('billing-v2/credit-note-line/violation/paid-in-full');
  });

  test('should name the segment it refuses when a segment is not in lower kebab case', () => {
    // Arrange
    // Act
    // The act gives the code, never the error: Bun's toThrow also passes when an act returns an error.
    const act = (): string =>
      new NotFoundError({
        meta: {
          module: 'Orders',
          entity: 'order',
        },
      }).code;

    // Assert
    expect(act).toThrow(new TypeError('A segment of a code is in lower kebab case: "Orders"'));
  });

  test('should say the module and the entity come together when meta has only one of them', () => {
    // Arrange
    const meta = {
      module: 'orders',
    };

    // Act
    const act = (): string =>
      new NotFoundError({
        // @ts-expect-error: the types refuse a module without an entity, so the case reaches the check that throws only past them
        meta,
      }).code;

    // Assert
    expect(act).toThrow(
      new TypeError('The module and the entity of a code come together or not at all'),
    );
  });

  test('should name the delay it refuses when the retry delay is negative', () => {
    // Arrange
    const retryAfter = Temporal.Duration.from({
      seconds: -1,
    });

    // Act
    const act = (): string =>
      new UnavailableError({
        retryAfter,
      }).code;

    // Assert
    expect(act).toThrow(new RangeError('A retry delay is not negative: -PT1S'));
  });

  test('should name the pointer it refuses when a failure is not located by a JSON Pointer', () => {
    // Arrange
    const errors = [
      {
        pointer: '/email',
        code: 'required',
        detail: 'is required',
      },
    ];

    // Act
    const act = (): string =>
      new ValidationError({
        errors,
      }).code;

    // Assert
    expect(act).toThrow(
      new TypeError('A failure\'s pointer is a JSON Pointer in URI fragment form: "/email"'),
    );
  });

  test.each(codedRows)('should %s', (_name, { input, expected }) => {
    // Arrange
    const builder = createDescriptorBuilder();
    const error = builder.buildError(input);

    // Act
    const code = codeOf(error);

    // Assert
    expect<unknown>({
      code,
    }).toStrictEqual(expected);
  });

  test.each(rejectedRows)('should %s', (_name, input, refusal) => {
    // Arrange
    const builder = createDescriptorBuilder();

    // Act
    const thrown = thrownBy(() => builder.buildError(input));

    // Assert
    expect(thrown).toStrictEqual(refusal);
  });
});

describe('ExpectedError', () => {
  test('should refuse the internal kind when a subclass passes it', () => {
    // Arrange
    const kind = ErrorKind.Internal;

    // Act
    const checked = expectTypeOf(kind);

    // Assert
    // @ts-expect-error: a subclass passes ExpectedError any kind but internal, so the type check fails if it takes this one
    checked.toExtend<ConstructorParameters<typeof ExpectedError>[0]>();
  });
});
