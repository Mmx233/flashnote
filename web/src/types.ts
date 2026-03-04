// Base clip fields shared by all clip types
export interface ClipBase {
  id: string;
  expiresAt: string;
  createdAt: string;
}

// Text clip — has content, no file fields
export interface TextClip extends ClipBase {
  type: 'text';
  content: string;
}

// Image clip — has file metadata, no content field
export interface ImageClip extends ClipBase {
  type: 'image';
  fileName: string;
  fileSize: number;
  mimeType: string;
}

// Discriminated union
export type Clip = TextClip | ImageClip;

export interface ClipListResponse {
  clips: Clip[];
  total: number;
  page: number;
  size: number;
}

export interface ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
}

// Server config exposed to frontend (sent as first WebSocket message)
export interface ServerLimits {
  maxTextSize: number;
  maxFileSize: number;
  ttlOptions: string[];
  defaultTTL: string;
  blurDisconnectTimeout: number; // seconds
  heartbeatInterval: number; // seconds
}

// WebSocket message types
export interface WSMessage {
  type: 'config' | 'clip:created' | 'clip:expired';
  data: ServerLimits | Clip | { id: string };
}
