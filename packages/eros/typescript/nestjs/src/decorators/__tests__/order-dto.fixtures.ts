import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { ItemDto } from './item-dto.fixtures';

class OrderDto {
  @ValidateNested()
  @Type(() => ItemDto)
  public readonly items: readonly ItemDto[] = [];
}

export { OrderDto };
