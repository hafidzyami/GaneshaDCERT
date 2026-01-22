/**
 * Selective Disclosure Service
 * Handles ZKP-based selective disclosure verification using BBS+ signatures
 *
 * Key Principles:
 * - Backend NEVER sees hidden attribute values
 * - Verification is done cryptographically without revealing data
 * - Uses blockchain for DID/VC status verification
 */

import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../config/database";
import logger from "../config/logger";
import DIDBlockchainService from "./blockchain/didBlockchain.service";
import VCBlockchainService from "./blockchain/vcBlockchain.service";
import {
  SelectiveDisclosurePresentationRequest,
  SelectiveDisclosureVP,
  SelectiveDisclosureVerificationResult,
  VerificationChecks,
  RevealedAttribute,
  PredicateProofResult,
  PredicateCondition,
  CreateSelectiveDisclosureRequestDTO,
  SubmitSelectiveDisclosureVPDTO,
  SelectiveDisclosureRequestResponse,
  BBSPublicKey,
  BBSVerificationContext,
  RequestedAttribute,
  RequestedPredicate,
  DEFAULT_REQUEST_EXPIRATION_SECONDS,
  MAX_REQUEST_EXPIRATION_SECONDS,
  BBS_PROOF_TYPES,
} from "../types/selectiveDisclosure.types";
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "../utils/errors/AppError";

/**
 * Selective Disclosure Service
 * Verifies BBS+ proofs and predicates without seeing hidden values
 */
class SelectiveDisclosureService {
  private db: PrismaClient;

  constructor(dependencies?: { db?: PrismaClient }) {
    this.db = dependencies?.db || prisma;
  }

  // ============================================
  // REQUEST MANAGEMENT
  // ============================================

  /**
   * Create a selective disclosure presentation request
   * Verifier specifies which attributes to reveal and predicates to prove
   */
  async createSelectiveDisclosureRequest(
    data: CreateSelectiveDisclosureRequestDTO
  ): Promise<SelectiveDisclosureRequestResponse> {
    logger.info(
      `[SelectiveDisclosure] Creating request from ${data.verifierDID} to ${data.holderDID}`
    );

    // Validate DIDs exist on blockchain (using legacy format for internal use)
    const [verifierDoc, holderDoc] = await Promise.all([
      DIDBlockchainService.getDIDDocumentLegacy(data.verifierDID),
      DIDBlockchainService.getDIDDocumentLegacy(data.holderDID),
    ]);

    if (!verifierDoc.found) {
      throw new BadRequestError("Verifier DID not found on blockchain");
    }

    if (!holderDoc.found) {
      throw new BadRequestError("Holder DID not found on blockchain");
    }

    // Generate challenge for replay protection
    const challenge = this.generateChallenge();

    // Calculate expiration
    const expiresIn = Math.min(
      data.expiresIn || DEFAULT_REQUEST_EXPIRATION_SECONDS,
      MAX_REQUEST_EXPIRATION_SECONDS
    );
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Create the request
    const request = await this.db.selectiveDisclosureRequest.create({
      data: {
        holderDID: data.holderDID,
        verifierDID: data.verifierDID,
        verifierName: data.verifierName,
        credentialTypes: data.credentialTypes,
        purpose: data.purpose,
        challenge,
        domain: data.domain,
        expiresAt: new Date(expiresAt),
        requestedAttributes: data.requestedAttributes
          ? JSON.stringify(data.requestedAttributes)
          : null,
        requestedPredicates: data.requestedPredicates
          ? JSON.stringify(data.requestedPredicates)
          : null,
        status: "PENDING",
      },
    });

    logger.success(
      `[SelectiveDisclosure] Request created: ${request.id} (challenge: ${challenge.substring(0, 16)}...)`
    );

    return {
      requestId: request.id,
      challenge,
      domain: data.domain,
      expiresAt,
      status: "PENDING",
    };
  }

  /**
   * Get selective disclosure request details
   */
  async getSelectiveDisclosureRequest(
    requestId: string
  ): Promise<SelectiveDisclosurePresentationRequest> {
    const request = await this.db.selectiveDisclosureRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundError("Selective disclosure request not found");
    }

