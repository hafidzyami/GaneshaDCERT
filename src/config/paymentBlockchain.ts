import { ethers, Interface } from "ethers";
import PaymentManager from "../utils/PaymentManager.json";
import { env } from "./env";
import logger from "./logger";

export const contractABI = PaymentManager.abi;
export const iface = new Interface(contractABI);

/**
 * Payment Blockchain Configuration Singleton
 */
class PaymentBlockchainConfig {
  private static _provider: ethers.JsonRpcProvider;
  private static _signer: ethers.Wallet;
  private static _contract: ethers.Contract;

  private constructor() {}

  public static get provider(): ethers.JsonRpcProvider {
    if (!PaymentBlockchainConfig._provider) {
      PaymentBlockchainConfig._provider = new ethers.JsonRpcProvider(
        env.HISTORY_BLOCKCHAIN_RPC_URL
      );
    }
    return PaymentBlockchainConfig._provider;
  }

  public static get signer(): ethers.Wallet {
    if (!PaymentBlockchainConfig._signer) {
      const privateKey = env.HISTORY_ACCOUNT_PRIVATE_KEY.trim();
      PaymentBlockchainConfig._signer = new ethers.Wallet(
        privateKey,
        PaymentBlockchainConfig.provider
      );
    }
    return PaymentBlockchainConfig._signer;
  }

  public static get contract(): ethers.Contract {
    if (!PaymentBlockchainConfig._contract) {
      const contractAddress = env.PAYMENT_CONTRACT_ADDRESS.trim();
      PaymentBlockchainConfig._contract = new ethers.Contract(
        contractAddress,
        contractABI,
        PaymentBlockchainConfig.signer
      );
    }
    return PaymentBlockchainConfig._contract;
  }

  public static async testConnection(): Promise<boolean> {
    try {
      const network = await PaymentBlockchainConfig.provider.getNetwork();
      const balance = await PaymentBlockchainConfig.provider.getBalance(
        PaymentBlockchainConfig.signer.address
      );

      logger.success("Payment Blockchain connected successfully");
      logger.info("Payment Blockchain Details", {
        network: network.name,
        chainId: network.chainId.toString(),
        signer: PaymentBlockchainConfig.signer.address,
        balance: `${ethers.formatEther(balance)} ETH`,
        contract: env.PAYMENT_CONTRACT_ADDRESS,
      });

      return true;
    } catch (error) {
      console.error("❌ Payment Blockchain connection failed:", error);
      return false;
    }
  }

  public static async isConnected(): Promise<boolean> {
    try {
      await PaymentBlockchainConfig.provider.getBlockNumber();
      return true;
    } catch (error) {
      logger.error("Payment Blockchain health check failed", error);
      return false;
    }
  }
}

export default PaymentBlockchainConfig;
