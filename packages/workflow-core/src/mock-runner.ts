import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { JsonObject, JsonValue, ValidationReport } from '../../shared-types/src';
import { FileSchemaRegistry } from '../../contract-schema/src';
import { FilePolicyRegistry } from '../../policy-engine/src';
import { WorkflowExecutor } from './executor';
import { loadWorkflowRegistry } from './loader';
import type { WorkflowNodeDef, WorkflowNodeResult, WorkflowRunState } from './types';
import {
  runMockValidationPlugin,
  runMockValidationSuite,
} from '../../validation-core/src';
import { scanProject } from '../../../plugins/project-scanner/src';
import { runRuleChecker } from '../../../plugins/rule-checkers/src';

function createMockResult(node: WorkflowNodeDef, state: WorkflowRunState, input: JsonObject): WorkflowNodeResult {
  const handledBy = node.skill ?? node.plugin ?? node.plugins ?? 'mock-runner';

  if (node.id === 'target_profile_selection') {
    const targetProfile = state.context.resolvedTargetProfile;
    return {
      ok: true,
      output: {
        profileId: targetProfile?.id ?? 'unknown',
        platform: targetProfile?.platform ?? 'unknown',
        framework: targetProfile?.framework ?? 'unknown',
        uiLibrary: targetProfile?.uiLibrary ?? 'unknown',
        routingMode: targetProfile?.routingMode ?? 'unknown',
        reasons: ['mock runner selected configured target profile'],
      },
    };
  }

  return {
    ok: true,
    output: {
      nodeId: node.id,
      nodeType: node.type,
      handledBy,
      targetProfile: state.context.targetProfile?.id ?? 'unknown',
      availableInputKeys: Object.keys(input),
      schemaHint: node.outputSchema ?? null,
    },
  };
}

function toJsonValue<T>(value: T): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function createValidationContext(node: WorkflowNodeDef, state: WorkflowRunState) {
  return {
    runId: state.context.runId,
    nodeId: node.id,
    targetProject: state.context.targetProject,
    targetProfileId: state.context.targetProfile?.id,
    workspaceRoot: state.context.targetProject,
    env: process.env,
  };
}

async function createValidationNodeResult(node: WorkflowNodeDef, state: WorkflowRunState): Promise<WorkflowNodeResult> {
  if (node.type === 'pluginGroup' && node.plugins?.length) {
    const targetProject = state.context.targetProject;
    const scanReport = targetProject ? await scanProject({ rootDir: targetProject }) : undefined;

    const supportedRulePlugins = new Set([
      'loading-rule-checker',
      'debounce-rule-checker',
      'delete-confirm-rule-checker',
    ]);

    const checks = await Promise.all(
      node.plugins.map(async (pluginName) => {
        if (scanReport && supportedRulePlugins.has(pluginName)) {
          const report = runRuleChecker(pluginName, scanReport);
          return {
            name: pluginName,
            report,
            metadata: {
              mock: false,
              source: 'project-scan',
            },
          };
        }
        return runMockValidationPlugin(pluginName, createValidationContext(node, state));
      }),
    );

    const suiteResult = runMockValidationSuite([], createValidationContext(node, state));
    suiteResult.checks = checks;
    suiteResult.report = {
      passed: checks.every((check) => check.report.passed),
      issues: checks.flatMap((check) => check.report.issues),
    };
    suiteResult.passed = suiteResult.report.passed;

    return {
      ok: suiteResult.passed,
      output: {
        checks: suiteResult.checks.map((check) => ({
          name: check.name,
          passed: check.report.passed,
          issueCount: check.report.issues.length,
        })),
        passed: suiteResult.report.passed,
        issues: toJsonValue(suiteResult.report.issues),
        scannedProject: scanReport?.rootDir ?? null,
      },
      raw: toJsonValue(suiteResult.report),
    };
  }

  if (node.type === 'plugin' && node.plugin) {
    if (node.plugin === 'project-scanner' && state.context.targetProject) {
      const scanReport = await scanProject({ rootDir: state.context.targetProject });
      return {
        ok: true,
        output: toJsonValue(scanReport) as JsonObject,
      };
    }

    const check = runMockValidationPlugin(node.plugin, createValidationContext(node, state));
    return {
      ok: check.report.passed,
      output: {
        check: check.name,
        passed: check.report.passed,
        issues: toJsonValue(check.report.issues),
      },
      raw: toJsonValue(check.report),
    };
  }

  return createMockResult(node, state, state.context.input);
}

