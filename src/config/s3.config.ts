import { registerAs } from '@nestjs/config';

export const s3Config = registerAs('s3', () => ({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.S3_SECRET_KEY || 'minioadmin123',
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  buckets: {
    avatars: process.env.S3_BUCKET_AVATARS || 'logistics-avatars',
    documents: process.env.S3_BUCKET_DOCUMENTS || 'logistics-documents',
    receipts: process.env.S3_BUCKET_RECEIPTS || 'logistics-receipts',
    chat: process.env.S3_BUCKET_CHAT || 'logistics-chat',
    exports: process.env.S3_BUCKET_EXPORTS || 'logistics-exports',
  },
}));
