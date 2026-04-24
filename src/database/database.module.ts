import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        database: configService.get<string>('DB_NAME', 'logistics_dev'),
        username: configService.get<string>('DB_USER', 'logistics'),
        password: configService.get<string>(
          'DB_PASSWORD',
          'logistics_dev_pass',
        ),
        ssl:
          configService.get<string>('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
        logging: configService.get<string>('DB_LOGGING') === 'true',
        synchronize: false, // NEVER true in production
        autoLoadEntities: true,
        namingStrategy: new SnakeNamingStrategy(),
        extra: {
          min: configService.get<number>('DB_POOL_MIN', 2),
          max: configService.get<number>('DB_POOL_MAX', 10),
        },
        migrations: ['dist/database/migrations/*{.ts,.js}'],
      }),
    }),
  ],
})
export class DatabaseModule {}
