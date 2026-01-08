import crypto from 'crypto';

export class PaymentSignatureUtil {
    constructor() {}

    /**
     * Function for encoding (base64) value of hashed (SHA-256) JSON body
     * 
     * (NON SNAP)
    */
    async generateDigest(body: any): Promise<string> {
        const bodyString = JSON.stringify(body);
        const hash = crypto.createHash('sha256').update(bodyString).digest('base64');
        return hash;
    }

    /**
     * Security parameter that needs to be generated on merchant Backend 
     * and placed to the header request to ensure that the request 
     * is coming from valid merchant.
     * 
     * (NON SNAP)
    */
    async geneateSignatureNonSnap(
        clientId: string, 
        requestId: string,
        requestTimestamp: string,
        requestTarget: string,
        digest: string,
        secretKey: string
    ): Promise<string> {
        const componentString = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${requestTimestamp}\nRequest-Target:${requestTarget}\nDigest:${digest}`;
        const signature = crypto.createHmac('sha256', secretKey).update(componentString).digest('base64');
        return `HMACSHA256=${signature}`;
    }
}

const paymentSignatureUtilInstance = new PaymentSignatureUtil();
export default paymentSignatureUtilInstance;

