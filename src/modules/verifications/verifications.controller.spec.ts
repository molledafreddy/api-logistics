import { VerificationsController } from './verifications.controller';

const verSvc = () => ({
  findAllTiers: jest.fn().mockResolvedValue('TIERS'),
  createTier: jest.fn().mockResolvedValue('TIER'),
  create: jest.fn().mockResolvedValue('CR'),
  findByCompany: jest.fn().mockResolvedValue('LIST'),
  findById: jest.fn().mockResolvedValue('ONE'),
  submit: jest.fn().mockResolvedValue('SUB'),
  review: jest.fn().mockResolvedValue('REV'),
  addDocument: jest.fn().mockResolvedValue('DOC'),
  findDocuments: jest.fn().mockResolvedValue('DOCS'),
});
const compSvc = () => ({
  getCompanyCompliance: jest.fn().mockResolvedValue('COMP'),
});
const onbSvc = () => ({
  getWizardForCompany: jest.fn().mockResolvedValue('WIZ'),
  previewWizard: jest.fn().mockResolvedValue('PREV'),
});

describe('VerificationsController', () => {
  let v: ReturnType<typeof verSvc>;
  let cmp: ReturnType<typeof compSvc>;
  let onb: ReturnType<typeof onbSvc>;
  let c: VerificationsController;
  beforeEach(() => {
    v = verSvc();
    cmp = compSvc();
    onb = onbSvc();
    c = new VerificationsController(v as never, cmp as never, onb as never);
  });

  it('findAllTiers', async () => {
    await expect(c.findAllTiers()).resolves.toBe('TIERS');
  });
  it('createTier', async () => {
    await c.createTier({} as never);
    expect(v.createTier).toHaveBeenCalled();
  });
  it('create', async () => {
    await c.create({} as never);
    expect(v.create).toHaveBeenCalled();
  });
  it('findByCompany', async () => {
    await c.findByCompany('cid');
    expect(v.findByCompany).toHaveBeenCalledWith('cid');
  });
  it('findById', async () => {
    await c.findById('id');
    expect(v.findById).toHaveBeenCalledWith('id');
  });
  it('submit', async () => {
    await c.submit('id');
    expect(v.submit).toHaveBeenCalledWith('id');
  });
  it('review passes user.sub', async () => {
    await c.review('id', {} as never, { sub: 'reviewer' } as never);
    expect(v.review).toHaveBeenCalledWith('id', {}, 'reviewer');
  });
  it('addDocument', async () => {
    await c.addDocument('id', { fileUrl: 'u' } as never);
    expect(v.addDocument).toHaveBeenCalled();
  });
  it('findDocuments', async () => {
    await c.findDocuments('id');
    expect(v.findDocuments).toHaveBeenCalledWith('id');
  });
  it('getCompliance', async () => {
    await c.getCompliance('cid');
    expect(cmp.getCompanyCompliance).toHaveBeenCalledWith('cid');
  });
  it('getOnboarding', async () => {
    await c.getOnboarding('cid');
    expect(onb.getWizardForCompany).toHaveBeenCalledWith('cid');
  });
  it('previewOnboarding', async () => {
    await c.previewOnboarding('TRANSPORT' as never, 'B2B' as never);
    expect(onb.previewWizard).toHaveBeenCalledWith('TRANSPORT', 'B2B');
  });
});
