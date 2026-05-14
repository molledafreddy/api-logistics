import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterPushTokenDto {
  @ApiProperty({
    description:
      'FCM registration token obtenido desde el navegador o app móvil',
    maxLength: 500,
    example:
      'dCPtjiB3d0wlUCSeibrF8k:APA91bGMSImQl2mvPSKOEYdpdeSzb1NKVC1Wv5yrhN8GnCAz3bD9WpBoHucU1Xi0qjUWbVJO7zpvFLhmq8iHWI390Vh0LejVeMSK4MAtatmNolBYLTui8nw',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token!: string;

  @ApiProperty({
    description: 'Plataforma del dispositivo',
    maxLength: 20,
    enum: ['web', 'android', 'ios'],
    example: 'web',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  platform!: string;

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
