import type { SchedulerAction, SchedulerLike, Subscription } from 'rxjs';
import { queueScheduler } from 'rxjs';

/** A clock past every deadline: what is scheduled on it runs at once, whatever its delay. */
class ExpiredClock implements SchedulerLike {
  public now(): number {
    return 0;
  }

  public schedule<T>(
    work: (this: SchedulerAction<T>, state?: T) => void,
    _delay?: number,
    state?: T,
  ): Subscription {
    return queueScheduler.schedule(work, 0, state);
  }
}

export { ExpiredClock };
