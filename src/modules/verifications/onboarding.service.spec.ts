import { NotFoundException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { ServiceType } from '../../common/enums/service-type.enum';
import { BusinessModel } from '../../common/enums/business-model.enum';
import { VerificationStatus } from '../../common/enums/verification-status.enum';
import { VerificationTierCode } from '../../common/enums/verification-tier-code.enum';

describe('OnboardingService', () => {
  const COMPANY = 'company-uuid';
  const PASSENGER_DOCS = [
    'background_check',
    'school_insurance',
    'monitor_license',
    'vehicle_safety_inspect',
    'driver_first_aid',
  ];

  let service: OnboardingService;
  let companyRepo: any;
  let verificationRepo: any;
  let tierRepo: any;
  let driverRepo: any;
  let truckRepo: any;

  beforeEach(() => {
    companyRepo = { findOne: jest.fn() };
    verificationRepo = { find: jest.fn().mockResolvedValue([]) };
    tierRepo = {
      findOne: jest.fn().mockResolvedValue({
        code: VerificationTierCode.PASSENGER_SAFE,
        requiredDocuments: PASSENGER_DOCS,
      }),
    };
    driverRepo = { count: jest.fn().mockResolvedValue(0) };
    truckRepo = { count: jest.fn().mockResolvedValue(0) };
    service = new OnboardingService(
      companyRepo,
      verificationRepo,
      tierRepo,
      driverRepo,
      truckRepo,
    );
  });

  it('lanza NotFound si la empresa no existe', async () => {
    companyRepo.findOne.mockResolvedValue(null);
    await expect(service.getWizardForCompany(COMPANY)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('freight → 4 pasos sin passenger_safe', async () => {
    companyRepo.findOne.mockResolvedValue({
      id: COMPANY,
      serviceType: ServiceType.FREIGHT,
      businessModel: BusinessModel.SMALL_FLEET,
    });
    const wizard = await service.getWizardForCompany(COMPANY);
    expect(wizard.steps).toHaveLength(4);
    expect(wizard.steps.map((s) => s.key)).toEqual([
      'company_profile',
      'add_drivers',
      'add_trucks',
      'tier_basic_verification',
    ]);
  });

  it('passenger → incluye paso tier_passenger_safe con sus 5 docs', async () => {
    companyRepo.findOne.mockResolvedValue({
      id: COMPANY,
      serviceType: ServiceType.PASSENGER,
      businessModel: BusinessModel.SMALL_FLEET,
    });
    const wizard = await service.getWizardForCompany(COMPANY);
    expect(wizard.steps).toHaveLength(6);
    const passengerStep = wizard.steps.find(
      (s) => s.key === 'tier_passenger_safe',
    );
    expect(passengerStep).toBeDefined();
    expect(passengerStep!.requiredDocuments).toEqual(PASSENGER_DOCS);
    expect(passengerStep!.unlocksServiceType).toBe(ServiceType.PASSENGER);
    expect(passengerStep!.completed).toBe(false);
  });

  it('mixed → mismo wizard que passenger (6 pasos)', async () => {
    companyRepo.findOne.mockResolvedValue({
      id: COMPANY,
      serviceType: ServiceType.MIXED,
      businessModel: BusinessModel.ENTERPRISE,
    });
    const wizard = await service.getWizardForCompany(COMPANY);
    expect(wizard.steps).toHaveLength(6);
    expect(wizard.businessModel).toBe(BusinessModel.ENTERPRISE);
  });

  it('marca tier_passenger_safe.completed=true cuando hay verification APPROVED+vigente', async () => {
    companyRepo.findOne.mockResolvedValue({
      id: COMPANY,
      serviceType: ServiceType.PASSENGER,
      businessModel: BusinessModel.SMALL_FLEET,
    });
    verificationRepo.find.mockResolvedValue([
      {
        id: 'v1',
        status: VerificationStatus.APPROVED,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        tier: { code: VerificationTierCode.PASSENGER_SAFE },
      },
    ]);
    const wizard = await service.getWizardForCompany(COMPANY);
    const passengerStep = wizard.steps.find(
      (s) => s.key === 'tier_passenger_safe',
    );
    expect(passengerStep!.completed).toBe(true);
  });

  it('progressPct refleja pasos completados', async () => {
    companyRepo.findOne.mockResolvedValue({
      id: COMPANY,
      serviceType: ServiceType.FREIGHT,
      businessModel: BusinessModel.SMALL_FLEET,
      taxId: '76123456-7', // marca company_profile como completed (1/4 = 25%)
    });
    const wizard = await service.getWizardForCompany(COMPANY);
    // Solo company_profile arranca completed=true (taxId presente).
    // 1 de 4 pasos = 25 %.
    expect(wizard.progressPct).toBe(25);
    expect(wizard.completed).toBe(false);
  });

  it('previewWizard devuelve steps sin estado y companyId zero', async () => {
    const preview = await service.previewWizard(ServiceType.PASSENGER);
    expect(preview.steps).toHaveLength(6);
    expect(preview.companyId).toMatch(/^0+/);
    expect(preview.progressPct).toBe(0);
    expect(preview.completed).toBe(false);
  });
});
