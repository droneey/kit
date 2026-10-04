import { describe, expect, test } from 'bun:test';

import projectionFixtures from '../../../../../common/fixtures/projections.json' with {
  type: 'json',
};
import type { Case, FixtureFile } from '../../__tests__/cases.fixtures';
import { conditionOf } from '../../__tests__/cases.fixtures';
import type { Descriptor } from '../../__tests__/descriptors.fixtures';
import { buildError } from '../../__tests__/descriptors.fixtures';
import {
  toExitCode,
  toGrpcStatus,
  toHttpStatus,
  toMcpOutcome,
  toQueueDisposition,
} from '../projections.utils';

interface Projected {
  readonly exitCode: number;
  readonly grpc: string;
  readonly http: number;
  readonly mcp: string;
  readonly queue: string;
}

type ProjectionCase = Case<Descriptor, Projected>;

const projections: FixtureFile<ProjectionCase> = projectionFixtures;

/** The rows of one transport's table: each case under its condition, with that transport's value. */
const rowsOf = <TTransport extends keyof Projected>(
  transport: TTransport,
): readonly (readonly [
  string,
  Descriptor,
  Projected[TTransport],
])[] =>
  projections.cases.map(
    ({ name, input, expected }) =>
      [
        conditionOf(name),
        input,
        expected[transport],
      ] as const,
  );

describe('toHttpStatus', () => {
  test.each(rowsOf('http'))(
    'should give the HTTP status when %s',
    (_condition, input, expected) => {
      // Arrange
      const error = buildError(input);

      // Act
      const status = toHttpStatus(error);

      // Assert
      expect<unknown>(status).toStrictEqual(expected);
    },
  );
});

describe('toGrpcStatus', () => {
  test.each(rowsOf('grpc'))(
    'should give the gRPC status when %s',
    (_condition, input, expected) => {
      // Arrange
      const error = buildError(input);

      // Act
      const status = toGrpcStatus(error);

      // Assert
      expect<unknown>(status).toStrictEqual(expected);
    },
  );
});

describe('toMcpOutcome', () => {
  test.each(rowsOf('mcp'))('should give the MCP outcome when %s', (_condition, input, expected) => {
    // Arrange
    const error = buildError(input);

    // Act
    const outcome = toMcpOutcome(error);

    // Assert
    expect<unknown>(outcome).toStrictEqual(expected);
  });
});

describe('toExitCode', () => {
  test.each(rowsOf('exitCode'))(
    'should give the exit code when %s',
    (_condition, input, expected) => {
      // Arrange
      const error = buildError(input);

      // Act
      const exitCode = toExitCode(error);

      // Assert
      expect<unknown>(exitCode).toStrictEqual(expected);
    },
  );
});

describe('toQueueDisposition', () => {
  test.each(rowsOf('queue'))(
    'should give the queue disposition when %s',
    (_condition, input, expected) => {
      // Arrange
      const error = buildError(input);

      // Act
      const disposition = toQueueDisposition(error);

      // Assert
      expect<unknown>(disposition).toStrictEqual(expected);
    },
  );
});
