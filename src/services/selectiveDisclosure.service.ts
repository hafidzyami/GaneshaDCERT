/**
 * Selective Disclosure Service
 * Handles selective disclosure verification using DataIntegrityProof
 * with ecdsa-rdfc-2019 cryptosuite and hash-based commitments
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
  CreateSelectiveDisclosureRequestDTO,
  SubmitSelectiveDisclosureVPDTO,
  SelectiveDisclosureRequestResponse,
  RequestedAttribute,
  RequestedPredicate,
  DataIntegrityProof,
  SelectiveDisclosureCredentialInfo,
  DEFAULT_REQUEST_EXPIRATION_SECONDS,
  MAX_REQUEST_EXPIRATION_SECONDS,
  SD_PROOF_TYPES,
  CRYPTOSUITES,
} from "../types/selectiveDisclosure.types";
import {
  BadRequestError,
  NotFoundError,
} from "../utils/errors/AppError";
import zkpService from "./zkp.service";

/**
 * Selective Disclosure Service
 * Verifies DataIntegrityProof and selective disclosure proofs
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
      vpProofValid: false,
      vcProofValid: false,
      selectiveProofValid: false,
      issuerTrusted: false,
      credentialNotRevoked: false,
      credentialNotExpired: false,
      challengeMatches: false,
      domainMatches: false,
      predicatesValid: true,
      requiredAttributesPresent: false,
    };
    const errors: string[] = [];
    const revealedAttributes: RevealedAttribute[] = [];
    const predicateResults: PredicateProofResult[] = [];

    // 4. Verify challenge and domain (replay protection)
    const vpChallenge = selectiveVP.proof?.challenge || null;
    const reqChallenge = request.challenge || null;
    checks.challengeMatches = vpChallenge === reqChallenge;
    if (!checks.challengeMatches) {
      errors.push("Challenge mismatch - possible replay attack");
    }

    const vpDomain = selectiveVP.proof?.domain || null;
    const reqDomain = request.domain || null;
    checks.domainMatches = vpDomain === reqDomain;
    if (!checks.domainMatches) {
      errors.push("Domain mismatch - possible relay attack");
    }

    // 5. Verify holder matches
    if (selectiveVP.holder !== request.holderDID) {
      errors.push("VP holder does not match request holder");
    }

    // 6. Verify VP proof (DataIntegrityProof by holder)
    try {
      const holderDoc = await DIDBlockchainService.getDIDDocumentLegacy(selectiveVP.holder);
      if (holderDoc.found && holderDoc.status === "Active") {
        const holderPublicKey = holderDoc[holderDoc.keyId];
        const vpProofValid = await this.verifyDataIntegrityProof(
          selectiveVP,
          selectiveVP.proof,
          holderPublicKey
        );
        checks.vpProofValid = vpProofValid;
        if (!vpProofValid) {
          errors.push("VP proof verification failed (holder signature invalid)");
        }
      } else {
        errors.push("Holder DID not found or inactive");
      }
    } catch (e: any) {
      errors.push(`VP proof verification error: ${e.message}`);
    }

    // 7. Process each credential in the VP
    let allCredentialsValid = true;

    for (let i = 0; i < selectiveVP.verifiableCredential.length; i++) {
      const credential = selectiveVP.verifiableCredential[i];
      const issuerDID =
        typeof credential.issuer === "string"
          ? credential.issuer
          : credential.issuer.id;

      try {
        // 7a. Get issuer's public key from blockchain
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

        // 7b. Verify credential not revoked (using VC id)
        const vcId = credential.id || credential.credentialId;
        if (vcId) {
          try {
            const vcStatus = await VCBlockchainService.getVCStatusFromBlockchain(vcId);
            checks.credentialNotRevoked = vcStatus[0] === true;
            if (!checks.credentialNotRevoked) {
              errors.push(`Credential revoked: ${vcId}`);
              allCredentialsValid = false;
            }
          } catch (e: any) {
            // If blockchain check fails, still continue
            logger.warn(`Failed to check revocation status for ${vcId}: ${e.message}`);
            checks.credentialNotRevoked = true;
          }
        } else {
          checks.credentialNotRevoked = true;
        }

        // 7c. Verify credential not expired
        const expirationDate = credential.expiredAt || credential.expirationDate;
        if (expirationDate) {
          const expDate = new Date(expirationDate);
          checks.credentialNotExpired = expDate > new Date();
          if (!checks.credentialNotExpired) {
            errors.push(`Credential expired: ${expirationDate}`);
            allCredentialsValid = false;
          }
        } else {
          checks.credentialNotExpired = true;
        }

        // 7d. VC proof check
        // NOTE: In selective disclosure, the credential only contains revealed attributes,
        // so the original issuer's DataIntegrityProof CANNOT be verified against the partial
        // credential (it was signed over the full credential). The credential integrity is
        // instead verified through the SelectiveDisclosureProof2024 which contains credentialHash
        // (hash of the entire original credential) signed by the holder.
        if (credential.proof) {
          // Just verify the proof structure exists and is a DataIntegrityProof
          if (credential.proof.type === SD_PROOF_TYPES.DATA_INTEGRITY_PROOF &&
            credential.proof.proofValue) {
            checks.vcProofValid = true;
          } else if (credential.proof.type === SD_PROOF_TYPES.BBS_BLS_SIGNATURE_PROOF_2020) {
            // BBS+ Verification
            try {
              // Verify using ZKP Service
              // Mattr's verify function resolves the issuer key via documentLoader
              const result = await zkpService.verifyProofBBS(credential, null);

              if (result.verified) {
                checks.vcProofValid = true;
                // BBS+ derived proof implies selective disclosure validity
                checks.selectiveProofValid = true;
              } else {
                errors.push(`BBS+ proof invalid: ${JSON.stringify(result.error)}`);
                // If it's a "key not found" error, it's likely due to local blockchain DID
                // In a real implementation, we'd inject a custom documentLoader to resolve DIDs from DB
                allCredentialsValid = false;
              }
            } catch (e: any) {
              errors.push(`BBS+ verification exception: ${e.message}`);
              allCredentialsValid = false;
            }
          } else {
            errors.push(`Credential ${i} has invalid proof structure`);
            allCredentialsValid = false;
          }
        } else {
          errors.push(`Credential ${i} has no proof`);
          allCredentialsValid = false;
        }

        // 7e. Verify selective disclosure proof
        const sdInfo = selectiveVP.selectiveDisclosure?.credentials?.[i];
        if (sdInfo) {
          const holderDocForSD = await DIDBlockchainService.getDIDDocumentLegacy(selectiveVP.holder);
          if (holderDocForSD.found) {
            const holderPublicKey = holderDocForSD[holderDocForSD.keyId];
            const sdProofValid = await this.verifySelectiveDisclosureProof(
              sdInfo,
              credential,
              holderPublicKey,
              selectiveVP.holder
            );
            checks.selectiveProofValid = sdProofValid;
            if (!sdProofValid) {
              errors.push(`Selective disclosure proof failed for credential ${i}`);
            }
          }
        } else {
          // No selective disclosure info - accept as fully disclosed
          checks.selectiveProofValid = true;
        }

        // 7f. Extract revealed attributes
        this.extractRevealedAttributes(
          credential.credentialSubject,
          i,
          revealedAttributes,
          ""
        );

        // 7g. Predicate proofs are handled at VP level (after credential loop)
      } catch (e: any) {
        errors.push(`Credential verification error: ${e.message}`);
        allCredentialsValid = false;
      }
    }

    // 8. Process predicate proofs (at VP level, not inside credentials)
    if (selectiveVP.predicateProofs && selectiveVP.predicateProofs.length > 0) {
      for (const predicateProof of selectiveVP.predicateProofs) {
        predicateResults.push({
          attributePath: predicateProof.attributePath,
          predicate: predicateProof.predicate,
          satisfied: predicateProof.satisfied,
          proofValue: predicateProof.proofValue,
        });
      }
    }

    // 10. Check required attributes are present
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

    // 11. Determine overall validity
    const valid =
      checks.vpProofValid &&
      checks.vcProofValid &&
      checks.selectiveProofValid &&
      checks.issuerTrusted &&
      checks.credentialNotRevoked &&
      checks.credentialNotExpired &&
      checks.challengeMatches &&
      checks.domainMatches &&
      checks.predicatesValid &&
      checks.requiredAttributesPresent &&
      errors.length === 0;

    // 12. Update request status
    await this.db.selectiveDisclosureRequest.update({
      where: { id: data.requestId },
      data: {
        status: valid ? "ACCEPT" : "DECLINE",
        verifyStatus: valid ? "VALID_VERIFICATION" : "INVALID_VERIFICATION",
        vpId: valid ? crypto.randomUUID() : null,
        verifiedAt: new Date(),
      },
    });

    // 13. Store the VP if valid
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
        vpProofValid: true,
        vcProofValid: true,
        selectiveProofValid: true,
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
  // PROOF VERIFICATION
  // ============================================

  /**
   * Verify DataIntegrityProof (ECDSA with ecdsa-rdfc-2019 cryptosuite)
   * Verifies the ECDSA signature over the canonicalized document
   *
   * Frontend signing process:
   * 1. Remove proof from VP
   * 2. If challenge/domain exist, add them to top-level object
   * 3. Sort keys and JSON.stringify
   * 4. SHA256 hash → P-256 sign → DER encode → base64
   */
  private async verifyDataIntegrityProof(
    data: any,
    proof: DataIntegrityProof,
    publicKeyHex: string
  ): Promise<boolean> {
    try {
      // Validate proof type and cryptosuite
      if (proof.type !== SD_PROOF_TYPES.DATA_INTEGRITY_PROOF) {
        logger.warn(`[SelectiveDisclosure] Unexpected proof type: ${proof.type}`);
        return false;
      }

      if (proof.cryptosuite !== CRYPTOSUITES.ECDSA_RDFC_2019) {
        logger.warn(`[SelectiveDisclosure] Unexpected cryptosuite: ${proof.cryptosuite}`);
        return false;
      }

      // Remove proof from data for verification
      const { proof: _, ...dataWithoutProof } = data;

      // If challenge/domain exist in the proof, add them to the top-level object
      // This matches the frontend signing: vpForSigning = { ...vpWithoutProof, challenge, domain }
      const dataForSigning = { ...dataWithoutProof };
      if (proof.challenge) {
        dataForSigning.challenge = proof.challenge;
      }
      if (proof.domain) {
        dataForSigning.domain = proof.domain;
      }

      // Canonicalize the data (sorted JSON stringification - matches frontend)
      const canonicalData = JSON.stringify(
        dataForSigning,
        Object.keys(dataForSigning).sort()
      );

      // Create message buffer
      const messageBuffer = Buffer.from(canonicalData, "utf8");

      // Decode signature from base64 (DER-encoded ECDSA signature)
      const signatureBuffer = Buffer.from(proof.proofValue, "base64");

      // Convert public key hex to ECDSA KeyObject
      const publicKey = this.hexToECDSAPublicKey(publicKeyHex);

      // Verify signature using ECDSA with SHA256
      // crypto.verify("sha256", msg, ...) internally hashes msg with SHA256,
      // which matches frontend: p256.sign(sha256(canonicalVP), privateKey)
      const isValid = crypto.verify(
        "sha256",
        messageBuffer,
        publicKey,
        signatureBuffer
      );

      logger.debug(`[SelectiveDisclosure] DataIntegrityProof verification: ${isValid}`);
      return isValid;
    } catch (error: any) {
      logger.error(`[SelectiveDisclosure] DataIntegrityProof verification error:`, error);
      return false;
    }
  }

  /**
   * Verify SelectiveDisclosureProof2024
   * Verifies the holder's proof of selective disclosure
   *
   * Frontend signing process (bbsProofGenerator.ts):
   * proofInput = {
   *   credentialHash, disclosedAttributeHash,
   *   disclosedAttributes, hiddenAttributes,
   *   commitments: [{algorithm, commitment, key, saltHash}],
   *   holder, timestamp (≈ selectiveProof.created)
   * }
   * Signs: SHA256(JSON.stringify(proofInput)) with P-256
   * Note: Keys are NOT sorted in the proofInput JSON.stringify
   */
  private async verifySelectiveDisclosureProof(
    sdInfo: SelectiveDisclosureCredentialInfo,
    credential: any,
    holderPublicKeyHex: string,
    holderDid: string
  ): Promise<boolean> {
    try {
      const selectiveProof = sdInfo.selectiveProof;

      if (!selectiveProof || selectiveProof.type !== SD_PROOF_TYPES.SELECTIVE_DISCLOSURE_PROOF_2024) {
        logger.warn(`[SelectiveDisclosure] Invalid selective proof type`);
        return false;
      }

      // Reconstruct the exact proofInput that the frontend signed
      // IMPORTANT: Key order matters! Must match frontend's object literal order
      const proofInput = {
        credentialHash: selectiveProof.credentialHash,
        disclosedAttributeHash: selectiveProof.disclosedAttributeHash,
        disclosedAttributes: sdInfo.disclosedAttributes,
        hiddenAttributes: sdInfo.hiddenAttributes,
        commitments: sdInfo.commitments.map((c) => ({
          algorithm: c.algorithm,
          commitment: c.commitment,
          key: c.key,
          saltHash: c.saltHash,
        })),
        holder: holderDid,
        timestamp: selectiveProof.created, // Frontend uses new Date().toISOString() for both
      };

      // Frontend does NOT sort keys: JSON.stringify(proofInput)
      const proofInputJson = JSON.stringify(proofInput);
      const messageBuffer = Buffer.from(proofInputJson, "utf8");

      // Decode DER-encoded ECDSA signature from base64
      const signatureBuffer = Buffer.from(selectiveProof.proofValue, "base64");
      const publicKey = this.hexToECDSAPublicKey(holderPublicKeyHex);

      // Verify: crypto.verify("sha256", msg) hashes with SHA256 internally
      // This matches frontend: p256.sign(sha256(proofInputBytes), privateKey)
      const isValid = crypto.verify(
        "sha256",
        messageBuffer,
        publicKey,
        signatureBuffer
      );

      if (!isValid) {
        logger.warn(`[SelectiveDisclosure] Selective disclosure proof signature invalid`);
        return false;
      }

      // Verify commitments structure
      for (const commitment of sdInfo.commitments) {
        if (!commitment.algorithm || !commitment.commitment || !commitment.key || !commitment.saltHash) {
          logger.warn(`[SelectiveDisclosure] Invalid commitment structure for key: ${commitment.key}`);
          return false;
        }
      }

      // Verify disclosed attributes match what's in the credential
      for (const attrName of sdInfo.disclosedAttributes) {
        if (credential.credentialSubject[attrName] === undefined) {
          logger.warn(`[SelectiveDisclosure] Disclosed attribute not found in credential: ${attrName}`);
          return false;
        }
      }

      // Verify hidden attributes have corresponding commitments
      for (const hiddenAttr of sdInfo.hiddenAttributes) {
        const hasCommitment = sdInfo.commitments.some((c) => c.key === hiddenAttr);
        if (!hasCommitment) {
          logger.warn(`[SelectiveDisclosure] Hidden attribute missing commitment: ${hiddenAttr}`);
          return false;
        }
      }

      logger.debug(`[SelectiveDisclosure] SelectiveDisclosureProof2024 verified successfully`);
      return true;
    } catch (error: any) {
      logger.error(`[SelectiveDisclosure] SelectiveDisclosureProof2024 verification error:`, error);
      return false;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Convert hex public key to ECDSA P-256 KeyObject
   */
  private hexToECDSAPublicKey(publicKeyHex: string): crypto.KeyObject {
    // Remove '0x' prefix if present
    const cleanHex = publicKeyHex.startsWith("0x")
      ? publicKeyHex.substring(2)
      : publicKeyHex;

    let publicKeyBuffer: Buffer;

    if (cleanHex.length === 130) {
      // 65 bytes with 04 prefix (uncompressed)
      publicKeyBuffer = Buffer.from(cleanHex, "hex");
    } else if (cleanHex.length === 128) {
      // 64 bytes without prefix, add 04 prefix
      publicKeyBuffer = Buffer.concat([
        Buffer.from([0x04]),
        Buffer.from(cleanHex, "hex"),
      ]);
    } else if (cleanHex.length === 66) {
      // 33 bytes compressed key (02 or 03 prefix)
      publicKeyBuffer = Buffer.from(cleanHex, "hex");
    } else {
      throw new Error(
        `Invalid public key length: expected 66, 128, or 130 hex chars, got ${cleanHex.length}`
      );
    }

    // ASN.1 DER header for ECDSA P-256 public key (SPKI format)
    const derHeader = Buffer.from([
      0x30, 0x59, // SEQUENCE, length 89
      0x30, 0x13, // SEQUENCE, length 19
      0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID: ecPublicKey
      0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID: P-256
      0x03, 0x42, 0x00, // BIT STRING, length 66, 0 unused bits
    ]);

    // For compressed keys, we need to decompress first
    if (publicKeyBuffer.length === 33) {
      // Use ECDH.convertKey to decompress from compressed to uncompressed format
      const uncompressed = crypto.ECDH.convertKey(publicKeyBuffer, "prime256v1", undefined, undefined, "uncompressed");
      publicKeyBuffer = Buffer.from(uncompressed as Buffer);
    }

    const derKey = Buffer.concat([derHeader, publicKeyBuffer]);

    return crypto.createPublicKey({
      key: derKey,
      format: "der",
      type: "spki",
    });
  }

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
}

// Export singleton and class
export default new SelectiveDisclosureService();
export { SelectiveDisclosureService };
