import { rabbitmqService } from './rabbitmq.service';

interface ScheduledDeletion {
  holderDid: string;
  scheduledAt: number;
  deleteAt: number;
}

class DelayedDeletionService {
  private static instance: DelayedDeletionService;
  private scheduledDeletions: Map<string, ScheduledDeletion> = new Map();
  private checkIntervalMs: number = 60000; // Check every 1 minute
  private deletionDelayMs: number = 5 * 60 * 1000; // 5 minutes
  private intervalTimer?: NodeJS.Timeout;

  private constructor() {}

  public static getInstance(): DelayedDeletionService {
    if (!DelayedDeletionService.instance) {
      DelayedDeletionService.instance = new DelayedDeletionService();
    }
    return DelayedDeletionService.instance;
  }

  /**
   * Start the delayed deletion service
   */
  public start(): void {
    if (this.intervalTimer) {
      console.log('⚠️  Delayed deletion service already running');
      return;
    }

    console.log('🚀 Starting Delayed Deletion Service...');
    console.log(`   ⏰ Deletion delay: ${this.deletionDelayMs / 60000} minutes`);
    console.log(`   🔍 Check interval: ${this.checkIntervalMs / 1000} seconds`);

    this.intervalTimer = setInterval(() => {
      this.checkAndDelete();
    }, this.checkIntervalMs);

    console.log('✅ Delayed Deletion Service started');
  }

  /**
   * Stop the service
   */
  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
      this.scheduledDeletions.clear();
      console.log('🛑 Delayed Deletion Service stopped');
    }
  }

  /**
   * Schedule deletion for a holder's credentials
   * Called when holder successfully retrieves VCs (GET /api/issuances)
   * 
   * Behavior: Timer does NOT reset if already scheduled
   */
  public scheduleHolderDeletion(holderDid: string): void {
    const now = Date.now();
    
    // Check if already scheduled
    const existing = this.scheduledDeletions.get(holderDid);
    
    if (existing) {
      const remainingSeconds = Math.round((existing.deleteAt - now) / 1000);
      console.log(`⏰ Deletion already scheduled for holder: ${holderDid}`);
      console.log(`   Will be deleted in: ${remainingSeconds} seconds`);
      console.log(`   Original schedule time: ${new Date(existing.scheduledAt).toISOString()}`);
      return; // Don't reset timer
    }
    
    // Schedule new deletion
    const deleteAt = now + this.deletionDelayMs;

    this.scheduledDeletions.set(holderDid, {
      holderDid,
      scheduledAt: now,
      deleteAt
    });

    console.log(`📅 Scheduled deletion for holder: ${holderDid}`);
    console.log(`   Delete at: ${new Date(deleteAt).toISOString()}`);
    console.log(`   Currently tracking: ${this.scheduledDeletions.size} holders`);
  }

  /**
   * Check and execute scheduled deletions
   */
  private async checkAndDelete(): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];

    // Find holders whose deletion time has passed
    for (const [holderDid, scheduled] of this.scheduledDeletions.entries()) {
      if (now >= scheduled.deleteAt) {
        toDelete.push(holderDid);
      }
    }

    if (toDelete.length === 0) {
      console.log(`🔍 Delayed deletion check: No deletions needed (tracking ${this.scheduledDeletions.size} holders)`);
      return;
    }

    console.log(`🗑️  Processing ${toDelete.length} scheduled deletion(s)...`);

    // Delete credentials for each holder
    for (const holderDid of toDelete) {
      try {
        await this.deleteHolderCredentials(holderDid);
        this.scheduledDeletions.delete(holderDid);
        console.log(`✅ Deleted credentials for holder: ${holderDid}`);
      } catch (error) {
        console.error(`❌ Failed to delete credentials for ${holderDid}:`, error);
        // Remove from schedule anyway to avoid repeated failures
        this.scheduledDeletions.delete(holderDid);
      }
    }

    console.log(`✅ Deletion complete. Still tracking: ${this.scheduledDeletions.size} holders`);
  }

  /**
   * Delete all credentials for a specific holder
   * This purges the entire queue for this holder
   */
  private async deleteHolderCredentials(holderDid: string): Promise<void> {
    try {
      // Get the queue name
      const queueName = `vc.issuances.${holderDid}`;

      // Purge the queue (delete all messages)
      const channel = await rabbitmqService.getChannel();
      const purgeResult = await channel.purgeQueue(queueName);

      console.log(`🧹 Purged queue: ${queueName}`);
      console.log(`   Messages deleted: ${purgeResult.messageCount}`);
    } catch (error) {
      console.error(`❌ Error purging queue for holder ${holderDid}:`, error);
      throw error;
    }
  }

  /**
   * Get current status
   */
  public getStatus(): {
    isRunning: boolean;
    scheduledCount: number;
    deletionDelayMinutes: number;
    checkIntervalSeconds: number;
    scheduledDeletions: Array<{
      holderDid: string;
      deleteIn: string;
    }>;
  } {
    const now = Date.now();
    const scheduled = Array.from(this.scheduledDeletions.values()).map(s => ({
      holderDid: s.holderDid,
      deleteIn: `${Math.round((s.deleteAt - now) / 1000)} seconds`
    }));

    return {
      isRunning: this.intervalTimer !== undefined,
      scheduledCount: this.scheduledDeletions.size,
      deletionDelayMinutes: this.deletionDelayMs / 60000,
      checkIntervalSeconds: this.checkIntervalMs / 1000,
      scheduledDeletions: scheduled
    };
  }

  /**
   * Cancel scheduled deletion (for testing or if holder retrieves again)
   */
  public cancelDeletion(holderDid: string): boolean {
    const existed = this.scheduledDeletions.has(holderDid);
    this.scheduledDeletions.delete(holderDid);
    
    if (existed) {
      console.log(`❌ Cancelled deletion for holder: ${holderDid}`);
    }
    
    return existed;
  }

  /**
   * Manually trigger deletion check (for testing)
   */
  public async triggerCheck(): Promise<void> {
    console.log('🔧 Manual deletion check triggered');
    await this.checkAndDelete();
  }
}

export const delayedDeletionService = DelayedDeletionService.getInstance();
export default delayedDeletionService;
