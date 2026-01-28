
import {
    Bls12381G2KeyPair,
    BbsBlsSignature2020,
    BbsBlsSignatureProof2020,
    deriveProof,
} from "@mattrglobal/jsonld-signatures-bbs";
import { sign, verify, extendContextLoader, purposes } from "jsonld-signatures";
import documentLoaders from "jsonld";
import { v4 as uuidv4 } from "uuid";
import logger from "../config/logger";
import { InternalServerError, BadRequestError } from "../utils/errors/AppError";

// Custom document loader to handle contexts offline
const CONTEXTS: Record<string, any> = {
    "https://www.w3.org/2018/credentials/v1": require("../utils/contexts/credentials-v1.json"),
    "https://w3id.org/security/bbs/v1": require("../utils/contexts/bbs-v1.json"),
    "https://schema.org": require("../utils/contexts/schema-org-mock.json"),
    "https://w3id.org/security/suites/jws-2020/v1": require("../utils/contexts/jws-2020-v1.json"),
    "https://w3id.org/security/v2": require("../utils/contexts/security-v2.json")
};

// In-memory cache for DIDs (Mock Resolver)
const DID_CACHE = new Map<string, any>();

const documentLoader = async (url: string) => {
    // console.log(`DEBUG: Loader requested: ${url}`);
    if (url in CONTEXTS) {
        return {
            contextUrl: null,
            document: CONTEXTS[url],
            documentUrl: url
        };
    }

    // Implement stateless did:key resolution
    if (url.startsWith("did:key")) {
        try {
            // Extract fingerprint (remove did:key: prefix and fragment)
            const did = url.split('#')[0];
            const fingerprint = did.replace("did:key:", "");

            // Resolve key from fingerprint
            // @ts-ignore
            const key = await Bls12381G2KeyPair.fromFingerprint({ fingerprint });
            // Construct DID Document
            // Fix publicKeyBase58 encoding
            const bs58 = require('bs58');
            const encodedKey = bs58.encode(key.publicKeyBuffer);

            const didDoc = {
                "@context": [
                    "https://w3id.org/security/v2",
                    "https://w3id.org/security/bbs/v1"
                ],
                "id": did,
                "verificationMethod": [{
                    id: `${did}#${fingerprint}`,
                    type: "Bls12381G2Key2020",
                    controller: did,
                    publicKeyBase58: encodedKey
                }],
                "assertionMethod": [`${did}#${fingerprint}`],
                "authentication": [`${did}#${fingerprint}`]
            };

            // console.log("DEBUG: Resolved DID Doc for", did);
            // console.log(JSON.stringify(didDoc, null, 2));



            return {
                contextUrl: null,
                document: didDoc,
                documentUrl: did
            };
        } catch (e) {
            console.warn(`Failed to resolve did:key ${url}`, e);
            // Fallthrough to node loader? Or throw?
        }
    }

    // Fallback to node loader
    // console.log(`DEBUG: Loader fallback to node for: ${url}`);
    try {
        return await documentLoaders.node.documentLoader(url);
    } catch (e) {
        console.error(`DEBUG: Loader died on ${url}`, e);
        throw e;
    }
};

/**
 * Service to handle Zero-Knowledge Proofs (ZKP) using BBS+ Signatures
 */
class ZKPService {
    /**
     * Generate a new BLS12-381 Key Pair
     */
    async generateBlsKeyPair() {
        try {
            // Generate key pair first
            const keyPair = await Bls12381G2KeyPair.generate();

            // Derive DID from fingerprint
            const fingerprint = await keyPair.fingerprint();
            const did = `did:key:${fingerprint}`;
            const keyId = `${did}#${fingerprint}`;

            // Update keyPair identifiers
            keyPair.id = keyId;
            keyPair.controller = did;

            // We don't need DID_CACHE anymore for these keys as they are self-resolving!

            return keyPair;
        } catch (error: any) {
            logger.error("Error generating BLS key pair:", error);
            throw new InternalServerError(`Failed to generate BLS key pair: ${error.message}`);
        }
    }

