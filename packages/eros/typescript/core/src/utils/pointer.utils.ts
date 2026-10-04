import { POINTER_PATTERN, POINTER_ROOT, TOKEN_SEPARATOR } from '../constants';

/** Rewrites an RFC 6901 JSON Pointer in URI fragment form: `#/items/0/quantity`. */
type PointerRemap = (pointer: string) => string;

type PointerReplacement = string | ((pointer: string, match: readonly string[]) => string);

/** A string pattern matches only a pointer equal to it; a RegExp replaces its first match. */
type ValidationRule = readonly [
  pattern: string | RegExp,
  replacement: PointerReplacement,
];

interface PrefixValidationFieldsInput {
  /** Names of root members, unescaped, whose pointers keep their place. */
  readonly keepAtRoot?: readonly string[];
}

/** Whether the value is an RFC 6901 JSON Pointer in URI fragment form. */
const isPointer = (candidate: unknown): candidate is string =>
  typeof candidate === 'string' && POINTER_PATTERN.test(candidate);

// RFC 6901: `~` first, so the `~1` written for `/` is not escaped again.
const escapeToken = (name: string): string =>
  name.replaceAll('~', '~0').replaceAll(TOKEN_SEPARATOR, '~1');

const prefixValidationFields = (
  prefix: string,
  { keepAtRoot }: PrefixValidationFieldsInput = {},
): PointerRemap => {
  const keptTokens = new Set<string | undefined>(keepAtRoot?.map(escapeToken));

  return (pointer: string): string => {
    const [, firstToken] = pointer.split(TOKEN_SEPARATOR);

    if (keptTokens.has(firstToken)) {
      return pointer;
    }

    return `${prefix}${pointer.slice(POINTER_ROOT.length)}`;
  };
};

const applyRule = (pointer: string, [pattern, replacement]: ValidationRule): string | undefined => {
  if (typeof pattern === 'string') {
    if (pointer !== pattern) {
      return;
    }

    return typeof replacement === 'string'
      ? replacement
      : replacement(pointer, [
          pointer,
        ]);
  }

  const match = pointer.match(pattern);

  if (match === null) {
    return;
  }

  return typeof replacement === 'string'
    ? pointer.replace(pattern, replacement)
    : replacement(pointer, match);
};

/** The first rule that matches wins; a pointer no rule matches comes back unchanged. */
const createValidationMapper =
  (rules: readonly ValidationRule[]): PointerRemap =>
  (pointer: string): string => {
    for (const rule of rules) {
      const remapped = applyRule(pointer, rule);

      if (remapped !== undefined) {
        return remapped;
      }
    }

    return pointer;
  };

export type { PointerRemap, PointerReplacement, PrefixValidationFieldsInput, ValidationRule };
export { createValidationMapper, isPointer, prefixValidationFields };
