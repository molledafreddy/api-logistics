import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Verification } from './entities/verification.entity';
import { VerificationDocument } from './entities/verification-document.entity';
import { VerificationTier } from './entities/verification-tier.entity';
import { Company } from '../companies/entities/company.entity';
import { VerificationsService } from './verifications.service';
import { VerificationsController } from './verifications.controller';
import { ComplianceService } from './compliance.service';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Verification,
      VerificationDocument,
      VerificationTier,
      Company,
    ]),
  ],
  controllers: [VerificationsController],
  providers: [VerificationsService, ComplianceService, OnboardingService],
  exports: [VerificationsService, ComplianceService, OnboardingService],
})
export class VerificationsModule {}
