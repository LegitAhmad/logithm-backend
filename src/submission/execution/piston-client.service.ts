import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { WrappedProgram } from './wrappers';

const StageValidator = z.object({
  stdout: z.string(), stderr: z.string(), code: z.number().nullable(),
  signal: z.string().nullable().optional().default(null),
  message: z.string().nullable().optional().default(null),
  cpu_time: z.number().optional(), wall_time: z.number().optional(), memory: z.number().optional(),
});
const ResultValidator = z.object({
  language: z.string(),
  version: z.string(),
  compile: StageValidator.optional(),
  run: StageValidator.optional(),
}).refine(result => result.run !== undefined || (
  result.compile !== undefined && (result.compile.code !== 0 || !!result.compile.signal)
), 'Executor must return a run stage unless compilation failed');
export type PistonStage = z.infer<typeof StageValidator>;
export type PistonExecuteResult = z.infer<typeof ResultValidator>;
// Piston duplicates streams in `output`; JSON escaping adds further wire overhead.
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const DEADLINE_MS = 20000;

@Injectable()
export class PistonClientService {
  private readonly baseUrl: string;
  private active = 0;
  private readonly pending: (() => void)[] = [];

  constructor(configService: ConfigService) {
    this.baseUrl = (configService.get<string>('pistonUrl') ?? 'http://localhost:2000').replace(/\/$/, '');
  }

  private async acquire(): Promise<void> {
    if (this.active < 4) { this.active++; return; }
    if (this.pending.length >= 32) throw new ServiceUnavailableException('Execution capacity reached; try again shortly');
    await new Promise<void>((resolve, reject) => {
      const resume = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        const index = this.pending.indexOf(resume);
        if (index !== -1) this.pending.splice(index, 1);
        reject(new ServiceUnavailableException('Execution queue deadline exceeded'));
      }, DEADLINE_MS);
      this.pending.push(resume);
    });
  }

  private release() {
    const next = this.pending.shift();
    if (next) next();
    else this.active--;
  }

  async execute(language: string, version: string, program: WrappedProgram): Promise<PistonExecuteResult> {
    await this.acquire();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEADLINE_MS);
    try {
      const response = await fetch(`${this.baseUrl}/api/v2/execute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({
          language, version, files: program.files, stdin: program.stdin,
          compile_timeout: 10000, run_timeout: 3000,
          compile_cpu_time: 10000, run_cpu_time: 3000,
          compile_memory_limit: 256 * 1024 * 1024,
          run_memory_limit: 128 * 1024 * 1024,
        }),
      });
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error('Executor unavailable');
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('Executor output limit exceeded'); }
          chunks.push(chunk.value);
        }
      } finally { reader.releaseLock(); }
      const body = Buffer.concat(chunks, size).toString('utf8');
      return ResultValidator.parse(JSON.parse(body));
    } catch {
      throw new ServiceUnavailableException('Execution service unavailable, timed out, or exceeded output limits');
    } finally {
      clearTimeout(timer);
      this.release();
    }
  }
}
