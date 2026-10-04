import { IsString } from 'class-validator';

/** Its only constraint belongs to a group, which validation without groups still checks. */
class GroupNameDto {
  @IsString({
    groups: [
      'admin',
    ],
  })
  public readonly name: string = '';
}

export { GroupNameDto };
