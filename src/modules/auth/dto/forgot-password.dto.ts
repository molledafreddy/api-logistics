import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'juan@empresa.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email!: string;
}