    /**
     * Sign a Verifiable Credential using BBS+ Signature
     * @param credential The unsigned JSON-LD credential
     * @param keyPair The issuer's BLS key pair
     */
    async signCredentialBBS(credential: any, keyPair: any) {
        try {
            const signedCredential = await sign(credential, {
                suite: new BbsBlsSignature2020({ key: keyPair }),
                purpose: new purposes.AssertionProofPurpose(),
                documentLoader,
            });

            // Ensure verificationMethod is set in the proof
            if (signedCredential.proof && !signedCredential.proof.verificationMethod) {
                // logger.warn("Patching missing verificationMethod in BBS+ proof");
                signedCredential.proof.verificationMethod = keyPair.id;
            }

            return signedCredential;
        } catch (error: any) {
            logger.error("Error signing credential with BBS+:", error);
            throw new InternalServerError(`Failed to sign credential with BBS+: ${error.message}`);
        }
    }

    /**
     * Derive a Zero-Knowledge Proof (Selective Disclosure) from a BBS+ signed VC
     * @param signedCredential The full BBS+ signed credential
     * @param revealedAttributes Array of JSON-LD paths to reveal (e.g. ["credentialSubject.name"])
     * @param nonce Replay protection challenge
     */
    async deriveProofBBS(
        signedCredential: any,
        revealedAttributes: string[],
        nonce: string
    ) {
        try {
            // The deriveProof API takes a "revealDocument" which filters what is shown
            // Here we construct a simple frame/reveal document based on paths
            // Note: This is a simplified implementation. Complex nesting requires proper JSON-LD framing.

            // For basic flat attributes in credentialSubject:
            const revealDocument: any = {
                "@context": signedCredential["@context"],
                type: signedCredential.type,
                credentialSubject: {
                    "@explicit": true,
                }
            };

            if (signedCredential.credentialSubject.type) {
                (revealDocument.credentialSubject as any).type = signedCredential.credentialSubject.type;
            }

            // Add attributes to reveal
            // This part needs to be dynamic based on structure. 
            // For this implementation, we assume revealedAttributes are direct properties of credentialSubject
            revealedAttributes.forEach(attr => {
                // Identify if it's nested or simple
                // Assuming simple "credentialSubject.propertyName" format for now
                const parts = attr.split('.');
                if (parts[0] === 'credentialSubject' && parts.length === 2) {
                    (revealDocument.credentialSubject as any)[parts[1]] = {};
                }
            });

            const derivedProof = await deriveProof(signedCredential, revealDocument, {
                suite: new BbsBlsSignatureProof2020(),
                documentLoader,
                nonce,
            });

            return derivedProof;
        } catch (error: any) {
            logger.error("Error deriving BBS+ proof:", error);
            throw new InternalServerError(`Failed to derive BBS+ proof: ${error.message}`);
        }
    }

    /**
     * Verify a BBS+ derived proof (Verifiable Presentation)
     * @param proof The derived proof (VP)
     * @param issuerPublicKey The issuer's public key (from DID document)
     */
    async verifyProofBBS(proof: any, issuerPublicKey: any) {
        try {
            // We need to construct the suite with the ISSUER'S public key to verify the proof
            // implied by the VP.

            // Note: Mattr's verify function mainly checks the proof against the document
            // The issuer's public key is needed to verify the signature was originally valid
            // In verify(), the suite usually extracts the key from the verificationMethod in valid DID docs.
            // If we provide the suite with specific key, it can verify.

            const result = await verify(proof, {
                suite: new BbsBlsSignatureProof2020(),
                purpose: new purposes.AssertionProofPurpose(),
                documentLoader,
            });

            return result;
        } catch (error: any) {
            logger.error("Error verifying BBS+ proof:", error);
            return { verified: false, error: error.message };
        }
    }
}

export default new ZKPService();
