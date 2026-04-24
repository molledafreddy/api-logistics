import { IsUUID, IsEnum, IsOptional, IsString, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationshipType } from '../../../common/enums/relationship-type.enum';

export class CreateRelationshipDto {
  @ApiProperty({ description: 'UUID of the parent/parent company' })
  @IsUUID()
  parentCompanyId!: string;

  @ApiProperty({ description: 'UUID of the child/partner company' })
  @IsUUID()
  childCompanyId!: string;

  @ApiProperty({
    enum: RelationshipType,
    description:
      'Type of relationship (covered_carrier, associated_company, client_carrier)',
  })
  @IsEnum(RelationshipType)
  relationshipType!: RelationshipType;

  @ApiPropertyOptional({ description: 'Email address to send invitation to' })
  @IsOptional()
  @IsEmail()
  invitationEmail?: string;

  @ApiPropertyOptional({ description: 'Message to include in invitation' })
  @IsOptional()
  @IsString()
  invitationMessage?: string;
}

export class RespondRelationshipDto {
  @ApiProperty({
    enum: ['accepted', 'rejected'],
    description: 'Decision on the relationship invitation',
  })
  @IsEnum(['accepted', 'rejected'] as const)
  decision!: 'accepted' | 'rejected';

  @ApiPropertyOptional({
    description: 'Reason for rejection (required if decision is rejected)',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class TerminateRelationshipDto {
  @ApiProperty({ description: 'Reason for terminating the relationship' })
  @IsString()
  reason!: string;
}
