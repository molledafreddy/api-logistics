import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @ApiPropertyOptional({ description: 'URL del archivo si type != text' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  fileName?: string;
}
