/**
 * Studio API — Express server wrapping workflow-core + agent-runtime
 *
 * Endpoints:
 *   GET  /api/health              — health check
 *   GET  /api/profiles            — list available target profiles
 *   GET  /api/catalog/ui          — UI library catalog
 *   POST /api/chat                — interactive requirement conversation
 *   POST /api/generate/design     — generate HTML design mockup
 *   POST /api/generate/code       — generate code files
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
  type LlmConfig,
} from '@ai-frontend-engineering-agent/agent-runtime';
import type { SkillContext } from '@ai-frontend-engineering-agent/skill-sdk';
import type { JsonObject } from '@ai-frontend-engineering-agent/shared-types';
import { UI_CATALOG, getCompatibleLibraries } from '@ai-frontend-engineering-agent/agent-runtime';
// Note: UI_CATALOG and getCompatibleLibraries are re-exported from agent-runtime/src/index.ts

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
  profileId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  document: JsonObject | null;
  createdAt: number;
}

const sessions = new Map<string, ChatSession>();

function getOrCreateSession(sessionId: string, profileId: string): ChatSession {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      profileId,
      messages: [],
      document: null,
      createdAt: Date.now(),
    });
  }
  return sessions.get(sessionId)!;
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

// Chat — interactive requirement conversation
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId = 'default', profileId = 'vue3-admin', userMessage, mode = 'gather' } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    const session = getOrCreateSession(sessionId, profileId);
    session.messages.push({ role: 'user', content: userMessage });

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
      session.messages.push({ role: 'assistant', content: JSON.stringify(result.output) });
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

// Get session state
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
      // Save HTML file
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
  console.log(`    POST /api/chat`);
  console.log(`    GET  /api/chat/:sessionId`);
  console.log(`    POST /api/generate/design`);
  console.log(`    POST /api/generate/code`);
});
