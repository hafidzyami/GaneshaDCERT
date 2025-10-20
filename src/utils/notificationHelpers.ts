import { sendVCStatusNotification } from '../controllers/notificationController';

/**
 * Helper functions to send notifications for various VC events
 */

export const notifyVCApproved = async (
  holder_did: string,
  vcType: string,
  vcId: string
) => {
  await sendVCStatusNotification(
    holder_did,
    'Credential Approved ✅',
    `Your ${vcType} credential has been approved and is now available in your wallet.`,
    {
      type: 'VC_APPROVED',
      vcId,
      vcType,
      timestamp: new Date().toISOString(),
    }
  );
};

export const notifyVCRejected = async (
  holder_did: string,
  vcType: string,
  reason?: string
) => {
  await sendVCStatusNotification(
    holder_did,
    'Credential Request Rejected ❌',
    `Your ${vcType} credential request has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
    {
      type: 'VC_REJECTED',
      vcType,
      reason,
      timestamp: new Date().toISOString(),
    }
  );
};

export const notifyVCRevoked = async (
  holder_did: string,
  vcType: string,
  vcId: string,
  reason?: string
) => {
  await sendVCStatusNotification(
    holder_did,
    'Credential Revoked 🚫',
    `Your ${vcType} credential has been revoked.${reason ? ` Reason: ${reason}` : ''}`,
    {
      type: 'VC_REVOKED',
      vcId,
      vcType,
      reason,
      timestamp: new Date().toISOString(),
    }
  );
};

export const notifyVCRenewed = async (
  holder_did: string,
  vcType: string,
  vcId: string
) => {
  await sendVCStatusNotification(
    holder_did,
    'Credential Renewed 🔄',
    `Your ${vcType} credential has been successfully renewed.`,
    {
      type: 'VC_RENEWED',
      vcId,
      vcType,
      timestamp: new Date().toISOString(),
    }
  );
};

export const notifyVCUpdated = async (
  holder_did: string,
  vcType: string,
  vcId: string
) => {
  await sendVCStatusNotification(
    holder_did,
    'Credential Updated 📝',
    `Your ${vcType} credential has been updated with new information.`,
    {
      type: 'VC_UPDATED',
      vcId,
      vcType,
      timestamp: new Date().toISOString(),
    }
  );
};

export const notifyVPRequested = async (
  holder_did: string,
  verifierName: string,
  requestedCredentials: string[]
) => {
  await sendVCStatusNotification(
    holder_did,
    'Presentation Request 📋',
    `${verifierName} has requested verification of your credentials.`,
    {
      type: 'VP_REQUESTED',
      verifierName,
      requestedCredentials,
      timestamp: new Date().toISOString(),
    }
  );
};