    // Check if expired
    if (new Date() > request.expiresAt) {
      // Update status to expired
      await this.db.selectiveDisclosureRequest.update({
        where: { id: requestId },
        data: { status: "EXPIRED" },
      });
      throw new BadRequestError("Request has expired");
    }

    return {
      requestId: request.id,
      verifierDID: request.verifierDID,
      holderDID: request.holderDID,
      credentialTypes: request.credentialTypes as string[],
      purpose: request.purpose,
      challenge: request.challenge,
      domain: request.domain,
      expiresAt: request.expiresAt.toISOString(),
      requestedAttributes: request.requestedAttributes
        ? JSON.parse(request.requestedAttributes as string)
        : undefined,
      requestedPredicates: request.requestedPredicates
        ? JSON.parse(request.requestedPredicates as string)
        : undefined,
    };
  }

  /**
   * Get pending selective disclosure requests for a holder
   */
  async getPendingRequestsForHolder(
    holderDID: string
  ): Promise<SelectiveDisclosurePresentationRequest[]> {
    const requests = await this.db.selectiveDisclosureRequest.findMany({
      where: {
        holderDID,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    return requests.map((r) => ({
      requestId: r.id,
      verifierDID: r.verifierDID,
      holderDID: r.holderDID,
      credentialTypes: r.credentialTypes as string[],
      purpose: r.purpose,
      challenge: r.challenge,
      domain: r.domain,
      expiresAt: r.expiresAt.toISOString(),
      requestedAttributes: r.requestedAttributes
        ? JSON.parse(r.requestedAttributes as string)
        : undefined,
      requestedPredicates: r.requestedPredicates
        ? JSON.parse(r.requestedPredicates as string)
        : undefined,
    }));
  }

  // ============================================
  // VP SUBMISSION & VERIFICATION
  // ============================================

  /**
   * Submit and verify a selective disclosure VP
   * This is the main verification endpoint
   */
  async submitSelectiveDisclosureVP(
    data: SubmitSelectiveDisclosureVPDTO
  ): Promise<SelectiveDisclosureVerificationResult> {
    logger.info(
      `[SelectiveDisclosure] Verifying VP for request: ${data.requestId}`
    );

    // 1. Get the original request
    const request = await this.db.selectiveDisclosureRequest.findUnique({
      where: { id: data.requestId },
    });

    if (!request) {
      throw new NotFoundError("Selective disclosure request not found");
    }

    if (request.status !== "PENDING") {
      throw new BadRequestError(`Request already ${request.status.toLowerCase()}`);
    }

    if (new Date() > request.expiresAt) {
      await this.db.selectiveDisclosureRequest.update({
        where: { id: data.requestId },
        data: { status: "EXPIRED" },
      });
      throw new BadRequestError("Request has expired");
    }

    // 2. Parse the selective VP
    let selectiveVP: SelectiveDisclosureVP;
    try {
      selectiveVP = JSON.parse(data.selectiveVP);
    } catch (e) {
      throw new BadRequestError("Invalid VP JSON format");
    }

    // 3. Initialize verification result
    const checks: VerificationChecks = {
      bbsProofValid: false,
      issuerTrusted: false,
      credentialNotRevoked: false,
      credentialNotExpired: false,
      challengeMatches: false,
      domainMatches: false,
      predicatesValid: false,
      requiredAttributesPresent: false,
    };
    const errors: string[] = [];
    const revealedAttributes: RevealedAttribute[] = [];
    const predicateResults: PredicateProofResult[] = [];

    // 4. Verify challenge and domain (replay protection)
    checks.challengeMatches = selectiveVP.proof.challenge === request.challenge;
    if (!checks.challengeMatches) {
      errors.push("Challenge mismatch - possible replay attack");
    }

    checks.domainMatches = selectiveVP.proof.domain === request.domain;
    if (!checks.domainMatches) {
      errors.push("Domain mismatch - possible relay attack");
    }

    // 5. Verify holder matches
    if (selectiveVP.holder !== request.holderDID) {
      errors.push("VP holder does not match request holder");
    }

    // 6. Process each credential in the VP
    let allCredentialsValid = true;
    let allPredicatesValid = true;

    for (let i = 0; i < selectiveVP.verifiableCredential.length; i++) {
      const credential = selectiveVP.verifiableCredential[i];
      const issuerDID =
        typeof credential.issuer === "string"
          ? credential.issuer
          : credential.issuer.id;

      try {
        // 6a. Get issuer's public key from blockchain (using legacy format for internal use)
        const issuerDoc = await DIDBlockchainService.getDIDDocumentLegacy(issuerDID);
        if (!issuerDoc.found) {
          errors.push(`Issuer DID not found: ${issuerDID}`);
          allCredentialsValid = false;
          continue;
        }

        if (issuerDoc.status !== "Active") {
          errors.push(`Issuer DID is not active: ${issuerDID}`);
          checks.issuerTrusted = false;
          allCredentialsValid = false;
          continue;
        }

        checks.issuerTrusted = true;

        // 6b. Verify credential not revoked (if credentialId is provided)
        if (credential.credentialId) {
          try {
            const vcStatus = await VCBlockchainService.getVCStatusFromBlockchain(
              credential.credentialId
            );
            // vcStatus[0] is isActive (true = active, false = revoked)
            checks.credentialNotRevoked = vcStatus[0] === true;
            if (!checks.credentialNotRevoked) {
              errors.push(`Credential revoked: ${credential.credentialId}`);
              allCredentialsValid = false;
            }
          } catch (e: any) {
            errors.push(`Failed to check revocation status: ${e.message}`);
            allCredentialsValid = false;
          }
        } else {
          // If no credentialId, we can't check revocation
          checks.credentialNotRevoked = true;
        }

        // 6c. Verify credential not expired
        if (credential.expirationDate) {
          const expDate = new Date(credential.expirationDate);
          checks.credentialNotExpired = expDate > new Date();
          if (!checks.credentialNotExpired) {
            errors.push(`Credential expired: ${credential.expirationDate}`);
            allCredentialsValid = false;
          }
        } else {
          checks.credentialNotExpired = true;
        }

        // 6d. Verify BBS+ derived proof
        const publicKeyHex = issuerDoc[issuerDoc.keyId];
        const bbsVerificationResult = await this.verifyBBSProof(
          selectiveVP,
          credential,
          publicKeyHex,
          request.challenge,
          request.domain
        );

        if (!bbsVerificationResult.valid) {
          errors.push(`BBS+ proof verification failed: ${bbsVerificationResult.error}`);
          allCredentialsValid = false;
        }

        checks.bbsProofValid = bbsVerificationResult.valid;

        // 6e. Extract revealed attributes
        this.extractRevealedAttributes(
          credential.credentialSubject,
          i,
          revealedAttributes,
          ""
        );

        // 6f. Verify predicate proofs
        if (credential.predicateProofs && credential.predicateProofs.length > 0) {
          for (const predicateProof of credential.predicateProofs) {
            const predicateValid = await this.verifyPredicateProof(
              predicateProof,
              publicKeyHex
            );

            predicateResults.push({
              ...predicateProof,
              satisfied: predicateValid,
            });

            if (!predicateValid) {
              allPredicatesValid = false;
              errors.push(
                `Predicate proof failed for ${predicateProof.attributeName}`
              );
            }
          }
        }
      } catch (e: any) {
        errors.push(`Credential verification error: ${e.message}`);
        allCredentialsValid = false;
      }
    }

    checks.predicatesValid = allPredicatesValid;

    // 7. Check required attributes are present
    const requestedAttrs = request.requestedAttributes
      ? (JSON.parse(request.requestedAttributes as string) as RequestedAttribute[])
      : [];

    const requestedPreds = request.requestedPredicates
      ? (JSON.parse(request.requestedPredicates as string) as RequestedPredicate[])
      : [];

    checks.requiredAttributesPresent = this.checkRequiredAttributes(
      requestedAttrs,
      requestedPreds,
      revealedAttributes,
      predicateResults
    );

    if (!checks.requiredAttributesPresent) {
      errors.push("Not all required attributes are present or proven");
    }

    // 8. Determine overall validity
    const valid =
      checks.bbsProofValid &&
      checks.issuerTrusted &&
      checks.credentialNotRevoked &&
      checks.credentialNotExpired &&
      checks.challengeMatches &&
      checks.domainMatches &&
      checks.predicatesValid &&
      checks.requiredAttributesPresent &&
      errors.length === 0;

    // 9. Update request status
    await this.db.selectiveDisclosureRequest.update({
      where: { id: data.requestId },
      data: {
        status: valid ? "ACCEPT" : "DECLINE",
        verifyStatus: valid ? "VALID_VERIFICATION" : "INVALID_VERIFICATION",
        vpId: valid ? crypto.randomUUID() : null,
        verifiedAt: new Date(),
      },
    });

    // 10. Store the VP if valid
    if (valid) {
      await this.db.selectiveDisclosureVP.create({
        data: {
          requestId: data.requestId,
          holderDID: selectiveVP.holder,
          verifierDID: request.verifierDID,
          vpData: data.selectiveVP,
          revealedAttributes: JSON.stringify(revealedAttributes),
          predicateResults: JSON.stringify(predicateResults),
        },
      });
    }

    // Get issuer from first credential
    const firstCredential = selectiveVP.verifiableCredential[0];
    const issuer =
      typeof firstCredential?.issuer === "string"
        ? firstCredential.issuer
        : firstCredential?.issuer?.id || "unknown";

    logger.info(
      `[SelectiveDisclosure] Verification complete: ${valid ? "VALID" : "INVALID"} (${errors.length} errors)`
    );

    return {
      valid,
      checks,
      revealedAttributes,
      predicateResults,
      issuer,
      holder: selectiveVP.holder,
      errors,
    };
  }

  /**
   * Get verification result for a VP
   */
  async getVerificationResult(
    vpId: string
  ): Promise<SelectiveDisclosureVerificationResult | null> {
    const vp = await this.db.selectiveDisclosureVP.findUnique({
      where: { id: vpId },
      include: { request: true },
    });

    if (!vp) {
      return null;
    }

    const selectiveVP: SelectiveDisclosureVP = JSON.parse(vp.vpData);
    const firstCredential = selectiveVP.verifiableCredential[0];
    const issuer =
      typeof firstCredential?.issuer === "string"
        ? firstCredential.issuer
        : firstCredential?.issuer?.id || "unknown";

    return {
      valid: vp.request.verifyStatus === "VALID_VERIFICATION",
      checks: {
        bbsProofValid: true,
        issuerTrusted: true,
        credentialNotRevoked: true,
        credentialNotExpired: true,
        challengeMatches: true,
        domainMatches: true,
        predicatesValid: true,
        requiredAttributesPresent: true,
      },
      revealedAttributes: JSON.parse(vp.revealedAttributes || "[]"),
      predicateResults: JSON.parse(vp.predicateResults || "[]"),
      issuer,
      holder: vp.holderDID,
      errors: [],
    };
  }

  // ============================================
  // BBS+ PROOF VERIFICATION
  // ============================================

  /**
   * Verify BBS+ derived proof
   * This verifies the selective disclosure proof without seeing hidden values
   *
   * NOTE: This is a placeholder implementation.
   * In production, use @mattrglobal/bbs-signatures or similar library.
   */
  private async verifyBBSProof(
    vp: SelectiveDisclosureVP,
    credential: any,
    publicKeyHex: string,
    expectedChallenge: string,
    expectedDomain: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Verify proof type
      if (vp.proof.type !== BBS_PROOF_TYPES.BBS_SELECTIVE_DISCLOSURE_2023) {
        return {
          valid: false,
          error: `Invalid proof type: ${vp.proof.type}`,
        };
      }

      // Verify challenge and domain in proof
      if (vp.proof.challenge !== expectedChallenge) {
        return { valid: false, error: "Challenge mismatch in proof" };
      }

      if (vp.proof.domain !== expectedDomain) {
        return { valid: false, error: "Domain mismatch in proof" };
      }

      // Decode proof value
      const proofValue = vp.proof.proofValue;
      if (!proofValue || proofValue.length === 0) {
        return { valid: false, error: "Empty proof value" };
      }

      // In a real implementation, you would:
      // 1. Decode the multibase-encoded proof value
      // 2. Extract the BBS+ proof components (A', e^, v^, etc.)
      // 3. Verify the proof using the issuer's BBS+ public key
      // 4. The proof cryptographically proves possession of hidden attributes
      //    without revealing them

      // For now, we perform structural validation
      // The actual BBS+ verification requires specialized library

      // Validate proof structure
      if (!proofValue.startsWith('z') && !proofValue.startsWith('u')) {
        // Check if it's a valid multibase encoding
        return { valid: false, error: "Invalid proof encoding" };
      }

      // Verify the proof using BBS+ signature verification
      // This is where the actual cryptographic verification happens
      const verified = await this.verifyBBSSignatureProof(
        credential,
        proofValue,
        publicKeyHex,
        expectedChallenge,
        expectedDomain
      );

      return { valid: verified, error: verified ? undefined : "BBS+ signature verification failed" };
    } catch (e: any) {
      logger.error(`[SelectiveDisclosure] BBS+ proof verification error:`, e);
      return { valid: false, error: e.message };
    }
  }

  /**
   * Verify BBS+ signature proof
   *
   * NOTE: This is a placeholder for actual BBS+ verification.
   * Implement with @mattrglobal/bbs-signatures when available.
   */
  private async verifyBBSSignatureProof(
    credential: any,
    proofValue: string,
    publicKeyHex: string,
    challenge: string,
    domain: string
  ): Promise<boolean> {
    try {
      // Placeholder implementation
      // In production, use BBS+ library:
      //
      // import { blsVerifyProof } from '@mattrglobal/bbs-signatures';
      //
      // const publicKey = Buffer.from(publicKeyHex, 'hex');
      // const proof = this.decodeMultibase(proofValue);
      // const revealedMessages = this.getRevealedMessages(credential);
      // const nonce = Buffer.from(challenge + domain);
      //
      // return await blsVerifyProof({
      //   proof,
      //   publicKey,
      //   messages: revealedMessages,
      //   nonce,
      // });

      // For now, verify basic structure and return true for well-formed proofs
      // This allows testing the flow while BBS+ library is being integrated

      // Basic structural validation
      if (!proofValue || proofValue.length < 10) {
        return false;
      }

      // Verify public key format (should be valid hex)
      if (!/^[0-9a-fA-F]+$/.test(publicKeyHex)) {
        return false;
      }

      // The proof value should be properly encoded
      // In multibase, 'z' prefix means base58btc
      // 'u' prefix means base64url
      const validPrefixes = ['z', 'u', 'f', 'F', 'm', 'M'];
      if (!validPrefixes.includes(proofValue[0])) {
        return false;
      }

      // For demonstration, accept well-formed proofs
      // TODO: Replace with actual BBS+ verification
      logger.warn(
        "[SelectiveDisclosure] Using placeholder BBS+ verification. " +
        "Install @mattrglobal/bbs-signatures for production use."
      );

      return true;
    } catch (e) {
      logger.error(`[SelectiveDisclosure] BBS+ signature verification error:`, e);
      return false;
    }
  }

  // ============================================
  // PREDICATE PROOF VERIFICATION
  // ============================================

  /**
   * Verify a predicate proof
   * Predicates prove conditions about hidden values without revealing them
   *
   * NOTE: This is a placeholder. Real predicate proofs use zero-knowledge
   * range proofs (e.g., Bulletproofs) or commitment schemes.
   */
  private async verifyPredicateProof(
    predicateProof: PredicateProofResult,
    publicKeyHex: string
  ): Promise<boolean> {
    try {
      // Validate predicate proof structure
      if (!predicateProof.proofValue || predicateProof.proofValue.length === 0) {
        return false;
      }

      if (!predicateProof.attributePath || !predicateProof.predicate) {
        return false;
      }

      // In a real implementation, you would:
      // 1. Decode the predicate proof (e.g., Bulletproof range proof)
      // 2. Verify the proof mathematically
      // 3. The proof proves the predicate is satisfied without revealing the value
      //
      // Example for age >= 18:
      // - Holder proves they have a credential with a birthdate
      // - The proof proves (currentDate - birthdate) >= 18 years
      // - Verifier never sees the actual birthdate

      // For now, verify structure and trust the proof
      // TODO: Implement actual predicate proof verification

      logger.warn(
        "[SelectiveDisclosure] Using placeholder predicate verification. " +
        "Implement Bulletproofs or similar for production use."
      );

      // Verify proof encoding
      const validPrefixes = ['z', 'u', 'f', 'F', 'm', 'M'];
      if (!validPrefixes.includes(predicateProof.proofValue[0])) {
        return false;
      }

      return true;
    } catch (e: any) {
      logger.error(`[SelectiveDisclosure] Predicate proof verification error:`, e);
      return false;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Generate a random challenge for replay protection
   */
  private generateChallenge(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Extract revealed attributes from credential subject
   */
  private extractRevealedAttributes(
    subject: any,
    credentialIndex: number,
    results: RevealedAttribute[],
    pathPrefix: string
  ): void {
    for (const [key, value] of Object.entries(subject)) {
      if (key === "id") continue; // Skip the subject ID

      const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        // Recurse into nested objects
        this.extractRevealedAttributes(value, credentialIndex, results, currentPath);
      } else {
        // Add revealed attribute
        results.push({
          path: `credentialSubject.${currentPath}`,
          name: key,
          value: value,
          credentialIndex,
        });
      }
    }
  }

  /**
   * Check if all required attributes are present
   */
  private checkRequiredAttributes(
    requestedAttributes: RequestedAttribute[],
    requestedPredicates: RequestedPredicate[],
    revealedAttributes: RevealedAttribute[],
    predicateResults: PredicateProofResult[]
  ): boolean {
    // Check required revealed attributes
    for (const reqAttr of requestedAttributes) {
      if (!reqAttr.required) continue;

      const found = revealedAttributes.some(
        (ra) => ra.path === reqAttr.attributePath
      );

      // If not found as revealed, check if predicate is acceptable
      if (!found && reqAttr.acceptPredicate) {
        const predicateFound = predicateResults.some(
          (pr) => pr.attributePath === reqAttr.attributePath && pr.satisfied
        );
        if (!predicateFound) {
          logger.warn(
            `[SelectiveDisclosure] Required attribute missing: ${reqAttr.attributePath}`
          );
          return false;
        }
      } else if (!found) {
        logger.warn(
          `[SelectiveDisclosure] Required attribute missing: ${reqAttr.attributePath}`
        );
        return false;
      }
    }

    // Check required predicates
    for (const reqPred of requestedPredicates) {
      if (!reqPred.required) continue;

      const found = predicateResults.some(
        (pr) =>
          pr.attributePath === reqPred.attributePath &&
          pr.predicate.operator === reqPred.operator &&
          pr.satisfied
      );

      if (!found) {
        logger.warn(
          `[SelectiveDisclosure] Required predicate not satisfied: ${reqPred.attributePath} ${reqPred.operator} ${reqPred.value}`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Decode multibase-encoded string
   */
  private decodeMultibase(encoded: string): Buffer {
    if (!encoded || encoded.length < 2) {
      throw new Error("Invalid multibase string");
    }

    const prefix = encoded[0];
    const data = encoded.slice(1);

    switch (prefix) {
      case "z": // base58btc
        return this.decodeBase58(data);
      case "u": // base64url
        return Buffer.from(data, "base64url");
      case "m": // base64
      case "M": // base64pad
        return Buffer.from(data, "base64");
      case "f": // base16 lower
      case "F": // base16 upper
        return Buffer.from(data, "hex");
      default:
        throw new Error(`Unsupported multibase prefix: ${prefix}`);
    }
  }

  /**
   * Decode base58btc string
   */
  private decodeBase58(str: string): Buffer {
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const ALPHABET_MAP: { [key: string]: number } = {};
    for (let i = 0; i < ALPHABET.length; i++) {
      ALPHABET_MAP[ALPHABET[i]] = i;
    }

    let num = BigInt(0);
    for (const char of str) {
      const digit = ALPHABET_MAP[char];
      if (digit === undefined) {
        throw new Error(`Invalid base58 character: ${char}`);
      }
      num = num * BigInt(58) + BigInt(digit);
    }

    const hex = num.toString(16);
    const paddedHex = hex.length % 2 ? "0" + hex : hex;
    return Buffer.from(paddedHex, "hex");
  }
}

// Export singleton and class
export default new SelectiveDisclosureService();
export { SelectiveDisclosureService };
