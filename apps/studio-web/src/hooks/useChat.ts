/**
 * useChat — chat logic with SSE streaming support
 */

import { useState, useRef, useCallback } from 'react';

const API = '/api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  streaming?: boolean;
}

export interface RequirementDocument {
  featureName: string;
  businessGoal: string;
  userRoles: Array<{ name: string; description: string; permissions: string[] }>;
  uiLibrary: { id: string; name: string; npmPackage: string } | null;
  pages: Array<{
    name: string;
    goal: string;
    pageType: string;
    sections: string[];
    actions: string[];
    fields: Array<{ name: string; type: string; required: boolean; description: string }>;
    interactions: string[];
  }>;
  entities: Array<{ name: string; fields: Array<{ name: string; type: string; required: boolean }> }>;
  businessRules: string[];
  edgeCases: string[];
  nonFunctional: string[];
  phases: Array<{ id: string; name: string; pages: string[]; priority: string }>;
  completeness: number;
  openQuestions: string[];
  suggestedNextStep: string;
}

export function useChat(sessionId: string | null, profileId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [document, setDocument] = useState<RequirementDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Load session messages
  const loadSession = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`${API}/chat/${sid}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
      setDocument(data.document ?? null);
    } catch {
      // session might not exist yet
      setMessages([]);
      setDocument(null);
    }
  }, []);

  // Send message with SSE streaming
  const sendStreaming = useCallback(async (text: string) => {
    if (!sessionId || !text.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setStreaming(true);
    setStreamContent('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, profileId, userMessage: text }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const event = line.slice(7).trim();
            continue;
          }
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.content) {
              fullContent += data.content;
              setStreamContent(fullContent);
            }
            if (data.document) {
              setDocument(data.document);
            }
          }
        }
      }

      // Add the final assistant message
      if (fullContent) {
        // Try to format a nice display message
        let displayContent = fullContent;
        try {
          // If it's JSON (requirement doc), format it nicely
          const parsed = JSON.parse(fullContent);
          if (parsed.completeness !== undefined) {
            displayContent = formatAiResponse(parsed);
          }
        } catch {
          // Not JSON, use as-is
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: displayContent,
          timestamp: Date.now(),
        }]);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ 请求失败: ${(err as Error).message}`,
          timestamp: Date.now(),
        }]);
      }
    } finally {
      setLoading(false);
      setStreaming(false);
      setStreamContent('');
      abortRef.current = null;
    }
  }, [sessionId, profileId, loading]);

  // Non-streaming fallback
  const send = useCallback(async (text: string) => {
    if (!sessionId || !text.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, profileId, userMessage: text }),
      });
      const data = await res.json();

      if (data.document) {
        setDocument(data.document);
        const aiResponse = formatAiResponse(data.document);
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse, timestamp: Date.now() }]);
      } else if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${data.error}`, timestamp: Date.now() }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ 请求失败', timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, profileId, loading]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    document,
    loading,
    streaming,
    streamContent,
    send: sendStreaming, // Use streaming by default
    sendNonStream: send,
    stop,
    loadSession,
    setMessages,
    setDocument,
  };
}

function formatAiResponse(doc: RequirementDocument): string {
  const parts: string[] = [];

  if (doc.featureName) parts.push(`功能: ${doc.featureName}`);
  if (doc.uiLibrary) parts.push(`UI 库: ${doc.uiLibrary.name}`);
  if (doc.pages.length > 0) parts.push(`页面: ${doc.pages.map(p => p.name).join(', ')}`);
  parts.push(`完整度: ${doc.completeness}%`);

  if (doc.openQuestions.length > 0) {
    parts.push('\n待确认问题:');
    doc.openQuestions.forEach((q, i) => parts.push(`  ${i + 1}. ${q}`));
  }

  if (doc.suggestedNextStep === 'generate-design') {
    parts.push('\n💡 需求已足够完整，可以生成设计稿了');
  } else if (doc.suggestedNextStep === 'start-coding') {
    parts.push('\n🚀 需求已非常完整，可以开始生成代码');
  }

  return parts.join('\n');
}
