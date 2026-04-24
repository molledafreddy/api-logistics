import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RelationshipsService } from './relationships.service';
import { CompanyRelationship } from './entities/company-relationship.entity';
import { CompanyRelationshipLog } from './entities/company-relationship-log.entity';
import { RelationshipStatus } from '../../common/enums/relationship-status.enum';

const repoMock = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'r1', ...x })),
  find: jest.fn(async () => []),
  findOneBy: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('RelationshipsService', () => {
  let service: RelationshipsService;
  let relRepo: ReturnType<typeof repoMock>;
  let logRepo: ReturnType<typeof repoMock>;

  beforeEach(async () => {
    relRepo = repoMock();
    logRepo = repoMock();

    const module = await Test.createTestingModule({
      providers: [
        RelationshipsService,
        { provide: getRepositoryToken(CompanyRelationship), useValue: relRepo },
        {
          provide: getRepositoryToken(CompanyRelationshipLog),
          useValue: logRepo,
        },
      ],
    }).compile();
    service = module.get(RelationshipsService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('persists with PENDING + token + writes log', async () => {
      const res = await service.create(
        { parentCompanyId: 'a', childCompanyId: 'b' } as never,
        'u1',
      );
      expect(res).toMatchObject({
        status: RelationshipStatus.PENDING,
        invitedBy: 'u1',
      });
      expect(res.invitationToken).toBeDefined();
      expect(logRepo.save).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('throws NotFound when missing', async () => {
      relRepo.findOneBy.mockResolvedValueOnce(undefined);
      await expect(service.findById('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('respond', () => {
    it('rejects if not PENDING', async () => {
      relRepo.findOneBy.mockResolvedValueOnce({
        id: 'r1',
        status: RelationshipStatus.ACCEPTED,
      });
      await expect(
        service.respond('r1', { decision: 'accepted' } as never, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts and stamps acceptedAt', async () => {
      relRepo.findOneBy.mockResolvedValueOnce({
        id: 'r1',
        status: RelationshipStatus.PENDING,
      });
      const res = await service.respond(
        'r1',
        { decision: 'accepted' } as never,
        'u1',
      );
      expect(res.status).toBe(RelationshipStatus.ACCEPTED);
      expect(res.acceptedAt).toBeInstanceOf(Date);
      expect(logRepo.save).toHaveBeenCalled();
    });

    it('rejects with reason', async () => {
      relRepo.findOneBy.mockResolvedValueOnce({
        id: 'r1',
        status: RelationshipStatus.PENDING,
      });
      const res = await service.respond(
        'r1',
        { decision: 'rejected', reason: 'no fit' } as never,
        'u1',
      );
      expect(res.status).toBe(RelationshipStatus.REJECTED);
      expect(res.rejectionReason).toBe('no fit');
    });
  });

  describe('terminate', () => {
    it('only accepted relationships can be terminated', async () => {
      relRepo.findOneBy.mockResolvedValueOnce({
        id: 'r1',
        status: RelationshipStatus.PENDING,
      });
      await expect(
        service.terminate('r1', { reason: 'x' } as never, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('moves to BLOCKED and stamps terminatedAt', async () => {
      relRepo.findOneBy.mockResolvedValueOnce({
        id: 'r1',
        status: RelationshipStatus.ACCEPTED,
      });
      const res = await service.terminate(
        'r1',
        { reason: 'breach' } as never,
        'u1',
      );
      expect(res.status).toBe(RelationshipStatus.BLOCKED);
      expect(res.terminatedReason).toBe('breach');
    });
  });

  describe('isActiveBetween', () => {
    it('returns true when same company', async () => {
      const res = await service.isActiveBetween('a', 'a');
      expect(res).toBe(true);
    });

    it('returns true when QB finds a row', async () => {
      relRepo.createQueryBuilder.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'r1' }),
      });
      const res = await service.isActiveBetween('a', 'b');
      expect(res).toBe(true);
    });

    it('returns false when QB returns null', async () => {
      relRepo.createQueryBuilder.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      const res = await service.isActiveBetween('a', 'b');
      expect(res).toBe(false);
    });
  });

  describe('getLogs', () => {
    it('lists logs ordered by createdAt ASC', async () => {
      await service.getLogs('r1');
      expect(logRepo.find).toHaveBeenCalledWith({
        where: { relationshipId: 'r1' },
        order: { createdAt: 'ASC' },
      });
    });
  });
});
