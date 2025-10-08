import { Request, Response } from 'express';
import { rabbitmqService } from '../services/rabbitmq.service';
import { v4 as uuidv4 } from 'uuid';

export interface VCRequestData {
  issuer_did: string;
  holder_did: string;
  credential_type: string;
  credential_data: any;
  requested_at?: Date;
}

export interface VCIssuanceData {
  holder_did: string;
  issuer_did: string;
  credential_type: string;
  credential: any;
  issued_at?: Date;
  request_id?: string;  // To link back to original request
  _replyTo?: string;    // Reply queue from request
  _correlationId?: string;  // Correlation ID from request
}

/**
 * Controller untuk membuat VC Request dan mengirimnya ke RabbitMQ
 * Menggunakan Direct Reply-to pattern: membuat reply queue unik
 */
export const createVCRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestData: VCRequestData = req.body;
    
    // Validasi data yang diperlukan
    if (!requestData.issuer_did) {
      res.status(400).json({
        success: false,
        error: 'issuer_did is required'
      });
      return;
    }

    if (!requestData.holder_did) {
      res.status(400).json({
        success: false,
        error: 'holder_did is required'
      });
      return;
    }

    if (!requestData.credential_type) {
      res.status(400).json({
        success: false,
        error: 'credential_type is required'
      });
      return;
    }

    // Generate unique IDs for Direct Reply-to pattern
    const correlationId = uuidv4();
    const replyToQueue = `reply.${requestData.holder_did}.${Date.now()}`;

    // Tambahkan metadata
    const vcRequest = {
      ...requestData,
      request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requested_at: new Date(),
      status: 'pending'
    };

    // Kirim ke RabbitMQ dengan replyTo dan correlationId
    await rabbitmqService.sendVCRequest(
      requestData.issuer_did,
      vcRequest,
      replyToQueue,
      correlationId
    );

    console.log(`📋 VC Request created with Direct Reply-to:`, {
      request_id: vcRequest.request_id,
      issuer_did: vcRequest.issuer_did,
      holder_did: vcRequest.holder_did,
      credential_type: vcRequest.credential_type,
      replyTo: replyToQueue,
      correlationId
    });

    res.status(201).json({
      success: true,
      message: 'VC Request submitted successfully using Direct Reply-to pattern.',
      data: {
        request_id: vcRequest.request_id,
        issuer_did: vcRequest.issuer_did,
        holder_did: vcRequest.holder_did,
        credential_type: vcRequest.credential_type,
        requested_at: vcRequest.requested_at,
        status: vcRequest.status,
        replyTo: replyToQueue,
        correlationId,
        note: 'Response will be sent directly to reply queue'
      }
    });

  } catch (error) {
    console.error('❌ Error creating VC Request:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to create VC Request',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

/**
 * Controller untuk issuer melihat semua VC requests yang masuk ke mereka
 * Messages are CONSUMED and DELETED permanently
 * Includes reply metadata (_replyTo, _correlationId) for sending responses
 */
export const getVCRequestsByIssuer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { issuer_did } = req.query;
    
    if (!issuer_did || typeof issuer_did !== 'string') {
      res.status(400).json({
        success: false,
        error: 'issuer_did query parameter is required'
      });
      return;
    }

    console.log(`🔍 Fetching VC requests for issuer: ${issuer_did}`);

    // Get messages from RabbitMQ - THEY WILL BE DELETED
    // Each message includes _replyTo and _correlationId for Direct Reply-to
    const requests = await rabbitmqService.getVCRequestsByIssuer(issuer_did);

    res.status(200).json({
      success: true,
      message: requests.length > 0 
        ? 'Requests retrieved and deleted from queue' 
        : 'No pending requests found',
      data: {
        issuer_did: issuer_did,
        total_requests: requests.length,
        requests: requests,
        note: requests.length > 0 
          ? 'These requests have been PERMANENTLY DELETED from the queue. Use _replyTo and _correlationId to send responses.' 
          : undefined
      }
    });

  } catch (error) {
    console.error('❌ Error fetching VC Requests:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch VC Requests',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

/**
 * Controller untuk issuer mengeluarkan/issue VC menggunakan Direct Reply-to
 * Issuer must provide _replyTo and _correlationId from the original request
 */
export const createVCIssuance = async (req: Request, res: Response): Promise<void> => {
  try {
    const issuanceData: VCIssuanceData = req.body;
    
    // Validasi data yang diperlukan
    if (!issuanceData.holder_did) {
      res.status(400).json({
        success: false,
        error: 'holder_did is required'
      });
      return;
    }

    if (!issuanceData.issuer_did) {
      res.status(400).json({
        success: false,
        error: 'issuer_did is required'
      });
      return;
    }

    if (!issuanceData.credential) {
      res.status(400).json({
        success: false,
        error: 'credential is required'
      });
      return;
    }

    // Validasi Direct Reply-to metadata
    if (!issuanceData._replyTo) {
      res.status(400).json({
        success: false,
        error: '_replyTo is required for Direct Reply-to pattern. Get it from the request.'
      });
      return;
    }

    if (!issuanceData._correlationId) {
      res.status(400).json({
        success: false,
        error: '_correlationId is required for Direct Reply-to pattern. Get it from the request.'
      });
      return;
    }

    // Tambahkan metadata
    const vcIssuance = {
      ...issuanceData,
      issuance_id: `iss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      issued_at: new Date(),
      status: 'issued'
    };

    // Remove internal metadata before sending
    const { _replyTo, _correlationId, ...cleanIssuance } = vcIssuance;

    // Kirim menggunakan Direct Reply-to
    await rabbitmqService.sendVCIssuance(
      _replyTo,
      _correlationId,
      cleanIssuance
    );

    console.log(`✅ VC Issued via Direct Reply-to:`, {
      issuance_id: vcIssuance.issuance_id,
      issuer_did: vcIssuance.issuer_did,
      holder_did: vcIssuance.holder_did,
      credential_type: vcIssuance.credential_type,
      replyTo: _replyTo,
      correlationId: _correlationId
    });

    res.status(201).json({
      success: true,
      message: 'VC issued successfully via Direct Reply-to pattern.',
      data: {
        issuance_id: vcIssuance.issuance_id,
        issuer_did: vcIssuance.issuer_did,
        holder_did: vcIssuance.holder_did,
        credential_type: vcIssuance.credential_type,
        issued_at: vcIssuance.issued_at,
        status: vcIssuance.status,
        note: 'Response sent directly to holder reply queue'
      }
    });

  } catch (error) {
    console.error('❌ Error issuing VC:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to issue VC',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

/**
 * NEW: Controller untuk holder menunggu response menggunakan Direct Reply-to
 * Holder provides replyTo queue and correlationId to wait for response
 */
export const waitForVCIssuance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { replyTo, correlationId, timeout } = req.query;
    
    if (!replyTo || typeof replyTo !== 'string') {
      res.status(400).json({
        success: false,
        error: 'replyTo query parameter is required'
      });
      return;
    }

    if (!correlationId || typeof correlationId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'correlationId query parameter is required'
      });
      return;
    }

    const timeoutMs = timeout ? parseInt(timeout as string) : 30000;

    console.log(`⏳ Waiting for VC issuance response:`, {
      replyTo,
      correlationId,
      timeout: timeoutMs
    });

    // Wait for reply with timeout
    const response = await rabbitmqService.waitForReply(
      replyTo,
      correlationId,
      timeoutMs
    );

    res.status(200).json({
      success: true,
      message: 'VC issuance received successfully',
      data: response
    });

  } catch (error) {
    console.error('❌ Error waiting for VC Issuance:', error);
    
    if (error instanceof Error && error.message.includes('Timeout')) {
      res.status(408).json({
        success: false,
        error: 'Request timeout',
        message: 'No response received within timeout period'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to wait for VC Issuance',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }
};
