const { Bls12381G2KeyPair } = require("@mattrglobal/bls12381-key-pair");

console.log("Static methods:", Object.getOwnPropertyNames(Bls12381G2KeyPair));
console.log("fromFingerprint exists?", typeof Bls12381G2KeyPair.fromFingerprint);

(async () => {
    try {
        const key = await Bls12381G2KeyPair.generate();
        const fp = await key.fingerprint();
        console.log("Generated fingerprint:", fp);

        const importedKey = await Bls12381G2KeyPair.fromFingerprint({ fingerprint: fp });
        console.log("Imported key keys:", Object.keys(importedKey));
        console.log("Imported key publicKeyBuffer:", importedKey.publicKeyBuffer);

        const originalHex = key.publicKeyBuffer.toString('hex');
        const importedHex = importedKey.publicKeyBuffer.toString('hex');
        console.log("Keys match?", originalHex === importedHex);
        if (originalHex !== importedHex) {
            console.log("Original:", originalHex);
            console.log("Imported:", importedHex);
        }
    } catch (e) {
        console.error(e);
    }
})();
