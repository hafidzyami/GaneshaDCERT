import { BadRequestError, InternalServerError, NotFoundError } from "../utils/errors/AppError";
import { logger } from "../config";
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from "../config/database";

import paymentSignatureUtilInstance from '../utils/paymentSignature';
import paymentBlockchainService from "./blockchain/paymentBlockchain.service";
import blockchainTransactionQueueService from "./blockchain/blockchainTransactionQueue.service";
import { ItemType } from "@prisma/client";

// General class for payment, using DOKU provider
class PaymentService {
    constructor() { }

    /**
     * Create transaction to DOKU payment gateway
     * Configuration object containing url, clientId, secretKey, requestTarget, and body
     * Returning response data from DOKU API
     */
    async createTransaction(params: {
        holder_did: string;
        item_ids: string[];
    }) {
        try {

            let totalAmount = 0;
            const items: Array<{ id: string; vcID: string; price: number }> = [];
            const invoice_number = `INV-${uuidv4()}-${Date.now()}`;
            for (const itemId of params.item_ids) {
                const item = await prisma.itemBlockchain.findUnique({
                    where: { id: itemId },
                    select: {
                        id: true,
                        vcID: true,
                        price: true,
                        isPaid: true,
                        
                    },
                });

                if (!item) {
                    throw new NotFoundError(`Item with ID ${itemId} not found`);
                }

                if (item.isPaid) {
                    throw new BadRequestError(`Item ${itemId} has already been paid`);
                }

                const priceInNumber = Number(item.price);
                totalAmount += priceInNumber;
                items.push({
                    id: item.id,
                    vcID: item.vcID,
                    price: priceInNumber,
                });
            }

            logger.info(`Creating transaction for ${items.length} items, total: ${totalAmount}`, {
                holder_did: params.holder_did,
                items: items.map(i => ({ id: i.id, vcID: i.vcID, price: i.price })),
            });

            // 1. IMMEDIATELY save OrderBlockchain to database (for fast response)
            try {
                await prisma.orderBlockchain.create({
                    data: {
                        id: invoice_number,
                        holderDID: params.holder_did,
                        status: "PENDING_PAYMENT",
                        amount: totalAmount,
                        currency: "IDR",
                        blockNumber: 0,
                        txHash: "pending-blockchain",
                    },
                });
                logger.success(`Order saved to database: ${invoice_number} (status=PENDING_PAYMENT)`);
            } catch (dbError: any) {
                logger.error(`Failed to save order to database: ${invoice_number}`, dbError);
                throw new InternalServerError(
                    `Failed to save order to database: ${dbError.message}`
                );
            }

            // 2. Queue CREATE_ORDER for blockchain (parallel)
            try {
                await blockchainTransactionQueueService.queueCreateOrder({
                    orderId: invoice_number,
                    holderDID: params.holder_did,
                    amount: totalAmount,
                    currency: "IDR",
                    itemIds: items.map(item => item.id),
                });
                logger.info(`Order queued for blockchain: ${invoice_number}`);
            } catch (queueError: any) {
                logger.error("Failed to queue order for blockchain:", queueError);
                // Don't throw - order already saved to database
                logger.warn("Order saved to database but blockchain transaction failed to queue. Will retry later.");
            }

            const paymentRecordId = uuidv4();

            // 3. IMMEDIATELY save PaymentBlockchain to database
            try {
                await prisma.paymentBlockchain.create({
                    data: {
                        id: paymentRecordId,
                        orderID: invoice_number,
                        method: "",
                        status: "PENDING",
                        amount: totalAmount,
                        paidAt: null,
                        blockNumber: 0,
                        txHash: "pending-blockchain",
                    },
                });
                logger.success(`Payment saved to database: ${paymentRecordId} (status=PENDING)`);
            } catch (dbError: any) {
                logger.error(`Failed to save payment to database: ${paymentRecordId}`, dbError);
                throw new InternalServerError(
                    `Failed to save payment to database: ${dbError.message}`
                );
            }

            // 4. Queue CREATE_PAYMENT for blockchain (parallel)
            try {
                await blockchainTransactionQueueService.queueCreatePayment({
                    paymentId: paymentRecordId,
                    orderID: invoice_number,
                    status: 'PENDING',
                    amount: totalAmount
                });
                logger.info(`Payment queued for blockchain: ${paymentRecordId}`);
            } catch (queueError: any) {
                logger.error("Failed to queue payment for blockchain:", queueError);
                // Don't throw - payment already saved to database
                logger.warn("Payment saved to database but blockchain transaction failed to queue. Will retry later.");
            }
            
            const payment_due_date = 3;

            const config = {
                url: process.env.DOKU_API_URL || '',
                clientId: process.env.DOKU_CLIENT_ID || '',
                secretKey: process.env.DOKU_SECRET_KEY || '',
                requestTarget: '/checkout/v1/payment',
                body: {
                    order: {
                        amount: totalAmount,
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

            logger.success(`Transaction created successfully: ${invoice_number}`);
            
            // Return the payment URL from DOKU response
            logger.info('DOKU Response Data:', response.data);
            const paymentUrl = response.data?.response?.payment?.url || response.data?.payment?.url;
            
            if (!paymentUrl) {
                logger.error('Payment URL not found in DOKU response:', response.data);
                throw new InternalServerError('Payment URL not received from payment gateway');
            }

            return paymentUrl;
        } catch (error) {
            logger.error('Error in createTransaction:', error);
            
            if (axios.isAxiosError(error)) {
                const errorMessage = error.response?.data?.message || error.message;
                logger.error('DOKU API Error details:', error.response?.data);
                throw new BadRequestError(`DOKU API Error: ${errorMessage}`);
            } else if (error instanceof BadRequestError || error instanceof NotFoundError || error instanceof InternalServerError) {
                throw error;
            } else {
                throw new InternalServerError(`Unexpected Error: ${error}`);
            }
        }
    }

    /**
     * Get unpaid items for a holder
     * @param holder_did - Holder's DID
     * @returns Array of unpaid items (item_id, vc_id, item_type only)
     */
    async getUnpaidItems(holder_did: string) {
        try {
            logger.info(`Fetching unpaid items for holder: ${holder_did}`);

            // Get unpaid items from ItemBlockchain filtered by holderDID
            const holderUnpaidItems = await prisma.itemBlockchain.findMany({
                where: {
                    holderDID: holder_did,
                    isPaid: false,
                },
                select: {
                    id: true,
                    vcID: true,
                    itemType: true,
                    price: true,
                    issuerDID: true,
                    holderDID: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });

            logger.info(`Found ${holderUnpaidItems.length} unpaid items for holder ${holder_did}`);

            // Transform data for response with date from respective tables
            const transformedItems = await Promise.all(
                holderUnpaidItems.map(async (item) => {
                    let requestDate = null;

                    // Get date based on itemType
                    if (item.itemType === ItemType.ISSUANCE) {
                        const request = await prisma.vCIssuanceRequest.findFirst({
                            where: { vc_id: item.vcID },
                            select: { createdAt: true },
                        });
                        requestDate = request?.createdAt;
                    } else if (item.itemType === ItemType.RENEWAL) {
                        const request = await prisma.vCRenewalRequest.findFirst({
                            where: { vc_id: item.vcID },
                            select: { createdAt: true },
                        });
                        requestDate = request?.createdAt;
                    } else if (item.itemType === ItemType.UPDATE) {
                        const request = await prisma.vCUpdateRequest.findFirst({
                            where: { vc_id: item.vcID },
                            select: { createdAt: true },
                        });
                        requestDate = request?.createdAt;
                    }

                    return {
                        item_id: item.id,
                        vc_id: item.vcID,
                        item_type: item.itemType,
                        date: requestDate,
                        price: item.price.toString(),
                    };
                })
            );

            return {
                holder_did,
                total_unpaid_items: transformedItems.length,
                items: transformedItems,
            };
        } catch (error) {
            logger.error(`Error fetching unpaid items for holder ${holder_did}:`, error);
            throw new InternalServerError(`Failed to fetch unpaid items: ${error}`);
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

            const paymentRecord = await prisma.paymentBlockchain.findFirst({
                where: {
                    orderID: invoiceNumber,
                    status: {
                        not: 'SUCCESS'
                    }
                },
                select: {
                    id: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            if (!paymentRecord) {
                throw new NotFoundError(`Payment record not found for invoice ${invoiceNumber}`);
            }

            const paymentRecordId = paymentRecord.id;

            // Handle payment based on status (queue for async processing)
            if (transactionStatus === 'SUCCESS') {
                await blockchainTransactionQueueService.queueCompletePayment({
                    paymentId: paymentRecordId,
                    orderId: invoiceNumber,
                    method: serviceId,
                    successStatus: transactionStatus
                });
                logger.success(`Payment completion queued for invoice ${invoiceNumber}`);
            } else if (transactionStatus === 'FAILED' || transactionStatus === 'EXPIRED' || transactionStatus === 'CANCELED') {
                await blockchainTransactionQueueService.queueFailedPayment({
                    paymentId: paymentRecordId,
                    orderId: invoiceNumber,
                    method: serviceId,
                    failedStatus: transactionStatus
                });
                logger.warn(`Payment failure queued for invoice ${invoiceNumber} with status: ${transactionStatus}`);
            } else {
                logger.info(`Payment status ${transactionStatus} for invoice ${invoiceNumber} - no action taken`);
            }

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









    /**
     * Get order from blockchain by ID
     * @param id - Order ID (invoice number)
     * @returns Order data from blockchain
     */
    async getOrderFromBlockchain(id: string) {
        try {
            logger.info(`Fetching order from blockchain: ${id}`);

            const orderData = await paymentBlockchainService.getOrder(id);

            if (!orderData) {
                throw new NotFoundError(`Order with ID ${id} not found on blockchain`);
            }

            // Map status enum number to string
            const statusMap: { [key: number]: string } = {
                0: "NONE",
                1: "PENDING_PAYMENT",
                2: "SUCCESS",
                3: "CANCELED",
            };

            const result = {
                id: id,
                holderDID: orderData.holderDID,
                status: statusMap[Number(orderData.status)] || "UNKNOWN",
                amount: orderData.amount.toString(),
                currency: orderData.currency,
                items: orderData.items, // Array of item IDs
            };

            logger.success(`Order fetched from blockchain: ${id}`);
            return result;
        } catch (error: any) {
            logger.error(`Error fetching order from blockchain:`, {
                id,
                error: error.message,
            });

            if (error instanceof NotFoundError) {
                throw error;
            }

            throw new InternalServerError(`Failed to fetch order from blockchain: ${error.message}`);
        }
    }

    /**
     * Get item from blockchain by ID
     * @param id - Item ID
     * @returns Item data from blockchain
     */
    async getItemFromBlockchain(id: string) {
        try {
            logger.info(`Fetching item from blockchain: ${id}`);

            const itemData = await paymentBlockchainService.getItem(id);

            if (!itemData) {
                throw new NotFoundError(`Item with ID ${id} not found on blockchain`);
            }

            // Map itemType enum number to string
            const itemTypeMap: { [key: number]: string } = {
                0: "ISSUANCE",
                1: "RENEWAL",
                2: "UPDATE",
            };

            const result = {
                id: id,
                issuerDID: itemData.issuerDID,
                holderDID: itemData.holderDID,
                price: itemData.price.toString(),
                vcID: itemData.vcID,
                vcHash: itemData.vcHash,
                itemType: itemTypeMap[Number(itemData.itemType)] || "UNKNOWN",
                isPaid: itemData.isPaid,
            };

            logger.success(`Item fetched from blockchain: ${id}`);
            return result;
        } catch (error: any) {
            logger.error(`Error fetching item from blockchain:`, {
                id,
                error: error.message,
            });

            if (error instanceof NotFoundError) {
                throw error;
            }

            throw new InternalServerError(`Failed to fetch item from blockchain: ${error.message}`);
        }
    }
}

const paymentServiceInstance = new PaymentService();
export default paymentServiceInstance;

export { PaymentService };
