import { CODE_SEPARATOR } from '../constants';

/** The parts of a code, as they were written: the kind is not checked against the kinds. */
interface CodeParts {
  readonly entity?: string;
  readonly kind: string;
  readonly module?: string;
  readonly reason?: string;
}

type UnscopedSegments =
  | readonly [
      kind: string,
    ]
  | readonly [
      kind: string,
      reason: string,
    ];

type ScopedSegments =
  | readonly [
      module: string,
      entity: string,
      kind: string,
    ]
  | readonly [
      module: string,
      entity: string,
      kind: string,
      reason: string,
    ];

const MAX_SEGMENTS = 4;
const SCOPE_SEGMENTS = 2;

// A split gives at least one segment, so a count up to the maximum is one of the four forms.
const isParsable = (segments: readonly string[]): segments is UnscopedSegments | ScopedSegments =>
  segments.length <= MAX_SEGMENTS && !segments.includes('');

const isScoped = (segments: UnscopedSegments | ScopedSegments): segments is ScopedSegments =>
  segments.length > SCOPE_SEGMENTS;

const reasonOf = (reason: string | undefined): Pick<CodeParts, 'reason'> =>
  reason === undefined
    ? {}
    : {
        reason,
      };

/**
 * Reads a code back by its number of segments: the kind; the kind and the reason; the module, the
 * entity and the kind; all four. Tolerant of what a server sends, it checks neither the kind nor the
 * spelling, gives nothing for an empty segment or more than four, and never throws.
 */
const parseCode = (code: string): CodeParts | undefined => {
  const segments = code.split(CODE_SEPARATOR);

  if (!isParsable(segments)) {
    return;
  }

  if (isScoped(segments)) {
    const [module, entity, kind, reason] = segments;

    return {
      module,
      entity,
      kind,
      ...reasonOf(reason),
    };
  }

  const [kind, reason] = segments;

  return {
    kind,
    ...reasonOf(reason),
  };
};

export type { CodeParts };
export { parseCode };
