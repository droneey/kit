import { describe, expect, test } from 'bun:test';

import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';

import codeFixtures from '../fixtures/code.json' with { type: 'json' };
import mapFixtures from '../fixtures/map.json' with { type: 'json' };
import parseFixtures from '../fixtures/parse.json' with { type: 'json' };
import parseCodeFixtures from '../fixtures/parse-code.json' with { type: 'json' };
import pointerFixtures from '../fixtures/pointer.json' with { type: 'json' };
import problemFixtures from '../fixtures/problem.json' with { type: 'json' };
import projectionFixtures from '../fixtures/projections.json' with { type: 'json' };
import recordFixtures from '../fixtures/record.json' with { type: 'json' };
import errorRecordSchema from '../spec/error-record.schema.json' with { type: 'json' };
import kindsFile from '../spec/kinds.yaml';
import problemSchema from '../spec/problem.schema.json' with { type: 'json' };

interface Kind {
  readonly category: string;
  readonly isRetryable: boolean;
  readonly title: string;
}

interface Projection {
  readonly exitCode: number;
  readonly grpc: string;
  readonly http: number;
  readonly mcp: string;
  readonly queue: string;
}

const kinds: Readonly<Record<string, Kind>> = kindsFile.kinds;
const projections: Readonly<Record<string, Projection>> = kindsFile.projections;

const ajv = new Ajv({
  allErrors: true,
  strict: true,
});

addFormats(ajv);

const validateProblem = ajv.compile(problemSchema);
const validateRecord = ajv.compile(errorRecordSchema);
const codePattern = new RegExp(problemSchema.properties.code.pattern, 'u');

interface FixtureFile {
  readonly cases: readonly {
    readonly name: string;
  }[];
  readonly operation: string;
}

const files: readonly FixtureFile[] = [
  codeFixtures,
  parseCodeFixtures,
  projectionFixtures,
  problemFixtures,
  parseFixtures,
  recordFixtures,
  mapFixtures,
  pointerFixtures,
];

const fileCases = files.map(
  (file) =>
    [
      file.operation,
      file,
    ] as const,
);

/** The kind of a code, by its number of segments: the first of one or two, the third of three or four. */
const kindOfCode = (code: string): string => {
  const segments = code.split('/');

  return (segments.length > 2 ? segments[2] : segments[0]) ?? '';
};

/** The code a record's parts make, joined as the spec joins them. */
const codeOfParts = (parts: readonly (string | undefined)[]): string =>
  parts.filter((part) => part !== undefined).join('/');

const problems = problemFixtures.cases.map(
  ({ name, expected }) =>
    [
      name,
      expected,
    ] as const,
);

const problemKinds = problemFixtures.cases.map(
  ({ name, expected }) =>
    [
      name,
      expected,
      kindOfCode(expected.code),
    ] as const,
);

const records = recordFixtures.cases.map(
  ({ name, expected }) =>
    [
      name,
      expected,
    ] as const,
);

const erosRecords = recordFixtures.cases.flatMap(({ name, expected }) => {
  const { kind } = expected;

  return kind === undefined
    ? []
    : [
        [
          name,
          {
            ...expected,
            kind,
          },
          codeOfParts([
            expected.module,
            expected.entity,
            kind,
            expected.reason,
          ]),
        ] as const,
      ];
});

const codes = codeFixtures.cases.flatMap(({ name, expected }) =>
  expected.code === undefined
    ? []
    : [
        [
          name,
          expected.code,
        ] as const,
      ],
);

const plainProjections = projectionFixtures.cases.flatMap(({ name, input, expected }) => {
  if ('foreign' in input) {
    return [
      [
        name,
        'internal',
        expected,
      ] as const,
    ];
  }

  return 'isRetryable' in input
    ? []
    : [
        [
          name,
          input.kind,
          expected,
        ] as const,
      ];
});

describe('fixtures', () => {
  test('should give every kind a projection when kinds.yaml is read', () => {
    // Arrange
    // Act
    const projected = Object.keys(projections);

    // Assert
    expect(projected).toStrictEqual(Object.keys(kinds));
  });

  test.each(problems)('should match the problem schema when the case is %s', (_name, body) => {
    // Arrange
    // Act
    const isValid = validateProblem(body);

    // Assert
    expect({
      isValid,
      errors: ajv.errorsText(validateProblem.errors),
    }).toStrictEqual({
      isValid: true,
      errors: 'No errors',
    });
  });

  test.each(problemKinds)(
    'should give the title and the status of the code kind when the case is %s',
    (_name, body, kind) => {
      // Arrange
      // Act
      const actual = {
        title: kinds[kind]?.title,
        status: projections[kind]?.http,
      };

      // Assert
      expect(actual).toStrictEqual({
        title: body.title,
        status: body.status,
      });
    },
  );

  test.each(records)(
    'should match the error record schema when the case is %s',
    (_name, record) => {
      // Arrange
      // Act
      const isValid = validateRecord(record);

      // Assert
      expect({
        isValid,
        errors: ajv.errorsText(validateRecord.errors),
      }).toStrictEqual({
        isValid: true,
        errors: 'No errors',
      });
    },
  );

  test.each(erosRecords)(
    'should give the title, the category and the code of the record kind when the case is %s',
    (_name, record, codeOfRecordParts) => {
      // Arrange
      // Act
      const actual = {
        title: kinds[record.kind]?.title,
        category: kinds[record.kind]?.category,
        code: codeOfRecordParts,
      };

      // Assert
      expect(actual).toStrictEqual({
        title: record.title,
        category: record.category,
        code: record.code,
      });
    },
  );

  test.each(codes)('should match the code pattern when the case is %s', (_name, code) => {
    // Arrange
    // Act
    const isValid = codePattern.test(code);

    // Assert
    expect(isValid).toBe(true);
  });

  test.each(plainProjections)(
    'should give the projections of kinds.yaml when the case is %s',
    (_name, kind, expected) => {
      // Arrange
      // Act
      const projection = projections[kind];

      // Assert
      expect(projection).toStrictEqual(expected);
    },
  );

  test.each(fileCases)(
    'should name every case once when the operation is %s',
    (_operation, file) => {
      // Arrange
      const names = file.cases.map(({ name }) => name);

      // Act
      const uniqueNames = new Set(names);

      // Assert
      expect([
        ...uniqueNames,
      ]).toStrictEqual(names);
    },
  );

  test.each(fileCases)(
    'should name every case as should and when when the operation is %s',
    (_operation, file) => {
      // Arrange
      const names = file.cases.map(({ name }) => name);

      // Act
      const misnamed = names.filter((name) => !/^should .+ when .+$/u.test(name));

      // Assert
      expect(misnamed).toStrictEqual([]);
    },
  );
});
