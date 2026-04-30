import type { JsonObject, JsonValue, SchemaRef, TargetProfileRef } from '../../shared-types/src';
import type { FilePolicyRegistry, TargetProfileDefinition } from '../../policy-engine/src';
import type { FileSchemaRegistry } from '../../contract-schema/src';

export type WorkflowNodeType = 'agent' | 'plugin' | 'pluginGroup';

export interface WorkflowFieldDef {
  name: string;
  type: string;
  required?: boolean;
}

export interface WorkflowInputDef {
  schema?: string;
  fields?: WorkflowFieldDef[];
}

export interface WorkflowWhenClause {
  allPassed?: boolean;
  hasFailures?: boolean;
}

export interface WorkflowNodeDef {
  id: string;
  type: WorkflowNodeType;
  skill?: string;
  plugin?: string;
  plugins?: string[];
  dependsOn?: string[];
  outputSchema?: string;
  when?: WorkflowWhenClause;
}

export interface WorkflowOutputDef {
  primaryFrom: string;
}

export interface WorkflowRetryPolicy {
  maxRounds: number;
}

export interface WorkflowStageDef {
  name: string;
  nodes: string[];
}

export interface WorkflowApprovalGate {
  afterStage: string;
  name: string;
  required: boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  input?: WorkflowInputDef;
  nodes?: WorkflowNodeDef[];
  stages?: WorkflowStageDef[];
  output?: WorkflowOutputDef;
  retryPolicy?: WorkflowRetryPolicy;
  approvalGates?: WorkflowApprovalGate[];
}

export interface WorkflowNodeResult {
  ok: boolean;
  // skipped 表示节点因条件不满足而被跳过，不算执行失败。
  skipped?: boolean;
  reason?: string;
  output?: JsonObject;
  raw?: JsonValue;
}

export interface WorkflowRunContext {
  runId: string;
  workflow: WorkflowDefinition;
  targetProject?: string;
  targetProfile?: TargetProfileRef;
  input: JsonObject;
  schemas?: FileSchemaRegistry;
  policies?: FilePolicyRegistry;
  resolvedTargetProfile?: TargetProfileDefinition;
}

export interface WorkflowRunState {
  context: WorkflowRunContext;
  nodeResults: Record<string, WorkflowNodeResult>;
  status: 'pending' | 'running' | 'waiting-approval' | 'failed' | 'completed';
}

export interface WorkflowRegistryEntry {
  filePath: string;
  definition: WorkflowDefinition;
}

export interface SchemaRegistry {
  get(ref: SchemaRef): Promise<JsonObject | undefined>;
}
