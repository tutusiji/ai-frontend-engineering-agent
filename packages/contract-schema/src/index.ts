import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { JsonObject, SchemaRef } from '../../shared-types/src';

export interface SchemaRegistryOptions {
  contractsDir: string;
}

export class FileSchemaRegistry {
  constructor(private readonly options: SchemaRegistryOptions) {}

  // 按约定把 schema 名称映射到 contracts 目录下的 json 文件。
  async get(ref: SchemaRef): Promise<JsonObject | undefined> {
    const filePath = path.join(this.options.contractsDir, `${ref.name}.schema.json`);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw) as JsonObject;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }

  async listAvailable(): Promise<string[]> {
    const entries = await fs.readdir(this.options.contractsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.schema.json'))
      .map((entry) => entry.name.replace(/\.schema\.json$/, ''))
      .sort();
  }
}
