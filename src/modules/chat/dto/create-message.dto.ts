import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateMessageDto {
  @ApiPropertyOptional({
    enum: ['text', 'image', 'file', 'system'],
    default: 'text',
  })
  @IsIn(['text', 'image', 'file', 'system'])
  @IsOptional()
  type?: 'text' | 'image' | 'file' | 'system';

  @ApiProperty({ description: 'Contenido del mensaje' })
  @IsString()
  @MaxLength(5000)
  content!: string;

  @ApiPropertyOptional({
    description: 'URL del archivo si type es image o file',
  })
  @ValidateIf((o) => o.type === 'image' || o.type === 'file')
  @IsUrl()
  @MaxLength(500)
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  fileName?: string;
}
