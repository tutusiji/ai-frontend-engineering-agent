/**
 * Skill: target-profile-selection
 *
 * Takes a RequirementSpec and available target profiles, then selects
 * the most appropriate one with reasoning.
 */

import type { JsonObject } from '../../../shared-types/src';
import type { SkillContext, SkillDefinition, SkillPrompt } from '../../../skill-sdk/src';

export const targetProfileSelectionSkill: SkillDefinition = {
  name: 'target-profile-selection',
  version: '0.1.0',
  description: '根据需求规格选择最合适的目标 profile',
  inputSchema: { name: 'requirement-spec' },
  outputSchema: { name: 'target-profile-selection' },
  defaultModel: {
    model: 'auto',
    temperature: 0.1,
  },

  async buildPrompt(ctx: SkillContext, input: JsonObject): Promise<SkillPrompt> {
    const availableProfiles = await getAvailableProfiles(ctx);

    return {
      system: `你是一个前端架构决策专家。根据需求规格和可用的目标 profile，选择最合适的一个。

可用的 target profiles:
${availableProfiles}

你必须输出一个合法的 JSON 对象，格式如下：
{
  "profileId": "选择的 profile id",
  "platform": "admin-web | pc-spa | h5-spa | miniapp",
  "framework": "vue3 | react | native-miniapp",
  "uiLibrary": "使用的 UI 库名称",
  "routingMode": "vue-router | react-router | miniapp-pages | custom | none",
  "styling": ["样式方案1", "样式方案2"],
  "reasons": ["选择理由1", "选择理由2"]
}

要求：
- 优先匹配需求中明确提到的技术栈
- 如果用户没指定，根据需求特点推断最合适的 profile
- admin 类需求默认选 vue3-admin
- 移动端/小程序需求选对应的 profile
- 只输出 JSON，不要有其他文字`,

      user: `需求规格:
${JSON.stringify(input, null, 2)}`,
    };
  },

  async normalize(raw: JsonObject): Promise<JsonObject> {
    return {
      profileId: String(raw.profileId ?? 'vue3-admin'),
      platform: String(raw.platform ?? 'admin-web'),
      framework: String(raw.framework ?? 'vue3'),
      uiLibrary: String(raw.uiLibrary ?? ''),
      routingMode: String(raw.routingMode ?? 'vue-router'),
      styling: Array.isArray(raw.styling) ? raw.styling : [],
      reasons: Array.isArray(raw.reasons) ? raw.reasons : [],
    };
  },
};

async function getAvailableProfiles(ctx: SkillContext): Promise<string> {
  const profiles = ['vue3-admin', 'react-admin', 'pc-spa', 'h5-spa', 'wechat-miniapp'];
  const lines: string[] = [];

  for (const id of profiles) {
    try {
      const policy = await ctx.policies.get(id);
      if (policy) {
        lines.push(`- ${id}: platform=${String(policy.platform ?? '?')}, framework=${String(policy.framework ?? '?')}, uiLibrary=${String(policy.uiLibrary ?? '?')}`);
      } else {
        lines.push(`- ${id}`);
      }
    } catch {
      lines.push(`- ${id}`);
    }
  }

  return lines.join('\n');
}
