import express, { Router } from "express";
import * as paymentController from "../controllers/payment.controller";
import {
  validatePaymentConfig,
  validateMinimumAmount,
  validateMaximumAmount,
  validatePaymentRequest
} from "../middlewares/payment.middleware";
import { verifyDIDSignature } from "../middlewares/didAuth.middleware";
import {
  paymentValidators,
  vaPaymentNotificationHeaderValidators,
  vaPaymentNotificationBodyValidators,
  getUnpaidItemsValidator,
  getItemFromBlockchainValidator,
} from "../validators/payment.validator";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payment
 *   description: Payment transaction management using DOKU payment gateway
 */

/**
 * @swagger
 * /payment/transaction:
 *   post:
 *     summary: Create payment transaction
 *     description: |
 *       Create a new payment transaction through DOKU payment gateway.
 *
 *       **Flow:**
 *       1. Validate items exist and not yet paid
 *       2. Create order on Payment Blockchain
 *       3. Generate DOKU payment link
 *       4. Return payment URL for holder to complete payment
 *     tags:
 *       - Payment
 *     security:
 *       - HolderBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - holder_did
 *               - item_ids
 *             properties:
 *               holder_did:
 *                 type: string
 *                 example: "did:dcert:uABCD1234567890-xyz_12345678901234567890abcd"
 *                 description: Holder's DID
 *               item_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example: ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440001"]
 *                 description: Array of unpaid item IDs to pay
 *     responses:
 *       200:
 *         description: Payment transaction created successfully
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
 *                   example: "Payment transaction created successfully"
 *                 data:
 *                   type: string
 *                   description: DOKU payment URL for holder to complete payment
 *                   example: "https://pay.doku.com/invoice/INV-550e8400-1234567890"
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Item with ID xxx not found"
 *       401:
 *         description: Unauthorized - Invalid DID signature
 *       500:
 *         description: Server error
 */
router.post(
  "/transaction",
  verifyDIDSignature,
  validatePaymentConfig,
  validatePaymentRequest,
  paymentValidators,
  paymentController.createPaymentTransaction
);

/**
 * @swagger
 * /payment/unpaid-items:
 *   post:
 *     summary: Get unpaid items for a holder
 *     description: |
 *       Retrieve all unpaid items (pending payment) for a specific holder identified by their DID.
 *
 *       **Use Case:**
 *       - Holder wants to see all pending payments
 *       - Display unpaid items in payment dashboard
 *       - Get list of item IDs to pay
 *
 *       **Returns:**
 *       - List of unpaid items (simplified: item_id, vc_id, item_type only)
 *       - Total unpaid items count
 *
 *       **Note:**
 *       - Holder DID is extracted from vc_id (format: schema_id:version:holder_did:timestamp)
 *     tags:
 *       - Payment
 *     security:
 *       - HolderBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - holder_did
 *             properties:
 *               holder_did:
 *                 type: string
 *                 description: Holder's DID (Decentralized Identifier)
 *                 example: "did:dcert:uABCD1234567890-xyz_12345678901234567890abcd"
 *     responses:
 *       200:
 *         description: Unpaid items retrieved successfully
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
 *                   example: "Unpaid items retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     holder_did:
 *                       type: string
 *                       example: "did:dcert:uABCD1234567890-xyz_12345678901234567890abcd"
 *                     total_unpaid_items:
 *                       type: integer
 *                       description: Total number of unpaid items
 *                       example: 3
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           item_id:
 *                             type: string
 *                             format: uuid
 *                             description: Item blockchain ID
 *                             example: "550e8400-e29b-41d4-a716-446655440000"
 *                           vc_id:
 *                             type: string
 *                             description: Verifiable Credential ID (format - schema_id:version:holder_did:timestamp)
 *                             example: "schema123:1:did:dcert:holder:1234567890"
 *                           item_type:
 *                             type: string
 *                             enum: [ISSUANCE, RENEWAL, UPDATE]
 *                             description: Type of credential operation
 *                             example: "ISSUANCE"
 *                           date:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                             description: Request creation date from respective table (VCIssuanceRequest, VCRenewalRequest, or VCUpdateRequest)
 *                             example: "2024-01-15T10:30:45.123Z"
 *                           price:
 *                             type: number
 *                             description: Price of the item
 *                             example: 50000 
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Validation error"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                         example: "holder_did"
 *                       message:
 *                         type: string
 *                         example: "Holder DID is required"
 *       401:
 *         description: Unauthorized - Invalid DID signature
 *       500:
 *         description: Internal server error
 */
