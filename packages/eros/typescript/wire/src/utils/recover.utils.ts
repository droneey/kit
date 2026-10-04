/**
 * What `attempt` returns, or what `recover` makes of the failure when `attempt` throws one of
 * `Failure`; any other failure is rethrown.
 */
const recoverFrom = <TValue, TFailure extends Error>(
  Failure: abstract new (...args: never[]) => TFailure,
  attempt: () => TValue,
  recover: (failure: TFailure) => TValue,
): TValue => {
  try {
    return attempt();
  } catch (error) {
    if (error instanceof Failure) {
      return recover(error);
    }

    throw error;
  }
};

export { recoverFrom };
