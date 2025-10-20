import { Router } from "express";
import {
  registerPushToken,
  unregisterPushToken,
  getPushTokensByHolder,
  sendPushNotification,
} from "../controllers/notification.controller";
import {
  registerPushTokenValidator,
  unregisterPushTokenValidator,
  getPushTokensByHolderValidator,
  sendPushNotificationValidator,
} from "../validators/notification.validator";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Push notification management endpoints
 */

// Register push token
router.post("/register", registerPushTokenValidator, registerPushToken);

// Unregister push token
router.post("/unregister", unregisterPushTokenValidator, unregisterPushToken);

// Get push tokens by holder
router.get("/tokens/:holder_did", getPushTokensByHolderValidator, getPushTokensByHolder);

// Send push notification
router.post("/send", sendPushNotificationValidator, sendPushNotification);

export default router;
