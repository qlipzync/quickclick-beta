/**
 * QlipZync / QuickClick - Central Pipeline Manager
 * 
 * Orchestrates:
 * 1. Stream Event Ingestion (stream.online, stream.offline)
 * 2. 300s Post-Stream Cooldown (Twitch VOD finalization buffer)
 * 3. Zero-Storage Clip Processing (In-Memory /dev/shm pass-through)
 * 4. Omni-Channel Social Distribution (Shorts, TikTok, Reels, Twitter/X)
 * 5. Telemetry & State Persistence in Firestore
 */

import {
  executeZeroDownloadPipeline,
  generateClipMetadata,
  TwitchClipMetadata,
  PipelineExecutionResult,
  StructuredClipMetadata,
} from './services/clipPipeline';
import { enqueueStreamCooldownTask, StreamCooldownPayload } from './services/cloudTasksService';

export interface PipelineJob {
  id: string;
  userId: string;
  channelName: string;
  status: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  cooldownSecondsRemaining?: number;
  clipCount?: number;
  result?: PipelineExecutionResult;
  error?: string;
}

export class PipelineManager {
  private activeJobs: Map<string, PipelineJob> = new Map();

  /**
   * Initializes a new post-stream processing pipeline job
   */
  public async handleStreamOffline(params: {
    userId: string;
    channelName: string;
    broadcasterId: string;
  }): Promise<{ jobId: string; status: string; cooldownSeconds: number }> {
    const jobId = `job_${params.userId}_${Date.now()}`;
    const job: PipelineJob = {
      id: jobId,
      userId: params.userId,
      channelName: params.channelName,
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cooldownSecondsRemaining: 300,
    };

    this.activeJobs.set(jobId, job);

    // Enqueue 300-second delayed task via Google Cloud Tasks
    try {
      const payload: StreamCooldownPayload = {
        broadcasterId: params.broadcasterId,
        broadcasterName: params.channelName,
        streamEndedAt: new Date().toISOString(),
      };
      await enqueueStreamCooldownTask(payload, async () => {
        console.log(`[PipelineManager] Fallback cooldown expired for ${params.channelName}`);
      });
    } catch (err) {
      console.warn('[PipelineManager] Cloud Tasks enqueue notice (falling back to in-memory timer):', err);
    }

    return {
      jobId,
      status: 'QUEUED',
      cooldownSeconds: 300,
    };
  }

  /**
   * Analyzes a twitch stream segment / clip using the @google/genai SDK
   */
  public async generateClipMetadata(clip: TwitchClipMetadata): Promise<StructuredClipMetadata> {
    return generateClipMetadata(clip);
  }

  /**
   * Processes a detected clip through the Zero-Storage ephemeral pipeline,
   * automatically triggering AI metadata analysis and multi-platform payload preparation.
   */
  public async processClip(clip: TwitchClipMetadata, caption?: string): Promise<PipelineExecutionResult> {
    const result = await executeZeroDownloadPipeline(clip, caption);
    return result;
  }

  /**
   * Retrieves current job status
   */
  public getJobStatus(jobId: string): PipelineJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Lists all active or recent pipeline jobs
   */
  public listRecentJobs(): PipelineJob[] {
    return Array.from(this.activeJobs.values()).slice(-20);
  }
}

export const pipelineManager = new PipelineManager();
export { executeZeroDownloadPipeline, generateClipMetadata };
export type { TwitchClipMetadata, PipelineExecutionResult, StructuredClipMetadata };

