import type { ValidationFailure } from '@droneey/eros';
import type { ValidationError as ClassValidatorError } from 'class-validator';

const ROOT = '#';

// RFC 6901: `~` first, so the `~1` written for `/` is not escaped again.
const escapeToken = (name: string): string => name.replaceAll('~', '~0').replaceAll('/', '~1');

/** One failure per member with a broken constraint, its first message as the detail, children flattened. */
const toValidationFailures = (
  errors: readonly ClassValidatorError[],
  parent: string = ROOT,
): ValidationFailure[] =>
  errors.flatMap((error) => {
    // A value the validator knows nothing of fails as a whole, with no property of its own.
    const pointer =
      typeof error.property === 'string' ? `${parent}/${escapeToken(error.property)}` : parent;
    const [detail] = Object.values(error.constraints ?? {});

    return [
      ...(detail === undefined
        ? []
        : [
            {
              pointer,
              code: 'invalid-format',
              detail,
            },
          ]),
      ...toValidationFailures(error.children ?? [], pointer),
    ];
  });

export { toValidationFailures };
