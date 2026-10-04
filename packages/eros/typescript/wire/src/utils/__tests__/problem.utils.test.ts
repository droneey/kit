import { describe, expect, test } from 'bun:test';

import problemFixtures from '../../../../../common/fixtures/problem.json' with { type: 'json' };
import type { Case, FixtureFile } from '../../__tests__/cases.fixtures';
import { rowsOf } from '../../__tests__/cases.fixtures';
import type { Descriptor } from '../../__tests__/descriptors.fixtures';
import { buildError } from '../../__tests__/descriptors.fixtures';
import type { ToProblemInput } from '../problem.utils';
import { toProblem } from '../problem.utils';

type ProblemCase = Case<
  {
    readonly error: Descriptor;
    readonly traceId?: string;
    readonly typeBase?: string;
  },
  unknown
>;

const problems: FixtureFile<ProblemCase> = problemFixtures;

const problemInputOf = ({ traceId, typeBase }: ProblemCase['input']): ToProblemInput => ({
  ...(traceId === undefined
    ? {}
    : {
        traceId,
      }),
  ...(typeBase === undefined
    ? {}
    : {
        typeBase,
      }),
});

describe('toProblem', () => {
  test.each(rowsOf(problems))('should %s', (_name, { input, expected }) => {
    // Arrange
    const error = buildError(input.error);

    // Act
    const problem = toProblem(error, problemInputOf(input));

    // Assert
    expect<unknown>(problem).toStrictEqual(expected);
  });
});
