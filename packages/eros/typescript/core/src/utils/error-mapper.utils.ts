import type { ErosError } from '../errors';
import { ExpectedError, UnexpectedError, ValidationError } from '../errors';
import type { PointerRemap } from './pointer.utils';

enum ErrorMapperMode {
  /** Rethrows every error. */
  Transparent = 'transparent',
  /** Rethrows an expected error and wraps any other in an UnexpectedError. */
  Expected = 'expected',
  /** Wraps every error in an UnexpectedError. */
  Unexpected = 'unexpected',
}

type ErrorClass = abstract new (...args: never[]) => ErosError;

type ErrorTarget = new (options: { readonly cause: unknown }) => ErosError;

/** The first pair whose source class the error is an instance of throws its target. */
type ErrorMapping = readonly [
  source: ErrorClass,
  target: ErrorTarget,
];

interface CreateErrorMapperInput {
  readonly mappings?: readonly ErrorMapping[];
  readonly mode: ErrorMapperMode;
  /** Rewrites the pointers of a ValidationError, whatever the mode and the mappings. */
  readonly validationMapper?: PointerRemap;
}

const wrap = (error: unknown): UnexpectedError =>
  new UnexpectedError({
    cause: error,
  });

const ERRORS_BY_MODE: Readonly<Record<ErrorMapperMode, (error: Error) => Error>> = {
  [ErrorMapperMode.Transparent]: (error) => error,
  [ErrorMapperMode.Expected]: (error) => (error instanceof ExpectedError ? error : wrap(error)),
  [ErrorMapperMode.Unexpected]: wrap,
};

const remapValidation = (error: ValidationError, remap: PointerRemap): ValidationError =>
  new ValidationError({
    cause: error,
    message: error.message,
    errors: error.details.errors.map((failure) => ({
      ...failure,
      pointer: remap(failure.pointer),
    })),
  });

/** A `.catch` for the border between layers or modules: it always throws. */
const createErrorMapper =
  ({
    mode,
    mappings = [],
    validationMapper,
  }: CreateErrorMapperInput): ((error: unknown) => never) =>
  (error: unknown): never => {
    if (!(error instanceof Error)) {
      throw wrap(error);
    }

    if (error instanceof UnexpectedError) {
      throw error;
    }

    if (validationMapper !== undefined && error instanceof ValidationError) {
      throw remapValidation(error, validationMapper);
    }

    const mapping = mappings.find(([source]) => error instanceof source);

    if (mapping !== undefined) {
      const [, Target] = mapping;

      throw new Target({
        cause: error,
      });
    }

    throw ERRORS_BY_MODE[mode](error);
  };

export type { CreateErrorMapperInput, ErrorClass, ErrorMapping, ErrorTarget };
export { createErrorMapper, ErrorMapperMode };
