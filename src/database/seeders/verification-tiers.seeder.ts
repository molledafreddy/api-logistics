import { DataSource } from 'typeorm';
import { VerificationTier } from '../../modules/verifications/entities/verification-tier.entity';

export async function seedVerificationTiers(
  dataSource: DataSource,
): Promise<void> {
  const tierRepo = dataSource.getRepository(VerificationTier);

  const tiers = [
    {
      code: 'BASIC',
      name: 'Basic Verification',
      description: 'Basic company and driver verification',
      price: 0,
      currency: 'USD',
      validityDays: 365,
      displayOrder: 1,
      badgeColor: '#4CAF50',
      badgeIcon: 'check-circle',
      requiredDocuments: ['company_registration', 'tax_id'],
      requirements: { minDocuments: 2, minAge: 18 },
      isActive: true,
    },
    {
      code: 'STANDARD',
      name: 'Standard Verification',
      description: 'Standard verification with enhanced checks',
      price: 99.99,
      currency: 'USD',
      validityDays: 365,
      displayOrder: 2,
      badgeColor: '#2196F3',
      badgeIcon: 'verified',
      requiredDocuments: [
        'company_registration',
        'tax_id',
        'insurance',
        'license',
      ],
      requirements: { minDocuments: 4, minAge: 21, backgroundCheck: true },
      isActive: true,
    },
    {
      code: 'PREMIUM',
      name: 'Premium Verification',
      description: 'Premium verification with full audit and compliance',
      price: 299.99,
      currency: 'USD',
      validityDays: 365,
      displayOrder: 3,
      badgeColor: '#FFB300',
      badgeIcon: 'verified-premium',
      requiredDocuments: [
        'company_registration',
        'tax_id',
        'insurance',
        'license',
        'financial_statements',
        'references',
      ],
      requirements: {
        minDocuments: 6,
        minAge: 25,
        backgroundCheck: true,
        auditRequired: true,
      },
      isActive: true,
    },
  ];

  for (const tierData of tiers) {
    const existing = await tierRepo.findOneBy({ code: tierData.code });
    if (!existing) {
      await tierRepo.save(tierRepo.create(tierData));
      console.log(`✓ Seeded verification tier: ${tierData.code}`);
    }
  }
}
