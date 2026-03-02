import { AlipaySdk } from 'alipay-sdk';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { BillingError } from '@/lib/billing/errors';
import { ErrorCode } from '@/types';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentWebhookEvent,
} from '@/lib/billing/payments/types';

interface AlipayNotifyPayload {
  app_id?: string;
  out_trade_no?: string;
  trade_no?: string;
  trade_status?: string;
  total_amount?: string;
  seller_id?: string;
}

let cachedSdk: AlipaySdk | null = null;

function asPemBody(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .trim();
}

function normalizePem(value: string, kind: 'private' | 'public'): string {
  const text = asPemBody(value);
  if (text.includes('-----BEGIN')) {
    return text;
  }

  const compact = text.replace(/\s+/g, '');
  if (!compact || /[^A-Za-z0-9+/=]/.test(compact)) {
    return text;
  }

  const wrapped = compact.match(/.{1,64}/g)?.join('\n') ?? compact;
  if (kind === 'private') {
    return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
  }
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`;
}

function validateKeyPair(params: {
  privateKey: string;
  alipayPublicKey: string;
}): void {
  try {
    createPrivateKey({ key: params.privateKey, format: 'pem' });
  } catch {
    throw new BillingError(
      ErrorCode.ORDER_NOT_PAYABLE,
      'ALIPAY_PRIVATE_KEY 格式无效，需填写应用私钥（PKCS8）',
      503
    );
  }

  try {
    createPublicKey({ key: params.alipayPublicKey, format: 'pem' });
  } catch {
    throw new BillingError(
      ErrorCode.ORDER_NOT_PAYABLE,
      'ALIPAY_PUBLIC_KEY 格式无效，需填写支付宝公钥',
      503
    );
  }
}

function requireAlipayConfig(): {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
} {
  const appId = process.env.ALIPAY_APP_ID || '';
  const privateKey = process.env.ALIPAY_PRIVATE_KEY || '';
  const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY || '';
  const missing: string[] = [];
  if (!appId) missing.push('ALIPAY_APP_ID');
  if (!privateKey) missing.push('ALIPAY_PRIVATE_KEY');
  if (!alipayPublicKey) missing.push('ALIPAY_PUBLIC_KEY');

  if (missing.length > 0) {
    throw new BillingError(
      ErrorCode.ORDER_NOT_PAYABLE,
      `Alipay is not configured: missing ${missing.join(', ')}`,
      503
    );
  }

  return {
    appId,
    privateKey: normalizePem(privateKey, 'private'),
    alipayPublicKey: normalizePem(alipayPublicKey, 'public'),
  };
}

function resolveAlipayKeyType(privateKeyPem: string): 'PKCS1' | 'PKCS8' {
  return privateKeyPem.includes('BEGIN RSA PRIVATE KEY') ? 'PKCS1' : 'PKCS8';
}

function getAlipaySdk(): AlipaySdk {
  if (cachedSdk) {
    return cachedSdk;
  }

  const config = requireAlipayConfig();
  validateKeyPair(config);
  const keyType = resolveAlipayKeyType(config.privateKey);
  cachedSdk = new AlipaySdk({
    appId: config.appId,
    privateKey: config.privateKey,
    keyType,
    alipayPublicKey: config.alipayPublicKey,
    signType: 'RSA2',
    gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
    timeout: 10_000,
  });
  return cachedSdk;
}

function clampOrderExpireMinutes(): number {
  const raw = Number.parseInt(process.env.ALIPAY_ORDER_EXPIRE_MIN || '', 10);
  if (Number.isNaN(raw)) {
    return 15;
  }
  return Math.min(Math.max(raw, 5), 60);
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function resolveNotifyUrl(explicitNotifyUrl?: string): string | undefined {
  if (explicitNotifyUrl) {
    return explicitNotifyUrl;
  }

  const base = process.env.PAY_NOTIFY_BASE_URL || '';
  if (!base) {
    return undefined;
  }
  return joinUrl(base, process.env.ALIPAY_NOTIFY_PATH || '/api/billing/webhook/alipay');
}

function resolveReturnUrl(explicitReturnUrl?: string): string | undefined {
  if (explicitReturnUrl) {
    return explicitReturnUrl;
  }
  return process.env.ALIPAY_RETURN_URL || undefined;
}

function parseRawFormPayload(rawText: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const segment of rawText.split('&')) {
    if (!segment) {
      continue;
    }
    const index = segment.indexOf('=');
    const rawKey = index >= 0 ? segment.slice(0, index) : segment;
    const rawValue = index >= 0 ? segment.slice(index + 1) : '';
    const key = decodeURIComponent(rawKey.replace(/\+/g, '%20'));
    result[key] = rawValue;
  }
  return result;
}

function decodeFormValue(value: string | undefined): string {
  if (!value) {
    return '';
  }
  try {
    return decodeURIComponent(value.replace(/\+/g, '%20'));
  } catch {
    return value;
  }
}

function parseAmountToCents(amount: string): number | undefined {
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.round(parsed * 100);
}

function readNotifyPayload(values: Record<string, string>): AlipayNotifyPayload {
  return {
    app_id: decodeFormValue(values.app_id),
    out_trade_no: decodeFormValue(values.out_trade_no),
    trade_no: decodeFormValue(values.trade_no),
    trade_status: decodeFormValue(values.trade_status),
    total_amount: decodeFormValue(values.total_amount),
    seller_id: decodeFormValue(values.seller_id),
  };
}

export class AlipayPaymentProvider implements PaymentProvider {
  readonly payChannel = 'alipay' as const;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const sdk = getAlipaySdk();
    const expireMinutes = clampOrderExpireMinutes();
    const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000).toISOString();

    const scene = input.scene === 'h5' ? 'h5' : 'web';
    const method = scene === 'h5' ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay';
    const productCode =
      scene === 'h5' ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY';
    const subjectPrefix = process.env.ALIPAY_ORDER_SUBJECT_PREFIX || 'Unmark';
    const totalAmount = (input.order.amountCents / 100).toFixed(2);

    const pageParams: Record<string, unknown> = {
      bizContent: {
        out_trade_no: input.order.orderNo,
        product_code: productCode,
        subject: `${subjectPrefix} ${input.order.planType}`,
        total_amount: totalAmount,
        timeout_express: `${expireMinutes}m`,
      },
    };
    const notifyUrl = resolveNotifyUrl(input.notifyUrl);
    const returnUrl = resolveReturnUrl(input.returnUrl);
    if (notifyUrl) {
      pageParams.notifyUrl = notifyUrl;
    }
    if (returnUrl) {
      pageParams.returnUrl = returnUrl;
    }

    const payUrl = sdk.pageExecute(method, 'GET', pageParams);

    return {
      payChannel: this.payChannel,
      providerOrderNo: input.order.orderNo,
      status: 'requires_action',
      expiresAt,
      paymentPayload: {
        gateway: 'alipay',
        scene,
        outTradeNo: input.order.orderNo,
        payUrl,
      },
    };
  }

  async verifyWebhook(request: Request): Promise<PaymentWebhookEvent> {
    const sdk = getAlipaySdk();
    const rawText = await request.text();
    const rawPayload = parseRawFormPayload(rawText);

    const verifyPassed = sdk.checkNotifySignV2(rawPayload);
    if (!verifyPassed) {
      throw new BillingError(
        ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'Alipay webhook signature invalid',
        401
      );
    }

    const payload = readNotifyPayload(rawPayload);
    const expectedAppId = process.env.ALIPAY_APP_ID || '';
    if (expectedAppId && payload.app_id !== expectedAppId) {
      throw new BillingError(
        ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'Alipay app_id mismatch',
        401
      );
    }

    const expectedSellerId = process.env.ALIPAY_SELLER_ID || '';
    if (expectedSellerId && payload.seller_id !== expectedSellerId) {
      throw new BillingError(
        ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'Alipay seller_id mismatch',
        401
      );
    }

    const orderNo = payload.out_trade_no || '';
    const transactionId = payload.trade_no || '';
    const tradeStatus = payload.trade_status || '';

    if (!orderNo || !transactionId) {
      throw new BillingError(
        ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'out_trade_no and trade_no are required',
        400
      );
    }

    return {
      payChannel: this.payChannel,
      orderNo,
      transactionId,
      eventType: tradeStatus || 'unknown',
      paidAmountCents: parseAmountToCents(payload.total_amount || ''),
      currency: 'CNY',
      rawPayload: payload,
    };
  }
}
