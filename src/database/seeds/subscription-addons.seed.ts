import { Logger } from '@nestjs/common';
import dataSource from '../data-source';

const logger = new Logger('SubscriptionAddonsSeed');

export async function seedSubscriptionAddons() {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  // Buscar una suscripción de prueba
  const [subscription] = await dataSource.query(
    `SELECT id FROM subscriptions ORDER BY created_at ASC LIMIT 1`,
  );
  if (!subscription) {
    logger.warn('No hay suscripciones para asociar addons.');
    return;
  }

  // Addons de ejemplo
  const addons = [
    { addon_type: 'extra_users', quantity: 5 },
    { addon_type: 'priority_support', quantity: 1 },
  ];

  for (const addon of addons) {
    // Verificar si ya existe
    const exists = await dataSource.query(
      `SELECT id FROM subscription_addons WHERE subscription_id = $1 AND addon_type = $2`,
      [subscription.id, addon.addon_type],
    );
    if (exists.length === 0) {
      await dataSource.query(
        `INSERT INTO subscription_addons (subscription_id, addon_type, quantity, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())`,
        [subscription.id, addon.addon_type, addon.quantity],
      );
      logger.log(
        `Addon '${addon.addon_type}' creado para la suscripción ${subscription.id}`,
      );
    } else {
      logger.log(
        `Addon '${addon.addon_type}' ya existe para la suscripción ${subscription.id}`,
      );
    }
  }
}
