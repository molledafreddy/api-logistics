import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

const mockService = () => ({
  createFreeSubscription: jest.fn(),
  findByCompany: jest.fn(),
  cancelSubscription: jest.fn(),
  upgradeSubscription: jest.fn(),
  downgradeSubscription: jest.fn(),
  suspendSubscription: jest.fn(),
  addAddon: jest.fn(),
  updateAddon: jest.fn(),
  getAddonsBySubscription: jest.fn(),
  getAddonById: jest.fn(),
  removeAddon: jest.fn(),
});

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let service: ReturnType<typeof mockService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [{ provide: SubscriptionsService, useFactory: mockService }],
    }).compile();
    controller = module.get(SubscriptionsController);
    service = module.get(SubscriptionsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a free subscription', async () => {
    service.createFreeSubscription.mockResolvedValue({ id: 'sub1' });
    const result = await controller.createFree({
      companyId: 'c1',
      planId: 'p1',
    });
    expect(service.createFreeSubscription).toHaveBeenCalledWith('c1', 'p1');
    expect(result).toEqual({ id: 'sub1' });
  });

  it('should find subscriptions by company', async () => {
    service.findByCompany.mockResolvedValue([{ id: 'sub1' }]);
    const result = await controller.findByCompany('c1');
    expect(service.findByCompany).toHaveBeenCalledWith('c1');
    expect(result).toEqual([{ id: 'sub1' }]);
  });

  it('should cancel a subscription', async () => {
    service.cancelSubscription.mockResolvedValue({ affected: 1 });
    const result = await controller.cancel('sub1');
    expect(service.cancelSubscription).toHaveBeenCalledWith('sub1');
    expect(result).toEqual({ affected: 1 });
  });

  it('should upgrade a subscription', async () => {
    service.upgradeSubscription.mockResolvedValue({ affected: 1 });
    const result = await controller.upgrade('sub1', { newPlanId: 'p2' });
    expect(service.upgradeSubscription).toHaveBeenCalledWith('sub1', 'p2');
    expect(result).toEqual({ affected: 1 });
  });

  it('should downgrade a subscription', async () => {
    service.downgradeSubscription.mockResolvedValue({ affected: 1 });
    const result = await controller.downgrade('sub1', { newPlanId: 'pFree' });
    expect(service.downgradeSubscription).toHaveBeenCalledWith('sub1', 'pFree');
    expect(result).toEqual({ affected: 1 });
  });

  it('should suspend a subscription', async () => {
    service.suspendSubscription.mockResolvedValue({ affected: 1 });
    const result = await controller.suspend('sub1');
    expect(service.suspendSubscription).toHaveBeenCalledWith('sub1');
    expect(result).toEqual({ affected: 1 });
  });

  // --- Addon endpoints ---
  it('should add an addon', async () => {
    service.addAddon.mockResolvedValue({ id: 'addon1' });
    const result = await controller.addAddon('sub1', {
      addon_type: 'extra',
      quantity: 2,
    });
    expect(service.addAddon).toHaveBeenCalledWith('sub1', 'extra', 2);
    expect(result).toEqual({ id: 'addon1' });
  });

  it('should update an addon', async () => {
    service.updateAddon.mockResolvedValue({ id: 'addon1', quantity: 5 });
    const result = await controller.updateAddon('addon1', { quantity: 5 });
    expect(service.updateAddon).toHaveBeenCalledWith('addon1', 5);
    expect(result).toEqual({ id: 'addon1', quantity: 5 });
  });

  it('should get addons by subscription', async () => {
    service.getAddonsBySubscription.mockResolvedValue([{ id: 'addon1' }]);
    const result = await controller.getAddons('sub1');
    expect(service.getAddonsBySubscription).toHaveBeenCalledWith('sub1');
    expect(result).toEqual([{ id: 'addon1' }]);
  });

  it('should get addon by id', async () => {
    service.getAddonById.mockResolvedValue({ id: 'addon1' });
    const result = await controller.getAddon('addon1');
    expect(service.getAddonById).toHaveBeenCalledWith('addon1');
    expect(result).toEqual({ id: 'addon1' });
  });

  it('should remove addon', async () => {
    service.removeAddon.mockResolvedValue({ affected: 1 });
    const result = await controller.removeAddon('addon1');
    expect(service.removeAddon).toHaveBeenCalledWith('addon1');
    expect(result).toEqual({ affected: 1 });
  });
});
