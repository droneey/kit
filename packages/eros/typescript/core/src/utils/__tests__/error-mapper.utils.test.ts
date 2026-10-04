import { describe, expect, test } from 'bun:test';

import { newErrorRows, rethrownRows } from '../../__tests__/cases.fixtures';
import { buildMapper, createDescriptorBuilder } from '../../__tests__/descriptors.fixtures';
import { summaryOfThrown, thrownBy } from '../../__tests__/outcomes.fixtures';
import { ValidationError } from '../../errors';
import { createErrorMapper, ErrorMapperMode } from '../error-mapper.utils';
import { prefixValidationFields } from '../pointer.utils';

describe('createErrorMapper', () => {
  test('should keep the message of a Validation when it remaps its pointers', () => {
    // Arrange
    const mapper = createErrorMapper({
      mode: ErrorMapperMode.Transparent,
      validationMapper: prefixValidationFields('#/outer'),
    });
    const error = new ValidationError({
      message: 'The order is invalid.',
    });

    // Act
    const thrown = thrownBy(() => mapper(error));

    // Assert
    expect(thrown).toStrictEqual(
      new ValidationError({
        message: 'The order is invalid.',
        cause: error,
      }),
    );
  });

  test.each(rethrownRows)('should %s', (_name, { input }) => {
    // Arrange
    const builder = createDescriptorBuilder();
    const mapper = buildMapper(builder, input.mapper);
    const error = builder.buildError(input.error);

    // Act
    const thrown = thrownBy(() => mapper(error));

    // Assert
    expect(thrown).toBe(error);
  });

  test.each(newErrorRows)('should %s', (_name, input, expected) => {
    // Arrange
    const builder = createDescriptorBuilder();
    const mapper = buildMapper(builder, input.mapper);
    const error = builder.buildError(input.error);

    // Act
    const thrown = thrownBy(() => mapper(error));

    // Assert
    expect(
      summaryOfThrown({
        thrown,
        input: error,
        expected,
        classOf: builder.classOf,
      }),
    ).toStrictEqual(expected);
  });
});
