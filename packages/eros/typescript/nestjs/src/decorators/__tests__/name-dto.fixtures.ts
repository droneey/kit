import { IsString } from 'class-validator';

class NameDto {
  @IsString()
  public readonly name: string = '';
}

const invalidName = (): NameDto =>
  Object.assign(new NameDto(), {
    name: 42,
  });

export { invalidName, NameDto };
