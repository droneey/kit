import { describe, expect, test } from 'bun:test';

import problemSchema from '../../../../../common/spec/problem.schema.json' with { type: 'json' };
import { PROBLEM_SCHEMA } from '../problem.constants';

interface Members {
  readonly names: readonly string[];
  readonly required: readonly string[] | undefined;
}

const membersOf = (schema: {
  readonly properties?: object;
  readonly required?: readonly string[];
}): Members => ({
  names: Object.keys(schema.properties ?? {}),
  required: schema.required,
});

const errorsSchema = PROBLEM_SCHEMA.properties?.errors ?? {};
const failureSchema =
  'items' in errorsSchema && errorsSchema.items !== undefined ? errorsSchema.items : {};
const failureMembers = '$ref' in failureSchema ? undefined : membersOf(failureSchema);

describe('PROBLEM_SCHEMA', () => {
  test('should name the members of the problem the spec describes, and require the same', () => {
    // Arrange
    // Act
    const members = membersOf(PROBLEM_SCHEMA);

    // Assert
    expect(members).toStrictEqual(membersOf(problemSchema));
  });

  test('should name the members of a validation failure the spec describes, and require the same', () => {
    // Arrange
    // Act
    const members = failureMembers;

    // Assert
    expect(members).toStrictEqual(membersOf(problemSchema.definitions.validationFailure));
  });
});
