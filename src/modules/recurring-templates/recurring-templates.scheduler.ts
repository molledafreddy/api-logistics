import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RecurringTemplatesService } from './recurring-templates.service';
import type { RecurringGeneratorJobData } from './recurring-templates.processor';

/**
 * Cron diario que enqueua jobs de generación para "mañana".
 *
 * Definición plan §30.3: corre 23:00 UTC y prepara los runs del día siguiente
 * para que estén listos cuando arranque la operación.
 */
@Injectable()
export class RecurringGeneratorScheduler {
  private readonly logger = new Logger(RecurringGeneratorScheduler.name);

  constructor(
    private readonly service: RecurringTemplatesService,
    @InjectQueue('recurring-generator')
    private readonly queue: Queue<RecurringGeneratorJobData>,
  ) {}

  /** 23:00 UTC todos los días. Generar ocurrencia de mañana. */
  @Cron('0 23 * * *', { timeZone: 'UTC' })
  async runDaily(): Promise<void> {
    const target = this.tomorrowISO();
    await this.enqueueForDate(target, 'cron');
  }

  /** Endpoint interno usable por tests/jobs manuales. */
  async enqueueForDate(
    dateISO: string,
    triggeredBy: 'cron' | 'manual',
  ): Promise<{ enqueued: number; date: string }> {
    const due = await this.service.listDueForDate(dateISO);
    this.logger.log(`Cron tick: ${due.length} templates due for ${dateISO}`);
    for (const tpl of due) {
      await this.queue.add(
        'generate',
        { templateId: tpl.id, date: dateISO, triggeredBy },
        {
          jobId: `gen:${tpl.id}:${dateISO}`, // ← idempotencia a nivel cola (BullMQ dedupe)
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
          removeOnFail: { age: 30 * 24 * 3600 },
        },
      );
    }
    return { enqueued: due.length, date: dateISO };
  }

  private tomorrowISO(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  // Suppress unused enum import if CronExpression is referenced elsewhere later
  static _cron = CronExpression;
}
