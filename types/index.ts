export interface ParseRequest {
  url: string;
}

export interface VideoResult {
  type: 'video';
  title: string;
  cover: string;
  videoUrl: string;
  author: {
    name: string;
    avatar: string;
  };
}

export interface ImagesResult {
  type: 'images';
  title: string;
  cover: string;
  images: string[];
  author: {
    name: string;
    avatar: string;
  };
}

export type ParseResult = VideoResult | ImagesResult;

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  requestId?: string;
}

export interface ApiErrorPayload {
  code: ErrorCode | string;
  message: string;
  details?: unknown;
}

export interface ApiError {
  success: false;
  error: ApiErrorPayload | string;
  requestId?: string;
}

export enum ErrorCode {
  INVALID_URL = 'INVALID_URL',
  NOT_DOUYIN_URL = 'NOT_DOUYIN_URL',
  PARSE_FAILED = 'PARSE_FAILED',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  PAYWALL_REQUIRED = 'PAYWALL_REQUIRED',
  FAIR_USE_SOFT_LIMITED = 'FAIR_USE_SOFT_LIMITED',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  ORDER_NOT_PAYABLE = 'ORDER_NOT_PAYABLE',
  ORDER_ALREADY_FULFILLED = 'ORDER_ALREADY_FULFILLED',
  WEBHOOK_SIGNATURE_INVALID = 'WEBHOOK_SIGNATURE_INVALID',
}
