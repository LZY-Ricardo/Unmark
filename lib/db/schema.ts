import { relations, sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const billingPlanTypeEnum = pgEnum('billing_plan_type', [
  'free',
  'day',
  'month',
]);
export const billingOrderStatusEnum = pgEnum('billing_order_status', [
  'created',
  'paying',
  'paid',
  'fulfilled',
  'failed',
  'refunded',
]);
export const billingEntitlementStatusEnum = pgEnum(
  'billing_entitlement_status',
  ['active', 'expired', 'revoked']
);
export const billingPayChannelEnum = pgEnum('billing_pay_channel', ['mock']);

export const billingUsers = pgTable(
  'billing_users',
  {
    id: serial('id').primaryKey(),
    anonId: varchar('anon_id', { length: 64 }).notNull(),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Shanghai'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    anonIdUnique: uniqueIndex('billing_users_anon_id_uq').on(table.anonId),
    createdAtIdx: index('billing_users_created_at_idx').on(table.createdAt),
  })
);

export const billingOrders = pgTable(
  'billing_orders',
  {
    id: serial('id').primaryKey(),
    orderNo: varchar('order_no', { length: 40 }).notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => billingUsers.id, { onDelete: 'cascade' }),
    planType: billingPlanTypeEnum('plan_type').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: varchar('currency', { length: 8 }).notNull().default('CNY'),
    variant: varchar('variant', { length: 16 }).notNull(),
    experimentId: varchar('experiment_id', { length: 64 }).notNull(),
    payChannel: billingPayChannelEnum('pay_channel').notNull().default('mock'),
    status: billingOrderStatusEnum('status').notNull().default('created'),
    transactionId: varchar('transaction_id', { length: 128 }),
    clientRequestId: varchar('client_request_id', { length: 64 }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orderNoUnique: uniqueIndex('billing_orders_order_no_uq').on(table.orderNo),
    clientRequestUnique: uniqueIndex('billing_orders_client_req_uq').on(
      table.clientRequestId
    ),
    userCreatedIdx: index('billing_orders_user_created_idx').on(
      table.userId,
      table.createdAt
    ),
    statusIdx: index('billing_orders_status_idx').on(table.status),
  })
);

export const billingEntitlements = pgTable(
  'billing_entitlements',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => billingUsers.id, { onDelete: 'cascade' }),
    sourceOrderNo: varchar('source_order_no', { length: 40 }),
    planType: billingPlanTypeEnum('plan_type').notNull(),
    status: billingEntitlementStatusEnum('status').notNull().default('active'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userStatusEndIdx: index('billing_entitlements_user_status_end_idx').on(
      table.userId,
      table.status,
      table.endsAt
    ),
  })
);

export const billingUsageDaily = pgTable(
  'billing_usage_daily',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => billingUsers.id, { onDelete: 'cascade' }),
    usageDate: date('usage_date').notNull(),
    successCount: integer('success_count').notNull().default(0),
    softLimitedCount: integer('soft_limited_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userDateUnique: unique('billing_usage_daily_user_date_uq').on(
      table.userId,
      table.usageDate
    ),
    usageDateIdx: index('billing_usage_daily_date_idx').on(table.usageDate),
  })
);

export const billingWebhookEvents = pgTable(
  'billing_webhook_events',
  {
    id: serial('id').primaryKey(),
    eventKey: varchar('event_key', { length: 256 }).notNull(),
    transactionId: varchar('transaction_id', { length: 128 }).notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    orderNo: varchar('order_no', { length: 40 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    eventKeyUnique: uniqueIndex('billing_webhook_event_key_uq').on(table.eventKey),
  })
);

export const billingUsersRelations = relations(billingUsers, ({ many }) => ({
  orders: many(billingOrders),
  entitlements: many(billingEntitlements),
  usageDaily: many(billingUsageDaily),
}));

export const billingOrdersRelations = relations(billingOrders, ({ one }) => ({
  user: one(billingUsers, {
    fields: [billingOrders.userId],
    references: [billingUsers.id],
  }),
}));

export const billingEntitlementsRelations = relations(
  billingEntitlements,
  ({ one }) => ({
    user: one(billingUsers, {
      fields: [billingEntitlements.userId],
      references: [billingUsers.id],
    }),
  })
);

export const billingUsageDailyRelations = relations(
  billingUsageDaily,
  ({ one }) => ({
    user: one(billingUsers, {
      fields: [billingUsageDaily.userId],
      references: [billingUsers.id],
    }),
  })
);

export type BillingDbUser = typeof billingUsers.$inferSelect;
export type BillingDbOrder = typeof billingOrders.$inferSelect;
export type BillingDbEntitlement = typeof billingEntitlements.$inferSelect;
export type BillingDbUsageDaily = typeof billingUsageDaily.$inferSelect;

export const ensureBillingSchemaSql = sql`
  SELECT 1;
`;
