import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PistonStage {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
  message: string | null;
  cpu_time?: number;
  wall_time?: number;
  memory?: number;
}

export interface PistonExecuteResult {
  language: string;
  version: string;
  compile?: PistonStage;
  run: PistonStage;
}

@Injectable()
export class PistonClientService {
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('pistonUrl') ?? 'http://localhost:2000';
  }

  async execute(
    language: string,
    version: string,
    code: string,
    stdin: string,
  ): Promise<PistonExecuteResult> {
    const res = await fetch(`${this.baseUrl}/api/v2/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language,
        version,
        files: [{ content: code }],
        stdin,
      }),
    });

    if (!res.ok) {
      throw new InternalServerErrorException(
        `Piston execute failed: ${res.status} ${await res.text()}`,
      );
    }

    return (await res.json()) as PistonExecuteResult;
  }
}
