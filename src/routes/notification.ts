import { Router } from "express";
import {
  registerPushToken,
  unregisterPushToken,
  getPushTokensByHolder,
  sendPushNotification,
} from "../controllers/notificationController";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Push notification management endpoints
 */

/**
 * @swagger
 * /notifications/register:
 *   post:
 *     summary: Register a push notification token
 *     description: Register an Expo push token for a holder to receive notifications
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - holder_did
 *               - token
 *             properties:
 *               holder_did:
 *                 type: string
 *                 description: DID of the token holder
 *               token:
 *                 type: string
 *                 description: Expo push token (ExponentPushToken[...])
 *               deviceInfo:
 *                 type: object
 *                 description: Optional device information
 *                 properties:
 *                   deviceName:
 *                     type: string
 *                   osName:
 *                     type: string
 *                   osVersion:
 *                     type: string
 *     responses:
 *       201:
 *         description: Push token registered successfully
 *       400:
 *         description: Invalid request or token format
 *       500:
 *         description: Server error
 */
router.post("/register", registerPushToken);

/**
 * @swagger
 * /notifications/unregister:
 *   post:
 *     summary: Unregister a push notification token
 *     description: Deactivate a push token so it no longer receives notifications
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Expo push token to unregister
 *     responses:
 *       200:
 *         description: Push token unregistered successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post("/unregister", unregisterPushToken);

/**
 * @swagger
 * /notifications/tokens/{holder_did}:
 *   get:
 *     summary: Get all push tokens for a holder
 *     description: Retrieve all active push tokens registered for a specific holder
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: holder_did
 *         required: true
 *         schema:
 *           type: string
 *         description: DID of the token holder
 *     responses:
 *       200:
 *         description: List of push tokens
 *       500:
 *         description: Server error
 */
router.get("/tokens/:holder_did", getPushTokensByHolder);

/**
 * @swagger
 * /notifications/send:
 *   post:
 *     summary: Send push notification to specific holders
 *     description: Send a push notification to one or more holders by their DIDs
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - holder_dids
 *               - title
 *               - body
 *             properties:
 *               holder_dids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of holder DIDs to send notification to
 *               title:
 *                 type: string
 *                 description: Notification title
 *               body:
 *                 type: string
 *                 description: Notification body text
 *               data:
 *                 type: object
 *                 description: Optional additional data to send with notification
 *     responses:
 *       200:
 *         description: Notifications sent successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: No active tokens found
 *       500:
 *         description: Server error
 */
router.post("/send", sendPushNotification);

export default router;
