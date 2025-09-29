# sign_vc_ldp.py
import json
import uuid
import hashlib
from datetime import datetime, timezone
from ecdsa import SigningKey, SECP256k1
import base64

# --- Konfigurasi Issuer (tetap, tidak perlu diubah) ---
issuer_private_key_hex = '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6'
issuer_did = 'did:example:issuer123'
verification_method = f"{issuer_did}#keys-1"


# Skrip akan berhenti dan meminta Anda memasukkan data ini
print("--- Silakan masukkan detail dari permintaan yang diambil dari API ---")
holder_did = input("Masukkan Holder DID: ")
holder_nama = input("Masukkan Nama Holder: ")
holder_nim = input("Masukkan NIM Holder: ")
# ----------------------------------------------------

def create_ldp_vc():
    print("\n📝 Membuat LDP-VC Ijazah untuk:")
    print(f"   Holder: {holder_nama} ({holder_nim})")
    print(f"   Issuer: {issuer_did}")

    # 1. Buat 'proof' options (tanpa signature)
    proof_options = {
        "type": "EcdsaSecp256k1Signature2019",
        "created": datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        "verificationMethod": verification_method,
        "proofPurpose": "assertionMethod"
    }

    # 2. Buat credential (tanpa 'proof') menggunakan data input
    credential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        "id": f"urn:uuid:{uuid.uuid4()}",
        "type": ["VerifiableCredential", "UniversityDegreeCredential"],
        "issuer": issuer_did,
        "issuanceDate": proof_options["created"],
        "credentialSubject": { "id": holder_did, "nama": holder_nama, "nim": holder_nim }
    }

    # 3. Buat data untuk di-sign (proses kanonisasi sederhana)
    proof_hash = hashlib.sha256(json.dumps(proof_options, sort_keys=True, separators=(',', ':')).encode('utf-8')).digest()
    credential_hash = hashlib.sha256(json.dumps(credential, sort_keys=True, separators=(',', ':')).encode('utf-8')).digest()
    data_to_sign = proof_hash + credential_hash

    # 4. Sign hash tersebut menggunakan kunci privat
    sk = SigningKey.from_string(bytes.fromhex(issuer_private_key_hex[2:]), curve=SECP256k1)
    signature_bytes = sk.sign(data_to_sign)
    
    # 5. Tambahkan signature ke dalam 'proof' dan gabungkan dengan credential
    proof_options["proofValue"] = base64.b64encode(signature_bytes).decode('utf-8')
    signed_vc = credential.copy()
    signed_vc["proof"] = proof_options

    print('\n✅ LDP-VC Berhasil Dibuat dan Ditandatangani!')
    print('----------------------------------------------------')
    print('Output JSON-LD dengan objek "proof":')
    print('----------------------------------------------------')
    print(json.dumps(signed_vc, indent=2))

if __name__ == "__main__":
    create_ldp_vc()