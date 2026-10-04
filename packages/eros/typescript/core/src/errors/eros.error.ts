import type { ErrorKind } from '../constants';
import { CODE_SEPARATOR, KINDS, SEGMENT_PATTERN } from '../constants';

/** A module and its entity, which come together. */
interface ModuleMeta {
  readonly entity: string;
  readonly module: string;
  readonly reason?: string;
}

/** A reason alone, or nothing: the code starts with the kind. */
interface ReasonMeta {
  readonly entity?: never;
  readonly module?: never;
  readonly reason?: string;
}

/** Public names that make the code, each in lower kebab case; they change only as a contract does. */
type ErrorMeta = ModuleMeta | ReasonMeta;

interface ErrorDetails {
  readonly [key: string]: unknown;
}

/** What every expected error takes, whatever its details. */
interface SharedErrorInput {
  readonly cause?: unknown;
  readonly isRetryable?: boolean;
  readonly message?: string;
  readonly meta?: ErrorMeta;
  /** Never negative. */
  readonly retryAfter?: Temporal.Duration;
}

interface ErosErrorInput extends SharedErrorInput {
  /** Safe to show the client: a log and a problem may carry them. */
  readonly details?: ErrorDetails;
}

const assertMeta = (meta: ErrorMeta): void => {
  // The parts the meta holds, and only those: an absent part has nothing to check.
  const segments: readonly unknown[] = Object.values(meta);

  for (const segment of segments) {
    if (!SEGMENT_PATTERN.test(String(segment))) {
      throw new TypeError(`A segment of a code is in lower kebab case: ${JSON.stringify(segment)}`);
    }
  }

  if ((meta.module === undefined) !== (meta.entity === undefined)) {
    throw new TypeError('The module and the entity of a code come together or not at all');
  }
};

const assertRetryAfter = (retryAfter: Temporal.Duration | undefined): void => {
  if (retryAfter !== undefined && retryAfter.sign < 0) {
    throw new RangeError(`A retry delay is not negative: ${retryAfter.toString()}`);
  }
};

/** `[<module>/<entity>/]<kind>[/<reason>]`: the reason is added after the kind, never in its place. */
const codeOf = (kind: ErrorKind, meta: ErrorMeta): string =>
  [
    meta.module,
    meta.entity,
    kind,
    meta.reason,
  ]
    .filter((segment) => segment !== undefined)
    .join(CODE_SEPARATOR);

abstract class ErosError extends Error {
  public readonly code: string;
  // Class fields are always defined, so an absent option is an explicit undefined here.
  public readonly details: ErrorDetails | undefined;
  public readonly isRetryable: boolean;
  public readonly kind: ErrorKind;
  public readonly meta: ErrorMeta | undefined;
  public readonly retryAfter: Temporal.Duration | undefined;
  public readonly title: string;

  public constructor(kind: ErrorKind, input: ErosErrorInput) {
    const { meta = {}, retryAfter } = input;

    assertMeta(meta);
    assertRetryAfter(retryAfter);

    super(
      input.message ?? KINDS[kind].message,
      input.cause === undefined
        ? undefined
        : {
            cause: input.cause,
          },
    );

    this.name = new.target.name;
    this.kind = kind;
    this.code = codeOf(kind, meta);
    this.title = KINDS[kind].title;
    this.isRetryable = input.isRetryable ?? KINDS[kind].isRetryable;
    this.meta = input.meta;
    this.details = input.details;
    this.retryAfter = retryAfter;
  }
}

export type { ErosErrorInput, ErrorDetails, ErrorMeta, SharedErrorInput };
export { ErosError };
