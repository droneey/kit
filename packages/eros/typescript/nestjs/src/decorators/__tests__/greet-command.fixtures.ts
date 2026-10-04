import type { NameDto } from './name-dto.fixtures';

/** A command with no decorator, so only the class of its member's value names the DTO. */
class GreetCommand {
  public readonly payload: NameDto;

  public constructor(payload: NameDto) {
    this.payload = payload;
  }
}

export { GreetCommand };