async function main(): Promise<void> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(currentDir, '../../..');
  const workflowDir = path.join(repoRoot, 'workflows');
  const contractsDir = path.join(repoRoot, 'contracts');
  const policiesDir = path.join(repoRoot, 'policies');
  const targetPoliciesDir = path.join(policiesDir, 'targets');

  const cliArgs = process.argv.slice(2).filter((arg) => arg !== '--');
  const requestedWorkflowId = cliArgs[0] ?? 'from-chat-to-page';
  const requestedTargetProfile = cliArgs[1] ?? 'vue3-admin';
  const requestedTargetProject = cliArgs[2] ? path.resolve(cliArgs[2]) : repoRoot;

  const registry = await loadWorkflowRegistry(workflowDir);
  const entry = registry[requestedWorkflowId];
  if (!entry) {
    throw new Error(`未找到工作流: ${requestedWorkflowId}`);
  }
  if (!entry.definition.nodes?.length) {
    throw new Error(`工作流 ${requestedWorkflowId} 当前没有可直接执行的 nodes`);
  }

  const schemas = new FileSchemaRegistry({ contractsDir });
  const policies = new FilePolicyRegistry({ policiesDir, targetPoliciesDir });
  const targetProfile = await policies.getTargetProfile(requestedTargetProfile);
  if (!targetProfile) {
    throw new Error(`未找到目标 profile: ${requestedTargetProfile}`);
  }

  const targetProfileSchema = await schemas.get({ name: 'target-profile-selection' });
  const sharedPolicy = await policies.get('shared-frontend-policy');

  const executor = new WorkflowExecutor({
    async runAgent(node, input, state) {
      return createMockResult(node, state, input);
    },
    async runPlugin(node, input, state) {
      const runtimePlugins = new Set(['project-scanner', 'playwright-runner', 'visual-regression-runner', 'typecheck']);
      if (node.plugin && runtimePlugins.has(node.plugin)) {
        return createValidationNodeResult(node, state);
      }
      return createMockResult(node, state, input);
    },
    async runPluginGroup(node, input, state) {
      return createValidationNodeResult(node, state);
    },
  });

  const input: JsonObject = {
    userPrompt: '生成一个前端页面流程示例',
    targetProject: requestedTargetProject,
  };

  const result = await executor.execute(entry.definition, input, {
    targetProject: input.targetProject as string,
    targetProfile: {
      id: targetProfile.id ?? requestedTargetProfile,
      platform: targetProfile.platform,
      framework: targetProfile.framework,
    },
    schemas,
    policies,
    resolvedTargetProfile: targetProfile,
  });

  printRuntimeSummary(targetProfileSchema, sharedPolicy, targetProfile);
  printRunState(result);
}

function printRuntimeSummary(
  targetProfileSchema: JsonObject | undefined,
  sharedPolicy: JsonObject | undefined,
  targetProfile: { id?: string },
): void {
  console.log('运行时上下文:');
  console.log(`- target-profile schema: ${targetProfileSchema ? 'loaded' : 'missing'}`);
  console.log(`- shared policy: ${sharedPolicy ? 'loaded' : 'missing'}`);
  console.log(`- active profile: ${stringifyValue(targetProfile.id)}`);
}

function printRunState(state: WorkflowRunState): void {
  console.log(`运行状态: ${state.status}`);
  console.log(`运行 ID: ${state.context.runId}`);
  console.log('节点结果:');

  for (const [nodeId, result] of Object.entries(state.nodeResults)) {
    const suffix = result.skipped ? ' [skipped]' : '';
    console.log(`- ${nodeId}: ok=${result.ok}${suffix}`);
    if (result.raw && typeof result.raw === 'object' && 'issues' in result.raw) {
      const report = result.raw as unknown as ValidationReport;
      const issueCount = Array.isArray(report.issues) ? report.issues.length : 0;
      console.log(`  issues: ${issueCount}`);
    }
  }
}

function stringifyValue(value: JsonValue | undefined): string {
  if (value === undefined) {
    return 'undefined';
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
