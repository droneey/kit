import codeFixtures from '../../../../common/fixtures/code.json' with { type: 'json' };
import mapFixtures from '../../../../common/fixtures/map.json' with { type: 'json' };
import parseCodeFixtures from '../../../../common/fixtures/parse-code.json' with { type: 'json' };
import pointerFixtures from '../../../../common/fixtures/pointer.json' with { type: 'json' };
import recordFixtures from '../../../../common/fixtures/record.json' with { type: 'json' };
import type { Descriptor, MapperDescriptor, RemapDescriptor } from './descriptors.fixtures';

interface FixtureFile<TCase> {
  readonly cases: readonly TCase[];
}

interface Case<TInput, TExpected> {
  readonly expected: TExpected;
  readonly input: TInput;
  readonly name: string;
}

type CodeCase = Case<
  Descriptor,
  {
    readonly code?: string;
    readonly isRejected?: boolean;
  }
>;

type ParseCodeCase = Case<
  {
    readonly code: string;
  },
  {
    readonly entity?: string;
    readonly isUnparsed?: boolean;
    readonly kind?: string;
    readonly module?: string;
    readonly reason?: string;
  }
>;

type RecordCase = Case<Descriptor, unknown>;

interface NewErrorDescriptor {
  readonly class?: string;
  readonly code: string;
  readonly details?: unknown;
  readonly kind: string;
}

interface MapInput {
  readonly error: Descriptor;
  readonly mapper: MapperDescriptor;
}

type MapCase = Case<
  MapInput,
  {
    readonly throws: string | NewErrorDescriptor;
  }
>;

type PointerCase = Case<
  {
    readonly pointer: string;
    readonly remap: RemapDescriptor;
  },
  string
>;

type Row<TCase> = readonly [
  name: string,
  fixture: TCase,
];

const codes: FixtureFile<CodeCase> = codeFixtures;
const parsedCodes: FixtureFile<ParseCodeCase> = parseCodeFixtures;
const records: FixtureFile<RecordCase> = recordFixtures;
const maps: FixtureFile<MapCase> = mapFixtures;
const pointers: FixtureFile<PointerCase> = pointerFixtures;

const SHOULD = 'should ';

/** The rows of a table titled `should %s`: each case under its name, past its `should`. */
const rowsOf = <
  TCase extends {
    readonly name: string;
  },
>(
  file: FixtureFile<TCase>,
): readonly Row<TCase>[] =>
  file.cases.map(
    (fixture) =>
      [
        fixture.name.slice(SHOULD.length),
        fixture,
      ] as const,
  );

// code.json checks only that an input is refused; these are the errors TypeScript refuses it with.
const REFUSALS: Readonly<Record<string, Error>> = {
  'should refuse the error when meta has a module and no entity': new TypeError(
    'The module and the entity of a code come together or not at all',
  ),
  'should refuse the error when meta has an entity and no module': new TypeError(
    'The module and the entity of a code come together or not at all',
  ),
  'should refuse the error when the module has a capital letter': new TypeError(
    'A segment of a code is in lower kebab case: "Orders"',
  ),
  'should refuse the error when the entity has an underscore': new TypeError(
    'A segment of a code is in lower kebab case: "promo_code"',
  ),
  'should refuse the error when the reason is in upper case': new TypeError(
    'A segment of a code is in lower kebab case: "ALREADY_PAID"',
  ),
  'should refuse the error when the module is an empty string': new TypeError(
    'A segment of a code is in lower kebab case: ""',
  ),
  'should refuse the error when the reason is an empty string': new TypeError(
    'A segment of a code is in lower kebab case: ""',
  ),
  'should refuse the error when a segment begins with a hyphen': new TypeError(
    'A segment of a code is in lower kebab case: "-order"',
  ),
  'should refuse the error when a segment ends with a hyphen': new TypeError(
    'A segment of a code is in lower kebab case: "archived-"',
  ),
  'should refuse the error when a segment holds two hyphens in a row': new TypeError(
    'A segment of a code is in lower kebab case: "promo--code"',
  ),
  'should refuse the error when a segment holds a slash': new TypeError(
    'A segment of a code is in lower kebab case: "already/paid"',
  ),
  'should refuse the error when a segment holds a space': new TypeError(
    'A segment of a code is in lower kebab case: "already paid"',
  ),
  'should refuse the error when a segment holds a letter outside ASCII': new TypeError(
    'A segment of a code is in lower kebab case: "café"',
  ),
  'should refuse the error when the retry delay is negative': new RangeError(
    'A retry delay is not negative: -PT1S',
  ),
  "should refuse the error when a failure's pointer has no hash": new TypeError(
    'A failure\'s pointer is a JSON Pointer in URI fragment form: "/email"',
  ),
  "should refuse the error when a failure's pointer has no slash after the hash": new TypeError(
    'A failure\'s pointer is a JSON Pointer in URI fragment form: "#email"',
  ),
  "should refuse the error when a failure's pointer has a tilde that escapes nothing":
    new TypeError('A failure\'s pointer is a JSON Pointer in URI fragment form: "#/a~2b"'),
};

const refusalOf = (name: string): Error => {
  const refusal = REFUSALS[name];

  if (refusal === undefined) {
    throw new Error(`The fixture names a refusal with no error: ${name}`);
  }

  return refusal;
};

const codedRows = rowsOf(codes).filter(([, fixture]) => fixture.expected.code !== undefined);

const rejectedRows = rowsOf(codes).flatMap(([name, fixture]) =>
  fixture.expected.isRejected === true
    ? [
        [
          name,
          fixture.input,
          refusalOf(fixture.name),
        ] as const,
      ]
    : [],
);

const parsedRows = rowsOf(parsedCodes).filter(
  ([, fixture]) => fixture.expected.isUnparsed !== true,
);

const unparsedRows = rowsOf(parsedCodes).filter(
  ([, fixture]) => fixture.expected.isUnparsed === true,
);

const recordRows = rowsOf(records);

const rethrownRows = rowsOf(maps).filter(([, fixture]) => fixture.expected.throws === 'input');

const newErrorRows = rowsOf(maps).flatMap(([name, fixture]) =>
  typeof fixture.expected.throws === 'string'
    ? []
    : [
        [
          name,
          fixture.input,
          fixture.expected.throws,
        ] as const,
      ],
);

const prefixedRows = rowsOf(pointers).filter(
  ([, fixture]) => fixture.input.remap.prefixValidationFields !== undefined,
);

const mappedPointerRows = rowsOf(pointers).filter(
  ([, fixture]) => fixture.input.remap.prefixValidationFields === undefined,
);

export {
  codedRows,
  mappedPointerRows,
  newErrorRows,
  parsedRows,
  prefixedRows,
  recordRows,
  rejectedRows,
  rethrownRows,
  unparsedRows,
};
