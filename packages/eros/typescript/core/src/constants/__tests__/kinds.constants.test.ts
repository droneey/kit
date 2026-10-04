import { describe, expect, test } from 'bun:test';

import kindsFile from '../../../../../common/spec/kinds.yaml';
import { KINDS } from '../kinds.constants';

const kindsSpec: unknown = kindsFile;

const kindsOf = (file: unknown): unknown =>
  typeof file === 'object' && file !== null && 'kinds' in file ? file.kinds : undefined;

describe('KINDS', () => {
  test('should hold every kind of the spec with its class, title, message, retry default and category', () => {
    // Arrange
    const kinds = kindsOf(kindsSpec);

    // Act
    const constants = KINDS;

    // Assert
    expect<unknown>(constants).toStrictEqual(kinds);
  });
});
