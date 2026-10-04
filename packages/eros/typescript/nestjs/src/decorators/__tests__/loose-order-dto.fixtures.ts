import { ValidateNested } from 'class-validator';

/** Without @Type, a nested plain object reaches the validator as a value it knows nothing of. */
class LooseOrderDto {
  @ValidateNested()
  public readonly item: object = {};
}

export { LooseOrderDto };
