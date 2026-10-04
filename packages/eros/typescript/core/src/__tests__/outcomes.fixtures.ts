import { ErosError } from '../errors';
import type { ErrorRecord } from '../utils';
import type { ClassDescriptor } from './descriptors.fixtures';
import { kindOf } from './kinds.fixtures';

interface ThrownSummaryInput {
  readonly classOf: (descriptor: ClassDescriptor) => abstract new (...args: never[]) => unknown;
  readonly expected: {
    readonly class?: string;
    readonly details?: unknown;
    readonly kind: string;
  };
  readonly input: unknown;
  readonly thrown: unknown;
}

const thrownBy = (act: () => unknown): unknown => {
  try {
    act();
  } catch (error) {
    return error;
  }

  throw new Error('The act threw nothing');
};

const erosErrorOf = (error: unknown): ErosError => {
  if (!(error instanceof ErosError)) {
    throw new Error('The outcome is not an error of eros', {
      cause: error,
    });
  }

  return error;
};

const codeOf = (error: unknown): string => erosErrorOf(error).code;

/** What map.json compares of a new error; its details only where the case names them. */
const summaryOfThrown = ({ thrown, input, expected, classOf }: ThrownSummaryInput): unknown => {
  const error = erosErrorOf(thrown);
  const declared = expected.class;

  return {
    kind: kindOf(error),
    ...(declared === undefined
      ? {}
      : {
          class:
            error instanceof
            classOf({
              kind: expected.kind,
              class: declared,
            })
              ? declared
              : error.name,
        }),
    code: error.code,
    ...(expected.details === undefined
      ? {}
      : {
          details: error.details,
        }),
    cause: error.cause === input ? 'input' : error.cause,
  };
};

const stacksOf = (record: ErrorRecord): readonly unknown[] => [
  record.stack,
  ...(record.cause === undefined ? [] : stacksOf(record.cause)),
];

const stripStacks = (record: ErrorRecord): unknown => {
  const { stack: _stack, cause, ...rest } = record;

  return {
    ...rest,
    ...(cause === undefined
      ? {}
      : {
          cause: stripStacks(cause),
        }),
  };
};

/** record.json leaves stacks out: each must be a string, and the rest is compared. */
const withoutStacks = (record: ErrorRecord): unknown => ({
  hasOnlyStringStacks: stacksOf(record).every((stack) => typeof stack === 'string'),
  record: stripStacks(record),
});

export { codeOf, summaryOfThrown, thrownBy, withoutStacks };
