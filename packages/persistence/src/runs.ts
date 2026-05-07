/**
 * Run Store — Persistent workflow run history
 */

import { JsonFileStore } from './store.js';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'waiting-approval' | 'approved' | 'rejected';
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting-approval';

export interface RunStage {
  id: string;
  name: string;
  nodeType: string;
  status: StageStatus;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  result?: unknown;
  error?: string;
  logs: string[];
}

export interface ApprovalRecord {
  action: 'approved' | 'rejected';
  by: string;
  at: number;
  comment?: string;
}

export interface Run {
  id: string;
  workflowId: string;
  workflowName: string;
  status: RunStatus;
  stages: RunStage[];
  approvalHistory: ApprovalRecord[];
  artifacts: string[];  // artifact file paths
  error?: string;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  trigger: 'manual' | 'api' | 'auto';
}

export class RunStore {
  private store: JsonFileStore<Run>;

  constructor(baseDir?: string) {
    this.store = new JsonFileStore<Run>('runs.json', { baseDir });
  }

  create(id: string, workflowId: string, workflowName: string, trigger: Run['trigger'] = 'manual'): Run {
    const run: Run = {
      id,
      workflowId,
      workflowName,
      status: 'pending',
      stages: [],
      approvalHistory: [],
      artifacts: [],
      startedAt: Date.now(),
      trigger,
    };
    this.store.write(id, run);
    return run;
  }

  get(id: string): Run | undefined {
    return this.store.read(id);
  }

  list(): Run[] {
    return this.store.list().sort((a, b) => b.startedAt - a.startedAt);
  }

  update(id: string, patch: Partial<Run>): Run | undefined {
    return this.store.update(id, patch);
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  /** Update a specific stage within a run. */
  updateStage(runId: string, stageId: string, patch: Partial<RunStage>): Run | undefined {
    const run = this.store.read(runId);
    if (!run) return undefined;
    const stageIndex = run.stages.findIndex(s => s.id === stageId);
    if (stageIndex === -1) {
      // Add new stage
      run.stages.push({ id: stageId, name: stageId, nodeType: 'unknown', status: 'pending', logs: [], ...patch });
    } else {
      run.stages[stageIndex] = { ...run.stages[stageIndex], ...patch };
    }
    this.store.write(runId, run);
    return run;
  }

  /** Mark run as completed. */
  complete(runId: string, error?: string): Run | undefined {
    const run = this.store.read(runId);
    if (!run) return undefined;
    const now = Date.now();
    run.status = error ? 'failed' : 'completed';
    run.completedAt = now;
    run.duration = now - run.startedAt;
    if (error) run.error = error;
    this.store.write(runId, run);
    return run;
  }

  /** Add approval record. */
  addApproval(runId: string, approval: ApprovalRecord): Run | undefined {
    const run = this.store.read(runId);
    if (!run) return undefined;
    run.approvalHistory.push(approval);
    run.status = approval.action === 'approved' ? 'approved' : 'rejected';
    this.store.write(runId, run);
    return run;
  }

  /** Add artifact path to run. */
  addArtifact(runId: string, artifactPath: string): Run | undefined {
    const run = this.store.read(runId);
    if (!run) return undefined;
    if (!run.artifacts.includes(artifactPath)) {
      run.artifacts.push(artifactPath);
    }
    this.store.write(runId, run);
    return run;
  }

  /** Get recent runs (last N). */
  recent(limit: number = 20): Run[] {
    return this.list().slice(0, limit);
  }

  /** Get runs for a specific workflow. */
  byWorkflow(workflowId: string): Run[] {
    return this.list().filter(r => r.workflowId === workflowId);
  }
}
