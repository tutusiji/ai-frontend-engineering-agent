/**
 * Session Store — Persistent session management
 */

import { JsonFileStore } from './store.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  name: string;
  profileId?: string;
  uiLibrary?: string;
  messages: ChatMessage[];
  document?: Record<string, unknown>;
  completeness: number;
  createdAt: number;
  updatedAt: number;
}

export class SessionStore {
  private store: JsonFileStore<Session>;

  constructor(baseDir?: string) {
    this.store = new JsonFileStore<Session>('sessions.json', { baseDir });
  }

  create(id: string, name?: string): Session {
    const now = Date.now();
    const session: Session = {
      id,
      name: name ?? `会话 ${new Date(now).toLocaleString('zh-CN')}`,
      messages: [],
      completeness: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.store.write(id, session);
    return session;
  }

  get(id: string): Session | undefined {
    return this.store.read(id);
  }

  list(): Session[] {
    return this.store.list().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  update(id: string, patch: Partial<Session>): Session | undefined {
    return this.store.update(id, { ...patch, updatedAt: Date.now() });
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  addMessage(id: string, message: ChatMessage): Session | undefined {
    const session = this.store.read(id);
    if (!session) return undefined;
    session.messages.push(message);
    session.updatedAt = Date.now();
    this.store.write(id, session);
    return session;
  }

  updateDocument(id: string, document: Record<string, unknown>, completeness: number): Session | undefined {
    return this.store.update(id, {
      document,
      completeness,
      updatedAt: Date.now(),
    });
  }
}
