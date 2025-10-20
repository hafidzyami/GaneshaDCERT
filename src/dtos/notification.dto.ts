/**
 * Notification DTOs
 */

export interface RegisterPushTokenDTO {
  holder_did: string;
  token: string;
  deviceInfo?: string;
}

export interface UnregisterPushTokenDTO {
  token: string;
}

export interface SendPushNotificationDTO {
  holder_dids: string[];
  title: string;
  body: string;
  data?: any;
}

export interface PushTokenResponseDTO {
  id: string;
  holder_did: string;
  token: string;
  deviceInfo?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationResultDTO {
  total: number;
  successful: number;
  failed: number;
  tickets: any[];
}
