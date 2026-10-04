import { Type } from 'class-transformer';

import { NameDto } from './name-dto.fixtures';

/** A command whose member declares its DTO, so the compiler records the member's type. */
class RenameCommand {
  @Type(() => NameDto)
  public readonly payload: NameDto;

  public constructor(payload: NameDto) {
    this.payload = payload;
  }
}

export { RenameCommand };
