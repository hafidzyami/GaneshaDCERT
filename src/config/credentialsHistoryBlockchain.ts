import { ethers, Interface } from "ethers";
import CredentialsHistoryManager from "../utils/CredentialsHistoryManager.json";
import { env } from "./env";
import logger from "./logger";

export const contractABI = CredentialsHistoryManager.abi;
export const iface = new Interface(contractABI);

/**
 * CredentialsHistory Blockchain Configuration Singleton
 */
class CredentialsHistoryBlockchainConfig {
  private static _provider: ethers.JsonRpcProvider;
  private static _signer: ethers.Wallet;
  private static _contract: ethers.Contract;

  private constructor() {}

  public static get provider(): ethers.JsonRpcProvider {
    if (!CredentialsHistoryBlockchainConfig._provider) {
      CredentialsHistoryBlockchainConfig._provider = new ethers.JsonRpcProvider(
        env.HISTORY_BLOCKCHAIN_RPC_URL
      );
    }
    return CredentialsHistoryBlockchainConfig._provider;
  }

  public static get signer(): ethers.Wallet {
    if (!CredentialsHistoryBlockchainConfig._signer) {
      const privateKey = env.HISTORY_ACCOUNT_PRIVATE_KEY.trim();
      CredentialsHistoryBlockchainConfig._signer = new ethers.Wallet(
        privateKey,
        CredentialsHistoryBlockchainConfig.provider
      );
    }
    return CredentialsHistoryBlockchainConfig._signer;
  }

  public static get contract(): ethers.Contract {
    if (!CredentialsHistoryBlockchainConfig._contract) {
      const contractAddress = env.CREDENTIALS_HISTORY_CONTRACT_ADDRESS.trim();
      CredentialsHistoryBlockchainConfig._contract = new ethers.Contract(
        contractAddress,
        contractABI,
        CredentialsHistoryBlockchainConfig.signer
      );
    }
    return CredentialsHistoryBlockchainConfig._contract;
  }

  public static async testConnection(): Promise<boolean> {
    try {
      const network = await CredentialsHistoryBlockchainConfig.provider.getNetwork();
      const balance = await CredentialsHistoryBlockchainConfig.provider.getBalance(
        CredentialsHistoryBlockchainConfig.signer.address
      );

      logger.success("CredentialsHistory Blockchain connected successfully");
      logger.info("CredentialsHistory Blockchain Details", {
        network: network.name,
        chainId: network.chainId.toString(),
        signer: CredentialsHistoryBlockchainConfig.signer.address,
        balance: `${ethers.formatEther(balance)} ETH`,
        contract: env.CREDENTIALS_HISTORY_CONTRACT_ADDRESS,
      });

      return true;
    } catch (error) {
      console.error("❌ CredentialsHistory Blockchain connection failed:", error);
      return false;
    }
  }

  public static async isConnected(): Promise<boolean> {
    try {
      await CredentialsHistoryBlockchainConfig.provider.getBlockNumber();
      return true;
    } catch (error) {
      logger.error("CredentialsHistory Blockchain health check failed", error);
      return false;
    }
  }
}

export default CredentialsHistoryBlockchainConfig;
