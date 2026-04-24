import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { RelationshipsService } from './relationships.service';
import {
  CreateRelationshipDto,
  RespondRelationshipDto,
  TerminateRelationshipDto,
} from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Relationships')
@ApiBearerAuth()
@Controller('relationships')
export class RelationshipsController {
  constructor(private readonly service: RelationshipsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a company relationship invitation' })
  @ApiResponse({ status: 201, description: 'Relationship invitation created' })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  create(@Body() dto: CreateRelationshipDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.sub);
  }

  @Get('company/:companyId')
  @ApiOperation({
    summary: 'List all relationships for a company (as parent or child)',
  })
  @ApiResponse({ status: 200, description: 'List of relationships' })
  findByCompany(@Param('companyId') companyId: string) {
    return this.service.findByCompany(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get relationship details by ID' })
  @ApiResponse({ status: 200, description: 'Relationship found' })
  @ApiResponse({ status: 404, description: 'Relationship not found' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id/respond')
  @ApiOperation({
    summary: 'Accept or reject a pending relationship invitation',
  })
  @ApiResponse({ status: 200, description: 'Relationship response recorded' })
  @ApiResponse({
    status: 400,
    description: 'Cannot respond to non-pending relationship',
  })
  @ApiResponse({ status: 404, description: 'Relationship not found' })
  respond(
    @Param('id') id: string,
    @Body() dto: RespondRelationshipDto,
    @CurrentUser() user: any,
  ) {
    return this.service.respond(id, dto, user.sub);
  }

  @Patch(':id/terminate')
  @ApiOperation({ summary: 'Terminate an active (accepted) relationship' })
  @ApiResponse({ status: 200, description: 'Relationship terminated' })
  @ApiResponse({
    status: 400,
    description: 'Cannot terminate non-accepted relationship',
  })
  @ApiResponse({ status: 404, description: 'Relationship not found' })
  terminate(
    @Param('id') id: string,
    @Body() dto: TerminateRelationshipDto,
    @CurrentUser() user: any,
  ) {
    return this.service.terminate(id, dto, user.sub);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get relationship status change history' })
  @ApiResponse({ status: 200, description: 'List of relationship logs' })
  @ApiResponse({ status: 404, description: 'Relationship not found' })
  getLogs(@Param('id') id: string) {
    return this.service.getLogs(id);
  }
}
