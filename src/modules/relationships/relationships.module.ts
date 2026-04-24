import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyRelationship } from './entities/company-relationship.entity';
import { CompanyRelationshipLog } from './entities/company-relationship-log.entity';
import { RelationshipsService } from './relationships.service';
import { RelationshipsController } from './relationships.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyRelationship, CompanyRelationshipLog]),
  ],
  controllers: [RelationshipsController],
  providers: [RelationshipsService],
  exports: [RelationshipsService],
})
export class RelationshipsModule {}
