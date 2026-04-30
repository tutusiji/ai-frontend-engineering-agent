import type { JsonValue, ValidationIssue, ValidationReport } from '../../shared-types/src';

export interface ValidationCheckContext {
  runId: string;
  nodeId: string;
  targetProject?: string;
  targetProfileId?: string;
  workspaceRoot?: string;
  env?: Record<string, string | undefined>;
}

export interface ValidationCheckResult {
  name: string;
  report: ValidationReport;
  durationMs?: number;
  metadata?: Record<string, JsonValue>;
}

export interface ValidationSuiteResult {
  passed: boolean;
  checks: ValidationCheckResult[];
  report: ValidationReport;
}

export interface ValidationPluginDefinition {
  name: string;
  category: ValidationIssue['category'];
  defaultSeverity?: ValidationIssue['severity'];
}
