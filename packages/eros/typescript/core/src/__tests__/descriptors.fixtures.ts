import type { ValidationFailure } from '../errors';
import type { PointerRemap, ValidationRule } from '../utils';
import {
  createErrorMapper,
  createValidationMapper,
  ErrorMapperMode,
  prefixValidationFields,
} from '../utils';
import type { MetaDescriptor } from './classes.fixtures';
import { declareClass } from './classes.fixtures';
import type { BuildableErrorClass, BuildInput } from './kinds.fixtures';
import { KIND_CLASSES, kindNamed } from './kinds.fixtures';

interface DetailsDescriptor {
  readonly errors?: readonly ValidationFailure[];
  readonly [key: string]: unknown;
}

interface ErosDescriptor {
  readonly cause?: Descriptor;
  readonly class?: string;
  readonly details?: DetailsDescriptor;
  readonly isRetryable?: boolean;
  readonly kind: string;
  readonly message?: string;
  readonly meta?: MetaDescriptor;
  readonly retryAfterSeconds?: number;
}

interface ForeignDescriptor {
  readonly foreign: {
    readonly cause?: Descriptor;
    readonly message: string;
    readonly name: string;
  };
}

interface ThrownDescriptor {
  readonly thrown: unknown;
}

type Descriptor = ErosDescriptor | ForeignDescriptor | ThrownDescriptor;

interface ClassDescriptor {
  readonly class?: string;
  readonly kind: string;
  readonly meta?: MetaDescriptor;
}

interface RegexRuleDescriptor {
  readonly regex: string;
  readonly replacement: string;
}

interface PatternRuleDescriptor {
  readonly pattern: string;
  readonly replacement: string;
}

interface RemapDescriptor {
  readonly createValidationMapper?: readonly (PatternRuleDescriptor | RegexRuleDescriptor)[];
  readonly prefixValidationFields?: {
    readonly keepAtRoot?: readonly string[];
    readonly prefix: string;
  };
}

interface MapperDescriptor {
  readonly mappings?: readonly {
    readonly source: ClassDescriptor;
    readonly target: ClassDescriptor;
  }[];
  readonly mode: string;
  readonly validationMapper?: RemapDescriptor;
}

interface DescriptorBuilder {
  readonly buildError: (descriptor: Descriptor) => unknown;
  readonly classOf: (descriptor: ClassDescriptor) => BuildableErrorClass;
}

const MILLISECONDS_PER_SECOND = 1000;

const isErrorConstructor = (candidate: unknown): candidate is ErrorConstructor =>
  typeof candidate === 'function' && (candidate === Error || candidate.prototype instanceof Error);

const messageOf = ({ message }: ErosDescriptor): BuildInput =>
  message === undefined
    ? {}
    : {
        message,
      };

// A validation takes its failures as errors; any other kind takes the details whole.
const detailsOf = ({ details }: ErosDescriptor): BuildInput => {
  if (details === undefined) {
    return {};
  }

  const { errors } = details;

  return errors === undefined
    ? {
        details,
      }
    : {
        errors,
      };
};

const retryOf = ({ isRetryable, retryAfterSeconds }: ErosDescriptor): BuildInput => ({
  ...(isRetryable === undefined
    ? {}
    : {
        isRetryable,
      }),
  ...(retryAfterSeconds === undefined
    ? {}
    : {
        retryAfter: Temporal.Duration.from({
          milliseconds: Math.round(retryAfterSeconds * MILLISECONDS_PER_SECOND),
        }),
      }),
});

/** Builds the values a file of fixtures describes; a class name always means the same class in it. */
const createDescriptorBuilder = (): DescriptorBuilder => {
  const classes = new Map<string, BuildableErrorClass>();

  const classOf = (descriptor: ClassDescriptor): BuildableErrorClass => {
    const kind = kindNamed(descriptor.kind);

    if (descriptor.class === undefined) {
      return descriptor.meta === undefined
        ? KIND_CLASSES[kind]
        : declareClass(kind, descriptor.meta);
    }

    const declared = classes.get(descriptor.class) ?? declareClass(kind, descriptor.meta);

    classes.set(descriptor.class, declared);

    return declared;
  };

  const causeOf = ({ cause }: { readonly cause?: Descriptor }): BuildInput =>
    cause === undefined
      ? {}
      : {
          cause: buildError(cause),
        };

  const buildForeign = ({ foreign }: ForeignDescriptor): Error => {
    const native: unknown = Reflect.get(globalThis, foreign.name);
    const options = causeOf(foreign);

    if (isErrorConstructor(native)) {
      return new native(foreign.message, options);
    }

    const error = new Error(foreign.message, options);

    error.name = foreign.name;

    return error;
  };

  const buildError = (descriptor: Descriptor): unknown => {
    if ('thrown' in descriptor) {
      return descriptor.thrown;
    }

    if ('foreign' in descriptor) {
      return buildForeign(descriptor);
    }

    const ErrorOfDescriptor = classOf(descriptor);

    return new ErrorOfDescriptor({
      ...messageOf(descriptor),
      ...detailsOf(descriptor),
      ...retryOf(descriptor),
      ...causeOf(descriptor),
    });
  };

  return {
    buildError,
    classOf,
  };
};

const ruleOf = (rule: PatternRuleDescriptor | RegexRuleDescriptor): ValidationRule =>
  'regex' in rule
    ? [
        new RegExp(rule.regex, 'u'),
        rule.replacement,
      ]
    : [
        rule.pattern,
        rule.replacement,
      ];

const buildRemap = (descriptor: RemapDescriptor): PointerRemap => {
  if (descriptor.prefixValidationFields !== undefined) {
    const { prefix, keepAtRoot } = descriptor.prefixValidationFields;

    return prefixValidationFields(
      prefix,
      keepAtRoot === undefined
        ? {}
        : {
            keepAtRoot,
          },
    );
  }

  return createValidationMapper((descriptor.createValidationMapper ?? []).map(ruleOf));
};

const modeNamed = (name: string): ErrorMapperMode =>
  Object.values(ErrorMapperMode).find((mode) => mode === name) ?? ErrorMapperMode.Transparent;

/** Builds the mapper a fixture describes, its classes taken from the builder of the case. */
const buildMapper = (
  builder: DescriptorBuilder,
  mapper: MapperDescriptor,
): ((error: unknown) => never) =>
  createErrorMapper({
    mode: modeNamed(mapper.mode),
    ...(mapper.mappings === undefined
      ? {}
      : {
          mappings: mapper.mappings.map(
            ({ source, target }) =>
              [
                builder.classOf(source),
                builder.classOf(target),
              ] as const,
          ),
        }),
    ...(mapper.validationMapper === undefined
      ? {}
      : {
          validationMapper: buildRemap(mapper.validationMapper),
        }),
  });

export type { ClassDescriptor, Descriptor, MapperDescriptor, RemapDescriptor };
export { buildMapper, buildRemap, createDescriptorBuilder };
