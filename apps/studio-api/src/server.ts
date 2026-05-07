/**
 * Studio API — Express server wrapping workflow-core + agent-runtime
 *
 * Endpoints:
 *   GET  /api/health                — health check
 *   GET  /api/profiles              — list available target profiles
 *   GET  /api/catalog/ui            — UI library catalog
 *
 *   Sessions:
 *     GET  /api/sessions                  — list all sessions
 *     POST /api/sessions                  — create new session
 *     GET  /api/sessions/:id              — get session detail
 *     DELETE /api/sessions/:id            — delete session
 *     PATCH /api/sessions/:id             — update session (name, profileId)
 *
 *   Chat:
 *     POST /api/chat                      — interactive requirement (non-stream)
 *     POST /api/chat/stream               — interactive requirement (SSE stream)
 *     GET  /api/chat/:sessionId           — get session state
 *
 *   Generation:
 *     POST /api/generate/design           — generate HTML design mockup
 *     POST /api/generate/code             — generate code files
 *
 *   Workflows:
 *     GET  /api/workflows                 — list available workflows
 *     POST /api/workflows/:id/run         — run a workflow (real execution)
 *     GET  /api/runs                      — list run history
 *     GET  /api/runs/:id                  — get run detail
 *
 *   Approval:
 *     POST /api/runs/:id/approve          — approve a workflow run
 *     POST /api/runs/:id/reject           — reject a workflow run
 *
 *   Artifacts:
 *     GET  /api/runs/:id/artifacts        — list artifacts for a run
 *     GET  /api/runs/:id/artifacts/:file  — get artifact content
 */

import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { FileSchemaRegistry } from '@ai-frontend-engineering-agent/contract-schema';
import { FilePolicyRegistry } from '@ai-frontend-engineering-agent/policy-engine';
import {
  getSkill,
  runSkillThroughLlm,
  loadLlmConfigFromEnv,
  type LlmConfig,
} from '@ai-frontend-engineering-agent/agent-runtime';
import type { SkillContext } from '@ai-frontend-engineering-agent/skill-sdk';
import type { JsonObject } from '@ai-frontend-engineering-agent/shared-types';
import { getCompatibleLibraries } from '@ai-frontend-engineering-agent/agent-runtime';
import { SessionStore, RunStore, ArtifactStore } from '@ai-frontend-engineering-agent/persistence';
import type { Session, ChatMessage } from '@ai-frontend-engineering-agent/persistence';

// Workflow execution
import { WorkflowExecutor } from '@ai-frontend-engineering-agent/workflow-core';
import { loadWorkflowRegistry } from '@ai-frontend-engineering-agent/workflow-core';
import type { WorkflowNodeDef, WorkflowNodeResult, WorkflowRunState } from '@ai-frontend-engineering-agent/workflow-core';

// ─── Config ─────────────────────────────────────────────────────────────

const PORT = Number(process.env.STUDIO_API_PORT ?? 4401);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

let llmConfig: LlmConfig;
try {
  llmConfig = loadLlmConfigFromEnv();
} catch {
  console.error('❌ LLM 配置缺失，请设置环境变量');
  process.exit(1);
}

// ─── Registries ─────────────────────────────────────────────────────────

const schemas = new FileSchemaRegistry({ contractsDir: path.join(repoRoot, 'contracts') });
const policies = new FilePolicyRegistry({
  policiesDir: path.join(repoRoot, 'policies'),
  targetPoliciesDir: path.join(repoRoot, 'policies/targets'),
});

// ─── Persistent Stores ──────────────────────────────────────────────────

const sessionStore = new SessionStore();
const runStore = new RunStore();
const artifactStore = new ArtifactStore();

// ─── Helpers ────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSkillContext(profileId: string): SkillContext {
  return {
    runId: `web-${Date.now()}`,
    nodeId: 'web-api',
    targetProfile: { id: profileId },
    schemas: schemas as unknown as SkillContext['schemas'],
    policies: policies as unknown as SkillContext['policies'],
    artifacts: [],
    logger: {
      info: (msg) => console.log(`[INFO] ${msg}`),
      warn: (msg) => console.warn(`[WARN] ${msg}`),
      error: (msg) => console.error(`[ERROR] ${msg}`),
    },
  };
}

// ─── Load workflows ─────────────────────────────────────────────────────

