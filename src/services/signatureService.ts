import { ethers } from 'ethers';

const getAddressFromDid = (did: string): string => {
  const parts = did.split(':');
  return parts[parts.length - 1];
};

export const verifySignature = (payload: object, signature: string, did: string): boolean => {
  try {
    const address = getAddressFromDid(did);
    const message = JSON.stringify(payload);
    const signerAddr = ethers.verifyMessage(message, signature);
    return signerAddr.toLowerCase() === address.toLowerCase();
  } catch (error) {
    return false;
  }
};