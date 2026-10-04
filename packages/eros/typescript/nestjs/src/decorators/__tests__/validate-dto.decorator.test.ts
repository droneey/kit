import { describe, expect, test } from 'bun:test';

import { ValidationError } from '@droneey/eros';

import { ValidateDto } from '../validate-dto.decorator';
import { GreetCommand } from './greet-command.fixtures';
import { LabelCommand } from './label-command.fixtures';
import { invalidName, NameDto } from './name-dto.fixtures';
import { MARK, NameService } from './name-service.fixtures';
import { PlainCommand } from './plain-command.fixtures';
import { RenameCommand } from './rename-command.fixtures';

const service = new NameService();

const ADA = Object.assign(new NameDto(), {
  name: 'Ada',
});

const NAME_IS_NOT_TEXT = [
  {
    pointer: '#/name',
    code: 'invalid-format',
    detail: 'name must be a string',
  },
];

const failuresOf = (act: () => unknown): unknown => {
  try {
    act();
  } catch (error: unknown) {
    return error instanceof ValidationError ? error.details.errors : error;
  }

  return 'nothing was thrown';
};

const rejectionOf = async (promise: unknown): Promise<unknown> => {
  try {
    await promise;
  } catch (error: unknown) {
    return error;
  }

  return 'nothing was rejected';
};

// A caller from JavaScript, or a request body, passes what the declared types refuse.
const callAsJavaScript = (
  method: (...args: never[]) => unknown,
  args: readonly unknown[],
): unknown => Reflect.apply(method, service, args);

