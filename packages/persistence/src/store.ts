/**
 * JSON File Store — Atomic read/write with directory auto-creation
 *
 * All data persisted as JSON files under a configurable base directory.
 * Default: ~/.ai-studio/data/
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, statSync, renameSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_BASE_DIR = join(homedir(), '.ai-studio', 'data');

export interface StoreOptions {
  baseDir?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export class JsonFileStore<T = any> {
  private filePath: string;
  private dirPath: string;

  constructor(filename: string, options: StoreOptions = {}) {
    const baseDir = options.baseDir ?? DEFAULT_BASE_DIR;
    this.dirPath = baseDir;
    this.filePath = join(baseDir, filename);
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!existsSync(this.dirPath)) {
      mkdirSync(this.dirPath, { recursive: true });
    }
  }

  /** Read all records. Returns empty object if file doesn't exist. */
  readAll(): Record<string, T> {
    this.ensureDir();
    if (!existsSync(this.filePath)) {
      return {};
    }
    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw) as Record<string, T>;
    } catch {
      return {};
    }
  }

  /** Read a single record by ID. Returns undefined if not found. */
  read(id: string): T | undefined {
    const all = this.readAll();
    return all[id];
  }

  /** Write a single record. Merges with existing data. */
  write(id: string, record: T): void {
    const all = this.readAll();
    all[id] = record;
    this.writeAll(all);
  }

  /** Write all records atomically. */
  writeAll(data: Record<string, T>): void {
    this.ensureDir();
    const tmp = this.filePath + '.tmp';
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    // Atomic rename (same filesystem)
    renameSync(tmp, this.filePath);
  }

  /** Delete a single record by ID. */
  delete(id: string): boolean {
    const all = this.readAll();
    if (!(id in all)) return false;
    delete all[id];
    this.writeAll(all);
    return true;
  }

  /** Update a single record (partial merge). */
  update(id: string, patch: Partial<T>): T | undefined {
    const all = this.readAll();
    if (!(id in all)) return undefined;
    all[id] = { ...all[id], ...patch };
    this.writeAll(all);
    return all[id];
  }

  /** List all records as array. */
  list(): T[] {
    return Object.values(this.readAll());
  }

  /** Check if a record exists. */
  exists(id: string): boolean {
    const all = this.readAll();
    return id in all;
  }

  /** Get record count. */
  count(): number {
    return Object.keys(this.readAll()).length;
  }
}

/**
 * Artifact Store — File-based artifact storage
 * Stores generated files (code, designs, reports) organized by runId.
 */
export class ArtifactStore {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? join(DEFAULT_BASE_DIR, 'artifacts');
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /** Save an artifact file for a run. */
  save(runId: string, filePath: string, content: string): string {
    const artifactDir = join(this.baseDir, runId);
    if (!existsSync(artifactDir)) {
      mkdirSync(artifactDir, { recursive: true });
    }
    const fullPath = join(artifactDir, filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
    return fullPath;
  }

  /** Read an artifact file. */
  read(runId: string, filePath: string): string | undefined {
    const fullPath = join(this.baseDir, runId, filePath);
    if (!existsSync(fullPath)) return undefined;
    return readFileSync(fullPath, 'utf-8');
  }

  /** List all artifacts for a run. */
  list(runId: string): Array<{ path: string; size: number; modified: Date }> {
    const artifactDir = join(this.baseDir, runId);
    if (!existsSync(artifactDir)) return [];
    return this.walkDir(artifactDir, artifactDir);
  }

  private walkDir(dir: string, base: string): Array<{ path: string; size: number; modified: Date }> {
    const results: Array<{ path: string; size: number; modified: Date }> = [];
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.walkDir(fullPath, base));
      } else {
        const stat = statSync(fullPath);
        results.push({
          path: fullPath.slice(base.length + 1),
          size: stat.size,
          modified: stat.mtime,
        });
      }
    }
    return results;
  }

  /** Delete all artifacts for a run. */
  deleteRun(runId: string): boolean {
    const artifactDir = join(this.baseDir, runId);
    if (!existsSync(artifactDir)) return false;
    rmSync(artifactDir, { recursive: true, force: true });
    return true;
  }

  /** Get the full path for a run's artifact directory. */
  getRunDir(runId: string): string {
    return join(this.baseDir, runId);
  }
}
