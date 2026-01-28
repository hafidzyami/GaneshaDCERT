/**
 * VC Cleanup Scheduler
 *
 * Background job that periodically resets VCs stuck in PROCESSING status
 * back to PENDING if they exceed the timeout threshold (default 15 minutes)
 *
 * Schedule: Runs every 5 minutes
 * Timeout: Resets VCs that have been PROCESSING for >15 minutes
 */

import cron from "node-cron";
import CredentialService from "../services/credential.service";
import logger from "../config/logger";

/**
 * Schedule the VC cleanup job
 * Runs every 5 minutes (cron: star-slash-5 star star star star)
 */
export const scheduleVCCleanup = () => {
  // Run every 5 minutes
  const cronExpression = "*/5 * * * *";

  const task = cron.schedule(cronExpression, async () => {
    try {
      logger.info("[Scheduler] Starting VC cleanup job");
      const result = await CredentialService.resetStuckProcessingVCs(15); // 15 minute timeout

      if (result.total_reset_count > 0) {
        logger.warn(
          `[Scheduler] VC cleanup completed: ${result.total_reset_count} total VCs reset to PENDING (${result.vc_response_reset_count} from VCResponse, ${result.vc_initiated_reset_count} from VCinitiatedByIssuer)`
        );
      } else {
        logger.info("[Scheduler] VC cleanup completed: no stuck VCs found");
      }
    } catch (error) {
      logger.error(`[Scheduler] VC cleanup job failed: ${error}`);
    }
  });

  // Start the task
  task.start();

  logger.info(
    `[Scheduler] VC cleanup job scheduled: ${cronExpression} (every 5 minutes)`
  );

  return task;
};

/**
 * Run cleanup job immediately (for testing or manual trigger)
 */
export const runVCCleanupNow = async () => {
  logger.info("[Scheduler] Running VC cleanup job manually");
  try {
    const result = await CredentialService.resetStuckProcessingVCs(15);
    return result;
  } catch (error) {
    logger.error(`[Scheduler] Manual VC cleanup failed: ${error}`);
    throw error;
  }
};
