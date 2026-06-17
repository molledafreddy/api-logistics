import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import {
  INTERNAL_EVENTS,
  type ExpenseCreatedPayload,
} from '../../gateways/events/internal.events';

const NOTIFIABLE_ROLES = [
  UserRole.COMPANY_OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
];

const FUEL_CATEGORIES = new Set(['fuel', 'toll', 'maintenance', 'repair']);

const CATEGORY_LABELS: Record<string, string> = {
  fuel: 'combustible',
  toll: 'caseta/peaje',
  maintenance: 'mantenimiento',
  repair: 'reparación',
};

@Injectable()
export class ExpenseNotificationListener {
  private readonly logger = new Logger(ExpenseNotificationListener.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent(INTERNAL_EVENTS.EXPENSE_CREATED, { async: true })
  async handle(payload: ExpenseCreatedPayload): Promise<void> {
    if (!FUEL_CATEGORIES.has(payload.category)) return;

    try {
      const recipients = await this.userRepo.find({
        where: {
          companyId: payload.companyId,
          role: In(NOTIFIABLE_ROLES),
        },
        select: ['id'],
      });

      const approvers = recipients.filter(
        (u) => u.id !== payload.createdByUserId,
      );
      if (!approvers.length) return;

      const label = CATEGORY_LABELS[payload.category] ?? payload.category;
      const amount = `${payload.amount} ${payload.currency}`;

      await Promise.allSettled(
        approvers.map((u) =>
          this.notificationsService.create({
            userId: u.id,
            type: NotificationType.EXPENSE_CREATED,
            title: `Nuevo gasto de ${label}`,
            body: `Se registró un gasto de ${amount} que requiere tu revisión.`,
            data: {
              type: 'expense_created',
              expenseId: payload.expenseId,
              category: payload.category,
            },
          }),
        ),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to notify expense ${payload.expenseId}: ${(err as Error).message}`,
      );
    }
  }
}
