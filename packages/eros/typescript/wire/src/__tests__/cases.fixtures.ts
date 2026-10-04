/** A file of `common/fixtures`: its cases, each named as a case of a spec reads. */
interface FixtureFile<TCase> {
  readonly cases: readonly TCase[];
}

interface Case<TInput, TExpected> {
  readonly expected: TExpected;
  readonly input: TInput;
  readonly name: string;
}

const SHOULD = 'should ';
const WHEN = ' when ';

/** The rows of a table titled `should %s`: each case under its name, past its `should`. */
const rowsOf = <
  TCase extends {
    readonly name: string;
  },
>(
  file: FixtureFile<TCase>,
): readonly (readonly [
  string,
  TCase,
])[] =>
  file.cases.map(
    (fixture) =>
      [
        fixture.name.slice(SHOULD.length),
        fixture,
      ] as const,
  );

/** The condition of a case's name: what follows its `when`. */
const conditionOf = (name: string): string => name.slice(name.indexOf(WHEN) + WHEN.length);

export type { Case, FixtureFile };
export { conditionOf, rowsOf };
