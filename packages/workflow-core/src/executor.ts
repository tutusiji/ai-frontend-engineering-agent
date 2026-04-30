import type { JsonObject, TargetProfileRef } from '../../shared-types/src';
import type {
  WorkflowDefinition,
  WorkflowNodeDef,
  WorkflowNodeResult,
  WorkflowRunState,
} from './types';

export interface WorkflowExecutorAdapters {
  runAgent(node: WorkflowNodeDef, input: JsonObject, state: WorkflowRunState): Promise<WorkflowNodeResult>;
  runPlugin(node: WorkflowNodeDef, input: JsonObject, state: WorkflowRunState): Promise<WorkflowNodeResult>;
  runPluginGroup(node: WorkflowNodeDef, input: JsonObject, state: WorkflowRunState): Promise<WorkflowNodeResult>;
}

export interface WorkflowExecutionOptions {
  targetProject?: string;
  targetProfile?: TargetProfileRef;
  schemas?: WorkflowRunState['context']['schemas'];
  policies?: WorkflowRunState['context']['policies'];
  resolvedTargetProfile?: WorkflowRunState['context']['resolvedTargetProfile'];
}

export class WorkflowExecutor {
  constructor(private readonly adapters: WorkflowExecutorAdapters) {}

  async execute(
    definition: WorkflowDefinition,
    input: JsonObject,
    options: WorkflowExecutionOptions = {},
  ): Promise<WorkflowRunState> {
    if (!definition.nodes?.length) {
      throw new Error(`Workflow ${definition.id} has no executable nodes`);
    }

    // 先构造最小运行态，后续可以继续补充事件流、日志流和审批状态。
    const state: WorkflowRunState = {
      context: {
        runId: `${definition.id}-${Date.now()}`,
        workflow: definition,
        targetProject: options.targetProject,
        targetProfile: options.targetProfile,
        input,
        schemas: options.schemas,
        policies: options.policies,
        resolvedTargetProfile: options.resolvedTargetProfile,
      },
      nodeResults: {},
      status: 'running',
    };

    // 当前骨架先按声明顺序串行执行，后续再补依赖图调度和并行执行。
    for (const node of definition.nodes) {
      if (!this.dependenciesSatisfied(node, state)) {
        state.nodeResults[node.id] = {
          ok: true,
          skipped: true,
          reason: '依赖节点尚未成功完成',
        };
        continue;
      }

      if (!this.matchesWhenClause(node, state)) {
        state.nodeResults[node.id] = {
          ok: true,
          skipped: true,
          reason: 'when 条件未命中',
        };
        continue;
      }

      const result = await this.runNode(node, input, state);
      state.nodeResults[node.id] = result;
      if (!result.ok) {
        state.status = 'failed';
        return state;
      }
    }

    if (definition.output?.primaryFrom) {
      const primaryResult = state.nodeResults[definition.output.primaryFrom];
      if (!primaryResult) {
        state.status = 'failed';
        throw new Error(`主输出节点未执行: ${definition.output.primaryFrom}`);
      }
    }

    state.status = 'completed';
    return state;
  }

  private dependenciesSatisfied(node: WorkflowNodeDef, state: WorkflowRunState): boolean {
    return (node.dependsOn ?? []).every((depId) => {
      const depResult = state.nodeResults[depId];
      return depResult?.ok === true && depResult.skipped !== true;
    });
  }

  private matchesWhenClause(node: WorkflowNodeDef, state: WorkflowRunState): boolean {
    if (!node.when) {
      return true;
    }

    const priorResults = Object.values(state.nodeResults);
    const allPassed = priorResults.every((result) => result.ok);
    const hasFailures = priorResults.some((result) => !result.ok);

    if (node.when.allPassed === true && !allPassed) {
      return false;
    }
    if (node.when.hasFailures === true && !hasFailures) {
      return false;
    }

    return true;
  }

  private async runNode(node: WorkflowNodeDef, input: JsonObject, state: WorkflowRunState): Promise<WorkflowNodeResult> {
    switch (node.type) {
      case 'agent':
        return this.adapters.runAgent(node, input, state);
      case 'plugin':
        return this.adapters.runPlugin(node, input, state);
      case 'pluginGroup':
        return this.adapters.runPluginGroup(node, input, state);
      default:
        throw new Error(`Unsupported node type: ${String(node.type)}`);
    }
  }
}
