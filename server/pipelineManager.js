import {
  executeZeroDownloadPipeline,
  generateClipMetadata
} from "./services/clipPipeline.js";
import { enqueueStreamCooldownTask } from "./services/cloudTasksService.js";
class PipelineManager {
  activeJobs = /* @__PURE__ */ new Map();
  /**
   * Initializes a new post-stream processing pipeline job
   */
  async handleStreamOffline(params) {
    const jobId = `job_${params.userId}_${Date.now()}`;
    const job = {
      id: jobId,
      userId: params.userId,
      channelName: params.channelName,
      status: "QUEUED",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      cooldownSecondsRemaining: 300
    };
    this.activeJobs.set(jobId, job);
    try {
      const payload = {
        broadcasterId: params.broadcasterId,
        broadcasterName: params.channelName,
        streamEndedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await enqueueStreamCooldownTask(payload, async () => {
        console.log(`[PipelineManager] Fallback cooldown expired for ${params.channelName}`);
      });
    } catch (err) {
      console.warn("[PipelineManager] Cloud Tasks enqueue notice (falling back to in-memory timer):", err);
    }
    return {
      jobId,
      status: "QUEUED",
      cooldownSeconds: 300
    };
  }
  /**
   * Analyzes a twitch stream segment / clip using the @google/genai SDK
   */
  async generateClipMetadata(clip) {
    return generateClipMetadata(clip);
  }
  /**
   * Processes a detected clip through the Zero-Storage ephemeral pipeline,
   * automatically triggering AI metadata analysis and multi-platform payload preparation.
   */
  async processClip(clip, caption) {
    const result = await executeZeroDownloadPipeline(clip, caption);
    return result;
  }
  /**
   * Retrieves current job status
   */
  getJobStatus(jobId) {
    return this.activeJobs.get(jobId) || null;
  }
  /**
   * Lists all active or recent pipeline jobs
   */
  listRecentJobs() {
    return Array.from(this.activeJobs.values()).slice(-20);
  }
}
const pipelineManager = new PipelineManager();
export {
  PipelineManager,
  executeZeroDownloadPipeline,
  generateClipMetadata,
  pipelineManager
};
