/**
 * Skill: interactive-requirement
 *
 * Multi-turn conversational requirement gathering.
 * The AI actively asks clarifying questions, and the user can
 * iterate/correct until the requirements are mature enough.
 *
 * Two modes:
 *   1. Ask mode — AI asks questions to fill gaps
 *   2. Refine mode — AI refines existing requirements based on user feedback
 */

import type { JsonObject } from '../../../shared-types/src';
import type { SkillContext, SkillDefinition, SkillPrompt } from '../../../skill-sdk/src';

export interface RequirementDocument {
  /** 功能名称 */
  featureName: string;
  /** 业务背景和目标 */
  businessGoal: string;
  /** 用户角色 */
  userRoles: Array<{ name: string; description: string; permissions: string[] }>;
  /** 选择的 UI 组件库 */
  uiLibrary: {
    id: string;
    name: string;
    npmPackage: string;
    componentMapping: Record<string, string>;
    styling: string[];
  } | null;
  /** 页面列表 */
  pages: Array<{
    name: string;
    goal: string;
    pageType: 'list' | 'form' | 'detail' | 'dashboard' | 'modal' | 'drawer' | 'tab' | 'wizard';
    sections: string[];
    actions: string[];
    fields: Array<{ name: string; type: string; required: boolean; description: string }>;
    interactions: string[];
  }>;
  /** 数据实体 */
  entities: Array<{
    name: string;
    fields: Array<{ name: string; type: string; required: boolean; description: string }>;
  }>;
  /** 业务规则 */
  businessRules: string[];
  /** 边界 case */
  edgeCases: string[];
  /** 非功能需求 */
  nonFunctional: string[];
  /** 阶段拆分 */
  phases: Array<{ id: string; name: string; pages: string[]; priority: string }>;
  /** 需求完整度 0-100 */
  completeness: number;
  /** AI 提出的待确认问题 */
  openQuestions: string[];
  /** 建议下一步 */
  suggestedNextStep: 'continue-gathering' | 'review-document' | 'generate-design' | 'start-coding';
}

