import type { Repository } from 'typeorm';
import { In } from 'typeorm';

import { BillingNotificationsService } from './billing-notifications.service';
import { BillingEventPayload } from '../subscriptions/billing-events';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import type { User } from '../auth/entities/user.entity';
import type { NotificationsService } from '../notifications/notifications.service';

function payload(
  overrides: Partial<BillingEventPayload> = {},
): BillingEventPayload {
  return {
    subscriptionId: 'sub-1',
    companyId: 'co-1',
    planName: 'Pro',
    meta: {},
    ...overrides,
  };
}

describe('BillingNotificationsService', () => {
  let userRepo: jest.Mocked<Repository<User>>;
  let notifications: jest.Mocked<NotificationsService>;
  let svc: BillingNotificationsService;

  beforeEach(() => {
    userRepo = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    notifications = {
      create: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<NotificationsService>;
    svc = new BillingNotificationsService(userRepo, notifications);
  });

  it('busca owners y admins de la company', async () => {
    userRepo.find.mockResolvedValue([
      { id: 'u-1' } as User,
      { id: 'u-2' } as User,
    ]);

    await svc.onRenewalScheduled(payload());

    expect(userRepo.find).toHaveBeenCalledWith({
      where: {
        companyId: 'co-1',
        role: In([UserRole.COMPANY_OWNER, UserRole.ADMIN]),
      },
      select: ['id'],
    });
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });

  it('crea notification con type=SUBSCRIPTION_ALERT y datos enriquecidos', async () => {
    userRepo.find.mockResolvedValue([{ id: 'u-1' } as User]);

    await svc.onSuspended(
      payload({ meta: { suspendedAt: '2025-05-01T00:00:00Z' } }),
    );

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        type: NotificationType.SUBSCRIPTION_ALERT,
        title: expect.stringContaining('suspendida'),
        data: expect.objectContaining({
          subscriptionId: 'sub-1',
          companyId: 'co-1',
          planName: 'Pro',
          actionUrl: '/billing',
          suspendedAt: '2025-05-01T00:00:00Z',
        }),
      }),
    );
  });

  it('warning si no hay destinatarios', async () => {
    userRepo.find.mockResolvedValue([]);

    await svc.onReactivated(payload());

    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('no propaga errores si NotificationsService falla', async () => {
    userRepo.find.mockResolvedValue([{ id: 'u-1' } as User]);
    notifications.create.mockRejectedValue(new Error('DB down'));

    await expect(svc.onGraceStarted(payload())).resolves.toBeUndefined();
  });

  it.each([
    ['onRenewalScheduled'],
    ['onRenewalFailed'],
    ['onGraceStarted'],
    ['onGraceEnding'],
    ['onSuspended'],
    ['onReactivated'],
  ])('%s notifica a destinatarios', async (method) => {
    userRepo.find.mockResolvedValue([{ id: 'u-1' } as User]);
    await (
      svc as unknown as Record<
        string,
        (p: BillingEventPayload) => Promise<void>
      >
    )[method](payload());
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });
});
