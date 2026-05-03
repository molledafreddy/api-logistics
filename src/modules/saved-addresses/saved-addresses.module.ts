import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SavedAddress } from './entities/saved-address.entity';
import { SavedAddressesService } from './saved-addresses.service';
import { SavedAddressesController } from './saved-addresses.controller';

/**
 * Sprint C.5 — SavedAddressesModule.
 *
 * Pieza independiente, no requiere inyectar GeocodingService porque el
 * frontend obtiene los datos vía `/v1/geocoding/search` y luego los envía
 * ya geocodificados al `POST /v1/saved-addresses`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SavedAddress])],
  controllers: [SavedAddressesController],
  providers: [SavedAddressesService],
  exports: [SavedAddressesService],
})
export class SavedAddressesModule {}
