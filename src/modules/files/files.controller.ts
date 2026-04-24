import { Controller, Post, Get, Delete, Body, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { FilesService } from './files.service';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly service: FilesService) {}

  @Post('upload-url')
  @ApiOperation({ summary: 'Generate a pre-signed S3 upload URL' })
  @ApiResponse({
    status: 201,
    description: 'Pre-signed URL generated',
    schema: {
      properties: { url: { type: 'string' }, key: { type: 'string' } },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file parameters' })
  getUploadUrl(
    @Body() body: { folder: string; filename: string; contentType: string },
  ) {
    return this.service.getUploadUrl(
      body.folder,
      body.filename,
      body.contentType,
    );
  }

  @Get('download-url')
  @ApiOperation({ summary: 'Generate a pre-signed S3 download URL' })
  @ApiResponse({
    status: 200,
    description: 'Pre-signed download URL generated',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 400, description: 'Missing file key' })
  getDownloadUrl(@Query('key') key: string) {
    return this.service.getDownloadUrl(key);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete a file from S3 storage' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  @ApiResponse({ status: 400, description: 'Missing file key' })
  delete(@Query('key') key: string) {
    return this.service.delete(key);
  }
}
