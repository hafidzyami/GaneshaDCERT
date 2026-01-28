import { ethers, TransactionReceipt } from "ethers";
import CredentialsHistoryBlockchainConfig from "../../config/credentialsHistoryBlockchain";
import logger from "../../config/logger";

/**
 * CredentialsHistory Blockchain Service
 * Handles all interactions with CredentialsHistoryManager smart contract
 */
class CredentialsHistoryBlockchainService {
  private contract: ethers.Contract;

  constructor() {
    this.contract = CredentialsHistoryBlockchainConfig.contract;
  }

  /**
   * Create credential history initiated by issuer (without new VC)
   */
  async createHistoryInitiatedByIssuer(
    id: string,
    issuerDID: string,
    holderDID: string,
    historyType: string,
    vcID: string
  ): Promise<TransactionReceipt> {
    try {
      logger.info("[CredentialsHistory] Creating history initiated by issuer", {
        id,
        issuerDID,
        holderDID,
        historyType,
        vcID,
      });

      const tx = await this.contract.createCredentialHistoryInitiatedByIssuer(
        id,
        issuerDID,
        holderDID,
        historyType,
        vcID
      );

      const receipt = await tx.wait();
      logger.success(`[CredentialsHistory] History created: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[CredentialsHistory] Failed to create history", error);
      throw new Error(
        `Failed to create history in blockchain: ${error.message}`
      );
    }
  }

  /**
   * Create credential history initiated by issuer (with new VC)
   */
  async createHistoryInitiatedByIssuerWithNewVC(
    id: string,
    issuerDID: string,
    holderDID: string,
    historyType: string,
    oldVCID: string,
    newVCID: string
  ): Promise<TransactionReceipt> {
    try {
      logger.info(
        "[CredentialsHistory] Creating history initiated by issuer with new VC",
        {
          id,
          issuerDID,
          holderDID,
          historyType,
          oldVCID,
          newVCID,
        }
      );

      const tx =
        await this.contract.createCredentialHistoryInitiatedByIssuerWithNewVC(
          id,
          issuerDID,
          holderDID,
          historyType,
          oldVCID,
          newVCID
        );

      const receipt = await tx.wait();
      logger.success(`[CredentialsHistory] History created with new VC: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[CredentialsHistory] Failed to create history with new VC", error);
      throw new Error(
        `Failed to create history with new VC in blockchain: ${error.message}`
      );
    }
  }

  /**
   * Create credential history initiated by holder (without new VC)
   */
  async createHistoryInitiatedByHolder(
    id: string,
    issuerDID: string,
    holderDID: string,
    historyType: string,
    vcID: string
  ): Promise<TransactionReceipt> {
    try {
      logger.info("[CredentialsHistory] Creating history initiated by holder", {
        id,
        issuerDID,
        holderDID,
        historyType,
        vcID,
      });

      const tx = await this.contract.createCredentialHistoryInitiatedByHolder(
        id,
        issuerDID,
        holderDID,
        historyType,
        vcID
      );

      const receipt = await tx.wait();
      logger.success(`[CredentialsHistory] History created: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[CredentialsHistory] Failed to create history", error);
      throw new Error(
        `Failed to create history in blockchain: ${error.message}`
      );
    }
  }

  /**
   * Create credential history initiated by holder (with new VC)
   */
  async createHistoryInitiatedByHolderWithNewVC(
    id: string,
    issuerDID: string,
    holderDID: string,
    historyType: string,
    oldVCID: string,
    newVCID: string
  ): Promise<TransactionReceipt> {
    try {
      logger.info(
        "[CredentialsHistory] Creating history initiated by holder with new VC",
        {
          id,
          issuerDID,
          holderDID,
          historyType,
          oldVCID,
          newVCID,
        }
      );

      const tx =
        await this.contract.createCredentialHistoryInitiatedByHolderWithNewVC(
          id,
          issuerDID,
          holderDID,
          historyType,
          oldVCID,
          newVCID
        );

      const receipt = await tx.wait();
      logger.success(`[CredentialsHistory] History created with new VC: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[CredentialsHistory] Failed to create history with new VC", error);
      throw new Error(
        `Failed to create history with new VC in blockchain: ${error.message}`
      );
    }
  }

  /**
   * Approve credential history (change status from PENDING to APPROVED)
   */
  async approveCredentialHistory(id: string): Promise<TransactionReceipt> {
    try {
      logger.info("[CredentialsHistory] Approving history", { id });

      const tx = await this.contract.approveCredentialHistory(id);
      const receipt = await tx.wait();

      logger.success(`[CredentialsHistory] History approved: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[CredentialsHistory] Failed to approve history", error);
      throw new Error(
        `Failed to approve history in blockchain: ${error.message}`
      );
    }
  }

  /**
   * Reject credential history (change status from PENDING to REJECTED)
   */
  async rejectCredentialHistory(id: string): Promise<TransactionReceipt> {
    try {
      logger.info("[CredentialsHistory] Rejecting history", { id });

      const tx = await this.contract.rejectCredentialHistory(id);
      const receipt = await tx.wait();

      logger.success(`[CredentialsHistory] History rejected: ${id}`, {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return receipt;
    } catch (error: any) {
      logger.error("[CredentialsHistory] Failed to reject history", error);
      throw new Error(
        `Failed to reject history in blockchain: ${error.message}`
      );
    }
  }

  /**
   * Get credential history by ID
   */
  async getCredentialHistory(id: string): Promise<any> {
    try {
      logger.info("[CredentialsHistory] Getting history", { id });

      const history = await this.contract.getCredentialHistory(id);

      return {
        id: history.id,
        issuerDID: history.issuerDID,
        holderDID: history.holderDID,
        historyType: history.historyType,
        status: Number(history.status), // HistoryStatus enum
        vcID: history.vcID,
        newVCID: history.newVCID,
      };
    } catch (error: any) {
      logger.error("[CredentialsHistory] Failed to get history", error);
      throw new Error(`Failed to get history from blockchain: ${error.message}`);
    }
  }

  /**
   * Get total history count
   */
  async getHistoryCount(): Promise<number> {
    try {
      const count = await this.contract.getHistoryCount();
      return Number(count);
    } catch (error: any) {
      logger.error("[CredentialsHistory] Failed to get history count", error);
      throw new Error(
        `Failed to get history count from blockchain: ${error.message}`
      );
    }
  }

  /**
   * Get all histories with pagination
   */
  async getAllHistoriesPaginated(
    offset: number,
    limit: number
  ): Promise<{
    histories: any[];
    total: number;
    returned: number;
  }> {
    try {
      logger.info("[CredentialsHistory] Getting all histories paginated", {
        offset,
        limit,
      });

      const result = await this.contract.getAllHistoriesPaginated(offset, limit);

      const histories = result.histories.map((h: any) => ({
        id: h.id,
        issuerDID: h.issuerDID,
        holderDID: h.holderDID,
        historyType: h.historyType,
        status: Number(h.status),
        vcID: h.vcID,
        newVCID: h.newVCID,
      }));

      return {
        histories,
        total: Number(result.total),
        returned: Number(result.returned),
      };
    } catch (error: any) {
      logger.error("[CredentialsHistory] Failed to get all histories", error);
      throw new Error(
        `Failed to get all histories from blockchain: ${error.message}`
      );
    }
  }

  /**
   * Get histories by holder DID with pagination
   */
  async getHistoriesByHolder(
    holderDID: string,
    offset: number,
    limit: number
  ): Promise<{
    histories: any[];
    total: number;
    returned: number;
  }> {
    try {
      logger.info("[CredentialsHistory] Getting histories by holder", {
        holderDID,
        offset,
        limit,
      });

      const result = await this.contract.getHistoriesByHolder(
        holderDID,
        offset,
        limit
      );

      const histories = result.histories.map((h: any) => ({
        id: h.id,
        issuerDID: h.issuerDID,
        holderDID: h.holderDID,
        historyType: h.historyType,
        status: Number(h.status),
        vcID: h.vcID,
        newVCID: h.newVCID,
      }));

      return {
        histories,
        total: Number(result.total),
        returned: Number(result.returned),
      };
    } catch (error: any) {
      logger.error("[CredentialsHistory] Failed to get histories by holder", error);
      throw new Error(
        `Failed to get histories by holder from blockchain: ${error.message}`
      );
    }
  }

  /**
   * Get histories by issuer DID with pagination
   */
  async getHistoriesByIssuer(
    issuerDID: string,
    offset: number,
    limit: number
  ): Promise<{
    histories: any[];
    total: number;
    returned: number;
  }> {
    try {
      logger.info("[CredentialsHistory] Getting histories by issuer", {
        issuerDID,
        offset,
        limit,
      });

      const result = await this.contract.getHistoriesByIssuer(
        issuerDID,
        offset,
        limit
      );

      const histories = result.histories.map((h: any) => ({
        id: h.id,
        issuerDID: h.issuerDID,
        holderDID: h.holderDID,
        historyType: h.historyType,
        status: Number(h.status),
        vcID: h.vcID,
        newVCID: h.newVCID,
      }));

      return {
        histories,
        total: Number(result.total),
        returned: Number(result.returned),
      };
    } catch (error: any) {
      logger.error("[CredentialsHistory] Failed to get histories by issuer", error);
      throw new Error(
        `Failed to get histories by issuer from blockchain: ${error.message}`
      );
    }
  }

  /**
   * Get histories by status with pagination
   * Status: 1 = INITIATED, 2 = PENDING, 3 = APPROVED, 4 = REJECTED
   */
  async getHistoriesByStatus(
    status: number,
    offset: number,
    limit: number
  ): Promise<{
    histories: any[];
    total: number;
    returned: number;
  }> {
    try {
      logger.info("[CredentialsHistory] Getting histories by status", {
        status,
        offset,
        limit,
      });

      const result = await this.contract.getHistoriesByStatus(
        status,
        offset,
        limit
      );

      const histories = result.histories.map((h: any) => ({
        id: h.id,
        issuerDID: h.issuerDID,
        holderDID: h.holderDID,
        historyType: h.historyType,
        status: Number(h.status),
        vcID: h.vcID,
        newVCID: h.newVCID,
      }));

      return {
        histories,
        total: Number(result.total),
        returned: Number(result.returned),
      };
    } catch (error: any) {
      logger.error("[CredentialsHistory] Failed to get histories by status", error);
      throw new Error(
        `Failed to get histories by status from blockchain: ${error.message}`
      );
    }
  }
}

export default new CredentialsHistoryBlockchainService();
