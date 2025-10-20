import { PushToken, Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { BadRequestError, NotFoundError } from "../utils/errors/AppError";

/**
 * Notification Service
 * Handles push notification token management and sending notifications
 */
class NotificationService {
  private expo: Expo;

  constructor() {
    this.expo = new Expo();
  }

  /**
   * Register push token for a holder
   */
  async registerPushToken(data: {
    holder_did: string;
    token: string;
    deviceInfo?: string;
  }): Promise<PushToken> {
    // Validate Expo push token
    if (!Expo.isExpoPushToken(data.token)) {
      throw new BadRequestError(
        `Push token ${data.token} is not a valid Expo push token`
      );
    }

    // Check if token already exists
    const existingToken = await prisma.pushToken.findUnique({
      where: { token: data.token },
    });

    if (existingToken) {
      // Update existing token
      const updatedToken = await prisma.pushToken.update({
        where: { token: data.token },
        data: {
          holder_did: data.holder_did,
          deviceInfo: data.deviceInfo ? (data.deviceInfo as Prisma.InputJsonValue) : Prisma.DbNull,
          isActive: true,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Push token updated: ${data.token}`);
      return updatedToken;
    }

    // Create new token
    const pushToken = await prisma.pushToken.create({
      data: {
        holder_did: data.holder_did,
        token: data.token,
        deviceInfo: data.deviceInfo ? (data.deviceInfo as Prisma.InputJsonValue) : Prisma.DbNull,
        isActive: true,
      },
    });

    console.log(`✅ Push token registered: ${data.token}`);
    return pushToken;
  }

  /**
   * Unregister push token
   */
  async unregisterPushToken(token: string): Promise<PushToken> {
    const pushToken = await prisma.pushToken.findUnique({
      where: { token },
    });

    if (!pushToken) {
      throw new NotFoundError("Push token not found");
    }

    // Soft delete by setting isActive to false
    const updatedToken = await prisma.pushToken.update({
      where: { token },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Push token unregistered: ${token}`);
    return updatedToken;
  }

  /**
   * Get all push tokens for a holder
   */
  async getPushTokensByHolder(holderDid: string): Promise<PushToken[]> {
    const tokens = await prisma.pushToken.findMany({
      where: {
        holder_did: holderDid,
        isActive: true,
      },
    });

    return tokens;
  }

  /**
   * Send push notification to specific users
   */
  async sendPushNotification(data: {
    holder_dids: string[];
    title: string;
    body: string;
    data?: any;
  }): Promise<{
    total: number;
    successful: number;
    failed: number;
    tickets: ExpoPushTicket[];
  }> {
    // Get all active push tokens for specified holders
    const pushTokens = await prisma.pushToken.findMany({
      where: {
        holder_did: { in: data.holder_dids },
        isActive: true,
      },
    });

    if (pushTokens.length === 0) {
      throw new NotFoundError(
        "No active push tokens found for the specified holders"
      );
    }

    // Create messages
    const messages: ExpoPushMessage[] = pushTokens.map((pushToken) => ({
      to: pushToken.token,
      sound: "default",
      title: data.title,
      body: data.body,
      data: data.data || {},
    }));

    // Send notifications in chunks
    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("❌ Error sending notification chunk:", error);
      }
    }

    // Count errors
    const errors = tickets.filter((ticket) => ticket.status === "error");

    console.log(
      `✅ Notifications sent: ${tickets.length - errors.length}/${tickets.length} successful`
    );

    return {
      total: tickets.length,
      successful: tickets.length - errors.length,
      failed: errors.length,
      tickets,
    };
  }

  /**
   * Send VC status notification to a holder
   */
  async sendVCStatusNotification(
    holderDid: string,
    title: string,
    body: string,
    vcData?: any
  ): Promise<void> {
    try {
      const pushTokens = await prisma.pushToken.findMany({
        where: {
          holder_did: holderDid,
          isActive: true,
        },
      });

      if (pushTokens.length === 0) {
        console.log(`⚠️ No active push tokens for holder: ${holderDid}`);
        return;
      }

      const messages: ExpoPushMessage[] = pushTokens.map((pushToken) => ({
        to: pushToken.token,
        sound: "default",
        title,
        body,
        data: vcData || {},
      }));

      const chunks = this.expo.chunkPushNotifications(messages);

      for (const chunk of chunks) {
        try {
          await this.expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error("❌ Error sending VC status notification:", error);
        }
      }

      console.log(`✅ VC status notification sent to: ${holderDid}`);
    } catch (error) {
      console.error("❌ Error in sendVCStatusNotification:", error);
    }
  }
}

export default new NotificationService();
