import type { ErrorCategory, ErrorKind } from '../constants';
import { KINDS } from '../constants';
import type { ErrorDetails } from '../errors';
import { ErosError } from '../errors';

/** An error of eros, unmasked: the log sees what the client does not. */
interface ErosErrorRecord {
  readonly category: ErrorCategory;
  readonly cause?: ErrorRecord;
  readonly code: string;
  readonly details?: ErrorDetails;
  readonly entity?: string;
  readonly isRetryable: boolean;
  readonly kind: ErrorKind;
  readonly message: string;
  readonly module?: string;
  readonly reason?: string;
  readonly stack?: string;
  readonly title: string;
}

/** An error that is not of eros; a thrown value that is not an error is named by its type. */
interface ForeignErrorRecord {
  readonly cause?: ErrorRecord;
  readonly message: string;
  readonly name: string;
  readonly stack?: string;
}

/** The plain object a log writes, as `error-record.schema.json` describes it. */
type ErrorRecord = ErosErrorRecord | ForeignErrorRecord;

const textOf = (thrown: unknown): string => {
  try {
    // The library types say string, but undefined, a function and a symbol give undefined.
    const json: string | undefined = JSON.stringify(thrown);

    return json ?? String(thrown);
  } catch (error) {
    // JSON refuses a bigint and a cycle with a TypeError; any other error is the value's own toJSON failing.
    if (!(error instanceof TypeError)) {
      throw error;
    }

    return String(thrown);
  }
};

/** The parts of the code an error's meta names, each only when it has one. */
const partsOf = ({ meta }: ErosError): Pick<ErosErrorRecord, 'entity' | 'module' | 'reason'> => ({
  ...(meta?.module === undefined
    ? {}
    : {
        module: meta.module,
        entity: meta.entity,
      }),
  ...(meta?.reason === undefined
    ? {}
    : {
        reason: meta.reason,
      }),
});

const recordOf = (thrown: unknown, ancestors: readonly unknown[]): ErrorRecord => {
  if (!(thrown instanceof Error)) {
    return {
      name: typeof thrown,
      message: textOf(thrown),
    };
  }

  // A cause chain that loops back ends where it would repeat itself.
  const cause =
    thrown.cause === undefined || ancestors.includes(thrown.cause)
      ? {}
      : {
          cause: recordOf(thrown.cause, [
            ...ancestors,
            thrown,
          ]),
        };
  const stack =
    thrown.stack === undefined
      ? {}
      : {
          stack: thrown.stack,
        };

  if (!(thrown instanceof ErosError)) {
    return {
      name: thrown.name,
      message: thrown.message,
      ...stack,
      ...cause,
    };
  }

  return {
    code: thrown.code,
    ...partsOf(thrown),
    kind: thrown.kind,
    category: KINDS[thrown.kind].category,
    title: thrown.title,
    message: thrown.message,
    isRetryable: thrown.isRetryable,
    ...(thrown.details === undefined
      ? {}
      : {
          details: thrown.details,
        }),
    ...stack,
    ...cause,
  };
};

/** The record a log writes of an error, with every cause in turn. */
const toRecord = (error: unknown): ErrorRecord =>
  recordOf(error, [
    error,
  ]);

export type { ErosErrorRecord, ErrorRecord, ForeignErrorRecord };
export { toRecord };
