import { describe, expect, test } from 'bun:test';

import { mappedPointerRows, prefixedRows } from '../../__tests__/cases.fixtures';
import { buildRemap } from '../../__tests__/descriptors.fixtures';
import { createValidationMapper, isPointer } from '../pointer.utils';

describe('prefixValidationFields', () => {
  test.each(prefixedRows)('should %s', (_name, { input, expected }) => {
    // Arrange
    const remap = buildRemap(input.remap);

    // Act
    const pointer = remap(input.pointer);

    // Assert
    expect(pointer).toBe(expected);
  });
});

describe('createValidationMapper', () => {
  test.each(mappedPointerRows)('should %s', (_name, { input, expected }) => {
    // Arrange
    const remap = buildRemap(input.remap);

    // Act
    const pointer = remap(input.pointer);

    // Assert
    expect(pointer).toBe(expected);
  });

  test('should call the replacement with the pointer when a string pattern equals it', () => {
    // Arrange
    const remap = createValidationMapper([
      [
        '#/productVariantId',
        (matched, match) => `${matched}/legacy/${match.join(',')}`,
      ],
    ]);

    // Act
    const pointer = remap('#/productVariantId');

    // Assert
    expect(pointer).toBe('#/productVariantId/legacy/#/productVariantId');
  });

  test('should call the replacement with the groups when a regex matches', () => {
    // Arrange
    const remap = createValidationMapper([
      [
        /^#\/items\/(\d+)\/sku$/u,
        (_pointer, match) => `#/items/${match[1] ?? ''}/productVariantSku`,
      ],
    ]);

    // Act
    const pointer = remap('#/items/2/sku');

    // Assert
    expect(pointer).toBe('#/items/2/productVariantSku');
  });

  test('should try the next rule when a string pattern with a replacement function does not match', () => {
    // Arrange
    const remap = createValidationMapper([
      [
        '#/sku',
        (): string => '#/never',
      ],
      [
        '#/quantity',
        '#/amount',
      ],
    ]);

    // Act
    const pointer = remap('#/quantity');

    // Assert
    expect(pointer).toBe('#/amount');
  });
});

describe('isPointer', () => {
  test.each([
    [
      'the root',
      '#',
      true,
    ],
    [
      'a nested member with an escaped tilde and slash',
      '#/a~0b/c~1d/0',
      true,
    ],
    [
      'a path without the hash',
      '/email',
      false,
    ],
    [
      'a member without a slash after the hash',
      '#email',
      false,
    ],
    [
      'a tilde that escapes nothing',
      '#/a~2b',
      false,
    ],
    [
      'a tilde at the end',
      '#/email~',
      false,
    ],
    [
      'a fragment after other text',
      'orders#/email',
      false,
    ],
    [
      'a number',
      7,
      false,
    ],
    [
      'a list whose text would be a pointer',
      [
        '#',
      ],
      false,
    ],
  ])(
    'should tell whether the value is a JSON Pointer when it is %s',
    (_condition, text, isExpected) => {
      // Arrange
      // Act
      const isOfPointer = isPointer(text);

      // Assert
      expect(isOfPointer).toBe(isExpected);
    },
  );
});
