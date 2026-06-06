import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FilesService } from './files.service';

interface MulterFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

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

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file via server (proxy to S3)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Download URL of uploaded file',
    schema: { type: 'string' },
  })
  uploadFile(@UploadedFile() file: MulterFile, @Body('folder') folder: string) {
    return this.service.uploadBuffer(
      folder ?? 'uploads',
      file.originalname,
      file.buffer,
      file.mimetype,
    );
  }

  @Get('local/*')
  @ApiOperation({
    summary: 'Serve locally stored file (STORAGE_PROVIDER=local only)',
  })
  serveLocal(@Param('0') key: string, @Res() res: Response) {
    const filePath = this.service.getLocalFilePath(key);
    return res.sendFile(filePath, (err) => {
      if (err) throw new NotFoundException(`File not found: ${key}`);
    });
  }

  @Delete()
  @ApiOperation({ summary: 'Delete a file from S3 storage' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  @ApiResponse({ status: 400, description: 'Missing file key' })
  delete(@Query('key') key: string) {
    return this.service.delete(key);
  }
}
