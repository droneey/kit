import { describe, expect, test } from 'bun:test';

import { recordRows } from '../../__tests__/cases.fixtures';
import { createDescriptorBuilder } from '../../__tests__/descriptors.fixtures';
import { thrownBy, withoutStacks } from '../../__tests__/outcomes.fixtures';
import { UnexpectedError } from '../../errors';
import { toRecord } from '../record.utils';

const stacklessError = (message: string, cause?: unknown): Error => {
  const error = new Error(
    message,
    cause === undefined
      ? undefined
      : {
          cause,
        },
  );

  Object.defineProperty(error, 'stack', {
    value: undefined,
  });

  return error;
};

const cyclicError = (): Error => {
  const outer = stacklessError('Outer.');
  const inner = stacklessError('Inner.', outer);

  outer.cause = inner;

  return outer;
};

describe('toRecord', () => {
  test.each([
    [
      'a string',
      'boom',
      {
        name: 'string',
        message: '"boom"',
      },
    ],
    [
      'an object',
      {
        reason: 'boom',
      },
      {
        name: 'object',
        message: '{"reason":"boom"}',
      },
    ],
    [
      'undefined, which has no JSON',
      undefined,
      {
        name: 'undefined',
        message: 'undefined',
      },
    ],
    [
      'a bigint, which JSON refuses',
      BigInt(42),
      {
        name: 'bigint',
        message: '42',
      },
    ],
  ])(
    'should name the value by its type when the thrown value is %s',
    (_condition, thrown, record) => {
      // Arrange
      // Act
      const recorded = toRecord(thrown);

      // Assert
      expect(recorded).toStrictEqual(record);
    },
  );

  test('should end the chain where it would repeat when a cause loops back', () => {
    // Arrange
    const error = cyclicError();

    // Act
    const record = toRecord(error);

    // Assert
    expect(record).toStrictEqual({
      name: 'Error',
      message: 'Outer.',
      cause: {
        name: 'Error',
        message: 'Inner.',
      },
    });
  });

  test('should leave the cause out when an error is its own cause', () => {
    // Arrange
    const error = stacklessError('Itself.');

    error.cause = error;

    // Act
    const record = toRecord(error);

    // Assert
    expect(record).toStrictEqual({
      name: 'Error',
      message: 'Itself.',
    });
  });

  test('should record the value an unexpected error wraps when it is not an error', () => {
    // Arrange
    const error = new UnexpectedError({
      cause: 'boom',
    });

    // Act
    const { cause } = toRecord(error);

    // Assert
    expect(cause).toStrictEqual({
      name: 'string',
      message: '"boom"',
    });
  });

  test('should rethrow what writing the value throws when it is not a TypeError', () => {
    // Arrange
    const failure = new RangeError('The amount cannot be read.');
    const thrown = {
      get amount(): never {
        throw failure;
      },
    };

    // Act
    const rethrown = thrownBy(() => toRecord(thrown));

    // Assert
    expect(rethrown).toBe(failure);
  });

  test.each(recordRows)('should %s', (_name, { input, expected }) => {
    // Arrange
    const builder = createDescriptorBuilder();
    const error = builder.buildError(input);

    // Act
    const record = toRecord(error);

    // Assert
    expect(withoutStacks(record)).toStrictEqual({
      hasOnlyStringStacks: true,
      record: expected,
    });
  });
});
