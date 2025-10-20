import { ethers, Interface, TransactionReceipt } from "ethers";
import DIDManager from "../utils/DIDManager.json";
import { env } from "./env";

export const contractABI = DIDManager.abi;
export const iface = new Interface(contractABI);

/**
 * Blockchain Configuration Singleton
 */
class BlockchainConfig {
  private static _provider: ethers.JsonRpcProvider;
  private static _signer: ethers.Wallet;
  private static _contract: ethers.Contract;

  private constructor() {}

  public static get provider(): ethers.JsonRpcProvider {
    if (!BlockchainConfig._provider) {
      BlockchainConfig._provider = new ethers.JsonRpcProvider(
        env.BLOCKCHAIN_RPC_URL
      );
    }
    return BlockchainConfig._provider;
  }

  public static get signer(): ethers.Wallet {
    if (!BlockchainConfig._signer) {
      const privateKey = env.ACCOUNT_PRIVATE_KEY.trim();
      BlockchainConfig._signer = new ethers.Wallet(
        privateKey,
        BlockchainConfig.provider
      );
    }
    return BlockchainConfig._signer;
  }

  public static get contract(): ethers.Contract {
    if (!BlockchainConfig._contract) {
      const contractAddress = env.DID_CONTRACT_ADDRESS.trim();
      BlockchainConfig._contract = new ethers.Contract(
        contractAddress,
        contractABI,
        BlockchainConfig.signer
      );
    }
    return BlockchainConfig._contract;
  }

  public static async testConnection(): Promise<boolean> {
    try {
      const network = await BlockchainConfig.provider.getNetwork();
      const balance = await BlockchainConfig.provider.getBalance(
        BlockchainConfig.signer.address
      );
      
      console.log('✅ Blockchain connected successfully');
      console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
      console.log(`   Signer: ${BlockchainConfig.signer.address}`);
      console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
      console.log(`   Contract: ${env.DID_CONTRACT_ADDRESS}`);
      
      return true;
    } catch (error) {
      console.error('❌ Blockchain connection failed:', error);
      return false;
    }
  }
}

export default BlockchainConfig;
