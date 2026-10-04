import { ValidateDto } from '../validate-dto.decorator';
// biome-ignore lint/style/useImportType: emitDecoratorMetadata reads the parameter types at run time
import { GroupNameDto } from './group-name-dto.fixtures';
// biome-ignore lint/style/useImportType: emitDecoratorMetadata reads the parameter types at run time
import { LooseOrderDto } from './loose-order-dto.fixtures';
// biome-ignore lint/style/useImportType: emitDecoratorMetadata reads the parameter types at run time
import { NameDto } from './name-dto.fixtures';
// biome-ignore lint/style/useImportType: emitDecoratorMetadata reads the parameter types at run time
import { OrderDto } from './order-dto.fixtures';
// biome-ignore lint/style/useImportType: emitDecoratorMetadata reads the parameter types at run time
import { RenameCommand } from './rename-command.fixtures';

const MARK = 'test:mark';

/** Gives the method a mark of its own, as Nest's route decorators do. */
const marked: MethodDecorator = (_target, _key, descriptor) => {
  Reflect.defineMetadata(MARK, 'marked', descriptor.value ?? {});
};

class NameService {
  public readonly greeting: string = 'Hello';

  @ValidateDto()
  public echoName(dto: NameDto): NameDto {
    return dto;
  }

  @ValidateDto()
  public echoGroupName(dto: GroupNameDto): GroupNameDto {
    return dto;
  }

  @ValidateDto()
  public greetName(dto: NameDto): string {
    return `${this.greeting}, ${dto.name}`;
  }

  @ValidateDto()
  public echoArgument(argument: unknown): unknown {
    return argument;
  }

  @ValidateDto()
  public echoOrder(dto: OrderDto): OrderDto {
    return dto;
  }

  @ValidateDto()
  public echoLooseOrder(dto: LooseOrderDto): LooseOrderDto {
    return dto;
  }

  @ValidateDto()
  public rename(command: RenameCommand): RenameCommand {
    return command;
  }

  @ValidateDto()
  public async saveName(dto: NameDto): Promise<NameDto> {
    return await Promise.resolve(dto);
  }

  @ValidateDto()
  public loadName(dto: NameDto): Promise<NameDto> {
    return Promise.resolve(dto);
  }

  @ValidateDto()
  @marked
  public markName(dto: NameDto): NameDto {
    return dto;
  }
}

export { MARK, NameService };
