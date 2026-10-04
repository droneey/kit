import type { ErrorKind } from '../constants';
import type { ErrorMeta } from '../errors';
import type { BuildableErrorClass, BuildInput } from './kinds.fixtures';
import { KIND_CLASSES } from './kinds.fixtures';

/** A meta as a fixture writes it: any part may be absent, the module and the entity apart too. */
interface MetaDescriptor {
  readonly entity?: string;
  readonly module?: string;
  readonly reason?: string;
}

const metaOf = ({ module, entity, reason }: MetaDescriptor): ErrorMeta => {
  const reasonPart =
    reason === undefined
      ? {}
      : {
          reason,
        };

  if (module !== undefined && entity !== undefined) {
    return {
      module,
      entity,
      ...reasonPart,
    };
  }

  if (module === undefined && entity === undefined) {
    return reasonPart;
  }

  const unpaired = {
    module,
    entity,
    ...reasonPart,
  };

  // @ts-expect-error: the types refuse a module without an entity, so a refused case reaches the check that throws only past them
  return unpaired;
};

/** Declares the error class of a feature, as spec §3 shows it: it passes its meta to super. */
const declareClass = (kind: ErrorKind, meta: MetaDescriptor | undefined): BuildableErrorClass => {
  const Kind = KIND_CLASSES[kind];
  const metaPart =
    meta === undefined
      ? {}
      : {
          meta: metaOf(meta),
        };

  return class extends Kind {
    public constructor(input: BuildInput) {
      super({
        ...input,
        ...metaPart,
      });
    }
  };
};

export type { MetaDescriptor };
export { declareClass };
