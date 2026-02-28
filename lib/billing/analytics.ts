type BillingEventName =
  | 'exp_assigned'
  | 'quota_exhausted'
  | 'paywall_view'
  | 'paywall_cta_click'
  | 'checkout_open'
  | 'order_paid'
  | 'entitlement_granted'
  | 'plan_upgrade_prompt_view'
  | 'plan_upgrade_paid'
  | 'refund_success';

export function trackBillingEvent(
  name: BillingEventName,
  payload: Record<string, unknown>
): void {
  // TODO: persist to analytics table or data pipeline.
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[billing:event] ${name}`, payload);
  }
}
