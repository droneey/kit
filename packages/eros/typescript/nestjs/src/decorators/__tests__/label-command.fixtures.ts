import { ValidateDto } from '../validate-dto.decorator';
// biome-ignore lint/style/useImportType: emitDecoratorMetadata reads the parameter types at run time
import { NameDto } from './name-dto.fixtures';

@ValidateDto()
class LabelCommand {
  public readonly dto: NameDto;
  public readonly label: string;

  public constructor(dto: NameDto, label: string) {
    this.dto = dto;
    this.label = label;
  }
}

export { LabelCommand };