router.post(
  "/unpaid-items",
  verifyDIDSignature,
  getUnpaidItemsValidator,
  paymentController.getUnpaidItems
);

/**
 * @swagger
 * /payment/test-transaction:
 *   post:
 *     summary: Create payment transaction (Test Mode)
 *     description: |
 *       Create a new payment transaction through DOKU payment gateway without DID signature verification.
 *
 *       **⚠️ WARNING: This endpoint is for testing purposes only.**
 *
 *       - No authentication required
 *       - Should be removed or secured in production
 *       - Use `/payment/transaction` for production with proper authentication
 *     tags:
 *       - Payment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - holder_did
 *               - item_ids
 *             properties:
 *               holder_did:
 *                 type: string
 *                 example: "did:dcert:uABCD1234567890-xyz_12345678901234567890abcd"
 *                 description: Holder's DID
 *               item_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example: ["550e8400-e29b-41d4-a716-446655440000"]
 *                 description: Array of unpaid item IDs
 *     responses:
 *       200:
 *         description: Payment transaction created successfully
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
 *                   example: "Payment transaction created successfully"
 *                 data:
 *                   type: string
 *                   description: DOKU payment URL
 *                   example: "https://pay.doku.com/invoice/INV-550e8400-1234567890"
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */
router.post(
  "/test-transaction",
  validatePaymentConfig,
  validatePaymentRequest,
  paymentValidators,
  paymentController.createPaymentTransaction
);

/**
 * @swagger
 * /payment/transfer-va/notification:
 *   post:
 *     summary: DOKU Payment Notification Webhook
 *     description: |
 *       Receives payment notification from DOKU when payment is completed.
 *
 *       **Supported Payment Methods:**
 *       - Virtual Account (VA)
 *       - Credit Card
 *       - E-wallet (ShopeePay, GoPay, OVO, DANA)
 *       - QRIS
 *       - Debit Card
 *       - Paylater (Kredivo, Akulaku)
 *       - Convenience Store (Alfamart, Indomaret)
 *
 *       **Automatic Process:**
 *       1. Verify DOKU signature
 *       2. Update order status to SUCCESS
 *       3. Mark items as paid
 *       4. Trigger automatic VC issuance to blockchain
 *     tags:
 *       - Payment
 *     parameters:
 *       - in: header
 *         name: Client-Id
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ID from DOKU Back Office
 *         example: MCH-0001-10791114622547
 *       - in: header
 *         name: Request-Id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique random string (max 128 characters) generated by DOKU
 *         example: fdb69f47-96da-499d-acec-7cdc318ab2fe
 *       - in: header
 *         name: Request-Timestamp
 *         required: true
 *         schema:
 *           type: string
 *         description: Time Stamp request on UTC time in ISO8601 format
 *         example: 2020-08-11T08:45:42Z
 *       - in: header
 *         name: Signature
 *         required: true
 *         schema:
 *           type: string
 *         description: Signature to verify notification authenticity from DOKU
 *         example: HMACSHA256=1jap2tpgvWt83tG4J7IhEwUrwmMt71OaIk0oL0e6sPM=
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - service
 *               - transaction
 *               - order
 *             properties:
 *               service:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     enum: [VIRTUAL_ACCOUNT, CREDIT_CARD, EMONEY, QRIS, DIRECT_DEBIT, PEER_TO_PEER, ONLINE_TO_OFFLINE]
 *                     description: Payment service type
 *                     example: "VIRTUAL_ACCOUNT"
 *               acquirer:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: Bank/acquirer ID
 *                     example: "BCA"
 *               channel:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: Payment channel ID
 *                     example: "VIRTUAL_ACCOUNT_BCA"
 *               transaction:
 *                 type: object
 *                 required:
 *                   - status
 *                   - date
 *                 properties:
 *                   status:
 *                     type: string
 *                     enum: [SUCCESS, FAILED, PENDING]
 *                     example: "SUCCESS"
 *                   date:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-01-15T10:30:45Z"
 *                   original_request_id:
 *                     type: string
 *                     example: "550e8400-e29b-41d4-a716-446655440000"
 *               order:
 *                 type: object
 *                 required:
 *                   - invoice_number
 *                   - amount
 *                 properties:
 *                   invoice_number:
 *                     type: string
 *                     description: Order invoice number
 *                     example: "INV-550e8400-1234567890"
 *                   amount:
 *                     type: number
 *                     description: Total amount paid
 *                     example: 150000
 *               virtual_account_info:
 *                 type: object
 *                 description: Present when payment method is Virtual Account
 *                 properties:
 *                   virtual_account_number:
 *                     type: string
 *                     example: "7777770000000001"
 *               card_payment:
 *                 type: object
 *                 description: Present when payment method is Credit/Debit Card
 *                 properties:
 *                   masked_card_number:
 *                     type: string
 *                     example: "411111******1111"
 *                   approval_code:
 *                     type: string
 *                     example: "123456"
 *               emoney_payment:
 *                 type: object
 *                 description: Present when payment method is E-wallet or QRIS
 *                 properties:
 *                   account_id:
 *                     type: string
 *                     example: "081234567890"
 *                   approval_code:
 *                     type: string
 *                     example: "QRIS123456"
 *     responses:
 *       200:
 *         description: Payment notification processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 responseCode:
 *                   type: string
 *                   example: "2002500"
 *                   description: DOKU standard success code
 *                 responseMessage:
 *                   type: string
 *                   example: "Success"
 *       400:
 *         description: Bad Request - Invalid payload
 *       403:
 *         description: Forbidden - Invalid signature
 *       500:
 *         description: Internal server error
 */
