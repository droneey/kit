import type { RequestListener } from 'node:http';

import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'light-my-request';
import { inject } from 'light-my-request';

interface StartAppInput {
  readonly controllers: readonly Type[];
  /** Wires the application as a project's entry file would, before it starts. */
  readonly wire: (app: INestApplication) => void;
}

/** A real Nest application on Express that answers in memory, with no port opened. */
const startApp = async ({ controllers, wire }: StartAppInput): Promise<INestApplication> => {
  const moduleRef = await Test.createTestingModule({
    controllers: [
      ...controllers,
    ],
  }).compile();
  const app = moduleRef.createNestApplication({
    logger: false,
  });

  wire(app);
  await app.init();

  return app;
};

const ignoreSocketOption = (): void => undefined;

// The in-memory socket has no TCP options, which Nest sets on every SSE response.
const SOCKET_OPTIONS = {
  setKeepAlive: ignoreSocketOption,
  setNoDelay: ignoreSocketOption,
  setTimeout: ignoreSocketOption,
};

const requestGet = async (app: INestApplication, url: string): Promise<Response> => {
  const listener: RequestListener = app.getHttpAdapter().getInstance();

  return await inject(
    (request, response) => {
      Object.assign(request.socket, SOCKET_OPTIONS);
      // Express swaps the prototype of the response, which would drop the capture of the body.
      Object.assign(response, {
        writeHead: response.writeHead.bind(response),
        write: response.write.bind(response),
        end: response.end.bind(response),
      });
      listener(request, response);
    },
    {
      method: 'GET',
      url,
    },
  );
};

export { requestGet, startApp };
