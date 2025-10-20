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

/**
 * @swagger
 * /notifications/register:
 *   post:
 *     summary: Register push token
 *     description: Register a device push token for receiving notifications
 *     tags:
 *       - Notifications
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - holder_did
 *               - push_token
 *               - device_type
 *             properties:
 *               holder_did:
 *                 type: string
 *                 example: did:ganesha:0x1234567890abcdef
 *                 description: DID of the token holder
 *               push_token:
 *                 type: string
 *                 example: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 *                 description: Push notification token from device
 *               device_type:
 *                 type: string
 *                 enum: [IOS, ANDROID, WEB]
 *                 example: ANDROID
 *                 description: Type of device
 *               device_name:
 *                 type: string
 *                 example: Samsung Galaxy S21
 *                 description: Optional device name
 *     responses:
 *       201:
 *         description: Push token registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Push token berhasil didaftarkan
 *                 data:
 *                   type: object
 *                   properties:
 *                     token_id:
 *                       type: string
 *                       format: uuid
 *                     holder_did:
 *                       type: string
 *                     device_type:
 *                       type: string
 *       400:
 *         description: Invalid request data
 *       409:
 *         description: Push token already registered
 *       500:
 *         description: Internal server error
 */
router.post("/register", registerPushTokenValidator, registerPushToken);

/**
 * @swagger
 * /notifications/unregister:
 *   post:
 *     summary: Unregister push token
 *     description: Remove a device push token from the system
 *     tags:
 *       - Notifications
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - push_token
 *             properties:
 *               push_token:
 *                 type: string
 *                 example: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 *                 description: Push notification token to unregister
 *     responses:
 *       200:
 *         description: Push token unregistered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Push token berhasil dihapus
 *       400:
 *         description: Invalid push token
 *       404:
 *         description: Push token not found
 *       500:
 *         description: Internal server error
 */
router.post("/unregister", unregisterPushTokenValidator, unregisterPushToken);

/**
 * @swagger
 * /notifications/tokens/{holder_did}:
 *   get:
 *     summary: Get push tokens by holder
 *     description: Retrieve all registered push tokens for a specific holder DID
 *     tags:
 *       - Notifications
 *     parameters:
 *       - in: path
 *         name: holder_did
 *         required: true
 *         schema:
 *           type: string
 *         example: did:ganesha:0x1234567890abcdef
 *         description: DID of the token holder
 *     responses:
 *       200:
 *         description: List of push tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       token_id:
 *                         type: string
 *                         format: uuid
 *                       holder_did:
 *                         type: string
 *                       push_token:
 *                         type: string
 *                       device_type:
 *                         type: string
 *                         enum: [IOS, ANDROID, WEB]
 *                       device_name:
 *                         type: string
 *                       is_active:
 *                         type: boolean
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Invalid holder DID
 *       404:
 *         description: No tokens found for this holder
 *       500:
 *         description: Internal server error
 */
router.get("/tokens/:holder_did", getPushTokensByHolderValidator, getPushTokensByHolder);

/**
 * @swagger
 * /notifications/send:
 *   post:
 *     summary: Send push notification
 *     description: Send a push notification to one or multiple holders
 *     tags:
 *       - Notifications
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipient_dids
 *               - title
 *               - body
 *             properties:
 *               recipient_dids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["did:ganesha:0x1234567890abcdef"]
 *                 description: Array of recipient DIDs
 *               title:
 *                 type: string
 *                 example: New Credential Request
 *                 description: Notification title
 *               body:
 *                 type: string
 *                 example: You have received a new credential request from Universitas Indonesia
 *                 description: Notification body message
 *               data:
 *                 type: object
 *                 description: Additional data to include in notification
 *                 properties:
 *                   type:
 *                     type: string
 *                     example: CREDENTIAL_REQUEST
 *                   request_id:
 *                     type: string
 *                     format: uuid
 *               priority:
 *                 type: string
 *                 enum: [default, normal, high]
 *                 default: default
 *                 description: Notification priority
 *     responses:
 *       200:
 *         description: Notifications sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Notifikasi berhasil dikirim
 *                 data:
 *                   type: object
 *                   properties:
 *                     sent_count:
 *                       type: integer
 *                       example: 3
 *                     failed_count:
 *                       type: integer
 *                       example: 0
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           recipient_did:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [sent, failed]
 *                           error:
 *                             type: string
 *                             nullable: true
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: No valid push tokens found for recipients
 *       500:
 *         description: Internal server error
 */
router.post("/send", sendPushNotificationValidator, sendPushNotification);

export default router;
