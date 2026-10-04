import type { ExpectedError } from '@droneey/eros';
import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

import { generateErrorResponses } from '../utils';

/** Documents the problems a route answers with: one response per status, an example per code. */
const ApiExpectedErrors = (...errors: readonly ExpectedError[]): MethodDecorator & ClassDecorator =>
  applyDecorators(...generateErrorResponses(...errors).map((response) => ApiResponse(response)));

export { ApiExpectedErrors };
