CREATE TYPE "billing_plan_type" AS ENUM ('free', 'day', 'month');
CREATE TYPE "billing_order_status" AS ENUM ('created', 'paying', 'paid', 'fulfilled', 'failed', 'refunded');
CREATE TYPE "billing_entitlement_status" AS ENUM ('active', 'expired', 'revoked');
CREATE TYPE "billing_pay_channel" AS ENUM ('mock', 'alipay', 'wechat');

CREATE TABLE "billing_users" (
  "id" serial PRIMARY KEY NOT NULL,
  "anon_id" varchar(64) NOT NULL,
  "timezone" varchar(64) DEFAULT 'Asia/Shanghai' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "billing_users_anon_id_uq" ON "billing_users" ("anon_id");
CREATE INDEX "billing_users_created_at_idx" ON "billing_users" ("created_at");

CREATE TABLE "billing_orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_no" varchar(40) NOT NULL,
  "user_id" integer NOT NULL REFERENCES "billing_users"("id") ON DELETE cascade,
  "plan_type" "billing_plan_type" NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" varchar(8) DEFAULT 'CNY' NOT NULL,
  "variant" varchar(16) NOT NULL,
  "experiment_id" varchar(64) NOT NULL,
  "pay_channel" "billing_pay_channel" DEFAULT 'mock' NOT NULL,
  "status" "billing_order_status" DEFAULT 'created' NOT NULL,
  "transaction_id" varchar(128),
  "client_request_id" varchar(64) NOT NULL,
  "paid_at" timestamp with time zone,
  "fulfilled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "billing_orders_order_no_uq" ON "billing_orders" ("order_no");
CREATE UNIQUE INDEX "billing_orders_client_req_uq" ON "billing_orders" ("client_request_id");
CREATE INDEX "billing_orders_user_created_idx" ON "billing_orders" ("user_id", "created_at");
CREATE INDEX "billing_orders_status_idx" ON "billing_orders" ("status");

CREATE TABLE "billing_entitlements" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "billing_users"("id") ON DELETE cascade,
  "source_order_no" varchar(40),
  "plan_type" "billing_plan_type" NOT NULL,
  "status" "billing_entitlement_status" DEFAULT 'active' NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "billing_entitlements_user_status_end_idx"
  ON "billing_entitlements" ("user_id", "status", "ends_at");

CREATE TABLE "billing_usage_daily" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "billing_users"("id") ON DELETE cascade,
  "usage_date" date NOT NULL,
  "success_count" integer DEFAULT 0 NOT NULL,
  "soft_limited_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "billing_usage_daily_user_date_uq" UNIQUE ("user_id", "usage_date")
);
CREATE INDEX "billing_usage_daily_date_idx" ON "billing_usage_daily" ("usage_date");

CREATE TABLE "billing_webhook_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_key" varchar(256) NOT NULL,
  "transaction_id" varchar(128) NOT NULL,
  "event_type" varchar(64) NOT NULL,
  "order_no" varchar(40),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "billing_webhook_event_key_uq" ON "billing_webhook_events" ("event_key");
