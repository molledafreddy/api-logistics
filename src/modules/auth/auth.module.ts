import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SupabaseService } from './supabase.service';
import { SupabaseJwtStrategy } from './strategies/supabase-jwt.strategy';
import { User } from './entities/user.entity';
import { Company } from '../companies/entities/company.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'supabase-jwt' }),
    TypeOrmModule.forFeature([User, Company]),
  ],
  controllers: [AuthController],
  providers: [AuthService, SupabaseService, SupabaseJwtStrategy],
  exports: [AuthService, SupabaseService],
})
export class AuthModule {}