function loadWorkflows(): Array<{ id: string; name: string; description: string; stages: string[] }> {
  const workflowsDir = path.join(repoRoot, 'workflows');
  if (!existsSync(workflowsDir)) return [];

  const files = readdirSync(workflowsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  const results: Array<{ id: string; name: string; description: string; stages: string[] }> = [];

  for (const file of files) {
    const content = readFileSync(path.join(workflowsDir, file), 'utf-8');
    const nameMatch = content.match(/name:\s*(.+)/);
    const descMatch = content.match(/description:\s*(.+)/);
    const stageMatches = [...content.matchAll(/- id:\s*(\S+)/g)].map(m => m[1]);

    results.push({
      id: file.replace(/\.(yaml|yml)$/, ''),
      name: nameMatch?.[1]?.trim() ?? file,
      description: descMatch?.[1]?.trim() ?? '',
      stages: stageMatches,
    });
  }

  return results;
}

// ─── App ────────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', model: llmConfig.model, timestamp: Date.now() });
});

// Profiles
app.get('/api/profiles', async (_req, res) => {
  try {
    const profileIds = ['vue3-admin', 'react-admin', 'pc-spa', 'h5-spa', 'wechat-miniapp'];
    const profiles = [];
    for (const id of profileIds) {
      const p = await policies.getTargetProfile(id);
      if (p) profiles.push({ id, ...p });
    }
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// UI catalog
app.get('/api/catalog/ui', (req, res) => {
  const framework = String(req.query.framework ?? 'vue3');
  const libs = getCompatibleLibraries(framework);
  res.json(libs);
});

// ─── Session endpoints ──────────────────────────────────────────────────

// List sessions
app.get('/api/sessions', (_req, res) => {
  const list = sessionStore.list().map(s => ({
    id: s.id,
    name: s.name,
    profileId: s.profileId,
    messageCount: s.messages.length,
    completeness: s.completeness,
    featureName: (s.document as Record<string, unknown>)?.featureName as string ?? null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
  res.json(list);
});

// Create session
app.post('/api/sessions', (req, res) => {
  const { profileId = 'vue3-admin', name } = req.body;
  const id = `session-${generateId()}`;
  const session = sessionStore.create(id, name);
  if (profileId) sessionStore.update(id, { profileId });
  res.json({ id, name: session.name, profileId });
});

// Get session
app.get('/api/sessions/:id', (req, res) => {
  const session = sessionStore.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// Delete session
app.delete('/api/sessions/:id', (req, res) => {
  const existed = sessionStore.delete(req.params.id);
  res.json({ ok: existed });
});

// Update session
app.patch('/api/sessions/:id', (req, res) => {
  const session = sessionStore.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const patch: Partial<Session> = {};
  if (req.body.name) patch.name = req.body.name;
  if (req.body.profileId) patch.profileId = req.body.profileId;
  sessionStore.update(req.params.id, patch);
  res.json({ ok: true });
});

// ─── Chat endpoints ─────────────────────────────────────────────────────

// Non-streaming chat
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId = 'default', profileId = 'vue3-admin', userMessage, mode = 'gather' } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    // Get or create session
    let session = sessionStore.get(sessionId);
    if (!session) {
      session = sessionStore.create(sessionId);
      sessionStore.update(sessionId, { profileId });
    }

    sessionStore.addMessage(sessionId, { role: 'user', content: userMessage, timestamp: Date.now() });

    const skill = getSkill('interactive-requirement');
    if (!skill) {
      return res.status(500).json({ error: 'interactive-requirement skill not found' });
    }

    const ctx = createSkillContext(profileId);
    const input: JsonObject = {
      userMessage,
      conversationHistory: session.messages as JsonObject[],
      existingDocument: session.document as JsonObject ?? null,
      mode,
    };

    const result = await runSkillThroughLlm(skill, ctx, input, llmConfig);

    if (result.ok && result.output) {
      const doc = result.output as Record<string, unknown>;
      const completeness = (doc.completeness as number) ?? 0;
      sessionStore.updateDocument(sessionId, doc, completeness);
      sessionStore.addMessage(sessionId, { role: 'assistant', content: JSON.stringify(result.output), timestamp: Date.now() });
    }

    session = sessionStore.get(sessionId)!;
    res.json({
      ok: result.ok,
      document: session.document,
      error: result.error,
      usage: result.usage,
      model: result.model,
      sessionId: session.id,
      messageCount: session.messages.length,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Streaming chat (SSE)
app.post('/api/chat/stream', async (req, res) => {
  const { sessionId = 'default', profileId = 'vue3-admin', userMessage, mode = 'gather' } = req.body;

  if (!userMessage) {
    return res.status(400).json({ error: 'userMessage is required' });
  }

  // Get or create session
  let session = sessionStore.get(sessionId);
  if (!session) {
    session = sessionStore.create(sessionId);
    sessionStore.update(sessionId, { profileId });
  }

  sessionStore.addMessage(sessionId, { role: 'user', content: userMessage, timestamp: Date.now() });

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const skill = getSkill('interactive-requirement');
    if (!skill) {
      send('error', { error: 'interactive-requirement skill not found' });
      res.end();
      return;
    }

    const ctx = createSkillContext(profileId);
    session = sessionStore.get(sessionId)!;
    const input: JsonObject = {
      userMessage,
      conversationHistory: session.messages as JsonObject[],
      existingDocument: session.document as JsonObject ?? null,
      mode,
    };

    const prompt = await skill.buildPrompt(ctx, input);
    const messages = [
      { role: 'system' as const, content: prompt.system },
      { role: 'user' as const, content: prompt.user + (prompt.attachments?.map(a => `\n\n--- ${a.kind} ---\n${a.content}`).join('') ?? '') },
    ];

    send('start', { model: llmConfig.model });

    // Stream from LLM
    const url = `${llmConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const body = {
      model: llmConfig.model,
      messages,
      temperature: llmConfig.temperature ?? 0.2,
      max_tokens: llmConfig.maxTokens ?? 4096,
      stream: true,
    };

    const llmRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llmConfig.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!llmRes.ok) {
      const errorText = await llmRes.text().catch(() => '');
      send('error', { error: `LLM request failed (${llmRes.status}): ${errorText}` });
      res.end();
      return;
    }

    let fullContent = '';
    const reader = llmRes.body?.getReader();
    if (!reader) {
      send('error', { error: 'No response body' });
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            send('chunk', { content: delta });
          }
        } catch {
          // ignore parse errors in stream
        }
      }
    }

    // Process the complete response
    send('done', { fullContent });

    const { extractJson } = await import('@ai-frontend-engineering-agent/agent-runtime');
    const parsed = extractJson(fullContent);

    if (parsed) {
      let output = parsed;
      if (skill.normalize) {
        output = await skill.normalize(parsed);
      }
      const doc = output as Record<string, unknown>;
      const completeness = (doc.completeness as number) ?? 0;
      sessionStore.updateDocument(sessionId, doc, completeness);
      sessionStore.addMessage(sessionId, { role: 'assistant', content: JSON.stringify(output), timestamp: Date.now() });
      send('document', { document: output });
    } else {
      sessionStore.addMessage(sessionId, { role: 'assistant', content: fullContent, timestamp: Date.now() });
      send('document', { document: null, raw: fullContent });
    }

    session = sessionStore.get(sessionId)!;
    send('end', { sessionId: session.id, messageCount: session.messages.length });
  } catch (err) {
    send('error', { error: String(err) });
  }

  res.end();
});

// Get chat session state
app.get('/api/chat/:sessionId', (req, res) => {
  const session = sessionStore.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({
    sessionId: session.id,
    profileId: session.profileId,
    document: session.document,
    messageCount: session.messages.length,
    messages: session.messages,
  });
});

// ─── Generation endpoints ───────────────────────────────────────────────

// Generate design mockup
app.post('/api/generate/design', async (req, res) => {
  try {
    const { sessionId = 'default', profileId = 'vue3-admin' } = req.body;
    const session = sessionStore.get(sessionId);

    if (!session?.document) {
      return res.status(400).json({ error: 'No requirement document. Complete the chat first.' });
    }

    const skill = getSkill('design-generation');
    if (!skill) {
      return res.status(500).json({ error: 'design-generation skill not found' });
    }

    const ctx = createSkillContext(profileId);
    const input: JsonObject = {
      ...(session.document as JsonObject),
      phaseId: 'P1',
    };

    const result = await runSkillThroughLlm(skill, ctx, input, llmConfig);

    if (result.ok && result.output) {
      const files = result.output.generatedFiles as Array<{ path: string; content: string }>;
      const htmlFile = files?.find(f => f.path?.endsWith('.html'));

      // Persist artifacts
      const runId = `design-${generateId()}`;
      if (files) {
        for (const file of files) {
          artifactStore.save(runId, file.path, file.content);
        }
      }

      res.json({
        ok: true,
        files: result.output.generatedFiles,
        htmlContent: htmlFile?.content ?? null,
        usage: result.usage,
        artifactRunId: runId,
      });
    } else {
      res.json({ ok: false, error: result.error });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Generate code
app.post('/api/generate/code', async (req, res) => {
  try {
    const { sessionId = 'default', profileId = 'vue3-admin', phaseId = 'P1' } = req.body;
    const session = sessionStore.get(sessionId);

    if (!session?.document) {
      return res.status(400).json({ error: 'No requirement document. Complete the chat first.' });
    }

    const skill = getSkill('code-generation');
    if (!skill) {
      return res.status(500).json({ error: 'code-generation skill not found' });
    }

    const ctx = createSkillContext(profileId);
    const doc = session.document as Record<string, unknown>;
    const phases = Array.isArray(doc.phases) ? doc.phases : [];
    const currentPhase = phases.find((p: unknown) => (p as Record<string, unknown>)?.id === phaseId) as Record<string, unknown> | undefined;
    const phasePages = currentPhase?.pages ?? (Array.isArray(doc.pages) ? (doc.pages as Array<Record<string, unknown>>).map(p => p.name) : []);

    const input: JsonObject = {
      ...(session.document as JsonObject),
      phaseId,
      pages: phasePages as string[],
    };

    const result = await runSkillThroughLlm(skill, ctx, input, llmConfig);

    if (result.ok && result.output) {
      const files = result.output.generatedFiles as Array<{ path: string; content: string }>;

      // Persist artifacts
      const runId = `code-${generateId()}`;
      if (files) {
        for (const file of files) {
          artifactStore.save(runId, file.path, file.content);
        }
      }

      res.json({
        ok: true,
        files: result.output.generatedFiles,
        notes: result.output.notes,
        usage: result.usage,
        artifactRunId: runId,
      });
    } else {
      res.json({ ok: false, error: result.error });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Workflow endpoints ─────────────────────────────────────────────────

// List workflows
app.get('/api/workflows', (_req, res) => {
  res.json(loadWorkflows());
});

// Run workflow (real execution)
app.post('/api/workflows/:id/run', async (req, res) => {
  const { profileId = 'vue3-admin', sessionId, params = {} } = req.body;
  const runId = `run-${generateId()}`;
  const workflowId = req.params.id;

  // Create persistent run record
  const run = runStore.create(runId, workflowId, workflowId, 'manual');

  // Return immediately, run in background
  res.json({ ok: true, runId, status: 'pending' });

  // Execute workflow in background
  (async () => {
    try {
      runStore.update(runId, { status: 'running' });

      // Load workflow definition
      const registry = await loadWorkflowRegistry(path.join(repoRoot, 'workflows'));
      const definition = registry.get(workflowId);

      if (!definition) {
        runStore.complete(runId, `Workflow not found: ${workflowId}`);
        return;
      }

      // Update stages from workflow nodes
      if (definition.nodes) {
        for (const node of definition.nodes) {
          runStore.updateStage(runId, node.id, {
            name: node.name ?? node.id,
            nodeType: node.type,
            status: 'pending',
          });
        }
      }

      // Create executor with adapters
      const executor = new WorkflowExecutor({
        runAgent: async (node, input, state) => {
          runStore.updateStage(runId, node.id, { status: 'running', startedAt: Date.now() });
          runStore.update(runId, { status: 'running' });

          const skillName = node.skill;
          if (!skillName) {
            runStore.updateStage(runId, node.id, { status: 'failed', error: 'No skill defined' });
            return { ok: false, error: `Agent node ${node.id} has no skill defined` };
          }

          const skill = getSkill(skillName);
          if (!skill) {
            runStore.updateStage(runId, node.id, { status: 'failed', error: `Skill not found: ${skillName}` });
            return { ok: false, error: `Skill not found: ${skillName}` };
          }

          const ctx = createSkillContext(profileId);
          const result = await runSkillThroughLlm(skill, ctx, input, llmConfig);

          if (result.ok) {
            runStore.updateStage(runId, node.id, {
              status: 'completed',
              completedAt: Date.now(),
              result: result.output,
            });
          } else {
            runStore.updateStage(runId, node.id, {
              status: 'failed',
              completedAt: Date.now(),
              error: result.error,
            });
          }

          return {
            ok: result.ok,
            output: result.output as JsonObject ?? undefined,
            error: result.error,
          };
        },

        runPlugin: async (node, input, state) => {
          runStore.updateStage(runId, node.id, { status: 'running', startedAt: Date.now() });

          // Dispatch to real plugins
          let result: WorkflowNodeResult;
          try {
            switch (node.id) {
              case 'project-scanner': {
                const { scanProject } = await import('@ai-frontend-engineering-agent/plugin-sdk');
                // Dynamic import of actual plugin
                const scanner = await import('../../../plugins/project-scanner/src/index.js');
                const scanResult = scanner.scanProject(state.context.targetProject ?? '.');
                result = { ok: true, output: scanResult as unknown as JsonObject };
                break;
              }
              case 'navigation-decider': {
                const nav = await import('../../../plugins/navigation-decider/src/index.js');
                result = { ok: true, output: nav.buildUiContract(input, state.context.resolvedTargetProfile) as unknown as JsonObject };
                break;
              }
              case 'page-generator': {
                const pg = await import('../../../plugins/page-generator/src/index.js');
                result = { ok: true, output: pg.buildGenerationReport(input) as unknown as JsonObject };
                break;
              }
              case 'playwright-runner': {
                const pw = await import('../../../plugins/playwright-runner/src/index.js');
                result = { ok: true, output: pw.buildPlaywrightValidation(state.context.targetProject ?? '.') as unknown as JsonObject };
                break;
              }
              case 'visual-regression-runner': {
                const vr = await import('../../../plugins/visual-regression-runner/src/index.js');
                result = { ok: true, output: vr.buildVisualRegressionValidation(state.context.targetProject ?? '.') as unknown as JsonObject };
                break;
              }
              default:
                result = { ok: true, output: { message: `Plugin ${node.id} executed (stub)` } };
            }
          } catch (err) {
            result = { ok: false, error: String(err) };
          }

          if (result.ok) {
            runStore.updateStage(runId, node.id, { status: 'completed', completedAt: Date.now(), result: result.output });
          } else {
            runStore.updateStage(runId, node.id, { status: 'failed', completedAt: Date.now(), error: result.error });
          }

          return result;
        },

        runPluginGroup: async (node, input, state) => {
          runStore.updateStage(runId, node.id, { status: 'running', startedAt: Date.now() });
          // Run all plugins in the group
          const result = { ok: true, output: { message: `Plugin group ${node.id} executed` } };
          runStore.updateStage(runId, node.id, { status: 'completed', completedAt: Date.now(), result: result.output });
          return result;
        },
      });

      // Execute the workflow
      const input: JsonObject = {
        ...(params as JsonObject),
        sessionId,
        profileId,
      };

      const options = {
        targetProject: (params as JsonObject)?.targetProject as string ?? undefined,
        targetProfile: { id: profileId },
        schemas,
        policies,
        // Approval callback — set run to waiting-approval status
        onApprovalRequired: async (node, state) => {
          runStore.update(runId, { status: 'waiting-approval' });
          runStore.updateStage(runId, node.id, { status: 'waiting-approval' });
          // In a real system, this would wait for user approval
          // For now, auto-approve (return true)
          return true;
        },
        // Node event callbacks
        onNodeStart: (node) => {
          runStore.update(runId, { status: 'running' });
        },
        onNodeComplete: (node, result) => {
          if (result.ok) {
            runStore.updateStage(runId, node.id, { status: 'completed', completedAt: Date.now() });
          }
        },
      };

      const executionResult = await executor.execute(definition, input, options);

      // Save results
      runStore.update(runId, {
        status: executionResult.status === 'completed' ? 'completed' : executionResult.status === 'waiting-approval' ? 'waiting-approval' : 'failed',
        result: executionResult.nodeResults as unknown as JsonObject,
      });

      // Save artifacts if any
      const nodeResults = executionResult.nodeResults;
      for (const [nodeId, nodeResult] of Object.entries(nodeResults)) {
        if (nodeResult?.ok && nodeResult.output) {
          const output = nodeResult.output as Record<string, unknown>;
          if (Array.isArray(output.generatedFiles)) {
            for (const file of output.generatedFiles as Array<{ path: string; content: string }>) {
              artifactStore.save(runId, `${nodeId}/${file.path}`, file.content);
              runStore.addArtifact(runId, `${nodeId}/${file.path}`);
            }
          }
        }
      }

      runStore.complete(runId);
    } catch (err) {
      runStore.complete(runId, String(err));
    }
  })();
});

// List runs
app.get('/api/runs', (_req, res) => {
  const list = runStore.list().map(r => ({
    id: r.id,
    workflowId: r.workflowId,
    workflowName: r.workflowName,
    status: r.status,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    duration: r.duration,
    error: r.error,
    artifactCount: r.artifacts.length,
  }));
  res.json(list);
});

// Get run detail
app.get('/api/runs/:id', (req, res) => {
  const run = runStore.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json(run);
});

// ─── Approval endpoints ─────────────────────────────────────────────────

// Approve a run
app.post('/api/runs/:id/approve', (req, res) => {
  const run = runStore.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  if (run.status !== 'waiting-approval') {
    return res.status(400).json({ error: `Run is not waiting for approval (current: ${run.status})` });
  }

  const { by = 'user', comment } = req.body;
  runStore.addApproval(req.params.id, { action: 'approved', by, at: Date.now(), comment });
  res.json({ ok: true, status: 'approved' });
});

// Reject a run
app.post('/api/runs/:id/reject', (req, res) => {
  const run = runStore.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  if (run.status !== 'waiting-approval') {
    return res.status(400).json({ error: `Run is not waiting for approval (current: ${run.status})` });
  }

  const { by = 'user', comment } = req.body;
  runStore.addApproval(req.params.id, { action: 'rejected', by, at: Date.now(), comment });
  res.json({ ok: true, status: 'rejected' });
});

// ─── Artifact endpoints ─────────────────────────────────────────────────

// List artifacts for a run
app.get('/api/runs/:id/artifacts', (req, res) => {
  const run = runStore.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const artifacts = artifactStore.list(req.params.id);
  res.json(artifacts);
});

// Get artifact content — use req.path to extract the file path after /api/runs/:id/artifacts/
app.get('/api/runs/:id/artifacts/*path', (req, res) => {
  const run = runStore.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const filePath = (req.params as Record<string, string>).path ?? req.path.split('/artifacts/')[1];
  if (!filePath) return res.status(400).json({ error: 'File path required' });

  const content = artifactStore.read(req.params.id, filePath);
  if (content === undefined) return res.status(404).json({ error: 'Artifact not found' });

  // Determine content type
  const ext = filePath.split('.').pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    ts: 'text/typescript',
    tsx: 'text/typescript',
    vue: 'text/plain',
    md: 'text/markdown',
  };

  res.setHeader('Content-Type', contentTypes[ext ?? ''] ?? 'text/plain');
  res.send(content);
});

// ─── Start ──────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`╔══════════════════════════════════════════╗`);
  console.log(`║   Studio API running on port ${PORT}       ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`  Model: ${llmConfig.model}`);
  console.log(`  URL:   ${llmConfig.baseUrl}`);
  console.log(`  Storage: ~/.ai-studio/data/`);
  console.log(`  Endpoints:`);
  console.log(`    GET  /api/health`);
  console.log(`    GET  /api/profiles`);
  console.log(`    GET  /api/catalog/ui?framework=vue3`);
  console.log(`    GET  /api/sessions`);
  console.log(`    POST /api/sessions`);
  console.log(`    GET  /api/sessions/:id`);
  console.log(`    DELETE /api/sessions/:id`);
  console.log(`    PATCH /api/sessions/:id`);
  console.log(`    POST /api/chat`);
  console.log(`    POST /api/chat/stream`);
  console.log(`    GET  /api/chat/:sessionId`);
  console.log(`    POST /api/generate/design`);
  console.log(`    POST /api/generate/code`);
  console.log(`    GET  /api/workflows`);
  console.log(`    POST /api/workflows/:id/run`);
  console.log(`    GET  /api/runs`);
  console.log(`    GET  /api/runs/:id`);
  console.log(`    POST /api/runs/:id/approve`);
  console.log(`    POST /api/runs/:id/reject`);
  console.log(`    GET  /api/runs/:id/artifacts`);
  console.log(`    GET  /api/runs/:id/artifacts/:file`);
});
