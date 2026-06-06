import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment } from '../shipments/entities/shipment.entity';
import { TrackingPoint } from '../tracking/entities/tracking-point.entity';

@Injectable()
export class PublicTrackingService {
  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepo: Repository<Shipment>,
    @InjectRepository(TrackingPoint)
    private readonly trackingRepo: Repository<TrackingPoint>,
  ) {}

  async getByToken(token: string) {
    const shipment = await this.shipmentRepo.findOne({
      where: { publicTrackingToken: token },
    });

    if (!shipment) throw new NotFoundException('Tracking no encontrado');

    const lastPoint = await this.trackingRepo.findOne({
      where: { shipmentId: shipment.id },
      order: { capturedAt: 'DESC' },
    });

    return {
      trackingCode: shipment.trackingCode,
      status: shipment.status,
      cargoType: shipment.cargoType ?? 'general',
      description: shipment.description ?? null,
      destinationAddress: shipment.destinationAddress,
      destinationLat: shipment.destinationLat ?? null,
      destinationLng: shipment.destinationLng ?? null,
      isNearby: shipment.proximityAlertSentAt !== null,
      deliveredAt: shipment.deliveredAt ?? null,
      podUrl: shipment.podUrl ?? null,
      podSignedBy: shipment.podSignedBy ?? null,
      lastLocation: lastPoint
        ? {
            lat: lastPoint.lat,
            lng: lastPoint.lng,
            capturedAt: lastPoint.capturedAt,
          }
        : null,
    };
  }
}
