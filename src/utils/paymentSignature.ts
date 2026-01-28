import crypto from 'crypto';

export interface DokuWebhookHeaders {
    clientId: string;
    requestId: string;
    requestTimestamp: string;
    signature: string;
}

export interface SignatureVerificationResult {
    isValid: boolean;
    message: string;
    expectedSignature?: string;
    receivedSignature?: string;
}

export class PaymentSignatureUtil {
    constructor() {}

    /**
     * Function for encoding (base64) value of hashed (SHA-256) JSON body
     * (NON SNAP)
     * @param body - Raw body string or object (if object, will be JSON.stringify'd)
     */
    async generateDigest(body: string | object): Promise<string> {
        const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
        const hash = crypto.createHash('sha256').update(bodyString).digest('base64');
        return hash;
    }

    /**
     * Security parameter that needs to be generated on merchant Backend
     * and placed to the header request to ensure that the request
     * is coming from valid merchant.
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

    /**
     * Verify DOKU webhook signature (Notification from DOKU)
     * DOKU sends notification with HMAC-SHA256 signature in header
     *
     * Signature component string format:
     * Client-Id:{clientId}\nRequest-Id:{requestId}\nRequest-Timestamp:{timestamp}\nRequest-Target:{target}\nDigest:{digest}
     *
     * @param headers - DOKU webhook headers
     * @param rawBody - Raw body string (must be the original body, not parsed then stringified)
     * @param requestTarget - Request path (e.g., /api/v1/payment/transfer-va/notification)
     * @param secretKey - DOKU secret key
     */
    async verifyWebhookSignature(
        headers: DokuWebhookHeaders,
        rawBody: string,
        requestTarget: string,
        secretKey: string
    ): Promise<SignatureVerificationResult> {
        try {
            // 1. Validate required headers
            if (!headers.clientId || !headers.requestId || !headers.requestTimestamp || !headers.signature) {
                return {
                    isValid: false,
                    message: 'Missing required headers for signature verification'
                };
            }

            // 2. Validate Client-Id matches our configured client
            const configuredClientId = process.env.DOKU_CLIENT_ID;
            if (headers.clientId !== configuredClientId) {
                return {
                    isValid: false,
                    message: `Client-Id mismatch. Expected: ${configuredClientId}, Received: ${headers.clientId}`
                };
            }

            // 3. Validate timestamp is not too old (prevent replay attacks)
            const timestampValidation = this.validateTimestamp(headers.requestTimestamp);
            if (!timestampValidation.isValid) {
                return {
                    isValid: false,
                    message: timestampValidation.message
                };
            }

            // 4. Generate digest from raw body (exactly as received)
            const digest = await this.generateDigest(rawBody);

            // 5. Build component string (same format as DOKU)
            const componentString = `Client-Id:${headers.clientId}\nRequest-Id:${headers.requestId}\nRequest-Timestamp:${headers.requestTimestamp}\nRequest-Target:${requestTarget}\nDigest:${digest}`;

            // 6. Generate expected signature
            const expectedSignatureHash = crypto
                .createHmac('sha256', secretKey)
                .update(componentString)
                .digest('base64');
            const expectedSignature = `HMACSHA256=${expectedSignatureHash}`;

            // 7. Compare signatures (constant-time comparison to prevent timing attacks)
            const receivedSignature = headers.signature;
            const isValid = this.secureCompare(expectedSignature, receivedSignature);

            if (!isValid) {
                // Include debug info in non-production environments
                const debugInfo = process.env.NODE_ENV !== 'production' ? {
                    componentString: componentString,
                    digest: digest,
                    requestTarget: requestTarget,
                    rawBodyLength: rawBody.length,
                    rawBodyPreview: rawBody.substring(0, 100) + '...'
                } : undefined;

                return {
                    isValid: false,
                    message: 'Signature verification failed',
                    expectedSignature: expectedSignature,
                    receivedSignature: receivedSignature,
                    ...debugInfo && { debug: debugInfo }
                };
            }

            return {
                isValid: true,
                message: 'Signature verified successfully'
            };

        } catch (error: any) {
            return {
                isValid: false,
                message: `Signature verification error: ${error.message}`
            };
        }
    }

    /**
     * Validate request timestamp to prevent replay attacks
     * Timestamp should be within acceptable window (default: 5 minutes)
     */
    private validateTimestamp(timestamp: string, maxAgeMinutes: number = 5): { isValid: boolean; message: string } {
        try {
            const requestTime = new Date(timestamp).getTime();
            const currentTime = Date.now();
            const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds

            if (isNaN(requestTime)) {
                return {
                    isValid: false,
                    message: 'Invalid timestamp format'
                };
            }

            const timeDiff = Math.abs(currentTime - requestTime);

            if (timeDiff > maxAge) {
                return {
                    isValid: false,
                    message: `Timestamp expired. Request time: ${timestamp}, Current time: ${new Date().toISOString()}, Diff: ${Math.floor(timeDiff / 1000)}s (max: ${maxAgeMinutes * 60}s)`
                };
            }

            return {
                isValid: true,
                message: 'Timestamp is valid'
            };

        } catch (error: any) {
            return {
                isValid: false,
                message: `Timestamp validation error: ${error.message}`
            };
        }
    }

    /**
     * Constant-time string comparison to prevent timing attacks
     */
    private secureCompare(a: string, b: string): boolean {
        if (a.length !== b.length) {
            return false;
        }

        try {
            return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
        } catch {
            return false;
        }
    }

    /**
     * Validate DOKU notification body structure
     * Ensures required fields are present
     */
    validateNotificationBody(body: any): { isValid: boolean; message: string; missingFields?: string[] } {
        const requiredFields = [
            'service.id',
            'transaction.status',
            'transaction.date',
            'order.invoice_number',
            'order.amount'
        ];

        const missingFields: string[] = [];

        for (const field of requiredFields) {
            const parts = field.split('.');
            let value: any = body;

            for (const part of parts) {
                if (value === undefined || value === null) {
                    missingFields.push(field);
                    break;
                }
                value = value[part];
            }

            if (value === undefined || value === null) {
                if (!missingFields.includes(field)) {
                    missingFields.push(field);
                }
            }
        }

        if (missingFields.length > 0) {
            return {
                isValid: false,
                message: `Missing required fields: ${missingFields.join(', ')}`,
                missingFields
            };
        }

        return {
            isValid: true,
            message: 'Notification body is valid'
        };
    }
}

const paymentSignatureUtilInstance = new PaymentSignatureUtil();
export default paymentSignatureUtilInstance;

