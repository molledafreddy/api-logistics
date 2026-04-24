import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { ServiceType } from '../../common/enums/service-type.enum';
import { VerificationStatus } from '../../common/enums/verification-status.enum';
import { VerificationTierCode } from '../../common/enums/verification-tier-code.enum';

/**
 * Tests unitarios — ComplianceService (PARTE 7 · Sprint 6).
 * Cubre la regla MV-002:
 *   serviceType ∈ {passenger, mixed} ⇒ requiere tier `passenger_safe` aprobado y vigente.
 */
describe('ComplianceService', () => {
  const COMPANY = 'company-uuid';
  const PASSENGER_TIER_DOCS = [
    'background_check',
    'school_insurance',
    'monitor_license',
    'vehicle_safety_inspect',
    'driver_first_aid',
  ];

  let service: ComplianceService;
  let companyRepo: any;
  let verificationRepo: any;
  let tierRepo: any;
  let docRepo: any;

  function build(serviceType: ServiceType) {
    return { id: COMPANY, serviceType };
  }

  beforeEach(() => {
    companyRepo = { findOne: jest.fn() };
    verificationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    tierRepo = { findOne: jest.fn() };
    docRepo = {};
    service = new ComplianceService(
      verificationRepo,
      tierRepo,
      docRepo,
      companyRepo,
    );
  });

  // ─── 404 ────────────────────────────
  it('lanza NotFound si la empresa no existe', async () => {
    companyRepo.findOne.mockResolvedValue(null);
    await expect(service.getCompanyCompliance(COMPANY)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ─── FREIGHT ────────────────────────
  it('serviceType=freight → canOperate=true sin requerimientos', async () => {
    companyRepo.findOne.mockResolvedValue(build(ServiceType.FREIGHT));
    const status = await service.getCompanyCompliance(COMPANY);
    expect(status.canOperate).toBe(true);
    expect(status.requiredTier).toBeNull();
    expect(status.hasRequiredTier).toBe(true);
    expect(status.blockReason).toBeNull();
  });

  it('assertCanOperatePassenger no lanza para freight', async () => {
    companyRepo.findOne.mockResolvedValue(build(ServiceType.FREIGHT));
    await expect(
      service.assertCanOperatePassenger(COMPANY),
    ).resolves.toBeUndefined();
  });

  // ─── PASSENGER sin verificación ─────
  it('passenger sin ninguna verificación → blockReason=no_verification + missingDocuments=todos', async () => {
    companyRepo.findOne.mockResolvedValue(build(ServiceType.PASSENGER));
    verificationRepo.find.mockResolvedValue([]);
    verificationRepo.findOne.mockResolvedValue(null);
    tierRepo.findOne.mockResolvedValue({
      code: VerificationTierCode.PASSENGER_SAFE,
      requiredDocuments: PASSENGER_TIER_DOCS,
    });

    const status = await service.getCompanyCompliance(COMPANY);
    expect(status.canOperate).toBe(false);
    expect(status.requiredTier).toBe(VerificationTierCode.PASSENGER_SAFE);
    expect(status.blockReason).toBe('no_verification');
    expect(status.missingDocuments).toEqual(PASSENGER_TIER_DOCS);
  });

  it('assertCanOperatePassenger lanza Forbidden con código MV-002', async () => {
    companyRepo.findOne.mockResolvedValue(build(ServiceType.PASSENGER));
    verificationRepo.find.mockResolvedValue([]);
    verificationRepo.findOne.mockResolvedValue(null);
    tierRepo.findOne.mockResolvedValue({
      code: VerificationTierCode.PASSENGER_SAFE,
      requiredDocuments: PASSENGER_TIER_DOCS,
    });

    await expect(service.assertCanOperatePassenger(COMPANY)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.assertCanOperatePassenger(COMPANY)).rejects.toThrow(
      /MV-002/,
    );
  });

  // ─── PASSENGER tier expirado ────────
  it('passenger con tier aprobado pero expirado → blockReason=tier_expired', async () => {
    companyRepo.findOne.mockResolvedValue(build(ServiceType.PASSENGER));
    verificationRepo.find.mockResolvedValue([]); // ninguna vigente
    verificationRepo.findOne.mockResolvedValue({
      id: 'v1',
      status: VerificationStatus.APPROVED,
      tier: {
        code: VerificationTierCode.PASSENGER_SAFE,
        requiredDocuments: PASSENGER_TIER_DOCS,
      },
      expiresAt: new Date(Date.now() - 1000 * 60),
      documents: [],
    });

    const status = await service.getCompanyCompliance(COMPANY);
    expect(status.canOperate).toBe(false);
    expect(status.blockReason).toBe('tier_expired');
  });

  // ─── PASSENGER tier en revisión, faltan docs ─
  it('passenger con verification PENDING → tier_not_approved + diff de documentos', async () => {
    companyRepo.findOne.mockResolvedValue(build(ServiceType.PASSENGER));
    verificationRepo.find.mockResolvedValue([]);
    verificationRepo.findOne.mockResolvedValue({
      id: 'v1',
      status: VerificationStatus.PENDING,
      tier: {
        code: VerificationTierCode.PASSENGER_SAFE,
        requiredDocuments: PASSENGER_TIER_DOCS,
      },
      expiresAt: null,
      documents: [
        { documentType: 'background_check' },
        { documentType: 'school_insurance' },
      ],
    });

    const status = await service.getCompanyCompliance(COMPANY);
    expect(status.blockReason).toBe('tier_not_approved');
    expect(status.missingDocuments).toEqual([
      'monitor_license',
      'vehicle_safety_inspect',
      'driver_first_aid',
    ]);
  });

  // ─── PASSENGER vigente ──────────────
  it('passenger con tier passenger_safe aprobado y vigente → canOperate=true', async () => {
    companyRepo.findOne.mockResolvedValue(build(ServiceType.PASSENGER));
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    verificationRepo.find.mockResolvedValue([
      {
        id: 'v1',
        status: VerificationStatus.APPROVED,
        approvedAt: new Date(),
        expiresAt: future,
        tier: {
          code: VerificationTierCode.PASSENGER_SAFE,
          requiredDocuments: PASSENGER_TIER_DOCS,
        },
      },
    ]);

    const status = await service.getCompanyCompliance(COMPANY);
    expect(status.canOperate).toBe(true);
    expect(status.currentTier).toBe(VerificationTierCode.PASSENGER_SAFE);
    expect(status.currentTierExpiresAt).toBe(future);
    expect(status.blockReason).toBeNull();
    expect(status.missingDocuments).toEqual([]);
  });

  // ─── MIXED bloquea igual que passenger ─
  it('serviceType=mixed sin tier passenger_safe → bloqueado', async () => {
    companyRepo.findOne.mockResolvedValue(build(ServiceType.MIXED));
    verificationRepo.find.mockResolvedValue([]);
    verificationRepo.findOne.mockResolvedValue(null);
    tierRepo.findOne.mockResolvedValue({
      code: VerificationTierCode.PASSENGER_SAFE,
      requiredDocuments: PASSENGER_TIER_DOCS,
    });

    const status = await service.getCompanyCompliance(COMPANY);
    expect(status.requiredTier).toBe(VerificationTierCode.PASSENGER_SAFE);
    expect(status.canOperate).toBe(false);
  });

  // ─── PASSENGER con tier basic vigente pero no passenger_safe ─
  it('passenger con tier basic aprobado pero sin passenger_safe → no_verification', async () => {
    companyRepo.findOne.mockResolvedValue(build(ServiceType.PASSENGER));
    verificationRepo.find.mockResolvedValue([
      {
        id: 'v1',
        status: VerificationStatus.APPROVED,
        approvedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        tier: { code: VerificationTierCode.BASIC, requiredDocuments: [] },
      },
    ]);
    verificationRepo.findOne.mockResolvedValue({
      id: 'v1',
      status: VerificationStatus.APPROVED,
      tier: { code: VerificationTierCode.BASIC, requiredDocuments: [] },
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      documents: [],
    });
    tierRepo.findOne.mockResolvedValue({
      code: VerificationTierCode.PASSENGER_SAFE,
      requiredDocuments: PASSENGER_TIER_DOCS,
    });

    const status = await service.getCompanyCompliance(COMPANY);
    expect(status.canOperate).toBe(false);
    expect(status.blockReason).toBe('no_verification');
    // Pero currentTier es basic
    expect(status.currentTier).toBe(VerificationTierCode.BASIC);
  });
});