export const interactiveRequirementSkill: SkillDefinition = {
  name: 'interactive-requirement',
  version: '0.1.0',
  description: '交互式需求对话 — AI 主动追问，用户反复修改，逐步完善需求文档',
  inputSchema: { name: 'requirement-chat-input' },
  outputSchema: { name: 'requirement-spec' },
  defaultModel: {
    model: 'auto',
    temperature: 0.3,
  },

  async buildPrompt(ctx: SkillContext, input: JsonObject): Promise<SkillPrompt> {
    const userMessage = String(input.userMessage ?? input.userPrompt ?? '');
    const conversationHistory = Array.isArray(input.conversationHistory)
      ? (input.conversationHistory as Array<{ role: string; content: string }>)
      : [];
    const existingDoc = input.existingDocument as JsonObject | undefined;
    const mode = String(input.mode ?? 'gather'); // gather | refine | score

    const historyText = conversationHistory.length > 0
      ? conversationHistory.map(m => `[${m.role}]: ${m.content}`).join('\n')
      : '（首次对话）';

    const existingDocText = existingDoc
      ? `\n当前需求文档:\n${JSON.stringify(existingDoc, null, 2)}`
      : '';

    const modeInstructions = getModeInstructions(mode);

    return {
      system: `你是一个资深前端产品分析师和需求架构师。你的任务是通过对话帮助用户梳理出完整、可执行的前端需求。

${modeInstructions}

## 输出格式

你必须输出一个合法的 JSON 对象，结构如下：

{
  "featureName": "功能名称",
  "businessGoal": "业务背景和目标（2-3句话）",
  "userRoles": [
    { "name": "角色名", "description": "角色描述", "permissions": ["权限1"] }
  ],
  "pages": [
    {
      "name": "页面名称",
      "goal": "页面目标",
      "pageType": "list|form|detail|dashboard|modal|drawer|tab|wizard",
      "sections": ["页面区域1", "页面区域2"],
      "actions": ["用户操作1"],
      "fields": [
        { "name": "字段名", "type": "string|number|boolean|date|enum", "required": true, "description": "描述" }
      ],
      "interactions": ["交互规则1"]
    }
  ],
  "entities": [
    {
      "name": "实体名",
      "fields": [
        { "name": "字段名", "type": "string|number|boolean|date", "required": true, "description": "描述" }
      ]
    }
  ],
  "businessRules": ["业务规则1", "业务规则2"],
  "edgeCases": ["边界case1", "边界case2"],
  "nonFunctional": ["非功能需求1"],
  "phases": [
    { "id": "P1", "name": "阶段名称", "pages": ["页面名1"], "priority": "核心/重要/可选" }
  ],
  "completeness": 75,
  "openQuestions": ["待确认问题1"],
  "suggestedNextStep": "continue-gathering"
}

## 评分维度 (completeness 计算)

满分 100，按以下维度评分：
- 功能名称 + 业务目标 (8分)
- 用户角色定义 (8分)
- UI 组件库选择 (9分) — 是否选定了具体 UI 库
- 页面定义完整性 (25分) — 每个页面是否有 goal、sections、actions、fields、interactions
- 数据实体定义 (15分) — 字段是否完整、类型是否明确
- 业务规则 (12分) — 是否有明确的业务约束
- 边界 case (8分) — 异常情况是否考虑
- 非功能需求 (5分)
- 阶段拆分 (10分) — 是否有合理的 P1/P2/P3 规划

## UI 组件库选择

在需求收集阶段，一定要帮用户选定 UI 组件库。可选列表：

Vue3 项目:
- element-plus — Element Plus，管理后台标配，中文生态最好
- ant-design-vue — Ant Design Vue，企业级设计语言
- naive-ui — Naive UI，TypeScript 优先，主题定制灵活
- vuetify — Vuetify 3，Material Design 风格
- arco-design-vue — Arco Design Vue，字节出品，配置化表格强

React 项目:
- antd — Ant Design，最流行的 React 企业级 UI 库
- arco-design-react — Arco Design，字节出品，配置化能力强
- heroui — HeroUI，Tailwind CSS 原生，动效出色

如果用户没有明确偏好，根据项目类型推荐：
- 管理后台 → element-plus (Vue) 或 antd (React)
- 注重设计 → arco-design 或 heroui
- 高度定制 → naive-ui (Vue) 或 heroui (React)

uiLibrary 字段格式:
{
  "id": "库的 npm id",
  "name": "显示名称",
  "npmPackage": "npm 包名",
  "componentMapping": { "button": "ElButton", "form": "ElForm", "table": "ElTable", "dialog": "ElDialog" },
  "styling": ["tailwindcss", "css"]
}

## 关键原则

1. 不要猜测 — 如果用户没说清楚，就放进 openQuestions 问出来
2. 每次至少提出 2-3 个有价值的追问
3. 阶段拆分要合理 — P1 是最小可用版本，后续阶段逐步增强
4. 交互规则要具体 — "列表需要 loading" 比 "体验要好" 有用得多
5. 字段类型要精确 — "日期用 date，金额用 number" 而不是都用 string`,

      user: `对话历史:
${historyText}
${existingDocText}

用户最新消息:
${userMessage}`,
    };
  },

  async normalize(raw: JsonObject): Promise<JsonObject> {
    const doc: JsonObject = {
      featureName: String(raw.featureName ?? '未命名功能'),
      businessGoal: String(raw.businessGoal ?? ''),
      userRoles: Array.isArray(raw.userRoles) ? raw.userRoles : [],
      uiLibrary: raw.uiLibrary && typeof raw.uiLibrary === 'object'
        ? (() => {
            const lib = raw.uiLibrary as Record<string, unknown>;
            return {
              id: String(lib.id ?? ''),
              name: String(lib.name ?? ''),
              npmPackage: String(lib.npmPackage ?? ''),
              componentMapping: (typeof lib.componentMapping === 'object' && lib.componentMapping !== null
                ? lib.componentMapping
                : {}) as Record<string, string>,
              styling: Array.isArray(lib.styling) ? lib.styling : ['css'],
            };
          })()
        : null,
      pages: Array.isArray(raw.pages) ? raw.pages.map(normalizePage) : [],
      entities: Array.isArray(raw.entities) ? raw.entities : [],
      businessRules: Array.isArray(raw.businessRules) ? raw.businessRules : [],
      edgeCases: Array.isArray(raw.edgeCases) ? raw.edgeCases : [],
      nonFunctional: Array.isArray(raw.nonFunctional) ? raw.nonFunctional : [],
      phases: Array.isArray(raw.phases) ? raw.phases : [],
      completeness: typeof raw.completeness === 'number' ? Math.min(100, Math.max(0, raw.completeness)) : 0,
      openQuestions: Array.isArray(raw.openQuestions) ? raw.openQuestions : [],
      suggestedNextStep: String(raw.suggestedNextStep ?? 'continue-gathering'),
    };

    return doc;
  },
};

function normalizePage(page: unknown): JsonObject {
  const p = page as Record<string, unknown>;
  return {
    name: String(p.name ?? '未命名页面'),
    goal: String(p.goal ?? ''),
    pageType: String(p.pageType ?? 'list'),
    sections: Array.isArray(p.sections) ? p.sections : [],
    actions: Array.isArray(p.actions) ? p.actions : [],
    fields: Array.isArray(p.fields) ? p.fields : [],
    interactions: Array.isArray(p.interactions) ? p.interactions : [],
  };
}

function getModeInstructions(mode: string): string {
  switch (mode) {
    case 'gather':
      return `## 模式：需求收集

你在帮助用户从零开始梳理需求。当前阶段：
- 如果是首次对话，先理解用户的核心意图，然后有针对性地追问
- 如果已有部分需求，检查缺失维度，主动提问补齐
- 每次回复至少提出 2-3 个有价值的追问
- 逐步构建需求文档，每次更新都给出最新的完整文档`;

    case 'refine':
      return `## 模式：需求细化

用户在对已有需求进行修改和确认：
- 根据用户的反馈修改对应部分
- 保持用户未提及的部分不变
- 如果修改引入了新的不确定性，放进 openQuestions
- 每次修改后给出更新后的完整文档`;

    case 'score':
      return `## 模式：需求评估

对当前需求文档进行完整度评分：
- 逐项检查每个维度
- 给出具体的分数和理由
- 指出最薄弱的环节
- 给出明确的改进建议
- 如果 completeness >= 80，suggestedNextStep 设为 "generate-design"
- 如果 completeness >= 95，suggestedNextStep 设为 "start-coding"`;

    default:
      return '';
  }
}
