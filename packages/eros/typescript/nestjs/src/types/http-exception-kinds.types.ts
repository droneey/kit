import type { ErrorKind } from '@droneey/eros';

/** The kind a Nest `HttpException` of each status becomes; a status it does not hold is masked. */
type HttpExceptionKinds = ReadonlyMap<number, ErrorKind>;

export type { HttpExceptionKinds };
