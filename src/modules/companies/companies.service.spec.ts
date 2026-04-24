import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { Company } from './entities/company.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { CompanyStatus } from '../../common/enums/company-status.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let companyRepository: any;

  const mockCompany: Partial<Company> = {
    id: 'company-uuid-1',
    name: 'Test Carrier Inc',
    legalName: null,
    type: 'carrier' as any,
    status: CompanyStatus.PENDING_VERIFICATION,
    taxId: null,
    ownerId: 'owner-uuid-1',
    email: null,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    get isActive() {
      return this.status === CompanyStatus.ACTIVE;
    },
    get isPendingVerification() {
      return this.status === CompanyStatus.PENDING_VERIFICATION;
    },
  };

  const ownerPayload: IUserPayload = {
    sub: 'owner-uuid-1',
    email: 'owner@test.com',
    role: UserRole.COMPANY_OWNER,
    companyId: 'company-uuid-1',
  };

  const adminPayload: IUserPayload = {
    sub: 'admin-uuid-1',
    email: 'admin@test.com',
    role: UserRole.ADMIN,
    companyId: 'company-uuid-1',
  };

  const superAdminPayload: IUserPayload = {
    sub: 'sadmin-uuid-1',
    email: 'sadmin@test.com',
    role: UserRole.SUPER_ADMIN,
    companyId: null,
  };

  const dispatcherPayload: IUserPayload = {
    sub: 'disp-uuid-1',
    email: 'disp@test.com',
    role: UserRole.DISPATCHER,
    companyId: 'company-uuid-1',
  };

  const otherCompanyPayload: IUserPayload = {
    sub: 'other-uuid-1',
    email: 'other@test.com',
    role: UserRole.COMPANY_OWNER,
    companyId: 'company-uuid-2',
  };

  // Mock query builder
  const mockQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[mockCompany], 1]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockQb.getManyAndCount.mockResolvedValue([[mockCompany], 1]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: getRepositoryToken(Company),
          useValue: {
            create: jest.fn().mockReturnValue(mockCompany),
            save: jest.fn().mockResolvedValue(mockCompany),
            findOne: jest.fn().mockResolvedValue(mockCompany),
            softRemove: jest.fn().mockResolvedValue(mockCompany),
            createQueryBuilder: jest.fn().mockReturnValue(mockQb),
          },
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    companyRepository = module.get(getRepositoryToken(Company));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── create ───────────────────────────────────────
  describe('create', () => {
    it('should create a company with PENDING_VERIFICATION status', async () => {
      const dto = { name: 'New Corp', type: 'carrier' as any };

      const result = await service.create(dto);

      expect(companyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Corp',
          status: CompanyStatus.PENDING_VERIFICATION,
        }),
      );
      expect(companyRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should accept an ownerId parameter', async () => {
      const dto = { name: 'New Corp', type: 'carrier' as any };

      await service.create(dto, 'owner-uuid-1');

      expect(companyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: 'owner-uuid-1' }),
      );
    });
  });

  // ─── findAll ──────────────────────────────────────
  describe('findAll', () => {
    const defaultQuery = { page: 1, limit: 20, skip: 0 } as any;

    it('should return paginated companies for owner', async () => {
      const result = await service.findAll(defaultQuery, ownerPayload);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockQb.andWhere).toHaveBeenCalledWith('company.id = :companyId', {
        companyId: 'company-uuid-1',
      });
    });

    it('should return all companies for super_admin', async () => {
      await service.findAll(defaultQuery, superAdminPayload);

      // super_admin should NOT have the companyId filter
      expect(mockQb.andWhere).not.toHaveBeenCalledWith(
        'company.id = :companyId',
        expect.anything(),
      );
    });

    it('should return empty for user without companyId', async () => {
      const noCompanyUser: IUserPayload = {
        sub: 'x',
        email: 'x@x.com',
        role: UserRole.VIEWER,
        companyId: null,
      };

      const result = await service.findAll(defaultQuery, noCompanyUser);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('should apply search filter', async () => {
      await service.findAll(
        { ...defaultQuery, search: 'Carrier' },
        ownerPayload,
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'company.name ILIKE :search',
        { search: '%Carrier%' },
      );
    });

    it('should apply type filter', async () => {
      await service.findAll({ ...defaultQuery, type: 'broker' }, ownerPayload);

      expect(mockQb.andWhere).toHaveBeenCalledWith('company.type = :type', {
        type: 'broker',
      });
    });

    it('should apply status filter', async () => {
      await service.findAll(
        { ...defaultQuery, status: 'active' },
        ownerPayload,
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith('company.status = :status', {
        status: 'active',
      });
    });
  });

  // ─── findOne ──────────────────────────────────────
  describe('findOne', () => {
    it('should return a company for its member', async () => {
      const result = await service.findOne('company-uuid-1', ownerPayload);

      expect(result).toBeDefined();
      expect(result.id).toBe('company-uuid-1');
    });

    it('should allow super_admin to access any company', async () => {
      const result = await service.findOne('company-uuid-1', superAdminPayload);

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if company not found', async () => {
      companyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('non-existent', ownerPayload),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for user from different company', async () => {
      await expect(
        service.findOne('company-uuid-1', otherCompanyPayload),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── update ───────────────────────────────────────
  describe('update', () => {
    it('should update company for owner', async () => {
      const dto = { name: 'Updated Name' };

      const result = await service.update('company-uuid-1', dto, ownerPayload);

      expect(companyRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should update company for admin', async () => {
      const dto = { name: 'Updated by Admin' };

      const result = await service.update('company-uuid-1', dto, adminPayload);

      expect(result).toBeDefined();
    });

    it('should update company for super_admin', async () => {
      const dto = { name: 'Updated by SA' };

      const result = await service.update(
        'company-uuid-1',
        dto,
        superAdminPayload,
      );

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for dispatcher', async () => {
      await expect(
        service.update('company-uuid-1', { name: 'Nope' }, dispatcherPayload),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for other company', async () => {
      await expect(
        service.update('company-uuid-1', { name: 'Nope' }, otherCompanyPayload),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── remove ───────────────────────────────────────
  describe('remove', () => {
    it('should soft-delete company for owner', async () => {
      await service.remove('company-uuid-1', ownerPayload);

      expect(companyRepository.softRemove).toHaveBeenCalled();
    });

    it('should soft-delete company for super_admin', async () => {
      await service.remove('company-uuid-1', superAdminPayload);

      expect(companyRepository.softRemove).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for admin', async () => {
      await expect(
        service.remove('company-uuid-1', adminPayload),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if not found', async () => {
      companyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove('non-existent', ownerPayload),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findById ─────────────────────────────────────
  describe('findById', () => {
    it('should return company without access control', async () => {
      const result = await service.findById('company-uuid-1');

      expect(result).toBeDefined();
    });

    it('should return null if not found', async () => {
      companyRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });
});
