import { ethers, TransactionReceipt } from "ethers";
import PaymentBlockchainConfig from "../../config/paymentBlockchain";
import logger from "../../config/logger";

/**
 * Payment Blockchain Service
 * Handles all interactions with PaymentManager smart contract
 */
class PaymentBlockchainService {
  private contract: ethers.Contract;

  constructor() {
    this.contract = PaymentBlockchainConfig.contract;
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
        holderDID,
        amount,
        currency,
        items,
      });

      const tx = await this.contract.createOrder(
        id,
        holderDID,
        amount,
        currency,
        items
      );

      const receipt = await tx.wait();
      logger.success(`[Payment] Order created: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to create order", error);
      throw new Error(`Failed to create order in blockchain: ${error.message}`);
    }
  }

  /**
   * Create item in blockchain
   * itemType: 0 = ISSUANCE, 1 = RENEWAL, 2 = UPDATE
   * Function signature: createItem(string _id, uint256 _price, string _vcID, string _issuerDID, string _holderDID, string _vcHash, uint8 _itemType)
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
      // Smart contract doesn't accept price = 0 (Error E5)
      // Set minimum price = 1 for free credentials as workaround
      const blockchainPrice = price === 0 ? 1 : price;

      if (price === 0) {
        logger.warn(`[Payment] Free item detected (price = 0). Using minimum blockchain price = 1 for compatibility.`);
      }

      logger.info("[Payment] Creating item", {
        id,
        originalPrice: price,
        blockchainPrice,
        vcID,
        issuerDID,
        holderDID,
        vcHash,
        itemType,
      });

      const tx = await this.contract.createItem(
        id,
        blockchainPrice,
        vcID,
        issuerDID,
        holderDID,
        vcHash,
        itemType
      );

      const receipt = await tx.wait();
      logger.success(`[Payment] Item created: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        price: blockchainPrice,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to create item", error);
      throw new Error(`Failed to create item in blockchain: ${error.message}`);
    }
  }

  /**
   * Create payment in blockchain
   * Function signature: createPayment(string _id, string _orderID, string _status, uint256 _amount)
   * Note: method is NOT set here, it will be set in completePayment
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

      const tx = await this.contract.createPayment(
        id,
        orderID,
        status,
        amount
      );

      const receipt = await tx.wait();
      logger.success(`[Payment] Payment created: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to create payment", error);
      throw new Error(
        `Failed to create payment in blockchain: ${error.message}`
      );
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

      const tx = await this.contract.updateOrderStatus(id, newStatus);
      const receipt = await tx.wait();

      logger.success(`[Payment] Order status updated: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to update order status", error);
      throw new Error(
        `Failed to update order status in blockchain: ${error.message}`
      );
    }
  }

  /**
   * Mark item as paid
   */
  async markItemAsPaid(id: string): Promise<TransactionReceipt> {
    try {
      logger.info("[Payment] Marking item as paid", { id });

      const tx = await this.contract.markItemAsPaid(id);
      const receipt = await tx.wait();

      logger.success(`[Payment] Item marked as paid: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to mark item as paid", error);
      throw new Error(
        `Failed to mark item as paid in blockchain: ${error.message}`
      );
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    id: string,
    newStatus: string
  ): Promise<TransactionReceipt> {
    try {
      logger.info("[Payment] Updating payment status", { id, newStatus });

      const tx = await this.contract.updatePaymentStatus(id, newStatus);
      const receipt = await tx.wait();

      logger.success(`[Payment] Payment status updated: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to update payment status", error);
      throw new Error(
        `Failed to update payment status in blockchain: ${error.message}`
      );
    }
  }

  /**
   * Fail payment
   * Function signature: failedPayment(string _paymentId, string _orderId, string _method, string _failedStatus)
   * Note: method is set here when payment fails
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

      const tx = await this.contract.failedPayment(
        paymentId,
        orderId,
        method,
        failedStatus
      );
      const receipt = await tx.wait();

      logger.success(`[Payment] Payment marked as failed: ${paymentId}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to mark payment as failed", error);
      throw new Error(
        `Failed to mark payment as failed in blockchain: ${error.message}`
      );
    }
  }

  /**
   * Complete payment (all-in-one: update payment status + order status + mark items as paid)
   * Function signature: completePayment(string _paymentId, string _orderId, string _method, string _successStatus)
   * Note: method is set here when payment is completed
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

      const tx = await this.contract.completePayment(
        paymentId,
        orderId,
        method,
        successStatus
      );
      const receipt = await tx.wait();

      logger.success(`[Payment] Payment completed: ${paymentId}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[Payment] Failed to complete payment", error);
      throw new Error(
        `Failed to complete payment in blockchain: ${error.message}`
      );
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(id: string): Promise<any> {
    try {
      logger.info("[Payment] Getting order", { id });

      const order = await this.contract.getOrder(id);

      return {
        holderDID: order.holderDID,
        status: Number(order.status), // OrderStatus enum
        amount: Number(order.amount),
        currency: order.currency,
        createdAt: Number(order.createdAt),
        items: order.items,
      };
    } catch (error: any) {
      logger.error("[Payment] Failed to get order", error);
      throw new Error(`Failed to get order from blockchain: ${error.message}`);
    }
  }

  /**
   * Get item by ID
   */
  async getItem(id: string): Promise<any> {
    try {
      logger.info("[Payment] Getting item", { id });

      const item = await this.contract.getItem(id);

      return {
        issuerDID: item.issuerDID,
        holderDID: item.holderDID,
        price: Number(item.price),
        vcID: item.vcID,
        vcHash: item.vcHash,
        itemType: Number(item.itemType), // ItemType enum
        isPaid: item.isPaid,
      };
    } catch (error: any) {
      logger.error("[Payment] Failed to get item", error);
      throw new Error(`Failed to get item from blockchain: ${error.message}`);
    }
  }

  /**
   * Get payment by ID
   */
  async getPayment(id: string): Promise<any> {
    try {
      logger.info("[Payment] Getting payment", { id });

      const payment = await this.contract.getPayment(id);

      return {
        orderID: payment.orderID,
        method: payment.method,
        status: payment.status,
        amount: Number(payment.amount),
        paidAt: Number(payment.paidAt),
      };
    } catch (error: any) {
      logger.error("[Payment] Failed to get payment", error);
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
      logger.error("[Payment] Failed to get orders count", error);
      throw new Error(
        `Failed to get orders count from blockchain: ${error.message}`
      );
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
      logger.error("[Payment] Failed to get items count", error);
      throw new Error(
        `Failed to get items count from blockchain: ${error.message}`
      );
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
      logger.error("[Payment] Failed to get payments count", error);
      throw new Error(
        `Failed to get payments count from blockchain: ${error.message}`
      );
    }
  }

  /**
   * Get items by order ID
   */
  async getItemsByOrder(orderId: string): Promise<any[]> {
    try {
      logger.info("[Payment] Getting items by order", { orderId });

      const items = await this.contract.getItemsByOrder(orderId);

      return items.map((item: any) => ({
        issuerDID: item.issuerDID,
        holderDID: item.holderDID,
        price: Number(item.price),
        vcID: item.vcID,
        vcHash: item.vcHash,
        itemType: Number(item.itemType),
        isPaid: item.isPaid,
      }));
    } catch (error: any) {
      logger.error("[Payment] Failed to get items by order", error);
      throw new Error(
        `Failed to get items by order from blockchain: ${error.message}`
      );
    }
  }

  /**
   * Verify VC hash against item
   */
  async verifyVCHash(itemId: string, vcHash: string): Promise<boolean> {
    try {
      logger.info("[Payment] Verifying VC hash", { itemId, vcHash });

      const isValid = await this.contract.verifyVCHash(itemId, vcHash);

      return isValid;
    } catch (error: any) {
      logger.error("[Payment] Failed to verify VC hash", error);
      throw new Error(
        `Failed to verify VC hash from blockchain: ${error.message}`
      );
    }
  }
}

export default new PaymentBlockchainService();
