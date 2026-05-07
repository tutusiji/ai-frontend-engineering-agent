/**
 * Agent Runner — bridges SkillDefinition with an LLM.
 *
 * Flow:
 *   1. Receive a SkillDefinition + SkillContext + input
 *   2. Call skill.buildPrompt() to get system/user prompts
 *   3. Send to LLM via chatCompletion()
 *   4. Extract JSON from the response
 *   5. Run skill.normalize() if available
 *   6. Return structured output
 */

import type { JsonObject } from '../../shared-types/src';
import type { SkillContext, SkillDefinition, SkillPrompt } from '../../skill-sdk/src';
import { chatCompletion, type LlmConfig, type LlmCallResult } from './llm-client';

export interface AgentRunResult {
  ok: boolean;
  output?: JsonObject;
  raw?: string;
  usage?: LlmCallResult['usage'];
  model?: string;
  error?: string;
}

/**
 * Execute a skill through the LLM.
 */
export async function runSkillThroughLlm(
  skill: SkillDefinition,
  ctx: SkillContext,
  input: JsonObject,
  llmConfig: LlmConfig,
): Promise<AgentRunResult> {
  try {
    // 1. Build prompt
    const prompt: SkillPrompt = await skill.buildPrompt(ctx, input);

    // 2. Call LLM
    const messages = [
      { role: 'system' as const, content: prompt.system },
      { role: 'user' as const, content: buildUserContent(prompt) },
    ];

    const result = await chatCompletion(llmConfig, messages);

    // 3. Extract JSON
    const parsed = extractJson(result.content);
    if (!parsed) {
      return {
        ok: false,
        raw: result.content,
        error: 'LLM response did not contain valid JSON',
        usage: result.usage,
        model: result.model,
      };
    }

    // 4. Normalize if the skill provides it
    let output = parsed;
    if (skill.normalize) {
      output = await skill.normalize(parsed);
    }

    return {
      ok: true,
      output,
      raw: result.content,
      usage: result.usage,
      model: result.model,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Build the user-facing content string from a SkillPrompt.
 */
function buildUserContent(prompt: SkillPrompt): string {
  let content = prompt.user;

  if (prompt.attachments?.length) {
    for (const attachment of prompt.attachments) {
      content += `\n\n--- ${attachment.kind} ---\n${attachment.content}`;
    }
  }

  return content;
}

/**
 * Extract JSON from LLM response.
 * Handles: raw JSON, JSON in markdown code fences, mixed text + JSON.
 */
export function extractJson(text: string): JsonObject | null {
  // Try parsing the whole thing first
  const direct = tryParse(text);
  if (direct) return direct;

  // Try extracting from ```json ... ``` fences
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced?.[1]) {
    const parsed = tryParse(fenced[1].trim());
    if (parsed) return parsed;
  }

  // Try finding the first { ... } block
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    const parsed = tryParse(braceMatch[0]);
    if (parsed) return parsed;
  }

  return null;
}

function tryParse(text: string): JsonObject | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
    return null;
  } catch {
    return null;
  }
}
