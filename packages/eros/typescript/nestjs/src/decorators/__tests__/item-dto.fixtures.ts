import { IsInt } from 'class-validator';

class ItemDto {
  @IsInt()
  public readonly quantity: number = 1;
}

export { ItemDto };
