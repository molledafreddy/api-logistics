import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { VerificationsService } from './verifications.service';
import { ComplianceService } from './compliance.service';
import { OnboardingService } from './onboarding.service';
import {
  CreateVerificationDto,
  ReviewVerificationDto,
  CreateVerificationTierDto,
  AddDocumentDto,
} from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

const { SUPER_ADMIN, COMPANY_OWNER, ADMIN, MANAGER } = UserRole;
import { ServiceType } from '../../common/enums/service-type.enum';
import { BusinessModel } from '../../common/enums/business-model.enum';

@ApiTags('Verifications')
@ApiBearerAuth()
@Controller('verifications')
export class VerificationsController {
  constructor(
    private readonly service: VerificationsService,
    private readonly compliance: ComplianceService,
    private readonly onboarding: OnboardingService,
  ) {}

  // ─── Tiers ─────────────────────────
  @Get('tiers')
  @ApiOperation({ summary: 'List all active verification tiers' })
  @ApiResponse({ status: 200, description: 'List of verification tiers' })
  findAllTiers() {
    return this.service.findAllTiers();
  }

  @Post('tiers')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a verification tier (admin)' })
  @ApiResponse({ status: 201, description: 'Verification tier created' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  createTier(@Body() dto: CreateVerificationTierDto) {
    return this.service.createTier(dto);
  }

  // ─── Verifications ─────────────────
  @Post()
  @Roles(SUPER_ADMIN, COMPANY_OWNER, ADMIN)
  @ApiOperation({ summary: 'Create a new verification request' })
  @ApiResponse({ status: 201, description: 'Verification request created' })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  @ApiResponse({ status: 404, description: 'Company or tier not found' })
  create(@Body() dto: CreateVerificationDto) {
    return this.service.create(dto);
  }

  @Get('company/:companyId')
  @Roles(SUPER_ADMIN, COMPANY_OWNER, ADMIN, MANAGER)
  @ApiOperation({ summary: 'List verifications for a company' })
  @ApiResponse({ status: 200, description: 'List of verifications' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  findByCompany(@Param('companyId') companyId: string) {
    return this.service.findByCompany(companyId);
  }

  @Get(':id')
  @Roles(SUPER_ADMIN, COMPANY_OWNER, ADMIN, MANAGER)
  @ApiOperation({ summary: 'Get verification by ID' })
  @ApiResponse({ status: 200, description: 'Verification details' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id/submit')
  @Roles(SUPER_ADMIN, COMPANY_OWNER, ADMIN)
  @ApiOperation({ summary: 'Submit verification for review' })
  @ApiResponse({ status: 200, description: 'Verification submitted' })
  @ApiResponse({ status: 400, description: 'Missing required documents' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  submit(@Param('id') id: string) {
    return this.service.submit(id);
  }

  @Patch(':id/review')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve or reject a verification (admin)' })
  @ApiResponse({ status: 200, description: 'Verification reviewed' })
  @ApiResponse({ status: 400, description: 'Invalid decision' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  review(
    @Param('id') id: string,
    @Body() dto: ReviewVerificationDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.service.review(id, dto, user.sub);
  }

  // ─── Documents ─────────────────────
  @Post(':id/documents')
  @Roles(SUPER_ADMIN, COMPANY_OWNER, ADMIN)
  @ApiOperation({ summary: 'Add a document to a verification' })
  @ApiResponse({ status: 201, description: 'Document added' })
  @ApiResponse({ status: 400, description: 'Invalid document' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  addDocument(@Param('id') id: string, @Body() body: AddDocumentDto) {
    return this.service.addDocument(id, body);
  }

  @Get(':id/documents')
  @Roles(SUPER_ADMIN, COMPANY_OWNER, ADMIN, MANAGER)
  @ApiOperation({ summary: 'List documents for a verification' })
  @ApiResponse({ status: 200, description: 'List of documents' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  findDocuments(@Param('id') id: string) {
    return this.service.findDocuments(id);
  }

  // ─── Compliance + Onboarding (PARTE 7 · Sprint 6) ──
  @Get('compliance/:companyId')
  @Roles(SUPER_ADMIN, COMPANY_OWNER, ADMIN, MANAGER)
  @ApiOperation({
    summary: 'Snapshot de cumplimiento (MV-002) para una empresa',
    description:
      'Devuelve el tier requerido según serviceType, el tier vigente actual y, si la empresa NO puede operar, el motivo y los documentos faltantes.',
  })
  @ApiResponse({ status: 200, description: 'ComplianceStatusDto' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  getCompliance(@Param('companyId') companyId: string) {
    return this.compliance.getCompanyCompliance(companyId);
  }

  @Get('onboarding/:companyId')
  @Roles(SUPER_ADMIN, COMPANY_OWNER, ADMIN, MANAGER)
  @ApiOperation({
    summary: 'Wizard de onboarding personalizado para la empresa',
    description:
      'Devuelve la lista ordenada de pasos según serviceType + businessModel, marcando cuáles ya están completos y un porcentaje agregado.',
  })
  @ApiResponse({ status: 200, description: 'OnboardingWizardDto' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  getOnboarding(@Param('companyId') companyId: string) {
    return this.onboarding.getWizardForCompany(companyId);
  }

  @Get('onboarding')
  @ApiOperation({
    summary: 'Preview pública del wizard (sin estado) por serviceType',
  })
  @ApiQuery({ name: 'serviceType', enum: ServiceType, required: true })
  @ApiQuery({ name: 'businessModel', enum: BusinessModel, required: false })
  @ApiResponse({ status: 200, description: 'OnboardingWizardDto (preview)' })
  previewOnboarding(
    @Query('serviceType') serviceType: ServiceType,
    @Query('businessModel') businessModel?: BusinessModel,
  ) {
    return this.onboarding.previewWizard(serviceType, businessModel);
  }
}
