import type { ErosError } from '@droneey/eros';
import { toRecord } from '@droneey/eros';

import type { OnError } from '../types';

const reportError = (error: ErosError, onError: OnError | undefined): void => {
  onError?.({
    error,
    record: toRecord(error),
  });
};

export { reportError };
