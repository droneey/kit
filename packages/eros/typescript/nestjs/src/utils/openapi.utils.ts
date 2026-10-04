import type { ErosError } from '@droneey/eros';
import type { HttpStatus, Problem } from '@droneey/eros-wire';
import { toProblem } from '@droneey/eros-wire';
import type { SchemaObject } from '@nestjs/swagger';

import { PROBLEM_MEDIA_TYPE, PROBLEM_SCHEMA } from '../constants';

interface ProblemExample {
  readonly summary: string;
  readonly value: Problem;
}

interface ProblemContent {
  readonly examples: Readonly<Record<string, ProblemExample>>;
  readonly schema: SchemaObject;
}

/** One OpenAPI response per status, with an example per code, as `@ApiResponse` takes it. */
interface ErrorResponse {
  readonly content: Readonly<Record<typeof PROBLEM_MEDIA_TYPE, ProblemContent>>;
  readonly description: string;
  readonly status: HttpStatus;
}

const generateErrorResponses = (...errors: readonly ErosError[]): ErrorResponse[] => {
  const responses = new Map<HttpStatus, ErrorResponse>();

  for (const problem of errors.map((error) => toProblem(error))) {
    const examples = responses.get(problem.status)?.content[PROBLEM_MEDIA_TYPE].examples;

    responses.set(problem.status, {
      status: problem.status,
      description: problem.title,
      content: {
        [PROBLEM_MEDIA_TYPE]: {
          schema: PROBLEM_SCHEMA,
          examples: {
            ...examples,
            [problem.code]: {
              summary: problem.detail,
              value: problem,
            },
          },
        },
      },
    });
  }

  return [
    ...responses.values(),
  ];
};

export type { ErrorResponse };
export { generateErrorResponses };
