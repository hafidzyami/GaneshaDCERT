import { BadRequestError, InternalServerError, NotFoundError } from "../utils/errors/AppError";
import { logger } from "../config";
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from "../config/database";

import paymentSignatureUtilInstance from '../utils/paymentSignature';
import paymentBlockchainService from "./blockchain/paymentBlockchain.service";
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
            const result = await paymentBlockchainService.createOrder(
                invoice_number,
                params.holder_did,
                totalAmount,
                "IDR",
                items.map(item => item.id),
            );

            if (!result) {
                throw new InternalServerError("Failed to create order on blockchain");
            }

            const payment_due_date = 60;

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
     * Get unpaid items for a holder
     * @param holder_did - Holder's DID
     * @returns Array of unpaid items (item_id, vc_id, item_type only)
     */
    async getUnpaidItems(holder_did: string) {
        try {
            logger.info(`Fetching unpaid items for holder: ${holder_did}`);

            // Get all unpaid items from ItemBlockchain
            const unpaidItems = await prisma.itemBlockchain.findMany({
                where: {
                    isPaid: false,
                },
                select: {
                    id: true,
                    vcID: true,
                    itemType: true,
                    price: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });

            // Get dari Database Issuance / RENEWAL / UPDATE Request based on VC ID

            // Filter items by holder_did extracted from vcID
            // vcID format: schema_id:version:holder_did:timestamp
            const holderUnpaidItems = unpaidItems.filter((item) => {
                const vcIdParts = item.vcID.split(':');
                if (vcIdParts.length >= 4) {
                    // vcID format: schema_id:version:holder_did:timestamp
                    // holder_did itself contains 'did:method:identifier', so we need to reconstruct it
                    const holderDidFromVC = `${vcIdParts[2]}:${vcIdParts[3]}:${vcIdParts[4]}`;
                    console.log("hasil: ", holderDidFromVC)
                    return holderDidFromVC === holder_did;
                }
                return false;
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
            const paymentRecordId = notificationData.order?.invoice_number || 'UNKNOWN_ID';
            // const result = await paymentBlockchainService.createPayment(
            //     paymentRecordId,
            //     transactionStatus,
            //     amount,
            //     transactionDate
            // )

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
