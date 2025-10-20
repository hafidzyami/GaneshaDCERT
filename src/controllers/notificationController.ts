import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";

const prisma = new PrismaClient();
const expo = new Expo();

/**
 * Register a push token for a user
 */
export const registerPushToken = async (req: Request, res: Response) => {
  try {
    const { holder_did, token, deviceInfo } = req.body;

    if (!holder_did || !token) {
      return res.status(400).json({
        success: false,
        message: "holder_did and token are required",
      });
    }

    // Validate that the token is a valid Expo push token
    if (!Expo.isExpoPushToken(token)) {
      return res.status(400).json({
        success: false,
        message: `Push token ${token} is not a valid Expo push token`,
      });
    }

    // Check if token already exists
    const existingToken = await prisma.pushToken.findUnique({
      where: { token },
    });

    if (existingToken) {
      // Update existing token
      const updatedToken = await prisma.pushToken.update({
        where: { token },
        data: {
          holder_did,
          deviceInfo: deviceInfo || null,
          isActive: true,
          updatedAt: new Date(),
        },
      });

      return res.status(200).json({
        success: true,
        message: "Push token updated successfully",
        data: updatedToken,
      });
    }

    // Create new token
    const pushToken = await prisma.pushToken.create({
      data: {
        holder_did,
        token,
        deviceInfo: deviceInfo || null,
        isActive: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Push token registered successfully",
      data: pushToken,
    });
  } catch (error: any) {
    console.error("Error registering push token:", error);
    res.status(500).json({
      success: false,
      message: "Failed to register push token",
      error: error.message,
    });
  }
};

/**
 * Unregister a push token
 */
export const unregisterPushToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "token is required",
      });
    }

    // Soft delete by setting isActive to false
    const updatedToken = await prisma.pushToken.update({
      where: { token },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: "Push token unregistered successfully",
      data: updatedToken,
    });
  } catch (error: any) {
    console.error("Error unregistering push token:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unregister push token",
      error: error.message,
    });
  }
};

/**
 * Get all push tokens for a specific holder
 */
export const getPushTokensByHolder = async (req: Request, res: Response) => {
  try {
    const { holder_did } = req.params;

    const tokens = await prisma.pushToken.findMany({
      where: {
        holder_did,
        isActive: true,
      },
    });

    res.status(200).json({
      success: true,
      data: tokens,
    });
  } catch (error: any) {
    console.error("Error getting push tokens:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get push tokens",
      error: error.message,
    });
  }
};

/**
 * Send a push notification to specific users
 */
export const sendPushNotification = async (req: Request, res: Response) => {
  try {
    const { holder_dids, title, body, data } = req.body;

    if (!holder_dids || !Array.isArray(holder_dids) || holder_dids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "holder_dids array is required",
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: "title and body are required",
      });
    }

    // Get all active push tokens for the specified holders
    const pushTokens = await prisma.pushToken.findMany({
      where: {
        holder_did: { in: holder_dids },
        isActive: true,
      },
    });

    if (pushTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active push tokens found for the specified holders",
      });
    }

    // Create messages
    const messages: ExpoPushMessage[] = pushTokens.map((pushToken) => ({
      to: pushToken.token,
      sound: "default",
      title,
      body,
      data: data || {},
    }));

    // Send notifications in chunks
    const chunks = expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Error sending chunk:", error);
      }
    }

    // Check for errors in tickets
    const errors = tickets.filter(
      (ticket) => ticket.status === "error"
    );

    res.status(200).json({
      success: true,
      message: "Push notifications sent",
      data: {
        total: tickets.length,
        successful: tickets.length - errors.length,
        failed: errors.length,
        tickets,
      },
    });
  } catch (error: any) {
    console.error("Error sending push notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send push notification",
      error: error.message,
    });
  }
};

/**
 * Send notification when VC status changes
 */
export const sendVCStatusNotification = async (
  holder_did: string,
  title: string,
  body: string,
  vcData?: any
) => {
  try {
    const pushTokens = await prisma.pushToken.findMany({
      where: {
        holder_did,
        isActive: true,
      },
    });

    if (pushTokens.length === 0) {
      console.log(`No active push tokens found for holder: ${holder_did}`);
      return;
    }

    const messages: ExpoPushMessage[] = pushTokens.map((pushToken) => ({
      to: pushToken.token,
      sound: "default",
      title,
      body,
      data: vcData || {},
    }));

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error("Error sending VC status notification:", error);
      }
    }
  } catch (error) {
    console.error("Error in sendVCStatusNotification:", error);
  }
};
