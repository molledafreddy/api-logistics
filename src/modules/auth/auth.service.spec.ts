import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { MailService } from '../mail/mail.service';
import { PermissionsCacheService } from '../../common/cache/permissions-cache.service';
import { ReferralsService } from '../referrals/referrals.service';
import { User } from './entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

// Mock Supabase client
const mockSupabaseAuth = {
  signInWithPassword: jest.fn(),
  refreshSession: jest.fn(),
};

const mockCreateClient = {
  auth: mockSupabaseAuth,
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockCreateClient),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let supabaseService: any;
  let mailService: any;

  const mockUser: Partial<User> = {
    id: 'user-uuid-1',
    authUid: 'supabase-auth-uid-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.COMPANY_OWNER,
    status: UserStatus.ACTIVE,
    companyId: 'company-uuid-1',
    phone: null,
    avatarUrl: null,
    timezone: 'America/New_York',
    language: 'en',
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    emailVerificationCodeHash: null,
    emailVerificationCodeExpiresAt: null,
    emailVerificationAttempts: 0,
    emailVerificationLastSentAt: null,
    lastLoginAt: null,
    lastLoginIp: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz', // Mock bcrypt hash for CI/CD mode fallback
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    get fullName() {
      return `${this.firstName} ${this.lastName}`;
    },
    get isEmailVerified() {
      return this.emailVerifiedAt !== null;
    },
    get isLocked() {
      return this.lockedUntil !== null && this.lockedUntil > new Date();
    },
  };

  const mockCompany = {
    id: 'company-uuid-1',
    name: 'Test Company',
    type: 'carrier',
    status: 'pending_verification',
    ownerId: null,
    legalName: null,
    taxId: null,
    email: null,
    phone: null,
    createdAt: new Date(),
  };

  // Track save calls to return the right mock based on order
  let saveCallCount = 0;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest
        .fn()
        .mockImplementation((_entity: unknown, data: unknown) => data),
      save: jest.fn().mockImplementation(() => {
        saveCallCount++;
        // 1st save = company, 2nd save = user, 3rd save = company (set owner)
        if (saveCallCount === 1) return Promise.resolve(mockCompany);
        if (saveCallCount === 2) return Promise.resolve(mockUser);
        return Promise.resolve({ ...mockCompany, ownerId: 'user-uuid-1' });
      }),
    },
  };

  beforeEach(async () => {
    saveCallCount = 0;
    mockQueryRunner.manager.save.mockImplementation(() => {
      saveCallCount++;
      if (saveCallCount === 1) return Promise.resolve(mockCompany);
      if (saveCallCount === 2) return Promise.resolve(mockUser);
      return Promise.resolve({ ...mockCompany, ownerId: 'user-uuid-1' });
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn().mockReturnValue(mockUser),
            save: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            createAuthUser: jest
              .fn()
              .mockResolvedValue({ id: 'supabase-auth-uid-1' }),
            deleteAuthUser: jest.fn(),
            getAdminClient: jest.fn().mockReturnValue({
              auth: {
                admin: {
                  signOut: jest.fn().mockResolvedValue({ error: null }),
                },
              },
            }),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendVerificationCode: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                'supabase.url': 'https://test.supabase.co',
                'supabase.anonKey': 'test-anon-key',
              };
              return map[key];
            }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
            query: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: PermissionsCacheService,
          useValue: { getOrLoad: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: ReferralsService,
          useValue: {
            applyReferralCode: jest.fn().mockResolvedValue(undefined),
            getReferredDiscount: jest.fn().mockResolvedValue(0),
            onReferredPaymentApproved: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    supabaseService = module.get(SupabaseService);
    mailService = module.get(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      companyName: 'Test Company',
      companyType: 'carrier' as const,
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'MyP@ssw0rd!',
    };

    it('should throw ConflictException if email exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should register a new user and company successfully', async () => {
      userRepository.findOne.mockResolvedValue(null);

      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'supabase-auth-uid-1' },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_at: 1234567890,
          },
        },
        error: null,
      });

      const result = await service.register(registerDto);

      expect(supabaseService.createAuthUser).toHaveBeenCalledWith(
        'test@example.com',
        'MyP@ssw0rd!',
        expect.objectContaining({ first_name: 'Test', last_name: 'User' }),
      );
      // 3 saves: company, user, company (set owner)
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(3);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.company).toBeDefined();
      expect(result.company.name).toBe('Test Company');
    });

    it('should rollback and cleanup on failure', async () => {
      userRepository.findOne.mockResolvedValue(null);
      supabaseService.createAuthUser.mockResolvedValue({
        id: 'supabase-auth-uid-1',
      });
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB error'));

      await expect(service.register(registerDto)).rejects.toThrow();

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(supabaseService.deleteAuthUser).toHaveBeenCalledWith(
        'supabase-auth-uid-1',
      );
    });
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'MyP@ssw0rd!' };

    it('should throw UnauthorizedException on invalid credentials', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should login successfully and update tracking', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'supabase-auth-uid-1' },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_at: 1234567890,
          },
        },
        error: null,
      });

      userRepository.findOne.mockResolvedValue({ ...mockUser });

      const result = await service.login(loginDto, '127.0.0.1');

      expect(result.user).toBeDefined();
      expect(result.session.accessToken).toBe('access-token');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw if user is suspended', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'supabase-auth-uid-1' },
          session: { access_token: 'tok', refresh_token: 'ref', expires_at: 0 },
        },
        error: null,
      });

      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw if email is not verified', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'supabase-auth-uid-1' },
          session: { access_token: 'tok', refresh_token: 'ref', expires_at: 0 },
        },
        error: null,
      });

      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        emailVerifiedAt: null,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh session successfully', async () => {
      mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'new-access',
            refresh_token: 'new-refresh',
            expires_at: 9999,
          },
        },
        error: null,
      });

      const result = await service.refreshToken('old-refresh-token');

      expect(result.session.accessToken).toBe('new-access');
    });

    it('should throw on invalid refresh token', async () => {
      mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid refresh token' },
      });

      await expect(service.refreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-uuid-1');

      expect(result.email).toBe('test@example.com');
      expect(result.firstName).toBe('Test');
    });

    it('should throw if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('resendVerificationCode', () => {
    it('should generate and email a new code for an unverified user', async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        emailVerifiedAt: null,
        emailVerificationLastSentAt: null,
      });

      const result = await service.resendVerificationCode('test@example.com');

      expect(result.message).toContain('código de verificación');
      expect(userRepository.save).toHaveBeenCalled();
      expect(mailService.sendVerificationCode).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'test@example.com' }),
      );
    });

    it('should return already verified without sending an email', async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        emailVerifiedAt: new Date(),
      });

      const result = await service.resendVerificationCode('test@example.com');

      expect(result).toEqual(expect.objectContaining({ verified: true }));
      expect(mailService.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('should not reveal whether the email exists', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.resendVerificationCode('ghost@example.com');

      expect(result.message).toContain('Si el correo existe');
      expect(mailService.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('should throw if resent within the cooldown window', async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        emailVerifiedAt: null,
        emailVerificationLastSentAt: new Date(),
      });

      await expect(
        service.resendVerificationCode('test@example.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyEmailCode', () => {
    it('should verify a correct, unexpired code', async () => {
      const codeHash = await bcrypt.hash('123456', 10);
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        emailVerifiedAt: null,
        emailVerificationCodeHash: codeHash,
        emailVerificationCodeExpiresAt: new Date(Date.now() + 60_000),
        emailVerificationAttempts: 0,
      });

      const result = await service.verifyEmailCode(
        'test@example.com',
        '123456',
      );

      expect(result.verified).toBe(true);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          emailVerifiedAt: expect.any(Date),
          emailVerificationCodeHash: null,
        }),
      );
    });

    it('should return already verified without checking the code', async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        emailVerifiedAt: new Date(),
      });

      const result = await service.verifyEmailCode(
        'test@example.com',
        '000000',
      );

      expect(result.verified).toBe(true);
    });

    it('should throw on an incorrect code and increment attempts', async () => {
      const codeHash = await bcrypt.hash('123456', 10);
      const user = {
        ...mockUser,
        emailVerifiedAt: null,
        emailVerificationCodeHash: codeHash,
        emailVerificationCodeExpiresAt: new Date(Date.now() + 60_000),
        emailVerificationAttempts: 0,
      };
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.verifyEmailCode('test@example.com', '999999'),
      ).rejects.toThrow(UnauthorizedException);

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerificationAttempts: 1 }),
      );
    });

    it('should throw on an expired code', async () => {
      const codeHash = await bcrypt.hash('123456', 10);
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        emailVerifiedAt: null,
        emailVerificationCodeHash: codeHash,
        emailVerificationCodeExpiresAt: new Date(Date.now() - 1_000),
        emailVerificationAttempts: 0,
      });

      await expect(
        service.verifyEmailCode('test@example.com', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw after too many failed attempts', async () => {
      const codeHash = await bcrypt.hash('123456', 10);
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        emailVerifiedAt: null,
        emailVerificationCodeHash: codeHash,
        emailVerificationCodeExpiresAt: new Date(Date.now() + 60_000),
        emailVerificationAttempts: 5,
      });

      await expect(
        service.verifyEmailCode('test@example.com', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyEmailCode('ghost@example.com', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
