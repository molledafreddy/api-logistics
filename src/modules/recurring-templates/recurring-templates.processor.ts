import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RecurringTemplatesService } from './recurring-templates.service';

export interface RecurringGeneratorJobData {
  templateId: string;
  date: string; // YYYY-MM-DD
  triggeredBy: 'cron' | 'manual';
}

/**
 * Worker BullMQ que procesa la cola `recurring-generator`.
 * Cada job genera (idempotente) la ocurrencia de un template para una fecha.
 */
@Processor('recurring-generator')
@Injectable()
export class RecurringGeneratorProcessor extends WorkerHost {
  private readonly logger = new Logger(RecurringGeneratorProcessor.name);

  constructor(private readonly service: RecurringTemplatesService) {
    super();
  }

  async process(job: Job<RecurringGeneratorJobData>): Promise<unknown> {
    const { templateId, date, triggeredBy } = job.data;
    this.logger.log(
      `Procesando job=${job.id} tpl=${templateId} date=${date} by=${triggeredBy}`,
    );
    try {
      const result = await this.service.generateForDate(templateId, date);
      if (result.skipped) {
        this.logger.log(
          `Skipped tpl=${templateId} date=${date} reason=${result.skipReason}`,
        );
      } else {
        this.logger.log(
          `Generated tpl=${templateId} date=${date} run=${result.runId} ships=${result.shipmentIds.length}`,
        );
      }
      return result;
    } catch (err) {
      this.logger.error(
        `Failed job=${job.id} tpl=${templateId}: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
