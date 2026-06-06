import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Verification } from './entities/verification.entity';
import { VerificationDocument } from './entities/verification-document.entity';
import { VerificationTier } from './entities/verification-tier.entity';
import { Company } from '../companies/entities/company.entity';
import { User } from '../auth/entities/user.entity';
import { Truck } from '../trucks/entities/truck.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { VerificationsService } from './verifications.service';
import { VerificationsController } from './verifications.controller';
import { ComplianceService } from './compliance.service';
import { OnboardingService } from './onboarding.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Verification,
      VerificationDocument,
      VerificationTier,
      Company,
      User,
      Truck,
      Driver,
    ]),
    NotificationsModule,
  ],
  controllers: [VerificationsController],
  providers: [VerificationsService, ComplianceService, OnboardingService],
  exports: [VerificationsService, ComplianceService, OnboardingService],
})
export class VerificationsModule {}
