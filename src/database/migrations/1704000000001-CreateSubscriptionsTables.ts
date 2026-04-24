import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptionsTables1704000000001 implements MigrationInterface {
  name = 'CreateSubscriptionsTables1704000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "subscriptions" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "company_id" uuid NOT NULL,
            "plan_id" uuid NOT NULL,
            "status" varchar(32) NOT NULL,
            "current_period_start" timestamptz NOT NULL,
            "current_period_end" timestamptz NOT NULL,
            "cancel_at_period_end" boolean NOT NULL DEFAULT false,
            "canceled_at" timestamptz,
            "trial_start" timestamptz,
            "trial_end" timestamptz,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            "updated_at" timestamptz NOT NULL DEFAULT now()
        );`);
    await queryRunner.query(`CREATE TABLE "subscription_addons" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "subscription_id" uuid NOT NULL,
            "addon_type" varchar(32) NOT NULL,
            "quantity" integer NOT NULL,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            "updated_at" timestamptz NOT NULL DEFAULT now()
        );`);
    await queryRunner.query(`CREATE TABLE "invoices" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "subscription_id" uuid NOT NULL,
            "amount_due" integer NOT NULL,
            "amount_paid" integer NOT NULL,
            "status" varchar(32) NOT NULL,
            "due_date" timestamptz NOT NULL,
            "paid_at" timestamptz,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            "updated_at" timestamptz NOT NULL DEFAULT now()
        );`);
    await queryRunner.query(`CREATE TABLE "invoice_line_items" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "invoice_id" uuid NOT NULL,
            "description" varchar(255) NOT NULL,
            "amount" integer NOT NULL,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            "updated_at" timestamptz NOT NULL DEFAULT now()
        );`);
    await queryRunner.query(`CREATE TABLE "payment_events" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "subscription_id" uuid NOT NULL,
            "event_type" varchar(32) NOT NULL,
            "amount" integer,
            "event_date" timestamptz NOT NULL,
            "metadata" jsonb,
            "created_at" timestamptz NOT NULL DEFAULT now()
        );`);
    await queryRunner.query(`CREATE TABLE "coupons" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "code" varchar(32) NOT NULL UNIQUE,
            "discount_type" varchar(16) NOT NULL,
            "amount_off" integer,
            "percent_off" integer,
            "max_redemptions" integer,
            "redeem_by" timestamptz,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            "updated_at" timestamptz NOT NULL DEFAULT now()
        );`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "coupons"`);
    await queryRunner.query(`DROP TABLE "payment_events"`);
    await queryRunner.query(`DROP TABLE "invoice_line_items"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TABLE "subscription_addons"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
  }
}
