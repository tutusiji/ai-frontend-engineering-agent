import type { WorkflowDefinition, WorkflowNodeDef, WorkflowStageDef } from './types';

export interface WorkflowValidationIssue {
  path: string;
  message: string;
}

export function validateWorkflowDefinition(definition: WorkflowDefinition): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];

  if (!definition.id) {
    issues.push({ path: 'id', message: '工作流缺少 id' });
  }
  if (!definition.name) {
    issues.push({ path: 'name', message: '工作流缺少 name' });
  }
  if (!definition.version) {
    issues.push({ path: 'version', message: '工作流缺少 version' });
  }

  const hasNodes = Array.isArray(definition.nodes) && definition.nodes.length > 0;
  const hasStages = Array.isArray(definition.stages) && definition.stages.length > 0;

  if (!hasNodes && !hasStages) {
    issues.push({ path: 'nodes', message: '工作流至少需要 nodes 或 stages 其中之一' });
    return issues;
  }

  if (hasNodes) {
    issues.push(...validateNodes(definition.nodes ?? []));
  }

  if (hasStages) {
    issues.push(...validateStages(definition.stages ?? []));
  }

  if (definition.output?.primaryFrom && hasNodes) {
    const nodeIds = new Set((definition.nodes ?? []).map((node) => node.id));
    if (!nodeIds.has(definition.output.primaryFrom)) {
      issues.push({
        path: 'output.primaryFrom',
        message: `output.primaryFrom 指向了不存在的节点: ${definition.output.primaryFrom}`,
      });
    }
  }

  return issues;
}

function validateNodes(nodes: WorkflowNodeDef[]): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    if (!node.id) {
      issues.push({ path: 'nodes[].id', message: '节点缺少 id' });
      continue;
    }

    if (seen.has(node.id)) {
      issues.push({ path: `nodes.${node.id}`, message: `节点 id 重复: ${node.id}` });
      continue;
    }
    seen.add(node.id);

    if (node.type === 'agent' && !node.skill) {
      issues.push({ path: `nodes.${node.id}.skill`, message: 'agent 节点必须声明 skill' });
    }
    if (node.type === 'plugin' && !node.plugin) {
      issues.push({ path: `nodes.${node.id}.plugin`, message: 'plugin 节点必须声明 plugin' });
    }
    if (node.type === 'pluginGroup' && (!node.plugins || node.plugins.length === 0)) {
      issues.push({ path: `nodes.${node.id}.plugins`, message: 'pluginGroup 节点必须声明 plugins' });
    }
  }

  for (const node of nodes) {
    for (const dep of node.dependsOn ?? []) {
      if (!seen.has(dep)) {
        issues.push({
          path: `nodes.${node.id}.dependsOn`,
          message: `节点 ${node.id} 依赖了不存在的节点: ${dep}`,
        });
      }
    }
  }

  return issues;
}

function validateStages(stages: WorkflowStageDef[]): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const seen = new Set<string>();

  for (const stage of stages) {
    if (!stage.name) {
      issues.push({ path: 'stages[].name', message: '阶段缺少 name' });
      continue;
    }
    if (seen.has(stage.name)) {
      issues.push({ path: `stages.${stage.name}`, message: `阶段名称重复: ${stage.name}` });
      continue;
    }
    seen.add(stage.name);
  }

  return issues;
}

export function assertWorkflowDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  const issues = validateWorkflowDefinition(definition);
  if (issues.length > 0) {
    const summary = issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
    throw new Error(`工作流定义校验失败: ${summary}`);
  }
  return definition;
}
