import { ethers, TransactionReceipt } from "ethers";
import PaymentBlockchainConfig from "../../config/paymentBlockchain";
import logger from "../../config/logger";
import {
  invoiceToBytes32,
  didToBytes32,
  vcIDToBytes32,
  vcHashToBytes32,
  stringToBytes32,
  stringArrayToBytes32Array,
  bytes32ToString,
  numberToUint248,
  uint248ToNumber,
  formatBytes32,
} from "../../utils/blockchain.helper";

/**
 * Payment Blockchain Service
 * Handles all interactions with PaymentManager smart contract
 * Uses bytes32 optimized contract
 */
class PaymentBlockchainService {
  private contract: ethers.Contract;

  constructor() {
    this.contract = PaymentBlockchainConfig.contract;
    logger.info("[PaymentBlockchain] Service initialized with bytes32 contract");
  }

  /**
   * Create order in blockchain
   */
  async createOrder(
    id: string,
    holderDID: string,
    amount: number,
    currency: string,
    items: string[]
  ): Promise<TransactionReceipt> {
    try {
      logger.info("[Payment] Creating order", {
        id,
        holderDID: holderDID.substring(0, 30) + "...",
        amount,
        currency,
        itemCount: items.length,
      });

      const idBytes32 = invoiceToBytes32(id);
      const holderDIDBytes32 = didToBytes32(holderDID);
      const amountUint248 = numberToUint248(amount);
      const currencyBytes32 = stringToBytes32(currency);
      const itemsBytes32 = stringArrayToBytes32Array(items);

      logger.debug("[Payment] Bytes32 conversions:", {
        idBytes32: formatBytes32(idBytes32),
        holderDIDBytes32: formatBytes32(holderDIDBytes32),
        currencyBytes32: formatBytes32(currencyBytes32),
        itemCount: itemsBytes32.length,
      });

      const tx = await this.contract.createOrder(
        idBytes32,
        holderDIDBytes32,
        amountUint248,
        currencyBytes32,
        itemsBytes32
      );

      const receipt = await tx.wait();
      logger.success(`[Payment] Order created: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to create order", {
        id,
        error: error.message,
        code: error.code,
      });
      throw new Error(`Failed to create order in blockchain: ${error.message}`);
    }
  }

  /**
   * Create item in blockchain
   * itemType: 0 = ISSUANCE, 1 = RENEWAL, 2 = UPDATE
   */
  async createItem(
    id: string,
    price: number,
    vcID: string,
    issuerDID: string,
    holderDID: string,
    vcHash: string,
    itemType: number
  ): Promise<TransactionReceipt> {
    try {
      const blockchainPrice = price === 0 ? 1 : price;

      if (price === 0) {
        logger.warn(`[Payment] Free item detected (price = 0). Using minimum blockchain price = 1.`);
      }

      logger.info("[Payment] Creating item", {
        id,
        originalPrice: price,
        blockchainPrice,
        vcID: vcID.substring(0, 30) + "...",
        itemType,
      });

      const idBytes32 = invoiceToBytes32(id);
      const priceUint248 = numberToUint248(blockchainPrice);
      const vcIDBytes32 = vcIDToBytes32(vcID);
      const issuerDIDBytes32 = didToBytes32(issuerDID);
      const holderDIDBytes32 = didToBytes32(holderDID);
      const vcHashBytes32 = vcHashToBytes32(vcHash);

      logger.debug("[Payment] Bytes32 conversions:", {
        idBytes32: formatBytes32(idBytes32),
        vcIDBytes32: formatBytes32(vcIDBytes32),
        vcHashBytes32: formatBytes32(vcHashBytes32),
      });

      const tx = await this.contract.createItem(
        idBytes32,
        priceUint248,
        vcIDBytes32,
        issuerDIDBytes32,
        holderDIDBytes32,
        vcHashBytes32,
        itemType
      );

      const receipt = await tx.wait();
      logger.success(`[Payment] Item created: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to create item", {
        id,
        error: error.message,
        code: error.code,
      });
      throw new Error(`Failed to create item in blockchain: ${error.message}`);
    }
  }

  /**
   * Create payment in blockchain
   */
  async createPayment(
    id: string,
    orderID: string,
    status: string,
    amount: number
  ): Promise<TransactionReceipt> {
    try {
      logger.info("[Payment] Creating payment", {
        id,
        orderID,
        status,
        amount,
      });

      const idBytes32 = invoiceToBytes32(id);
      const orderIDBytes32 = invoiceToBytes32(orderID);
      const statusBytes32 = stringToBytes32(status);
      const amountUint248 = numberToUint248(amount);

      const tx = await this.contract.createPayment(
        idBytes32,
        orderIDBytes32,
        statusBytes32,
        amountUint248
      );

      const receipt = await tx.wait();
      logger.success(`[Payment] Payment created: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to create payment", {
        id,
        error: error.message,
        code: error.code,
      });
      throw new Error(`Failed to create payment in blockchain: ${error.message}`);
    }
  }

  /**
   * Update order status
   * Status: 1 = PENDING_PAYMENT, 2 = SUCCESS, 3 = CANCELED
   */
  async updateOrderStatus(
    id: string,
    newStatus: number
  ): Promise<TransactionReceipt> {
    try {
      logger.info("[Payment] Updating order status", { id, newStatus });

      const idBytes32 = invoiceToBytes32(id);
      const tx = await this.contract.updateOrderStatus(idBytes32, newStatus);

      const receipt = await tx.wait();
      logger.success(`[Payment] Order status updated: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to update order status", {
        id,
        error: error.message,
      });
      throw new Error(`Failed to update order status in blockchain: ${error.message}`);
    }
  }

  /**
   * Mark item as paid
   */
  async markItemAsPaid(id: string): Promise<TransactionReceipt> {
    try {
      logger.info("[Payment] Marking item as paid", { id });

      const idBytes32 = invoiceToBytes32(id);
      const tx = await this.contract.markItemAsPaid(idBytes32);

      const receipt = await tx.wait();
      logger.success(`[Payment] Item marked as paid: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to mark item as paid", {
        id,
        error: error.message,
      });
      throw new Error(`Failed to mark item as paid in blockchain: ${error.message}`);
    }
  }

  /**
   * Fail payment
   */
  async failedPayment(
    paymentId: string,
    orderId: string,
    method: string,
    failedStatus: string
  ): Promise<TransactionReceipt> {
    try {
      logger.info("[Payment] Marking payment as failed", {
        paymentId,
        orderId,
        method,
        failedStatus,
      });

      const paymentIdBytes32 = invoiceToBytes32(paymentId);
      const orderIdBytes32 = invoiceToBytes32(orderId);
      const methodBytes32 = stringToBytes32(method);
      const failedStatusBytes32 = stringToBytes32(failedStatus);

      const tx = await this.contract.failedPayment(
        paymentIdBytes32,
        orderIdBytes32,
        methodBytes32,
        failedStatusBytes32
      );

      const receipt = await tx.wait();
      logger.success(`[Payment] Payment marked as failed: ${paymentId}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to mark payment as failed", {
        paymentId,
        error: error.message,
      });
      throw new Error(`Failed to mark payment as failed in blockchain: ${error.message}`);
    }
  }

  /**
   * Complete payment (all-in-one: update payment status + order status + mark items as paid)
   */
  async completePayment(
    paymentId: string,
    orderId: string,
    method: string,
    successStatus: string
  ): Promise<TransactionReceipt> {
    try {
      logger.info("[Payment] Completing payment", {
        paymentId,
        orderId,
        method,
        successStatus,
      });

      const paymentIdBytes32 = invoiceToBytes32(paymentId);
      const orderIdBytes32 = invoiceToBytes32(orderId);
      const methodBytes32 = stringToBytes32(method);
      const successStatusBytes32 = stringToBytes32(successStatus);

      const tx = await this.contract.completePayment(
        paymentIdBytes32,
        orderIdBytes32,
        methodBytes32,
        successStatusBytes32
      );

      const receipt = await tx.wait();
      logger.success(`[Payment] Payment completed: ${paymentId}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to complete payment", {
        paymentId,
        error: error.message,
      });
      throw new Error(`Failed to complete payment in blockchain: ${error.message}`);
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(id: string): Promise<any> {
    try {
      logger.info("[Payment] Getting order", { id });

      const idBytes32 = invoiceToBytes32(id);
      const order = await this.contract.getOrder(idBytes32);

      return {
        holderDID: order.holderDID,
        holderDIDBytes32: order.holderDID,
        status: Number(order.status),
        amount: uint248ToNumber(order.amount),
        currency: this.tryDecodeBytes32(order.currency),
        currencyBytes32: order.currency,
        createdAt: Number(order.createdAt),
        items: order.items,
      };
    } catch (error: any) {
      logger.error("[Payment] Failed to get order", { id, error: error.message });
      throw new Error(`Failed to get order from blockchain: ${error.message}`);
    }
  }

  /**
   * Get item by ID
   */
  async getItem(id: string): Promise<any> {
    try {
      logger.info("[Payment] Getting item", { id });

      const idBytes32 = invoiceToBytes32(id);
      const item = await this.contract.getItem(idBytes32);

      return {
        issuerDID: item.issuerDID,
        issuerDIDBytes32: item.issuerDID,
        holderDID: item.holderDID,
        holderDIDBytes32: item.holderDID,
        price: uint248ToNumber(item.price),
        vcID: item.vcID,
        vcIDBytes32: item.vcID,
        vcHash: item.vcHash,
        vcHashBytes32: item.vcHash,
        itemType: Number(item.itemType),
        isPaid: item.isPaid,
      };
    } catch (error: any) {
      logger.error("[Payment] Failed to get item", { id, error: error.message });
      throw new Error(`Failed to get item from blockchain: ${error.message}`);
    }
  }

  /**
   * Get payment by ID
   */
  async getPayment(id: string): Promise<any> {
    try {
      logger.info("[Payment] Getting payment", { id });

      const idBytes32 = invoiceToBytes32(id);
      const payment = await this.contract.getPayment(idBytes32);

      return {
        orderID: payment.orderID,
        orderIDBytes32: payment.orderID,
        method: this.tryDecodeBytes32(payment.method),
        methodBytes32: payment.method,
        status: this.tryDecodeBytes32(payment.status),
        statusBytes32: payment.status,
        amount: uint248ToNumber(payment.amount),
        paidAt: Number(payment.paidAt),
      };
    } catch (error: any) {
      logger.error("[Payment] Failed to get payment", { id, error: error.message });
      throw new Error(`Failed to get payment from blockchain: ${error.message}`);
    }
  }

  /**
   * Get orders count
   */
  async getOrdersCount(): Promise<number> {
    try {
      const count = await this.contract.getOrdersCount();
      return Number(count);
    } catch (error: any) {
      logger.error("[Payment] Failed to get orders count", { error: error.message });
      throw new Error(`Failed to get orders count from blockchain: ${error.message}`);
    }
  }

  /**
   * Get items count
   */
  async getItemsCount(): Promise<number> {
    try {
      const count = await this.contract.getItemsCount();
      return Number(count);
    } catch (error: any) {
      logger.error("[Payment] Failed to get items count", { error: error.message });
      throw new Error(`Failed to get items count from blockchain: ${error.message}`);
    }
  }

  /**
   * Get payments count
   */
  async getPaymentsCount(): Promise<number> {
    try {
      const count = await this.contract.getPaymentsCount();
      return Number(count);
    } catch (error: any) {
      logger.error("[Payment] Failed to get payments count", { error: error.message });
      throw new Error(`Failed to get payments count from blockchain: ${error.message}`);
    }
  }

  /**
   * Get items by order ID
   */
  async getItemsByOrder(orderId: string): Promise<any[]> {
    try {
      logger.info("[Payment] Getting items by order", { orderId });

      const orderIdBytes32 = invoiceToBytes32(orderId);
      const items = await this.contract.getItemsByOrder(orderIdBytes32);

      return items.map((item: any) => ({
        issuerDID: item.issuerDID,
        holderDID: item.holderDID,
        price: uint248ToNumber(item.price),
        vcID: item.vcID,
        vcHash: item.vcHash,
        itemType: Number(item.itemType),
        isPaid: item.isPaid,
      }));
    } catch (error: any) {
      logger.error("[Payment] Failed to get items by order", { orderId, error: error.message });
      throw new Error(`Failed to get items by order from blockchain: ${error.message}`);
    }
  }

  /**
   * Verify VC hash against item
   */
  async verifyVCHash(itemId: string, vcHash: string): Promise<boolean> {
    try {
      logger.info("[Payment] Verifying VC hash", { itemId });

      const itemIdBytes32 = invoiceToBytes32(itemId);
      const vcHashBytes32 = vcHashToBytes32(vcHash);
      const isValid = await this.contract.verifyVCHash(itemIdBytes32, vcHashBytes32);

      return isValid;
    } catch (error: any) {
      logger.error("[Payment] Failed to verify VC hash", { itemId, error: error.message });
      throw new Error(`Failed to verify VC hash from blockchain: ${error.message}`);
    }
  }

  /**
   * Check if order exists
   */
  async orderExists(id: string): Promise<boolean> {
    try {
      const idBytes32 = invoiceToBytes32(id);
      return await this.contract.orderExists(idBytes32);
    } catch (error: any) {
      logger.error("[Payment] Failed to check order exists", { id, error: error.message });
      return false;
    }
  }

  /**
   * Check if item exists
   */
  async itemExists(id: string): Promise<boolean> {
    try {
      const idBytes32 = invoiceToBytes32(id);
      return await this.contract.itemExists(idBytes32);
    } catch (error: any) {
      logger.error("[Payment] Failed to check item exists", { id, error: error.message });
      return false;
    }
  }

  /**
   * Check if payment exists
   */
  async paymentExists(id: string): Promise<boolean> {
    try {
      const idBytes32 = invoiceToBytes32(id);
      return await this.contract.paymentExists(idBytes32);
    } catch (error: any) {
      logger.error("[Payment] Failed to check payment exists", { id, error: error.message });
      return false;
    }
  }

  /**
   * Helper: Try to decode bytes32 to string, return original if failed
   */
  private tryDecodeBytes32(bytes32: string): string {
    try {
      const decoded = bytes32ToString(bytes32);
      return decoded || bytes32;
    } catch {
      return bytes32;
    }
  }
}

export default new PaymentBlockchainService();
