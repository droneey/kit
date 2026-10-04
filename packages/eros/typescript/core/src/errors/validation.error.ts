import { ErrorKind, POINTER_PATTERN } from '../constants';
import type { ErrorDetails, SharedErrorInput } from './eros.error';
import { ExpectedError } from './expected.error';

interface ValidationFailure {
  /** What the member failed, in lower kebab case: `invalid-format`. */
  readonly code: string;
  readonly detail: string;
  /** The failed member, as an RFC 6901 JSON Pointer in URI fragment form: `#/items/0/quantity`. */
  readonly pointer: string;
}

interface ValidationDetails extends ErrorDetails {
  readonly errors: readonly ValidationFailure[];
}

interface ValidationErrorInput extends SharedErrorInput {
  readonly errors?: readonly ValidationFailure[];
}

/** The request breaks its contract: a format, a type, a required member. */
class ValidationError extends ExpectedError {
  declare public readonly details: ValidationDetails;

  public constructor({ errors = [], ...input }: ValidationErrorInput = {}) {
    const unlocated = errors.find(({ pointer }) => !POINTER_PATTERN.test(pointer));

    if (unlocated !== undefined) {
      throw new TypeError(
        `A failure's pointer is a JSON Pointer in URI fragment form: ${JSON.stringify(unlocated.pointer)}`,
      );
    }

    super(ErrorKind.Validation, {
      ...input,
      details: {
        errors,
      },
    });
  }
}

export type { ValidationDetails, ValidationErrorInput, ValidationFailure };
export { ValidationError };
