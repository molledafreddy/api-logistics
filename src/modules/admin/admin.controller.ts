import { Controller, Get, Patch, Param, Query, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CompanyStatus } from '../../common/enums/company-status.enum';
import { VerificationStatus } from '../../common/enums/verification-status.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// We import entities directly to keep Admin simple
import { Company } from '../companies/entities/company.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Verification } from '../verifications/entities/verification.entity';

class UpdateCompanyAdminDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @IsOptional() @IsEnum(CompanyStatus) status?: CompanyStatus;
  @IsOptional() @IsString() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@Roles(UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Verification)
    private readonly verificationRepo: Repository<Verification>,
  ) {}

  // ─── Dashboard ─────────────────────
  @Get('dashboard')
  @ApiOperation({ summary: 'Admin dashboard stats' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async dashboard() {
    const [companies, subscriptions, verifications] = await Promise.all([
      this.companyRepo.count(),
      this.subscriptionRepo.count(),
      this.verificationRepo.count(),
    ]);
    return { companies, subscriptions, verifications };
  }

  // ─── Companies ─────────────────────
  @Get('companies')
  @ApiOperation({ summary: 'List all companies (admin)' })
  @ApiResponse({ status: 200, description: 'List of all companies' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  listCompanies(@Query('page') page?: string, @Query('limit') limit?: string) {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    return this.companyRepo.find({
      order: { createdAt: 'DESC' },
      skip: (p - 1) * l,
      take: l,
    });
  }

  @Get('companies/:id')
  @ApiOperation({ summary: 'Get company detail (admin)' })
  @ApiResponse({ status: 200, description: 'Company details' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  getCompany(@Param('id') id: string) {
    return this.companyRepo.findOneByOrFail({ id });
  }

  @Patch('companies/:id')
  @ApiOperation({ summary: 'Update company (admin)' })
  @ApiResponse({ status: 200, description: 'Company updated' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateCompany(
    @Param('id') id: string,
    @Body() body: UpdateCompanyAdminDto,
  ) {
    await this.companyRepo.update(id, body);
    return this.companyRepo.findOneByOrFail({ id });
  }

  // ─── Subscriptions ─────────────────
  @Get('subscriptions')
  @ApiOperation({ summary: 'List all subscriptions (admin)' })
  @ApiResponse({ status: 200, description: 'List of all subscriptions' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  listSubscriptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    return this.subscriptionRepo.find({
      order: { created_at: 'DESC' as const },
      skip: (p - 1) * l,
      take: l,
    });
  }

  // ─── Verifications ─────────────────
  @Get('verifications')
  @ApiOperation({ summary: 'List all verifications (admin)' })
  @ApiResponse({ status: 200, description: 'List of all verifications' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  listVerifications(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const where = status ? { status: status as VerificationStatus } : {};
    return this.verificationRepo.find({
      where,
      order: { createdAt: 'DESC' },
      skip: (p - 1) * l,
      take: l,
    });
  }
}
