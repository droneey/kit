import type { ErrorEvent, ErrorRecord } from '@droneey/eros';

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

/** A reported event as a case compares it: a stack differs by machine, so the record leaves it out. */
const withoutStacks = ({ error, record }: ErrorEvent): unknown => ({
  error,
  record: stripStacks(record),
});

export { stripStacks, withoutStacks };
