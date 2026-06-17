import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DevicePlatform } from '../entities/push-token.entity';

export class RegisterPushTokenDto {
  @ApiProperty({
    description: 'Expo push token obtenido desde el dispositivo móvil',
    maxLength: 500,
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token!: string;

  @ApiProperty({
    description: 'Plataforma del dispositivo',
    enum: DevicePlatform,
    example: DevicePlatform.ANDROID,
  })
  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @ApiPropertyOptional({
    description: 'Nombre descriptivo del dispositivo',
    maxLength: 100,
    example: 'Chrome en MacBook',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;
}
