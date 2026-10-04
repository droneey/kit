import { describe, expect, test } from 'bun:test';

import { recoverFrom } from '../recover.utils';

describe('recoverFrom', () => {
  test('should give what the attempt returns when it does not throw', () => {
    // Arrange
    const attempt = (): string => 'parsed';

    // Act
    const returned = recoverFrom(SyntaxError, attempt, () => 'recovered');

    // Assert
    expect(returned).toBe('parsed');
  });

  test('should give what the recovery makes of the failure when the attempt throws one of its class', () => {
    // Arrange
    const attempt = (): string => {
      throw new SyntaxError('Unexpected token');
    };

    // Act
    const recovered = recoverFrom(SyntaxError, attempt, (failure) => failure.message);

    // Assert
    expect(recovered).toBe('Unexpected token');
  });

  test('should rethrow the failure when the attempt throws one of another class', () => {
    // Arrange
    const failure = new RangeError('Too deep');
    const attempt = (): string => {
      throw failure;
    };

    // Act
    const act = (): string => recoverFrom(SyntaxError, attempt, () => 'recovered');

    // Assert
    expect(act).toThrow(failure);
  });
});