router.post(
  "/transfer-va/notification",
  vaPaymentNotificationHeaderValidators,
  vaPaymentNotificationBodyValidators,
  paymentController.handleVAPaymentNotification
);

/**
 * @swagger
 * /payment/blockchain/item/{id}:
 *   get:
 *     summary: Get item from blockchain by ID
 *     description: |
 *       Retrieve item details directly from the PaymentManager smart contract on blockchain.
 *
 *       **Returns:**
 *       - Item ID
 *       - Price (in wei/smallest unit)
 *       - VC ID (Verifiable Credential ID)
 *       - VC Hash (Hash of the credential)
 *       - Item Type (ISSUANCE, RENEWAL, or UPDATE)
 *       - Payment Status (isPaid)
 *
 *       **Note:**
 *       - This fetches real-time data from blockchain
 *       - Data may differ from database if sync is delayed
 *     tags:
 *       - Payment
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Item ID (UUID format)
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Item retrieved successfully from blockchain
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
 *                   example: "Item retrieved from blockchain successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Item ID
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     price:
 *                       type: string
 *                       description: Item price (as string to preserve precision)
 *                       example: "50000"
 *                     vcID:
 *                       type: string
 *                       description: Verifiable Credential ID
 *                       example: "schema123:1:did:dcert:holder:1234567890"
 *                     vcHash:
 *                       type: string
 *                       description: Hash of the verifiable credential
 *                       example: "0x1234567890abcdef..."
 *                     itemType:
 *                       type: string
 *                       enum: [ISSUANCE, RENEWAL, UPDATE]
 *                       description: Type of credential operation
 *                       example: "ISSUANCE"
 *                     isPaid:
 *                       type: boolean
 *                       description: Payment status
 *                       example: false
 *       400:
 *         description: Validation error - Invalid item ID format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Validation error"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                         example: "id"
 *                       message:
 *                         type: string
 *                         example: "Item ID is required"
 *       404:
 *         description: Item not found on blockchain
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Item with ID 550e8400-e29b-41d4-a716-446655440000 not found on blockchain"
 *       500:
 *         description: Internal server error or blockchain connection issue
 */
router.get(
  "/blockchain/item/:id",
  getItemFromBlockchainValidator,
  paymentController.getItemFromBlockchain
);

export default router;