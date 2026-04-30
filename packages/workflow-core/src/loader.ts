import { type Dirent, promises as fs } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import type { WorkflowDefinition, WorkflowRegistryEntry } from './types';
import { assertWorkflowDefinition } from './validator';

function parseYamlDocument(source: string): WorkflowDefinition {
  // 这里直接使用 yaml 包解析工作流定义，再进入结构校验。
  const parsed = parse(source);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('YAML 内容不是有效的工作流对象');
  }
  return assertWorkflowDefinition(parsed as WorkflowDefinition);
}

export async function loadWorkflowFile(filePath: string): Promise<WorkflowRegistryEntry> {
  const source = await fs.readFile(filePath, 'utf8');
  const definition = parseYamlDocument(source);
  return {
    filePath,
    definition,
  };
}

export async function listWorkflowFiles(workflowDir: string): Promise<string[]> {
  const entries = await fs.readdir(workflowDir, { withFileTypes: true });
  return entries
    .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith('.yaml'))
    .map((entry: Dirent) => path.join(workflowDir, entry.name))
    .sort();
}

export async function loadWorkflowRegistry(workflowDir: string): Promise<Record<string, WorkflowRegistryEntry>> {
  const files = await listWorkflowFiles(workflowDir);
  const registryEntries = await Promise.all(files.map((file) => loadWorkflowFile(file)));
  return Object.fromEntries(registryEntries.map((entry) => [entry.definition.id, entry]));
}
