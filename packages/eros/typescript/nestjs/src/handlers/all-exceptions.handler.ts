import type { Observable, Subscription } from 'rxjs';

import type { OnError } from '../types';
import { reportError, toErosError } from '../utils';

interface AllExceptionsHandlerInput {
  readonly onError?: OnError;
}

/** What `UnhandledExceptionBus` of @nestjs/cqrs publishes, as far as the handler reads it. */
interface UnhandledException {
  readonly exception: unknown;
}

/** Reports what an event handler or a saga threw, which no request is left to answer. */
class AllExceptionsHandler {
  private readonly input: AllExceptionsHandlerInput;

  public constructor(input: AllExceptionsHandlerInput = {}) {
    this.input = input;
  }

  /** Listens to `UnhandledExceptionBus`; ending the subscription ends the listening. */
  public subscribe(bus: Observable<UnhandledException>): Subscription {
    return bus.subscribe(({ exception }) => {
      reportError(toErosError(exception), this.input.onError);
    });
  }
}

export type { AllExceptionsHandlerInput, UnhandledException };
export { AllExceptionsHandler };
