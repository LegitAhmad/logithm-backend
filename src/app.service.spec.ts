import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { Connection } from 'mongoose';
import { AppService } from './app.service';

describe('application readiness', () => {
  const installedRuntimes = [
    { language: 'python', version: '3.12.0', aliases: ['python3'] },
    { language: 'javascript', version: '20.11.1', aliases: ['js'] },
    { language: 'typescript', version: '5.0.3', aliases: ['ts'] },
    { language: 'go', version: '1.16.2', aliases: [] },
  ];
  let service: AppService;
  let command: jest.Mock;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    command = jest.fn().mockResolvedValue({ ok: 1 });
    const connection = { readyState: 1, db: { command } } as unknown as Connection;
    service = new AppService(connection, new ConfigService({ pistonUrl: 'http://executor:2000' }));
    fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(installedRuntimes)),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pings MongoDB and requires all supported exact runtime versions', async () => {
    await expect(service.getReadiness()).resolves.toEqual({
      status: 'ready',
      dependencies: { mongodb: 'up', executor: 'up' },
    });
    expect(command).toHaveBeenCalledWith({ ping: 1 }, { timeoutMS: 2500 });
    expect(fetchMock).toHaveBeenCalledWith('http://executor:2000/api/v2/runtimes', {
      signal: expect.any(AbortSignal),
      redirect: 'error',
    });
  });

  it('does not report an empty executor as ready', async () => {
    fetchMock.mockResolvedValue(new Response('[]'));
    await expect(service.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it.each(['python', 'javascript', 'typescript', 'go'])(
    'rejects readiness when %s is missing even if other runtimes are installed',
    async (language) => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify(
        installedRuntimes.filter((runtime) => runtime.language !== language),
      )));
      await expect(service.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
    },
  );

  it.each(['python', 'javascript', 'typescript', 'go'])(
    'rejects readiness when %s has only the wrong version installed',
    async (language) => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify(
        installedRuntimes.map((runtime) =>
          runtime.language === language ? { ...runtime, version: '0.0.0' } : runtime,
        ),
      )));
      await expect(service.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
    },
  );

  it('reports dependency failure without leaking the underlying message', async () => {
    command.mockRejectedValue(new Error('mongodb://user:secret@private-host'));
    try {
      await service.getReadiness();
      throw new Error('Expected unavailable readiness');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toEqual({
        status: 'not_ready',
        dependencies: { mongodb: 'down', executor: 'up' },
      });
    }
  });

  it('stops advertising readiness during graceful shutdown', async () => {
    service.onModuleDestroy();
    await expect(service.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
