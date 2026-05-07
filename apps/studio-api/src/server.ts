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
 *     POST /api/workflows/:id/run         — run a workflow
 *     GET  /api/runs                      — list run history
 *     GET  /api/runs/:id                  — get run detail
 */

import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileSchemaRegistry } from '@ai-frontend-engineering-agent/contract-schema';
import { FilePolicyRegistry } from '@ai-frontend-engineering-agent/policy-engine';
import {
  getSkill,
  runSkillThroughLlm,
  loadLlmConfigFromEnv,
  chatCompletion,
  type LlmConfig,
} from '@ai-frontend-engineering-agent/agent-runtime';
import type { SkillContext } from '@ai-frontend-engineering-agent/skill-sdk';
import type { JsonObject } from '@ai-frontend-engineering-agent/shared-types';
import { UI_CATALOG, getCompatibleLibraries } from '@ai-frontend-engineering-agent/agent-runtime';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

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

// ─── In-memory sessions ────────────────────────────────────────────────

interface ChatSession {
  id: string;
  name: string;
  profileId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  document: JsonObject | null;
  createdAt: number;
  updatedAt: number;
}

interface WorkflowRun {
  id: string;
  workflowId: string;
  sessionId: string | null;
  profileId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt: number | null;
  result: JsonObject | null;
  error: string | null;
  logs: Array<{ timestamp: number; level: string; message: string }>;
}

const sessions = new Map<string, ChatSession>();
const runs = new Map<string, WorkflowRun>();