describe('ValidateDto on a method', () => {
  test('should pass a valid plain argument on as an instance of its DTO', () => {
    // Arrange
    // Act
    const dto = service.echoName({
      name: 'Ada',
    });

    // Assert
    expect(dto).toStrictEqual(ADA);
  });

  test('should pass an instance of the DTO on as the same instance', () => {
    // Arrange
    const dto = Object.assign(new NameDto(), {
      name: 'Ada',
    });

    // Act
    const passed = service.echoName(dto);

    // Assert
    expect(passed).toBe(dto);
  });

  test('should validate a missing DTO argument as an empty object', () => {
    // Arrange
    // Act
    const dto = callAsJavaScript(NameService.prototype.echoName, [
      undefined,
    ]);

    // Assert
    expect(dto).toStrictEqual(new NameDto());
  });

  test('should keep the instance the method is called on', () => {
    // Arrange
    // Act
    const greeting = service.greetName({
      name: 'Ada',
    });

    // Assert
    expect(greeting).toBe('Hello, Ada');
  });

  test('should throw a ValidationError whose pointer locates the member when a member breaks its constraint', () => {
    // Arrange
    // Act
    const failures = failuresOf(() =>
      callAsJavaScript(NameService.prototype.echoName, [
        {
          name: 42,
        },
      ]),
    );

    // Assert
    expect(failures).toStrictEqual(NAME_IS_NOT_TEXT);
  });

  test('should validate a DTO whose constraints all belong to a group', () => {
    // Arrange
    // Act
    const failures = failuresOf(() =>
      callAsJavaScript(NameService.prototype.echoGroupName, [
        {
          name: 42,
        },
      ]),
    );

    // Assert
    expect(failures).toStrictEqual(NAME_IS_NOT_TEXT);
  });

  test('should refuse a member the DTO does not declare', () => {
    // Arrange
    // Act
    const failures = failuresOf(() =>
      callAsJavaScript(NameService.prototype.echoName, [
        {
          name: 'Ada',
          nickname: 'Countess',
        },
      ]),
    );

    // Assert
    expect(failures).toStrictEqual([
      {
        pointer: '#/nickname',
        code: 'invalid-format',
        detail: 'property nickname should not exist',
      },
    ]);
  });

  test('should point inside a nested list when an item of it is invalid', () => {
    // Arrange
    // Act
    const failures = failuresOf(() =>
      callAsJavaScript(NameService.prototype.echoOrder, [
        {
          items: [
            {
              quantity: 2,
            },
            {
              quantity: 'many',
            },
          ],
        },
      ]),
    );

    // Assert
    expect(failures).toStrictEqual([
      {
        pointer: '#/items/1/quantity',
        code: 'invalid-format',
        detail: 'quantity must be an integer number',
      },
    ]);
  });

  test('should refuse a nested value the validator knows nothing of', () => {
    // Arrange
    // Act
    const failures = failuresOf(() =>
      service.echoLooseOrder({
        item: {
          sku: 'A-1',
        },
      }),
    );

    // Assert
    expect(failures).toStrictEqual([
      {
        pointer: '#/item',
        code: 'invalid-format',
        detail: 'an unknown value was passed to the validate function',
      },
    ]);
  });

  test.each([
    [
      'a text',
      'Ada',
    ],
    [
      'a number',
      7,
    ],
    [
      'the null of a JSON body',
      JSON.parse('null'),
    ],
    [
      'undefined',
      undefined,
    ],
    [
      'a plain object holding an invalid DTO',
      {
        dto: invalidName(),
      },
    ],
    [
      'a list holding an invalid DTO',
      [
        invalidName(),
      ],
    ],
    [
      'a command with no DTO member',
      new PlainCommand('first'),
    ],
  ])('should pass an argument on unchanged when it is %s', (_condition, argument) => {
    // Arrange
    // Act
    const passed = service.echoArgument(argument);

    // Assert
    expect(passed).toBe(argument);
  });

  test('should validate an argument by its own class when its declared type is not a DTO', () => {
    // Arrange
    // Act
    const failures = failuresOf(() => service.echoArgument(invalidName()));

    // Assert
    expect(failures).toStrictEqual(NAME_IS_NOT_TEXT);
  });

  test('should validate the member of a command by the class of its value', () => {
    // Arrange
    const command = new GreetCommand(invalidName());

    // Act
    const failures = failuresOf(() => service.echoArgument(command));

    // Assert
    expect(failures).toStrictEqual(NAME_IS_NOT_TEXT);
  });

  test('should pass on a command of its class with the validated DTO in place of a member declared as a DTO', () => {
    // Arrange
    const command = new RenameCommand({
      name: 'Ada',
    });

    // Act
    const renamed = service.rename(command);

    // Assert
    expect(renamed).toStrictEqual(new RenameCommand(ADA));
  });

  test('should leave the command of the caller as it was', () => {
    // Arrange
    const command = new RenameCommand({
      name: 'Ada',
    });

    // Act
    service.rename(command);

    // Assert
    expect(command).toStrictEqual(
      new RenameCommand({
        name: 'Ada',
      }),
    );
  });

  test.each([
    [
      'an async method',
      NameService.prototype.saveName,
    ],
    [
      'a method declared to return a promise',
      NameService.prototype.loadName,
    ],
  ])('should reject the promise of %s instead of throwing', async (_condition, method) => {
    // Arrange
    // Act
    const rejection = await rejectionOf(
      callAsJavaScript(method, [
        {
          name: 42,
        },
      ]),
    );

    // Assert
    expect(rejection).toBeInstanceOf(ValidationError);
  });

  test('should reject the promise of an async function that carries no type metadata', async () => {
    // Arrange
    const descriptor: PropertyDescriptor = {
      value: async (dto: unknown): Promise<unknown> => await Promise.resolve(dto),
    };
    ValidateDto()({}, 'saveName', descriptor);

    // Act
    const rejection = await rejectionOf(
      Reflect.apply(descriptor.value, undefined, [
        invalidName(),
      ]),
    );

    // Assert
    expect(rejection).toBeInstanceOf(ValidationError);
  });

  test('should resolve an async method with what it returns when its DTO is valid', async () => {
    // Arrange
    // Act
    const dto = await service.saveName({
      name: 'Ada',
    });

    // Assert
    expect(dto).toStrictEqual(ADA);
  });

  test('should keep the metadata other decorators gave the method', () => {
    // Arrange
    // Act
    const mark: unknown = Reflect.getMetadata(MARK, NameService.prototype.markName);

    // Assert
    expect(mark).toBe('marked');
  });

  test('should leave a descriptor whose value is not a function as it is', () => {
    // Arrange
    const descriptor: PropertyDescriptor = {
      value: 'not a method',
    };

    // Act
    ValidateDto()({}, 'label', descriptor);

    // Assert
    expect(descriptor).toStrictEqual({
      value: 'not a method',
    });
  });

  test('should return nothing when it decorates a property', () => {
    // Arrange
    // Act
    const decorated: unknown = Reflect.apply(ValidateDto(), undefined, [
      NameDto.prototype,
      'name',
    ]);

    // Assert
    expect(decorated).toBeUndefined();
  });
});

describe('ValidateDto on a class', () => {
  test('should throw a ValidationError when a constructor DTO argument is invalid', () => {
    // Arrange
    // Act
    const failures = failuresOf(() => new LabelCommand(invalidName(), 'first'));

    // Assert
    expect(failures).toStrictEqual(NAME_IS_NOT_TEXT);
  });

  test('should construct the instance from the validated DTO', () => {
    // Arrange
    // Act
    const command = new LabelCommand(
      {
        name: 'Ada',
      },
      'first',
    );

    // Assert
    expect(command.dto).toStrictEqual(ADA);
  });

  test('should keep the name of the class', () => {
    // Arrange
    // Act
    const { name } = LabelCommand;

    // Assert
    expect(name).toBe('LabelCommand');
  });

  test('should return the class itself when no constructor argument is a DTO', () => {
    // Arrange
    // Act
    const decorated = ValidateDto()(PlainCommand);

    // Assert
    expect(decorated).toBe(PlainCommand);
  });

  test.each([
    [
      'an arrow function',
      (): undefined => undefined,
    ],
    [
      'an object with a prototype member',
      {
        prototype: {},
      },
    ],
  ])('should return nothing when a JavaScript caller decorates %s', (_condition, target) => {
    // Arrange
    // Act
    const decorated: unknown = Reflect.apply(ValidateDto(), undefined, [
      target,
    ]);

    // Assert
    expect(decorated).toBeUndefined();
  });
});
