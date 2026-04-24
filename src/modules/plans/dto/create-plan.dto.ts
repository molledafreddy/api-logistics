import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  price: number;

  @IsString()
  interval: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
