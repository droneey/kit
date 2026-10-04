import type { ErrorEvent } from '@droneey/eros';

/** Hands each error to the log once, with its record; the wiring chooses the level. */
type OnError = (event: ErrorEvent) => void;

export type { OnError };
