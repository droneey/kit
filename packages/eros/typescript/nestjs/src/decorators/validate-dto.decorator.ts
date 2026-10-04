import 'reflect-metadata';

import { ValidationError } from '@droneey/eros';
import { plainToInstance } from 'class-transformer';
import type { ValidatorOptions } from 'class-validator';
import { getMetadataStorage, validateSync } from 'class-validator';

import { toValidationFailures } from '../utils';

// JavaScript lets a class be called with any arguments, which is what this type says.
type DtoClass = new (...args: unknown[]) => object;

type AnyClass = new (...args: never[]) => object;

type ValidatedMethod = (this: unknown, ...args: unknown[]) => unknown;

const VALIDATOR_OPTIONS: ValidatorOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
};

// A wrapper of these is data, not a command whose members are DTOs.
const PLAIN_CONSTRUCTORS: ReadonlySet<unknown> = new Set([
  Object,
  Array,
]);

// No schema and no `always` option are in use, so these two select every constraint alike.
// Stryker disable next-line StringLiteral: no schema is registered under any name
const NO_SCHEMA = '';
// Stryker disable next-line BooleanLiteral: with no groups asked for, `always` includes what it would exclude
const IS_ALWAYS = false;
// As validateSync does by default: a constraint in a group still counts.
const HAS_STRICT_GROUPS = false;

// An arrow function has no prototype object, so it cannot be a class.
const isClass = (candidate: unknown): candidate is DtoClass =>
  typeof candidate === 'function' && typeof candidate.prototype === 'object';

const isDtoClass = (candidate: unknown): candidate is DtoClass =>
  isClass(candidate) &&
  getMetadataStorage().getTargetValidationMetadatas(
    candidate,
    NO_SCHEMA,
    IS_ALWAYS,
    HAS_STRICT_GROUPS,
  ).length > 0;

const isObject = (candidate: unknown): candidate is object =>
  typeof candidate === 'object' && candidate !== null;

const constructorOf = (candidate: unknown): unknown =>
  isObject(candidate) ? candidate.constructor : undefined;

const typesOf = (metadata: unknown): readonly unknown[] =>
  // Stryker disable next-line ArrayDeclaration: no types and types that are not classes name no DTO alike
  Array.isArray(metadata) ? metadata : [];

const validateDto = (candidate: unknown, dtoClass: DtoClass): object => {
  const instance =
    candidate instanceof dtoClass ? candidate : plainToInstance(dtoClass, candidate ?? {});
  const errors = validateSync(instance, VALIDATOR_OPTIONS);

  if (errors.length > 0) {
    throw new ValidationError({
      errors: toValidationFailures(errors),
    });
  }

  return instance;
};

interface ValidateArgumentInput {
  readonly argument: unknown;
  /** The type the compiler recorded for the parameter, if any. */
  readonly declaredType: unknown;
}

interface ValidateArgumentsInput {
  readonly args: readonly unknown[];
  readonly declaredTypes: readonly unknown[];
}

interface CopyMetadataInput {
  readonly source: object;
  readonly target: object;
}

/**
 * Validates each member of a command or a query that holds a DTO, by the member's declared type or
 * by the class of its value. A wrapper with such a member is passed on as a copy of its class that
 * holds the validated instances; the caller's own is left as it was.
 */
const validateMembers = (wrapper: object): object => {
  const validatedMembers = Object.keys(wrapper).flatMap((name) => {
    const member: unknown = Reflect.get(wrapper, name);
    const dtoClass = [
      Reflect.getMetadata('design:type', wrapper, name),
      constructorOf(member),
    ].find(isDtoClass);

    return dtoClass === undefined
      ? []
      : [
          [
            name,
            validateDto(member, dtoClass),
          ] as const,
        ];
  });

  if (validatedMembers.length === 0) {
    return wrapper;
  }

  const copy: object = Object.create(Object.getPrototypeOf(wrapper));

  return Object.assign(copy, wrapper, Object.fromEntries(validatedMembers));
};

const validateArgument = ({ argument, declaredType }: ValidateArgumentInput): unknown => {
  const dtoClass = [
    declaredType,
    constructorOf(argument),
  ].find(isDtoClass);

  if (dtoClass !== undefined) {
    return validateDto(argument, dtoClass);
  }

  return isObject(argument) && !PLAIN_CONSTRUCTORS.has(argument.constructor)
    ? validateMembers(argument)
    : argument;
};

const validateArguments = ({ args, declaredTypes }: ValidateArgumentsInput): unknown[] =>
  args.map((argument, index) =>
    validateArgument({
      argument,
      declaredType: declaredTypes[index],
    }),
  );

const copyMetadata = ({ source, target }: CopyMetadataInput): void => {
  for (const key of Reflect.getMetadataKeys(source)) {
    Reflect.defineMetadata(key, Reflect.getMetadata(key, source), target);
  }
};

const decorateMethod = (
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): void => {
  const method: unknown = descriptor.value;

  if (typeof method !== 'function') {
    return;
  }

  const isAsync =
    Reflect.getMetadata('design:returntype', target, propertyKey) === Promise ||
    method.constructor.name === 'AsyncFunction';

  const validated: ValidatedMethod = function (this: unknown, ...args) {
    try {
      return Reflect.apply(
        method,
        this,
        validateArguments({
          args,
          declaredTypes: typesOf(Reflect.getMetadata('design:paramtypes', target, propertyKey)),
        }),
      );
    } catch (error: unknown) {
      if (isAsync) {
        return Promise.reject(error);
      }

      throw error;
    }
  };

  copyMetadata({
    source: method,
    target: validated,
  });
  descriptor.value = validated;
};

const decorateClass = (target: DtoClass): DtoClass => {
  const declaredTypes = typesOf(Reflect.getMetadata('design:paramtypes', target));

  if (!declaredTypes.some(isDtoClass)) {
    return target;
  }

  // The subclass inherits the class's metadata through its prototype chain.
  const Validated = class extends target {
    public constructor(...args: unknown[]) {
      super(
        ...validateArguments({
          args,
          declaredTypes,
        }),
      );
    }
  };

  Object.defineProperty(Validated, 'name', {
    value: target.name,
  });

  return Validated;
};

function decorate<TClass extends AnyClass>(target: TClass): TClass;
function decorate(
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): PropertyDescriptor;
function decorate(
  target: object,
  propertyKey?: string | symbol,
  descriptor?: PropertyDescriptor,
): object | undefined {
  if (propertyKey === undefined) {
    return isClass(target) ? decorateClass(target) : undefined;
  }

  if (descriptor !== undefined) {
    decorateMethod(target, propertyKey, descriptor);
  }

  return descriptor;
}

/**
 * Validates the DTOs a method or a constructor receives — a command, a query, a handler's input —
 * and throws a ValidationError whose pointers locate each failure inside its DTO. A DTO is a class
 * with class-validator constraints; one held by a member of an argument is validated too.
 */
const ValidateDto = (): typeof decorate => decorate;

export { ValidateDto };
