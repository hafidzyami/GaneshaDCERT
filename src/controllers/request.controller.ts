import { Request, Response } from 'express';
import { kafkaService } from '../services/kafka.service';
import { KAFKA_TOPICS } from '../config/kafka.config';

export interface VCRequestData {
  issuer_did: string;  // Changed from issuer_id to issuer_did
  holder_did: string;  // Changed from holder_id to holder_did
  credential_type: string;
  credential_data: any;
  requested_at?: Date;
}

export interface VCIssuanceData {
  holder_did: string;
  issuer_did: string;
  credential_type: string;
  credential: any;  // The actual VC
  issued_at?: Date;
}

/**
 * Controller untuk membuat VC Request dan mengirimnya ke Kafka
 * Key: issuer_did (agar issuer bisa query requests mereka)
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

    // Kirim ke Kafka menggunakan issuer_did sebagai key
    // Ini akan masuk ke partition berdasarkan issuer_did
    await kafkaService.sendMessage(
      KAFKA_TOPICS.VC_REQUESTS, 
      requestData.issuer_did,  // Key = issuer_did
      vcRequest
    );

    console.log(`📋 VC Request created:`, {
      request_id: vcRequest.request_id,
      issuer_did: vcRequest.issuer_did,
      holder_did: vcRequest.holder_did,
      credential_type: vcRequest.credential_type,
      partition_key: requestData.issuer_did
    });

    res.status(201).json({
      success: true,
      message: 'VC Request submitted successfully to issuer partition',
      data: {
        request_id: vcRequest.request_id,
        issuer_did: vcRequest.issuer_did,
        holder_did: vcRequest.holder_did,
        credential_type: vcRequest.credential_type,
        requested_at: vcRequest.requested_at,
        status: vcRequest.status
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
 * Query dari partition berdasarkan issuer_did
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

    // Consume messages dari partition issuer ini
    const requests = await kafkaService.consumeMessagesByKey(
      KAFKA_TOPICS.VC_REQUESTS,
      issuer_did,
      10000 // timeout 10 seconds
    );

    res.status(200).json({
      success: true,
      data: {
        issuer_did: issuer_did,
        total_requests: requests.length,
        requests: requests
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
 * Key: holder_did (agar holder bisa query VCs mereka)
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

    // Kirim ke Kafka menggunakan holder_did sebagai key
    // Ini akan masuk ke partition berdasarkan holder_did
    await kafkaService.sendMessage(
      KAFKA_TOPICS.VC_ISSUANCES,
      issuanceData.holder_did,  // Key = holder_did
      vcIssuance
    );

    console.log(`✅ VC Issued:`, {
      issuance_id: vcIssuance.issuance_id,
      issuer_did: vcIssuance.issuer_did,
      holder_did: vcIssuance.holder_did,
      credential_type: vcIssuance.credential_type,
      partition_key: issuanceData.holder_did
    });

    res.status(201).json({
      success: true,
      message: 'VC issued successfully to holder partition',
      data: {
        issuance_id: vcIssuance.issuance_id,
        issuer_did: vcIssuance.issuer_did,
        holder_did: vcIssuance.holder_did,
        credential_type: vcIssuance.credential_type,
        issued_at: vcIssuance.issued_at,
        status: vcIssuance.status
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
 * Query dari partition berdasarkan holder_did
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

    // Consume messages dari partition holder ini
    const issuances = await kafkaService.consumeMessagesByKey(
      KAFKA_TOPICS.VC_ISSUANCES,
      holder_did,
      10000 // timeout 10 seconds
    );

    res.status(200).json({
      success: true,
      data: {
        holder_did: holder_did,
        total_credentials: issuances.length,
        credentials: issuances
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
