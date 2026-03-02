DO $$
BEGIN
  ALTER TYPE "billing_pay_channel" ADD VALUE IF NOT EXISTS 'alipay';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "billing_pay_channel" ADD VALUE IF NOT EXISTS 'wechat';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
