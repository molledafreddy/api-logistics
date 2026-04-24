import { IsString, IsOptional } from 'class-validator';

export class CreatePermissionDefinitionDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  feature?: string;
}
