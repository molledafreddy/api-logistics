import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FilesService } from './files.service';

// ─── Mocks de AWS SDK ───────────────────────────────────────────
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

const mockGetSignedUrl = jest.fn();
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

describe('FilesService', () => {
  let service: FilesService;

  beforeEach(async () => {
    mockSend.mockReset();
    mockGetSignedUrl.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: string) => def ?? '',
          },
        },
      ],
    }).compile();
    service = module.get(FilesService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUploadUrl', () => {
    it('returns signed url and key with folder/filename', async () => {
      mockGetSignedUrl.mockResolvedValue('https://s3.example/upload');
      const res = await service.getUploadUrl(
        'docs',
        'a.pdf',
        'application/pdf',
      );
      expect(res.url).toBe('https://s3.example/upload');
      expect(res.key).toMatch(/^docs\/.+-a\.pdf$/);
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDownloadUrl', () => {
    it('returns presigned url for given key', async () => {
      mockGetSignedUrl.mockResolvedValue('https://s3.example/download');
      const url = await service.getDownloadUrl('docs/x.pdf');
      expect(url).toBe('https://s3.example/download');
    });
  });

  describe('delete', () => {
    it('calls s3.send with DeleteObjectCommand', async () => {
      mockSend.mockResolvedValue({});
      await service.delete('docs/x.pdf');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });
});
