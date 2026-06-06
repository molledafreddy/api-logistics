import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UsersService } from './users.service';
import { User } from '../auth/entities/user.entity';
import { SupabaseService } from '../auth/supabase.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: any;
  let supabaseService: any;

  // ─── Mocks ────────────────────────────────────────

  const baseUser = (overrides: Partial<User> = {}): Partial<User> => ({
    id: 'user-uuid-1',
    authUid: 'auth-uid-1',
    email: 'member@test.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: null,
    avatarUrl: null,
    role: UserRole.DISPATCHER,
    status: UserStatus.ACTIVE,
    companyId: 'company-uuid-1',
    timezone: 'America/New_York',
    language: 'en',
    invitedById: null,
    invitationToken: null,
    invitationExpiresAt: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    get fullName() {
      return `${this.firstName} ${this.lastName}`;
    },
    ...overrides,
  });

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

  const dispatcherPayload: IUserPayload = {
    sub: 'user-uuid-1',
    email: 'member@test.com',
    role: UserRole.DISPATCHER,
    companyId: 'company-uuid-1',
  };

  const otherCompanyPayload: IUserPayload = {
    sub: 'other-uuid-1',
    email: 'other@test.com',
    role: UserRole.COMPANY_OWNER,
    companyId: 'company-uuid-2',
  };

  // QBuilder mock
  const mockQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockUser = baseUser();
    mockQb.getManyAndCount.mockResolvedValue([[mockUser], 1]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest
              .fn()
              .mockImplementation((data) => ({ ...baseUser(), ...data })),
            save: jest
              .fn()
              .mockImplementation((entity) => Promise.resolve(entity)),
            findOne: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
            createQueryBuilder: jest.fn().mockReturnValue(mockQb),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            createAuthUser: jest.fn().mockResolvedValue({ id: 'new-auth-uid' }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest
              .fn()
              .mockResolvedValue([
                { limits: { global: { max_users: 99999 } } },
              ]),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
    supabaseService = module.get(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ══════════════════════════════════════════════════
  //  findAll
  // ══════════════════════════════════════════════════
  describe('findAll', () => {
    const defaultQuery = { page: 1, limit: 20, skip: 0 } as any;

    it('should return paginated users scoped to company', async () => {
      const result = await service.findAll(defaultQuery, ownerPayload);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'user.companyId = :companyId',
        { companyId: 'company-uuid-1' },
      );
    });

    it('should return empty for user without companyId', async () => {
      const noCompany: IUserPayload = {
        sub: 'x',
        email: 'x@x.com',
        role: UserRole.VIEWER,
        companyId: null,
      };

      const result = await service.findAll(defaultQuery, noCompany);

      expect(result.data).toHaveLength(0);
    });

    it('should apply search filter', async () => {
      await service.findAll({ ...defaultQuery, search: 'John' }, ownerPayload);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        { search: '%John%' },
      );
    });

    it('should apply role filter', async () => {
      await service.findAll(
        { ...defaultQuery, role: UserRole.DISPATCHER },
        ownerPayload,
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith('user.role = :role', {
        role: UserRole.DISPATCHER,
      });
    });

    it('should apply status filter', async () => {
      await service.findAll(
        { ...defaultQuery, status: UserStatus.ACTIVE },
        ownerPayload,
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith('user.status = :status', {
        status: UserStatus.ACTIVE,
      });
    });
  });

  // ══════════════════════════════════════════════════
  //  findOne
  // ══════════════════════════════════════════════════
  describe('findOne', () => {
    it('should return user for same company', async () => {
      userRepository.findOne.mockResolvedValue(baseUser());

      const result = await service.findOne('user-uuid-1', ownerPayload);

      expect(result.email).toBe('member@test.com');
    });

    it('should throw NotFoundException if not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('non-existent', ownerPayload),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for different company', async () => {
      userRepository.findOne.mockResolvedValue(baseUser());

      await expect(
        service.findOne('user-uuid-1', otherCompanyPayload),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════
  //  invite
  // ══════════════════════════════════════════════════
  describe('invite', () => {
    const inviteDto = {
      email: 'newhire@test.com',
      role: UserRole.DISPATCHER,
    };

    it('should create an invitation successfully', async () => {
      userRepository.findOne.mockResolvedValue(null); // no existing user

      const result = await service.invite(inviteDto, ownerPayload);

      expect(result.email).toBe('newhire@test.com');
      expect(result.invitationToken).toBeDefined();
      expect(result.invitationToken.length).toBe(64); // 32 bytes hex
      expect(result.status).toBe(UserStatus.PENDING_VERIFICATION);
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      userRepository.findOne.mockResolvedValue(baseUser());

      await expect(service.invite(inviteDto, ownerPayload)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ForbiddenException for equal or higher role', async () => {
      userRepository.findOne.mockResolvedValue(null);

      // admin trying to invite another admin (equal role)
      await expect(
        service.invite(
          { email: 'x@x.com', role: UserRole.ADMIN },
          adminPayload,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for owner role invite', async () => {
      userRepository.findOne.mockResolvedValue(null);

      // admin trying to invite company_owner (higher role)
      await expect(
        service.invite(
          { email: 'x@x.com', role: UserRole.COMPANY_OWNER as any },
          adminPayload,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if user has no company', async () => {
      const noCompany: IUserPayload = {
        sub: 'x',
        email: 'x@x.com',
        role: UserRole.COMPANY_OWNER,
        companyId: null,
      };

      await expect(service.invite(inviteDto, noCompany)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ══════════════════════════════════════════════════
  //  acceptInvite
  // ══════════════════════════════════════════════════
  describe('acceptInvite', () => {
    const acceptDto = {
      token: 'valid-token-hash',
      firstName: 'Carlos',
      lastName: 'Nuevo',
      password: 'MyP@ssw0rd!',
    };

    it('should accept invitation and create Supabase user', async () => {
      const pendingUser = baseUser({
        status: UserStatus.PENDING_VERIFICATION,
        invitationToken: 'valid-token-hash',
        invitationExpiresAt: new Date(Date.now() + 86400000), // +24h
        authUid: null,
      });
      userRepository.findOne.mockResolvedValue(pendingUser);

      const result = await service.acceptInvite(acceptDto);

      expect(supabaseService.createAuthUser).toHaveBeenCalledWith(
        'member@test.com',
        'MyP@ssw0rd!',
        expect.objectContaining({ first_name: 'Carlos', last_name: 'Nuevo' }),
      );
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          authUid: 'new-auth-uid',
          status: UserStatus.ACTIVE,
          invitationToken: null,
        }),
      );
      expect(result.user).toBeDefined();
      expect(result.message).toContain('aceptada');
    });

    it('should throw NotFoundException if token not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.acceptInvite(acceptDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if token expired', async () => {
      const expiredUser = baseUser({
        status: UserStatus.PENDING_VERIFICATION,
        invitationToken: 'valid-token-hash',
        invitationExpiresAt: new Date(Date.now() - 86400000), // -24h (expired)
        authUid: null,
      });
      userRepository.findOne.mockResolvedValue(expiredUser);

      await expect(service.acceptInvite(acceptDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ══════════════════════════════════════════════════
  //  update
  // ══════════════════════════════════════════════════
  describe('update', () => {
    it('should allow user to update their own info', async () => {
      const user = baseUser();
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.update(
        'user-uuid-1',
        { firstName: 'Updated' },
        dispatcherPayload,
      );

      expect(result.firstName).toBe('Updated');
    });

    it('should allow owner to update another user', async () => {
      const user = baseUser();
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.update(
        'user-uuid-1',
        { lastName: 'Changed' },
        ownerPayload,
      );

      expect(result.lastName).toBe('Changed');
    });

    it('should throw ForbiddenException if non-admin tries to edit someone else', async () => {
      const otherUser = baseUser({
        id: 'other-user-uuid',
        companyId: 'company-uuid-1',
      });
      userRepository.findOne.mockResolvedValue(otherUser);

      // dispatcher trying to edit someone else
      await expect(
        service.update(
          'other-user-uuid',
          { firstName: 'Nope' },
          dispatcherPayload,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { firstName: 'X' }, ownerPayload),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for different company', async () => {
      userRepository.findOne.mockResolvedValue(baseUser());

      await expect(
        service.update('user-uuid-1', { firstName: 'X' }, otherCompanyPayload),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════
  //  updateRole
  // ══════════════════════════════════════════════════
  describe('updateRole', () => {
    it('should allow owner to change role', async () => {
      userRepository.findOne.mockResolvedValue(baseUser());

      const result = await service.updateRole(
        'user-uuid-1',
        { role: UserRole.MANAGER },
        ownerPayload,
      );

      expect(result.role).toBe(UserRole.MANAGER);
    });

    it('should not allow demoting owner', async () => {
      const ownerUser = baseUser({ role: UserRole.COMPANY_OWNER });
      userRepository.findOne.mockResolvedValue(ownerUser);

      await expect(
        service.updateRole(
          'owner-uuid-1',
          { role: UserRole.ADMIN },
          ownerPayload,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not allow assigning equal or higher role', async () => {
      userRepository.findOne.mockResolvedValue(baseUser());

      // admin trying to promote someone to admin (equal)
      await expect(
        service.updateRole(
          'user-uuid-1',
          { role: UserRole.ADMIN },
          adminPayload,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should only allow owner to create admins', async () => {
      userRepository.findOne.mockResolvedValue(baseUser());

      // admin trying to create another admin — role hierarchy blocks this
      await expect(
        service.updateRole(
          'user-uuid-1',
          { role: UserRole.ADMIN },
          adminPayload,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for different company', async () => {
      userRepository.findOne.mockResolvedValue(baseUser());

      await expect(
        service.updateRole(
          'user-uuid-1',
          { role: UserRole.VIEWER },
          otherCompanyPayload,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateRole('x', { role: UserRole.VIEWER }, ownerPayload),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════
  //  deactivate
  // ══════════════════════════════════════════════════
  describe('deactivate', () => {
    it('should deactivate a user', async () => {
      userRepository.findOne.mockResolvedValue(baseUser());

      const result = await service.deactivate('user-uuid-1', ownerPayload);

      expect(result.message).toContain('desactivado');
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: UserStatus.INACTIVE }),
      );
    });

    it('should not deactivate the owner', async () => {
      const ownerUser = baseUser({ role: UserRole.COMPANY_OWNER });
      userRepository.findOne.mockResolvedValue(ownerUser);

      await expect(
        service.deactivate('owner-uuid-1', ownerPayload),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not allow self-deactivation', async () => {
      userRepository.findOne.mockResolvedValue(baseUser());

      await expect(
        service.deactivate('user-uuid-1', dispatcherPayload),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for dispatcher (no permission)', async () => {
      const otherUser = baseUser({ id: 'other-uuid' });
      userRepository.findOne.mockResolvedValue(otherUser);

      await expect(
        service.deactivate('other-uuid', dispatcherPayload),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.deactivate('x', ownerPayload)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ══════════════════════════════════════════════════
  //  reactivate
  // ══════════════════════════════════════════════════
  describe('reactivate', () => {
    it('should reactivate an inactive user', async () => {
      const inactiveUser = baseUser({ status: UserStatus.INACTIVE });
      userRepository.findOne.mockResolvedValue(inactiveUser);

      const result = await service.reactivate('user-uuid-1', ownerPayload);

      expect(result.message).toContain('reactivado');
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: UserStatus.ACTIVE }),
      );
    });

    it('should throw BadRequestException if user is not inactive', async () => {
      userRepository.findOne.mockResolvedValue(baseUser()); // status: active

      await expect(
        service.reactivate('user-uuid-1', ownerPayload),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for dispatcher (no permission)', async () => {
      const inactiveUser = baseUser({ status: UserStatus.INACTIVE });
      userRepository.findOne.mockResolvedValue(inactiveUser);

      await expect(
        service.reactivate('user-uuid-1', dispatcherPayload),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.reactivate('x', ownerPayload)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for different company', async () => {
      const inactiveUser = baseUser({ status: UserStatus.INACTIVE });
      userRepository.findOne.mockResolvedValue(inactiveUser);

      await expect(
        service.reactivate('user-uuid-1', otherCompanyPayload),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
