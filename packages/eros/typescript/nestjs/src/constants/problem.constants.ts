import type { SchemaObject } from '@nestjs/swagger';

const PROBLEM_MEDIA_TYPE = 'application/problem+json';

/** The OpenAPI form of `common/spec/problem.schema.json`: its members and what each requires. */
const PROBLEM_SCHEMA: SchemaObject = {
  type: 'object',
  required: [
    'type',
    'title',
    'status',
    'detail',
    'code',
    'isRetryable',
  ],
  properties: {
    type: {
      type: 'string',
    },
    title: {
      type: 'string',
    },
    status: {
      type: 'integer',
    },
    detail: {
      type: 'string',
    },
    code: {
      type: 'string',
    },
    isRetryable: {
      type: 'boolean',
    },
    retryAfterSeconds: {
      type: 'integer',
    },
    traceId: {
      type: 'string',
    },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'pointer',
          'code',
          'detail',
        ],
        properties: {
          pointer: {
            type: 'string',
          },
          code: {
            type: 'string',
          },
          detail: {
            type: 'string',
          },
        },
      },
    },
  },
};

export { PROBLEM_MEDIA_TYPE, PROBLEM_SCHEMA };
