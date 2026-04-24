import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { getQueueToken } from '@nestjs/bullmq';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionAddon } from './entities/subscription-addon.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { PaymentEvent } from './entities/payment-event.entity';
import { Coupon } from './entities/coupon.entity';

const mockRepo = () => ({
  save: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(),
});

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let subscriptionRepo: ReturnType<typeof mockRepo>;
  let addonRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: getRepositoryToken(Subscription), useFactory: mockRepo },
        {
          provide: getRepositoryToken(SubscriptionAddon),
          useFactory: mockRepo,
        },
        { provide: getRepositoryToken(Invoice), useFactory: mockRepo },
        { provide: getRepositoryToken(InvoiceLineItem), useFactory: mockRepo },
        { provide: getRepositoryToken(PaymentEvent), useFactory: mockRepo },
        { provide: getRepositoryToken(Coupon), useFactory: mockRepo },
        {
          provide: getQueueToken('subscription-renewal'),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(SubscriptionsService);
    subscriptionRepo = module.get(getRepositoryToken(Subscription));
    addonRepo = module.get(getRepositoryToken(SubscriptionAddon));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a free subscription', async () => {
    subscriptionRepo.save.mockResolvedValue({ id: 'sub1' });
    const result = await service.createFreeSubscription('company1', 'plan1');
    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 'company1',
        plan_id: 'plan1',
        status: 'active',
      }),
    );
    expect(result).toEqual({ id: 'sub1' });
  });

  it('should find subscriptions by company', async () => {
    subscriptionRepo.find.mockResolvedValue([{ id: 'sub1' }]);
    const result = await service.findByCompany('company1');
    expect(subscriptionRepo.find).toHaveBeenCalledWith({
      where: { company_id: 'company1' },
    });
    expect(result).toEqual([{ id: 'sub1' }]);
  });

  it('should cancel a subscription', async () => {
    subscriptionRepo.update.mockResolvedValue({ affected: 1 });
    const result = await service.cancelSubscription('sub1');
    expect(subscriptionRepo.update).toHaveBeenCalledWith(
      'sub1',
      expect.objectContaining({
        cancel_at_period_end: true,
        status: 'canceled',
      }),
    );
    expect(result).toEqual({ affected: 1 });
  });

  it('should upgrade a subscription', async () => {
    subscriptionRepo.update.mockResolvedValue({ affected: 1 });
    const result = await service.upgradeSubscription('sub1', 'plan2');
    expect(subscriptionRepo.update).toHaveBeenCalledWith(
      'sub1',
      expect.objectContaining({
        plan_id: 'plan2',
        status: 'active',
      }),
    );
    expect(result).toEqual({ affected: 1 });
  });

  it('should downgrade a subscription', async () => {
    subscriptionRepo.update.mockResolvedValue({ affected: 1 });
    const result = await service.downgradeSubscription('sub1', 'planFree');
    expect(subscriptionRepo.update).toHaveBeenCalledWith(
      'sub1',
      expect.objectContaining({
        plan_id: 'planFree',
        status: 'active',
      }),
    );
    expect(result).toEqual({ affected: 1 });
  });

  it('should suspend a subscription', async () => {
    subscriptionRepo.update.mockResolvedValue({ affected: 1 });
    const result = await service.suspendSubscription('sub1');
    expect(subscriptionRepo.update).toHaveBeenCalledWith('sub1', {
      status: 'suspended',
    });
    expect(result).toEqual({ affected: 1 });
  });

  // --- Addon tests ---
  it('should add an addon', async () => {
    addonRepo.create = jest.fn().mockReturnValue({
      subscription_id: 'sub1',
      addon_type: 'extra',
      quantity: 2,
    });
    addonRepo.save.mockResolvedValue({ id: 'addon1' });
    const result = await service.addAddon('sub1', 'extra', 2);
    expect(addonRepo.create).toHaveBeenCalledWith({
      subscription_id: 'sub1',
      addon_type: 'extra',
      quantity: 2,
    });
    expect(addonRepo.save).toHaveBeenCalledWith({
      subscription_id: 'sub1',
      addon_type: 'extra',
      quantity: 2,
    });
    expect(result).toEqual({ id: 'addon1' });
  });

  it('should update an addon', async () => {
    addonRepo.update.mockResolvedValue({ affected: 1 });
    addonRepo.findOne.mockResolvedValue({ id: 'addon1', quantity: 5 });
    const result = await service.updateAddon('addon1', 5);
    expect(addonRepo.update).toHaveBeenCalledWith('addon1', { quantity: 5 });
    expect(result).toEqual({ id: 'addon1', quantity: 5 });
  });

  it('should get addons by subscription', async () => {
    addonRepo.find.mockResolvedValue([{ id: 'addon1' }]);
    const result = await service.getAddonsBySubscription('sub1');
    expect(addonRepo.find).toHaveBeenCalledWith({
      where: { subscription_id: 'sub1' },
    });
    expect(result).toEqual([{ id: 'addon1' }]);
  });

  it('should get addon by id', async () => {
    addonRepo.findOne.mockResolvedValue({ id: 'addon1' });
    const result = await service.getAddonById('addon1');
    expect(addonRepo.findOne).toHaveBeenCalledWith({ where: { id: 'addon1' } });
    expect(result).toEqual({ id: 'addon1' });
  });

  it('should remove addon', async () => {
    addonRepo.delete.mockResolvedValue({ affected: 1 });
    const result = await service.removeAddon('addon1');
    expect(addonRepo.delete).toHaveBeenCalledWith('addon1');
    expect(result).toEqual({ affected: 1 });
  });
});
