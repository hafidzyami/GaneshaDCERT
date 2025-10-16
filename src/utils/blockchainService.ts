import { ethers, Interface } from "ethers";
import DIDManager from "./DIDManager.json";
import dotenv from "dotenv";
dotenv.config();

export const contractABI = DIDManager.abi;
export const iface = new Interface(contractABI);

const privateKey = process.env.ACCOUNT_PRIVATE_KEY?.trim();
if (!privateKey) throw new Error("Missing ACCOUNT_PRIVATE_KEY in environment");

const contractAddress = process.env.DID_CONTRACT_ADDRESS?.trim();
if (!contractAddress) throw new Error("Missing DID_CONTRACT_ADDRESS in environment");

export const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
export const signer = new ethers.Wallet(privateKey, provider);
export const contract = new ethers.Contract(contractAddress, contractABI, signer);

export const registerDIDOnChain = async (did: string, key: string) => {
    try {
        await contract.registerDID(did, "#key-1", key);
    } catch (error) {

    }
}

export const registerNewKeyOnChain = async (did: string, key: string) => {
    try {
        await contract.registerDID(did, "#key-2", key);
    } catch (error) {

    }
}

export const checkDIDOnChain = async (did: string) => {
    try {
        const result = await contract.verifyDID(did);
        return result;
    } catch (error) {
        console.log("ERROR", error);
    }
}

export const getDIDKeyOnChain = async (did: string, keyId: string) => {
    try {
        const result = await contract.getKey(did);
        return result;
    } catch (error) {
        
    }
}

export const getDIDCountOnChain = async () => {
    try {
        const result = await contract.getDIDCount();
        return result;
    } catch (error) {
        
    }
}

export const getNumberOfBlocksOnChain = async () => {
    try {
        const blockCount = await provider.getBlockNumber();
        return blockCount;
    } catch (error) {
        
    }
}