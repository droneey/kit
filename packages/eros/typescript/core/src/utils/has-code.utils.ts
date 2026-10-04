import { ExpectedError } from '../errors';

/**
 * Recognises an expected error by its code: the only way to catch an error of another module, or one
 * that came over the network. `instanceof` is fine for the errors of one's own feature.
 */
const hasCode = <TCode extends string>(
  error: unknown,
  code: TCode,
): error is ExpectedError & {
  readonly code: TCode;
} => error instanceof ExpectedError && error.code === code;

export { hasCode };
