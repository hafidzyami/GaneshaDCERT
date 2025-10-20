import { ethers, Interface } from "ethers";
import DIDManager from "./DIDManager.json";
import dotenv from "dotenv";
dotenv.config();

export const contractABI = DIDManager.abi;
export const iface = new Interface(contractABI);

const privateKey = process.env.ACCOUNT_PRIVATE_KEY?.trim();
if (!privateKey) throw new Error("Missing ACCOUNT_PRIVATE_KEY in environment");

const contractAddress = process.env.DID_CONTRACT_ADDRESS?.trim();
if (!contractAddress)
  throw new Error("Missing DID_CONTRACT_ADDRESS in environment");

export const provider = new ethers.JsonRpcProvider(
  process.env.BLOCKCHAIN_RPC_URL
);
export const signer = new ethers.Wallet(privateKey, provider);
export const contract = new ethers.Contract(
  contractAddress,
  contractABI,
  signer
);

export const registerIndividualDIDOnChain = async (
  did: string,
  key: string
) => {
  try {
    await contract.registerIndividual(did, "#key-1", key);
  } catch (error) {}
};

export const registerInstitutionalDIDOnChain = async (
  did: string,
  key: string,
  email: string,
  name: string,
  phone: string,
  country: string,
  website: string,
  addressInfo: string
) => {
  try {
    await contract.registerInstitution(
      did,
      "#key-1",
      key,
      email,
      name,
      phone,
      country,
      website,
      addressInfo
    );
  } catch (error) {}
};

export const registerNewKeyOnChain = async (did: string, key: string) => {
  try {
    // TODO: getCurrentActiveKeyId and increment of activeKeyId
    const currentKeyId = await contract.getActiveKeyId(did);
    const stringKeyId = currentKeyId.split("-").pop();
    const numberKeyId = parseInt(stringKeyId, 10);

    await contract.registerNewKey(
      did,
      "#key-" + (numberKeyId + 1).toString(),
      key
    );
  } catch (error) {}
};

export const checkDIDOnChain = async (did: string) => {
  try {
    const result = await contract.isRegistered(did);
    return result;
  } catch (error) {
    console.log("ERROR", error);
  }
};

export const getDIDKeyOnChain = async (did: string, keyId: string) => {
  try {
    const result = await contract.getKey(did);
    return result;
  } catch (error) {}
};

export const getDIDCountOnChain = async () => {
  try {
    const result = await contract.getDIDCount();
    return result;
  } catch (error) {}
};

export const getNumberOfBlocksOnChain = async () => {
  try {
    const blockCount = await provider.getBlockNumber();
    return blockCount;
  } catch (error) {}
};

export const deactivatedDID = async (did: string) => {
  try {
    const result = await contract.deactivate(did);
    return result;
  } catch (error) {}
};

export const getDIDDocument = async (did: string) => {
  try {
    const result = await contract.getDIDDocument(did);
    const keyId = await contract.getActiveKeyId(did);
    const public_key = await contract.getKey(did, keyId);
    result[keyId] = public_key;
    return result;
  } catch (error) {}
};
