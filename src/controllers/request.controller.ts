import { Request, Response } from 'express';
import { rabbitmqService } from '../services/rabbitmq.service';
import { delayedDeletionService } from '../services/delayed-deletion.service';

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
}

/**
 * Controller untuk membuat VC Request dan mengirimnya ke RabbitMQ
 * Routing key: issuer_did (agar issuer bisa query requests mereka)
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

    // Tambahkan metadata
    const vcRequest = {
      ...requestData,
      request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requested_at: new Date(),
      status: 'pending'
    };

    // Kirim ke RabbitMQ
    await rabbitmqService.sendVCRequest(requestData.issuer_did, vcRequest);

    console.log(`📋 VC Request created:`, {
      request_id: vcRequest.request_id,
      issuer_did: vcRequest.issuer_did,
      holder_did: vcRequest.holder_did,
      credential_type: vcRequest.credential_type
    });

    res.status(201).json({
      success: true,
      message: 'VC Request submitted successfully. Stored in queue until issuer processes it.',
      data: {
        request_id: vcRequest.request_id,
        issuer_did: vcRequest.issuer_did,
        holder_did: vcRequest.holder_did,
        credential_type: vcRequest.credential_type,
        requested_at: vcRequest.requested_at,
        status: vcRequest.status,
        note: 'No TTL - Request stays in queue'
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
 * Messages are NOT deleted - they stay in queue
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

    // Get messages from RabbitMQ (NOT deleted, kept in queue)
    const requests = await rabbitmqService.getVCRequestsByIssuer(issuer_did);

    res.status(200).json({
      success: true,
      message: requests.length > 0 
        ? 'Requests retrieved (kept in queue)' 
        : 'No pending requests found',
      data: {
        issuer_did: issuer_did,
        total_requests: requests.length,
        requests: requests,
        note: 'These requests remain in the queue and can be fetched again'
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
 * Controller untuk issuer mengeluarkan/issue VC
 * Routing key: holder_did (agar holder bisa query VCs mereka)
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

    // Tambahkan metadata
    const vcIssuance = {
      ...issuanceData,
      issuance_id: `iss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      issued_at: new Date(),
      status: 'issued'
    };

    // Kirim ke RabbitMQ
    await rabbitmqService.sendVCIssuance(issuanceData.holder_did, vcIssuance);

    console.log(`✅ VC Issued:`, {
      issuance_id: vcIssuance.issuance_id,
      issuer_did: vcIssuance.issuer_did,
      holder_did: vcIssuance.holder_did,
      credential_type: vcIssuance.credential_type
    });

    res.status(201).json({
      success: true,
      message: 'VC issued successfully. Stored in queue until holder retrieves it.',
      data: {
        issuance_id: vcIssuance.issuance_id,
        issuer_did: vcIssuance.issuer_did,
        holder_did: vcIssuance.holder_did,
        credential_type: vcIssuance.credential_type,
        issued_at: vcIssuance.issued_at,
        status: vcIssuance.status,
        note: 'No TTL - Will be deleted 5 minutes after holder retrieves it'
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
 * Controller untuk holder melihat semua VCs yang diterbitkan untuk mereka
 * TRIGGERS 5-MINUTE DELETION TIMER after successful retrieval
 */
export const getVCIssuancesByHolder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { holder_did } = req.query;
    
    if (!holder_did || typeof holder_did !== 'string') {
      res.status(400).json({
        success: false,
        error: 'holder_did query parameter is required'
      });
      return;
    }

    console.log(`🔍 Fetching VCs for holder: ${holder_did}`);

    // Get messages from RabbitMQ (NOT deleted, kept in queue)
    const issuances = await rabbitmqService.getVCIssuancesByHolder(holder_did);

    // IMPORTANT: Schedule 5-minute deletion ONLY if messages found
    if (issuances.length > 0) {
      delayedDeletionService.scheduleHolderDeletion(holder_did);
      console.log(`⏰ 5-minute deletion timer started for holder: ${holder_did}`);
    }

    res.status(200).json({
      success: true,
      message: issuances.length > 0 
        ? '5-minute deletion timer started' 
        : 'No credentials found',
      data: {
        holder_did: holder_did,
        total_credentials: issuances.length,
        credentials: issuances,
        deletion_note: issuances.length > 0 
          ? 'These credentials will be automatically deleted after 5 minutes'
          : undefined
      }
    });

  } catch (error) {
    console.error('❌ Error fetching VC Issuances:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch VC Issuances',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};
