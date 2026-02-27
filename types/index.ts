// 解析请求
export interface ParseRequest {
  url: string;
}

// 视频结果
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

// 图集结果
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

// 解析结果（联合类型）
export type ParseResult = VideoResult | ImagesResult;

// API 响应
export interface ApiResponse<T> {
  success: true;
  data: T;
  message: string;
}

// API 错误
export interface ApiError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: string;
  };
}

// 错误码枚举
export enum ErrorCode {
  INVALID_URL = 'INVALID_URL',
  NOT_DOUYIN_URL = 'NOT_DOUYIN_URL',
  PARSE_FAILED = 'PARSE_FAILED',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}
