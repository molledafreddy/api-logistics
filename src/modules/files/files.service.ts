import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdir, writeFile, unlink } from 'fs/promises';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly storageProvider: 's3' | 'local';
  private readonly s3: S3Client;
  private readonly s3Internal: S3Client;
  private readonly bucket: string;
  private readonly appUrl: string;
  private readonly uploadsDir: string;

  constructor(private readonly config: ConfigService) {
    this.storageProvider = (this.config.get<string>('STORAGE_PROVIDER') ??
      's3') as 's3' | 'local';
    this.appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    this.uploadsDir = join(process.cwd(), 'uploads');

    this.bucket = this.config.get<string>('S3_BUCKET', 'logistics-files');
    const credentials = {
      accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID', ''),
      secretAccessKey: this.config.get<string>('S3_SECRET_ACCESS_KEY', ''),
    };
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    const publicEndpoint = this.config.get<string>('S3_ENDPOINT');
    const internalEndpoint =
      this.config.get<string>('S3_ENDPOINT_INTERNAL') ?? publicEndpoint;

    this.s3 = new S3Client({
      region,
      endpoint: publicEndpoint,
      forcePathStyle: true,
      credentials,
    });
    this.s3Internal = new S3Client({
      region,
      endpoint: internalEndpoint,
      forcePathStyle: true,
      credentials,
    });

    this.logger.log(`Storage provider: ${this.storageProvider}`);
  }

  // ─── Upload URL (presigned) ────────────────────────────────────────────────
  async getUploadUrl(
    folder: string,
    filename: string,
    contentType: string,
  ): Promise<{ url: string; key: string }> {
    if (this.storageProvider === 'local') {
      // Return a fake key; the actual upload goes through POST /files/upload
      const key = `${folder}/${randomUUID()}-${filename}`;
      return { url: `${this.appUrl}/api/v1/files/upload`, key };
    }
    const key = `${folder}/${randomUUID()}-${filename}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.s3, command, { expiresIn: 3600 });
    return { url, key };
  }

  // ─── Download URL (presigned or local) ────────────────────────────────────
  async getDownloadUrl(key: string): Promise<string> {
    if (this.storageProvider === 'local') {
      return `${this.appUrl}/api/v1/files/local/${key}`;
    }
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────
  async delete(key: string): Promise<void> {
    if (this.storageProvider === 'local') {
      await unlink(join(this.uploadsDir, key)).catch(() => undefined);
      return;
    }
    await this.s3Internal.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  // ─── Upload buffer (proxy upload from server) ─────────────────────────────
  async uploadBuffer(
    folder: string,
    originalname: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const ext = extname(originalname) || '.bin';
    const filename = `${randomUUID()}${ext}`;
    const key = `${folder}/${filename}`;

    if (this.storageProvider === 'local') {
      const dir = join(this.uploadsDir, folder);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, filename), buffer);
      this.logger.log(`File saved locally: ${key}`);
      return `${this.appUrl}/api/v1/files/local/${key}`;
    }

    await this.s3Internal.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return this.getDownloadUrl(key);
  }

  // ─── Read local file (dev only) ───────────────────────────────────────────
  getLocalFilePath(key: string): string {
    return join(this.uploadsDir, key);
  }
}
