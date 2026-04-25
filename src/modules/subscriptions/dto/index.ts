import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsUUID, Min } from 'class-validator';

export class CreateFreeSubscriptionDto {
  @ApiProperty({ description: 'Company UUID', format: 'uuid' })
  @IsUUID()
  companyId!: string;

  @ApiProperty({ description: 'Plan UUID', format: 'uuid' })
  @IsUUID()
  planId!: string;
}

export class ChangePlanDto {
  @ApiProperty({ description: 'Target plan UUID', format: 'uuid' })
  @IsUUID()
  newPlanId!: string;
}

export class AddAddonDto {
  @ApiProperty({ description: 'Addon type identifier', example: 'extra_users' })
  @IsString()
  @IsNotEmpty()
  addon_type!: string;

  @ApiProperty({ description: 'Quantity of units', example: 5, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class UpdateAddonQuantityDto {
  @ApiProperty({ description: 'New quantity', example: 10, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}
