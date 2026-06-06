import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralConfig } from './entities/referral-config.entity';
import { ReferralLink } from './entities/referral-link.entity';
import { Referral } from './entities/referral.entity';
import { Company } from '../companies/entities/company.entity';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { ReferralsLandingController } from './referrals-landing.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ReferralConfig, ReferralLink, Referral, Company]),
  ],
  controllers: [ReferralsController, ReferralsLandingController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
