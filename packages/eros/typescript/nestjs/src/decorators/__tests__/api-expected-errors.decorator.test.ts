import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { startApp } from '../../__tests__/app.fixtures';
import { DocumentedOrdersController } from './documented-orders-controller.fixtures';

const PROBLEM_SCHEMA = {
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

let app: INestApplication;
let document: OpenAPIObject;

beforeAll(async () => {
  app = await startApp({
    controllers: [
      DocumentedOrdersController,
    ],
    wire: () => undefined,
  });
  document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
});

afterAll(async () => {
  await app.close();
});

describe('ApiExpectedErrors', () => {
  test('should document each problem of the route under its status, as application/problem+json', () => {
    // Arrange
    // Act
    const responses = document.paths['/orders/latest']?.get?.responses;

    // Assert
    expect(responses).toStrictEqual({
      '404': {
        description: 'Not Found',
        content: {
          'application/problem+json': {
            schema: PROBLEM_SCHEMA,
            examples: {
              ['orders/order/not-found']: {
                summary: 'Order 42 not found.',
                value: {
                  type: 'about:blank',
                  title: 'Not Found',
                  status: 404,
                  detail: 'Order 42 not found.',
                  code: 'orders/order/not-found',
                  isRetryable: false,
                },
              },
            },
          },
        },
      },
      '429': {
        description: 'Too Many Requests',
        content: {
          'application/problem+json': {
            schema: PROBLEM_SCHEMA,
            examples: {
              ['rate-limited']: {
                summary: 'Too many requests.',
                value: {
                  type: 'about:blank',
                  title: 'Too Many Requests',
                  status: 429,
                  detail: 'Too many requests.',
                  code: 'rate-limited',
                  isRetryable: true,
                  retryAfterSeconds: 30,
                },
              },
            },
          },
        },
      },
    });
  });
});