function getOrCreateSession(sessionId: string, profileId: string): ChatSession {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      name: `会话 ${sessions.size + 1}`,
      profileId,
      messages: [],
      document: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  return sessions.get(sessionId)!;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Load workflows ─────────────────────────────────────────────────────

function loadWorkflows(): Array<{ id: string; name: string; description: string; stages: string[] }> {
  const workflowsDir = path.join(repoRoot, 'workflows');
  if (!existsSync(workflowsDir)) return [];

  const files = readdirSync(workflowsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  const results: Array<{ id: string; name: string; description: string; stages: string[] }> = [];

  for (const file of files) {
    const content = readFileSync(path.join(workflowsDir, file), 'utf-8');
    // Simple YAML parsing for workflow metadata
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
  const list = Array.from(sessions.values())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(s => ({
      id: s.id,
      name: s.name,
      profileId: s.profileId,
      messageCount: s.messages.length,
      completeness: (s.document as Record<string, unknown>)?.completeness as number ?? 0,
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
  const session: ChatSession = {
    id,
    name: name ?? `会话 ${sessions.size + 1}`,
    profileId,
    messages: [],
    document: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  sessions.set(id, session);
  res.json({ id, name: session.name, profileId: session.profileId });
});

// Get session
app.get('/api/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// Delete session
app.delete('/api/sessions/:id', (req, res) => {
  const existed = sessions.delete(req.params.id);
  res.json({ ok: existed });
});

// Update session
app.patch('/api/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (req.body.name) session.name = req.body.name;
  if (req.body.profileId) session.profileId = req.body.profileId;
  session.updatedAt = Date.now();
  res.json({ ok: true });
});

// ─── Chat endpoints ─────────────────────────────────────────────────────

// Non-streaming chat (existing)
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId = 'default', profileId = 'vue3-admin', userMessage, mode = 'gather' } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    const session = getOrCreateSession(sessionId, profileId);
    session.messages.push({ role: 'user', content: userMessage, timestamp: Date.now() });
    session.updatedAt = Date.now();

    const skill = getSkill('interactive-requirement');
    if (!skill) {
      return res.status(500).json({ error: 'interactive-requirement skill not found' });
    }

    const ctx = createSkillContext(profileId);
    const input: JsonObject = {
      userMessage,
      conversationHistory: session.messages as JsonObject[],
      existingDocument: session.document,
      mode,
    };

    const result = await runSkillThroughLlm(skill, ctx, input, llmConfig);

    if (result.ok && result.output) {
      session.document = result.output;
      session.messages.push({ role: 'assistant', content: JSON.stringify(result.output), timestamp: Date.now() });
    }

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

  const session = getOrCreateSession(sessionId, profileId);
  session.messages.push({ role: 'user', content: userMessage, timestamp: Date.now() });
  session.updatedAt = Date.now();

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

    // Build prompt
    const ctx = createSkillContext(profileId);
    const input: JsonObject = {
      userMessage,
      conversationHistory: session.messages as JsonObject[],
      existingDocument: session.document,
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

    // Extract JSON and update session
    const { extractJson } = await import('@ai-frontend-engineering-agent/agent-runtime');
    const parsed = extractJson(fullContent);

    if (parsed) {
      let output = parsed;
      if (skill.normalize) {
        output = await skill.normalize(parsed);
      }
      session.document = output;
      session.messages.push({ role: 'assistant', content: JSON.stringify(output), timestamp: Date.now() });
      send('document', { document: output });
    } else {
      session.messages.push({ role: 'assistant', content: fullContent, timestamp: Date.now() });
      send('document', { document: null, raw: fullContent });
    }

    send('end', { sessionId: session.id, messageCount: session.messages.length });
  } catch (err) {
    send('error', { error: String(err) });
  }

  res.end();
});

// Get chat session state (legacy compatibility)
app.get('/api/chat/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
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
    const session = sessions.get(sessionId);

    if (!session?.document) {
      return res.status(400).json({ error: 'No requirement document. Complete the chat first.' });
    }

    const skill = getSkill('design-generation');
    if (!skill) {
      return res.status(500).json({ error: 'design-generation skill not found' });
    }

    const ctx = createSkillContext(profileId);
    const input: JsonObject = {
      ...session.document,
      phaseId: 'P1',
    };

    const result = await runSkillThroughLlm(skill, ctx, input, llmConfig);

    if (result.ok && result.output) {
      const files = result.output.generatedFiles as Array<{ path: string; content: string }>;
      const htmlFile = files?.find(f => f.path?.endsWith('.html'));

      res.json({
        ok: true,
        files: result.output.generatedFiles,
        htmlContent: htmlFile?.content ?? null,
        usage: result.usage,
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
    const session = sessions.get(sessionId);

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
      ...session.document,
      phaseId,
      pages: phasePages as string[],
    };

    const result = await runSkillThroughLlm(skill, ctx, input, llmConfig);

    if (result.ok && result.output) {
      res.json({
        ok: true,
        files: result.output.generatedFiles,
        notes: result.output.notes,
        usage: result.usage,
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

// Run workflow (background)
app.post('/api/workflows/:id/run', async (req, res) => {
  const { profileId = 'vue3-admin', sessionId, params = {} } = req.body;
  const runId = `run-${generateId()}`;

  const run: WorkflowRun = {
    id: runId,
    workflowId: req.params.id,
    sessionId: sessionId ?? null,
    profileId,
    status: 'pending',
    startedAt: Date.now(),
    completedAt: null,
    result: null,
    error: null,
    logs: [{ timestamp: Date.now(), level: 'info', message: `工作流 ${req.params.id} 已创建` }],
  };
  runs.set(runId, run);

  // Run asynchronously
  (async () => {
    run.status = 'running';
    run.logs.push({ timestamp: Date.now(), level: 'info', message: '工作流开始执行' });

    try {
      // For now, simulate workflow execution
      // In real implementation, this would call workflow-core executor
      const session = sessionId ? sessions.get(sessionId) : null;

      if (session?.document) {
        run.logs.push({ timestamp: Date.now(), level: 'info', message: '检测到已有需求文档' });
      }

      // Simulate stages
      const workflows = loadWorkflows();
      const workflow = workflows.find(w => w.id === req.params.id);

      if (workflow) {
        for (const stage of workflow.stages) {
          run.logs.push({ timestamp: Date.now(), level: 'info', message: `执行阶段: ${stage}` });
          // Simulate work
          await new Promise(r => setTimeout(r, 500));
        }
      }

      run.status = 'completed';
      run.completedAt = Date.now();
      run.result = { message: '工作流执行完成', workflowId: req.params.id };
      run.logs.push({ timestamp: Date.now(), level: 'info', message: '工作流执行完成' });
    } catch (err) {
      run.status = 'failed';
      run.completedAt = Date.now();
      run.error = String(err);
      run.logs.push({ timestamp: Date.now(), level: 'error', message: `执行失败: ${String(err)}` });
    }
  })();

  res.json({ ok: true, runId, status: run.status });
});

// List runs
app.get('/api/runs', (_req, res) => {
  const list = Array.from(runs.values())
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(r => ({
      id: r.id,
      workflowId: r.workflowId,
      sessionId: r.sessionId,
      profileId: r.profileId,
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      error: r.error,
    }));
  res.json(list);
});

// Get run detail
app.get('/api/runs/:id', (req, res) => {
  const run = runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json(run);
});

// ─── Helpers ────────────────────────────────────────────────────────────

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

// ─── Start ──────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`╔══════════════════════════════════════════╗`);
  console.log(`║   Studio API running on port ${PORT}       ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`  Model: ${llmConfig.model}`);
  console.log(`  URL:   ${llmConfig.baseUrl}`);
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
});
