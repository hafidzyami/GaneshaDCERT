
import zkpService from "../services/zkp.service";
import { v4 as uuidv4 } from "uuid";

async function runDemo() {
    console.log("=== Starting ZKP (BBS+) Demo ===");

    // 1. Generate Issuer Keys
    console.log("\n1. Generating Issuer Keys...");
    const keyPair = await zkpService.generateBlsKeyPair();
    console.log("Issuer DID:", keyPair.controller);
    console.log("Issuer Key ID:", keyPair.id);
    console.log("Issuer Key Public:", keyPair.publicKeyBuffer ? "Buffer Present" : "Missing");

    // 2. Create Unsigned Credential
    console.log("\n2. Creating Credential...");
    const credential = {
        "@context": [
            "https://www.w3.org/2018/credentials/v1",
            "https://w3id.org/security/bbs/v1",
            "https://schema.org"
        ],
        id: `urn:uuid:${uuidv4()}`,
        type: ["VerifiableCredential"],
        issuer: keyPair.controller,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
            id: "did:example:holder",
            name: "John Doe",
            email: "john@example.com",
            birthDate: "1990-01-01",
            jobTitle: "Software Engineer"
        }
    };
    console.log("Credential Subject:", credential.credentialSubject);

    // 3. Sign Credential (BBS+)
    console.log("\n3. Signing Credential (BBS+)...");
    const signedCredential = await zkpService.signCredentialBBS(credential, keyPair);
    console.log("Signed VC Proof Type:", signedCredential.proof.type);
    console.log("Signed VC Proof VerificationMethod:", signedCredential.proof.verificationMethod);

    // 4. Derive Proof (Holder) - Selectively Reveal ONLY 'name' and 'jobTitle'
    console.log("\n4. Deriving Proof (Selective Disclosure)...");
    console.log("Revealing: ['credentialSubject.name', 'credentialSubject.jobTitle']");
    const nonce = uuidv4();
    const derivedProof = await zkpService.deriveProofBBS(
        signedCredential,
        ["credentialSubject.name", "credentialSubject.jobTitle"],
        nonce
    );
    console.log("Derived Proof Type:", derivedProof.proof.type);

    // 5. Verify Proof (Verifier)
    console.log("\n5. Verifying Proof...");

    // NOTE: in the demo we pass the full derivedProof (VP)
    // The service extracts the proof and verifies it using the embedded key reference
    // In a real scenario, we might need to resolve the issuer key from the DID
    const verificationResult = await zkpService.verifyProofBBS(derivedProof, null);

    console.log("Verification Result:", verificationResult);

    if (verificationResult.verified) {
        console.log("\nSUCCESS: Proof Verified!");

        // Check hidden attributes (Simulated check - visually inspect credentialSubject)
        const visibleKeys = Object.keys(derivedProof.credentialSubject);
        console.log("Visible Attributes:", visibleKeys);

        if (!visibleKeys.includes('birthDate') && !visibleKeys.includes('email')) {
            console.log("CONFIRMED: BirthDate and Email are HIDDEN.");
        } else {
            console.log("WARNING: Hidden attributes leaked!");
        }
    } else {
        console.log("\nFAILURE: Verification Failed:", verificationResult.error);
    }
}

// Run the demo
runDemo().catch(console.error);
