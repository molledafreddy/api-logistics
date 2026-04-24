import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { Company } from '../companies/entities/company.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Verification } from '../verifications/entities/verification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Company, Subscription, Verification])],
  controllers: [AdminController],
})
export class AdminModule {}
