import { BadRequestError, NotFoundError } from "../utils/errors/AppError";
import { logger } from "../config";
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';


import paymentSignatureUtilInstance from '../utils/paymentSignature';


// General class for payment, using DOKU provider
class PaymentService {
    constructor() { }

    /**
     * Create transaction to DOKU payment gateway
     * Configuration object containing url, clientId, secretKey, requestTarget, and body
     * Returning response data from DOKU API
     */
    async createTransaction(config: {
        holder_did: string;
        item_ids: string[];
    }) {
        try {

            // HARDCODE FOR DEVELOPMENT
            const amount = 10000;
            const invoice_number = `INV-${Date.now()}`;
            const payment_due_date = 60

            const config = {
                url: process.env.DOKU_API_URL || '',
                clientId: process.env.DOKU_CLIENT_ID || '',
                secretKey: process.env.DOKU_SECRET_KEY || '',
                requestTarget: '/checkout/v1/payment',
                body: {
                    order: {
                        amount,
                        invoice_number
                    },
                    payment: {
                        payment_due_date
                    }
                }
            };
            const requestId = uuidv4();
            const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
            const digest = await paymentSignatureUtilInstance.generateDigest(config.body);

            const signature = await paymentSignatureUtilInstance.geneateSignatureNonSnap(
                config.clientId,
                requestId,
                timestamp,
                config.requestTarget,
                digest,
                config.secretKey
            );

            const headers = {
                'Client-Id': config.clientId,
                'Request-Id': requestId,
                'Request-Timestamp': timestamp,
                'Request-Target': config.requestTarget,
                'Signature': signature,
                'Content-Type': 'application/json'
            };

            const response = await axios.post(config.url, config.body, {
                headers
            });

            return response.data.response.payment.url;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new BadRequestError(`DOKU API Error: ${error.response?.data?.message || error.message}`);
            } else {
                throw new BadRequestError(`Unexpected Error: ${error}`);
            }
        }
    }

    /**
     * Handle DOKU payment notification for all payment types
     * Supports: Virtual Account, Credit Card, Convenience Store, E-wallet, Debit, Paylater, QRIS
     * @param notificationData Payment notification data from DOKU
     * @returns Response to send back to DOKU
     */
    async handleVAPaymentNotification(notificationData: any) {
        try {
            const serviceId = notificationData.service?.id || 'UNKNOWN';
            const acquirerId = notificationData.acquirer?.id || 'UNKNOWN';
            const channelId = notificationData.channel?.id || 'UNKNOWN';
            const transactionStatus = notificationData.transaction?.status;
            const invoiceNumber = notificationData.order?.invoice_number;
            const amount = notificationData.order?.amount;
            const transactionDate = notificationData.transaction?.date;

            logger.info(`Received ${serviceId} payment notification:`, {
                serviceId,
                acquirerId,
                channelId,
                invoiceNumber,
                amount,
                status: transactionStatus,
                date: transactionDate,
            });

            switch (serviceId) {
                case 'VIRTUAL_ACCOUNT':
                    logger.info('Virtual Account Details:', {
                        vaNumber: notificationData.virtual_account_info?.virtual_account_number,
                        identifier: notificationData.virtual_account_payment?.identifer,
                    });
                    break;

                case 'CREDIT_CARD':
                    logger.info('Credit Card Details:', {
                        maskedCard: notificationData.card_payment?.masked_card_number,
                        approvalCode: notificationData.card_payment?.approval_code,
                        issuer: notificationData.card_payment?.issuer,
                    });
                    break;

                case 'ONLINE_TO_OFFLINE':
                    logger.info('Convenience Store Details:', {
                        paymentCode: notificationData.online_to_offline_info?.payment_code,
                        agentId: notificationData.online_to_offline_payment?.identifier?.find((i: any) => i.name === 'AGENT_ID')?.value,
                    });
                    break;

                case 'EMONEY':
                    logger.info('E-wallet Details:', {
                        transactionMessage: notificationData.shopeepay_payment?.transaction_message,
                        merchantExtId: notificationData.shopeepay_configuration?.merchant_ext_id,
                    });
                    break;

                case 'DIRECT_DEBIT':
                    logger.info('Debit Card Details:', {
                        maskedCard: notificationData.card_payment?.masked_card_number,
                        paymentId: notificationData.card_payment?.payment_id,
                    });
                    break;

                case 'PEER_TO_PEER':
                    logger.info('Paylater Details:', {
                        vaNumber: notificationData.peer_to_peer_info?.virtual_account_number,
                        merchantRef: notificationData.payment?.merchant_unique_reference,
                    });
                    break;

                case 'QRIS':
                    logger.info('QRIS Details:', {
                        accountId: notificationData.emoney_payment?.account_id,
                        approvalCode: notificationData.emoney_payment?.approval_code,
                        customer: notificationData.customer?.name,
                    });
                    break;

                default:
                    logger.warn('Unknown payment service type:', serviceId);
            }

            // TODO: In production, implement these based on payment type:
            // 1. Verify signature from DOKU headers
            // 2. Save payment data to database with proper payment type
            // 3. Update order/transaction status
            // 4. Send notification to user (email/push)
            // 5. Trigger post-payment processes (issue VC, etc)

            logger.success('Payment notification processed successfully');

            // Return standard success response
            return {
                responseCode: '2002500',
                responseMessage: 'Success',
            };
        } catch (error) {
            logger.error('Error processing payment notification:', error);
            throw new BadRequestError('Failed to process payment notification');
        }
    }
}

const paymentServiceInstance = new PaymentService();
export default paymentServiceInstance;

export { PaymentService };
