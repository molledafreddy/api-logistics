import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VerificationsService } from './verifications.service';
import { Verification } from './entities/verification.entity';
import { VerificationDocument } from './entities/verification-document.entity';
import { VerificationTier } from './entities/verification-tier.entity';
import { Company } from '../companies/entities/company.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { VerificationStatus } from '../../common/enums/verification-status.enum';

const repoMock = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'v1', ...x })),
  find: jest.fn(async () => []),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
});

describe('VerificationsService', () => {
  let service: VerificationsService;
  let vRepo: ReturnType<typeof repoMock>;
  let docRepo: ReturnType<typeof repoMock>;
  let tierRepo: ReturnType<typeof repoMock>;

  beforeEach(async () => {
    vRepo = repoMock();
    docRepo = repoMock();
    tierRepo = repoMock();

    const module = await Test.createTestingModule({
      providers: [
        VerificationsService,
        { provide: getRepositoryToken(Verification), useValue: vRepo },
        {
          provide: getRepositoryToken(VerificationDocument),
          useValue: docRepo,
        },
        { provide: getRepositoryToken(VerificationTier), useValue: tierRepo },
        {
          provide: getRepositoryToken(Company),
          useValue: {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            save: jest.fn(async (x: any) => x),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            sendVerificationApproved: jest.fn().mockResolvedValue(undefined),
            sendVerificationRejected: jest.fn().mockResolvedValue(undefined),
            sendVerificationSubmitted: jest.fn().mockResolvedValue(undefined),
            sendToCompany: jest.fn().mockResolvedValue(undefined),
            sendToUser: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();
    service = module.get(VerificationsService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('tiers', () => {
    it('findAllTiers returns active tiers ordered', async () => {
      await service.findAllTiers();
      expect(tierRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('createTier persists', async () => {
      await service.createTier({ code: 'basic' } as Partial<VerificationTier>);
      expect(tierRepo.create).toHaveBeenCalled();
      expect(tierRepo.save).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('throws NotFound if tier missing', async () => {
      tierRepo.findOneBy.mockResolvedValueOnce(undefined);
      await expect(
        service.create({ companyId: 'c1', tierId: 't1' } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('persists with PENDING status when tier exists', async () => {
      tierRepo.findOneBy.mockResolvedValueOnce({ id: 't1' });
      const res = await service.create({
        companyId: 'c1',
        tierId: 't1',
      } as never);
      expect(res).toMatchObject({ status: VerificationStatus.PENDING });
    });
  });

  describe('findById', () => {
    it('throws NotFound if missing', async () => {
      vRepo.findOne.mockResolvedValueOnce(undefined);
      await expect(service.findById('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns entity if found', async () => {
      vRepo.findOne.mockResolvedValueOnce({ id: 'v1' });
      const res = await service.findById('v1');
      expect(res).toMatchObject({ id: 'v1' });
    });
  });

  describe('submit', () => {
    it('rejects if not PENDING', async () => {
      vRepo.findOne.mockResolvedValueOnce({
        id: 'v1',
        status: VerificationStatus.APPROVED,
      });
      await expect(service.submit('v1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('moves to IN_REVIEW and stamps submittedAt', async () => {
      vRepo.findOne.mockResolvedValueOnce({
        id: 'v1',
        status: VerificationStatus.PENDING,
      });
      const res = await service.submit('v1');
      expect(res.status).toBe(VerificationStatus.IN_REVIEW);
      expect(res.submittedAt).toBeInstanceOf(Date);
    });
  });

  describe('review', () => {
    it('rejects if not IN_REVIEW', async () => {
      vRepo.findOne.mockResolvedValueOnce({
        id: 'v1',
        status: VerificationStatus.PENDING,
      });
      await expect(
        service.review('v1', { decision: 'approved' } as never, 'admin'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('approves and computes expiresAt from tier validityDays', async () => {
      vRepo.findOne.mockResolvedValueOnce({
        id: 'v1',
        status: VerificationStatus.IN_REVIEW,
        tier: { validityDays: 30 },
      });
      const res = await service.review(
        'v1',
        { decision: 'approved' } as never,
        'admin',
      );
      expect(res.status).toBe(VerificationStatus.APPROVED);
      expect(res.approvedAt).toBeInstanceOf(Date);
      expect(res.expiresAt).toBeInstanceOf(Date);
    });

    it('rejects with reason', async () => {
      vRepo.findOne.mockResolvedValueOnce({
        id: 'v1',
        status: VerificationStatus.IN_REVIEW,
      });
      const res = await service.review(
        'v1',
        { decision: 'rejected', reason: 'bad docs' } as never,
        'admin',
      );
      expect(res.status).toBe(VerificationStatus.REJECTED);
      expect(res.rejectionReason).toBe('bad docs');
    });
  });

  describe('documents', () => {
    it('addDocument links to verification', async () => {
      vRepo.findOne.mockResolvedValueOnce({ id: 'v1' });
      await service.addDocument('v1', { fileKey: 'k' } as never);
      expect(docRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ verificationId: 'v1', fileKey: 'k' }),
      );
      expect(docRepo.save).toHaveBeenCalled();
    });

    it('findDocuments queries by verificationId', async () => {
      await service.findDocuments('v1');
      expect(docRepo.find).toHaveBeenCalledWith({
        where: { verificationId: 'v1' },
      });
    });
  });
});
