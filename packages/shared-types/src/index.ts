export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface SchemaRef {
  name: string;
  version?: string;
}

export interface ArtifactRef {
  id: string;
  kind: string;
  path?: string;
  metadata?: Record<string, JsonValue>;
}

export interface TargetProfileRef {
  id: string;
  platform?: string;
  framework?: string;
}

// 统一验证问题结构，方便规则检查、E2E、视觉回归共用同一套报告格式。
export interface ValidationIssue {
  category: 'lint' | 'typecheck' | 'rule' | 'e2e' | 'visual' | 'review';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  file?: string;
  suggestion?: string;
}

export interface ValidationReport {
  passed: boolean;
  issues: ValidationIssue[];
}
