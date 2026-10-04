import { describe, expect, test } from 'bun:test';

import { parsedRows, unparsedRows } from '../../__tests__/cases.fixtures';
import { parseCode } from '../parse-code.utils';

describe('parseCode', () => {
  test.each(parsedRows)('should %s', (_name, { input, expected }) => {
    // Arrange
    const { code } = input;

    // Act
    const parts = parseCode(code);

    // Assert
    expect<unknown>(parts).toStrictEqual(expected);
  });

  test.each(unparsedRows)('should %s', (_name, { input }) => {
    // Arrange
    const { code } = input;

    // Act
    const parts = parseCode(code);

    // Assert
    expect(parts).toBeUndefined();
  });
});
