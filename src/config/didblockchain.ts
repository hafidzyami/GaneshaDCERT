import { ethers, Interface } from "ethers";
import DIDManager from "../utils/DIDManager.json";
import { env } from "./env";
import logger from "./logger";

export const contractABI = DIDManager.abi;
export const iface = new Interface(contractABI);

/**
 * Blockchain Configuration Singleton
 */
class DIDsBlockchainConfig {
  private static _provider: ethers.JsonRpcProvider;
  private static _signer: ethers.Wallet;
  private static _contract: ethers.Contract;

  private constructor() {}

  public static get provider(): ethers.JsonRpcProvider {
    if (!DIDsBlockchainConfig._provider) {
      DIDsBlockchainConfig._provider = new ethers.JsonRpcProvider(
        env.BLOCKCHAIN_RPC_URL
      );
    }
    return DIDsBlockchainConfig._provider;
  }

  public static get signer(): ethers.Wallet {
    if (!DIDsBlockchainConfig._signer) {
      const privateKey = env.ACCOUNT_PRIVATE_KEY.trim();
      DIDsBlockchainConfig._signer = new ethers.Wallet(
        privateKey,
        DIDsBlockchainConfig.provider
      );
    }
    return DIDsBlockchainConfig._signer;
  }

  public static get contract(): ethers.Contract {
    if (!DIDsBlockchainConfig._contract) {
      const contractAddress = env.DID_CONTRACT_ADDRESS.trim();
      DIDsBlockchainConfig._contract = new ethers.Contract(
        contractAddress,
        contractABI,
        DIDsBlockchainConfig.signer
      );
    }
    return DIDsBlockchainConfig._contract;
  }

  public static async testConnection(): Promise<boolean> {
    try {
      const network = await DIDsBlockchainConfig.provider.getNetwork();
      const balance = await DIDsBlockchainConfig.provider.getBalance(
        DIDsBlockchainConfig.signer.address
      );

      logger.success("Blockchain connected successfully");
      logger.info("Blockchain Details", {
        network: network.name,
        chainId: network.chainId.toString(),
        signer: DIDsBlockchainConfig.signer.address,
        balance: `${ethers.formatEther(balance)} ETH`,
        contract: env.DID_CONTRACT_ADDRESS,
      });

      return true;
    } catch (error) {
      logger.error("Blockchain connection failed", error);
      return false;
    }
  }

  public static async isConnected(): Promise<boolean> {
    try {
      await DIDsBlockchainConfig.provider.getBlockNumber();
      return true;
    } catch (error) {
      logger.error("Blockchain health check failed", error);
      return false;
    }
  }
}

export default DIDsBlockchainConfig;
