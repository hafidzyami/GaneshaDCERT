import { ethers, Interface, TransactionReceipt } from "ethers";
import VCManager from "../utils/VCManager.json";
import { env } from "./env";

export const contractABI = VCManager.abi;
export const iface = new Interface(contractABI);

/**
 * Blockchain Configuration Singleton
 */
class VCBlockchainConfig {
  private static _provider: ethers.JsonRpcProvider;
  private static _signer: ethers.Wallet;
  private static _contract: ethers.Contract;

  private constructor() {}

  public static get provider(): ethers.JsonRpcProvider {
    if (!VCBlockchainConfig._provider) {
      VCBlockchainConfig._provider = new ethers.JsonRpcProvider(
        env.BLOCKCHAIN_RPC_URL
      );
    }
    return VCBlockchainConfig._provider;
  }

  public static get signer(): ethers.Wallet {
    if (!VCBlockchainConfig._signer) {
      const privateKey = env.ACCOUNT_PRIVATE_KEY.trim();
      VCBlockchainConfig._signer = new ethers.Wallet(
        privateKey,
        VCBlockchainConfig.provider
      );
    }
    return VCBlockchainConfig._signer;
  }

  public static get contract(): ethers.Contract {
    if (!VCBlockchainConfig._contract) {
      const contractAddress = env.VC_CONTRACT_ADDRESS.trim();
      VCBlockchainConfig._contract = new ethers.Contract(
        contractAddress,
        contractABI,
        VCBlockchainConfig.signer
      );
    }
    return VCBlockchainConfig._contract;
  }

  public static async testConnection(): Promise<boolean> {
    try {
      const network = await VCBlockchainConfig.provider.getNetwork();
      const balance = await VCBlockchainConfig.provider.getBalance(
        VCBlockchainConfig.signer.address
      );

      console.log("✅ VC Blockchain connected successfully");
      console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
      console.log(`   Signer: ${VCBlockchainConfig.signer.address}`);
      console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
      console.log(`   Contract: ${env.VC_CONTRACT_ADDRESS}`);

      return true;
    } catch (error) {
      console.error("❌ VC Blockchain connection failed:", error);
      return false;
    }
  }
}

export default VCBlockchainConfig;
