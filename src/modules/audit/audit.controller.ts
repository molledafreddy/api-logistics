import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get('company/:companyId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get audit logs for a company (paginated)' })
  @ApiResponse({ status: 200, description: 'List of audit logs for company' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findByCompany(
    @Param('companyId') companyId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findByCompany(
      companyId,
      Number(page) || 1,
      Number(limit) || 50,
    );
  }

  @Get(':resourceType/:resourceId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Get audit logs for a specific resource (e.g., company, verification, subscription)',
  })
  @ApiResponse({ status: 200, description: 'List of audit logs for resource' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findByResource(
    @Param('resourceType') entityType: string,
    @Param('resourceId') entityId: string,
  ) {
    return this.service.findByResource(entityType, entityId);
  }
}
