import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TrackingPoint } from '../tracking/entities/tracking-point.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { INTERNAL_EVENTS } from '../../gateways/events/internal.events';
import { WhatsAppService } from './whatsapp.service';
import { NotificationsService } from './notifications.service';
import { PermissionsCacheService } from '../../common/cache/permissions-cache.service';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';

const PROXIMITY_METERS = 500;
const PERMISSION_CODE = 'tracking.proximity_alerts';

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class ProximityAlertService {
  private readonly logger = new Logger(ProximityAlertService.name);
  private readonly thresholdMeters: number;

  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepo: Repository<Shipment>,
    private readonly whatsapp: WhatsAppService,
    private readonly notificationsService: NotificationsService,
    private readonly permissionsCache: PermissionsCacheService,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.thresholdMeters = config.get<number>(
      'PROXIMITY_ALERT_METERS',
      PROXIMITY_METERS,
    );
  }

  @OnEvent(INTERNAL_EVENTS.TRACKING_POINT_CREATED)
  async handleLocationUpdate(point: TrackingPoint): Promise<void> {
    if (!point.driverId || !point.companyId) return;

    try {
      // Gate: only companies with tracking.proximity_alerts permission
      const allowed = await this.hasProximityPermission(point.companyId);
      if (!allowed) return;

      // Scoped to this driver only — avoids full-table scan
      const shipments = await this.shipmentRepo
        .createQueryBuilder('s')
        .where('s.driverId = :driverId', { driverId: point.driverId })
        .andWhere('s.status IN (:...statuses)', {
          statuses: [
            ShipmentStatus.IN_TRANSIT,
            ShipmentStatus.ASSIGNED,
            ShipmentStatus.PICKED_UP,
          ],
        })
        .andWhere('s.proximityAlertSentAt IS NULL')
        .andWhere('s.destinationContactPhone IS NOT NULL')
        .andWhere('s.destinationLat IS NOT NULL')
        .andWhere('s.destinationLng IS NOT NULL')
        .andWhere('s.publicTrackingToken IS NOT NULL')
        .getMany();

      for (const shipment of shipments) {
        const destLat = parseFloat(shipment.destinationLat!);
        const destLng = parseFloat(shipment.destinationLng!);
        if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) continue;

        const distance = haversineMeters(
          parseFloat(point.lat),
          parseFloat(point.lng),
          destLat,
          destLng,
        );

        if (distance <= this.thresholdMeters) {
          this.logger.log(
            `[Proximity] Driver ${point.driverId} a ${Math.round(distance)}m de shipment ${shipment.id}`,
          );

          // Persistent cooldown: once per shipment per destination
          await this.shipmentRepo.update(shipment.id, {
            proximityAlertSentAt: new Date(),
          });

          // 1. WhatsApp to recipient
          await this.whatsapp.sendProximityAlert(
            shipment.destinationContactPhone!,
            shipment.publicTrackingToken,
            shipment.destinationAddress,
          );

          // 2. In-app push to driver (best-effort)
          this.sendDriverPush(point.driverId, shipment).catch((err) => {
            this.logger.warn(
              `[Proximity] Push falló para driver ${point.driverId}: ${(err as Error).message}`,
            );
          });
        }
      }
    } catch (err) {
      this.logger.error(`[Proximity] Error: ${(err as Error).message}`);
    }
  }

  private async hasProximityPermission(companyId: string): Promise<boolean> {
    const perms = await this.permissionsCache.getOrLoad(companyId, () =>
      this.loadCompanyPermissions(companyId),
    );
    return perms.includes(PERMISSION_CODE);
  }

  private async loadCompanyPermissions(companyId: string): Promise<string[]> {
    const rows: Array<{ code: string }> = await this.dataSource.query(
      `SELECT pd.code
         FROM subscriptions s
         JOIN plan_permissions pp ON pp.plan_id = s.plan_id
         JOIN permission_definitions pd ON pd.id = pp.permission_id
        WHERE s.company_id = $1 AND s.status = 'active'
        ORDER BY s.created_at DESC
        LIMIT 100`,
      [companyId],
    );
    return rows.map((r) => r.code);
  }

  private async sendDriverPush(
    driverId: string,
    shipment: Shipment,
  ): Promise<void> {
    const rows: Array<{ user_id: string }> = await this.dataSource.query(
      `SELECT user_id FROM drivers WHERE id = $1 AND user_id IS NOT NULL`,
      [driverId],
    );
    if (!rows.length || !rows[0].user_id) return;

    await this.notificationsService.create({
      userId: rows[0].user_id,
      type: NotificationType.PROXIMITY_ALERT,
      title: '📍 Llegando a destino',
      body: `Estás a menos de ${this.thresholdMeters}m de ${shipment.destinationAddress}`,
      data: { shipmentId: shipment.id },
    });
  }
}
