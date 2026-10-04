import { describe, expect, test } from 'bun:test';

import { ValidationError as ClassValidatorError } from 'class-validator';

import { toValidationFailures } from '../validation.utils';

const failureOf = (fields: Partial<ClassValidatorError>): ClassValidatorError =>
  Object.assign(new ClassValidatorError(), fields);

describe('toValidationFailures', () => {
  test('should escape a tilde and a slash in a member name as RFC 6901 does', () => {
    // Arrange
    const errors = [
      failureOf({
        property: 'size~/unit',
        constraints: {
          isString: 'size must be a string',
        },
      }),
    ];

    // Act
    const failures = toValidationFailures(errors);

    // Assert
    expect(failures).toStrictEqual([
      {
        pointer: '#/size~0~1unit',
        code: 'invalid-format',
        detail: 'size must be a string',
      },
    ]);
  });

  test('should take the first message when a member breaks several constraints', () => {
    // Arrange
    const errors = [
      failureOf({
        property: 'name',
        constraints: {
          isString: 'name must be a string',
          isNotEmpty: 'name should not be empty',
        },
      }),
    ];

    // Act
    const failures = toValidationFailures(errors);

    // Assert
    expect(failures).toStrictEqual([
      {
        pointer: '#/name',
        code: 'invalid-format',
        detail: 'name must be a string',
      },
    ]);
  });

  test('should list the failures of the children under their parent when the parent breaks none itself', () => {
    // Arrange
    const errors = [
      failureOf({
        property: 'items',
        children: [
          failureOf({
            property: '0',
            children: [
              failureOf({
                property: 'quantity',
                constraints: {
                  isInt: 'quantity must be an integer number',
                },
              }),
            ],
          }),
        ],
      }),
    ];

    // Act
    const failures = toValidationFailures(errors);

    // Assert
    expect(failures).toStrictEqual([
      {
        pointer: '#/items/0/quantity',
        code: 'invalid-format',
        detail: 'quantity must be an integer number',
      },
    ]);
  });

  test('should list the parent before its children when both fail', () => {
    // Arrange
    const errors = [
      failureOf({
        property: 'address',
        constraints: {
          isDefined: 'address should be defined',
        },
        children: [
          failureOf({
            property: 'city',
            constraints: {
              isString: 'city must be a string',
            },
          }),
        ],
      }),
    ];

    // Act
    const failures = toValidationFailures(errors);

    // Assert
    expect(failures).toStrictEqual([
      {
        pointer: '#/address',
        code: 'invalid-format',
        detail: 'address should be defined',
      },
      {
        pointer: '#/address/city',
        code: 'invalid-format',
        detail: 'city must be a string',
      },
    ]);
  });
});
