import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PISTON_LANGUAGES } from './submission/execution/language-map';

@Injectable()
export class AppService implements OnModuleDestroy {
  private shuttingDown = false;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
  ) {}

  onModuleDestroy() {
    this.shuttingDown = true;
  }

  async getReadiness() {
    const results = await Promise.allSettled([
      this.checkDatabase(),
      this.checkExecutor(),
    ]);
    const dependencies = {
      mongodb: results[0].status === 'fulfilled' ? 'up' : 'down',
      executor: results[1].status === 'fulfilled' ? 'up' : 'down',
    };
    if (this.shuttingDown || results.some((result) => result.status === 'rejected')) {
      throw new ServiceUnavailableException({ status: 'not_ready', dependencies });
    }
    return { status: 'ready', dependencies };
  }

  private async checkDatabase() {
    if (this.connection.readyState !== 1 || !this.connection.db) {
      throw new Error('Database unavailable');
    }
    await this.connection.db.command({ ping: 1 }, { timeoutMS: 2500 });
  }

  private async checkExecutor() {
    const response = await fetch(`${this.config.getOrThrow<string>('pistonUrl')}/api/v2/runtimes`, {
      signal: AbortSignal.timeout(3000),
      redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('Executor unavailable');
    }
    // A live daemon is not ready unless every adapter's exact runtime is installed.
    const runtimes: unknown = await response.json();
    if (
      !Array.isArray(runtimes) ||
      !Object.values(PISTON_LANGUAGES).every((required) =>
        runtimes.some((runtime: unknown) =>
          typeof runtime === 'object' &&
          runtime !== null &&
          'language' in runtime &&
          'version' in runtime &&
          runtime.language === required.language &&
          runtime.version === required.version,
        ),
      )
    ) {
      throw new Error('Required executor runtime versions unavailable');
    }
  }
}
