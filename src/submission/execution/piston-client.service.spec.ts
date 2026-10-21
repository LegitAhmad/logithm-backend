import { ConfigService } from '@nestjs/config';
import { PistonClientService } from './piston-client.service';

const program = { files: [{ name: 'main.py', content: 'print(1)' }], stdin: '[]' };
const success = { language: 'python', version: '3.12.0', run: { code: 0, signal: null, stdout: '{"version":1,"value":1}', stderr: '' } };

describe('resource-bound Piston client', () => {
  let originalFetch: typeof fetch;
  let request: jest.Mock;
  let client: PistonClientService;
  beforeEach(() => {
    originalFetch = global.fetch;
    request = jest.fn().mockResolvedValue(new Response(JSON.stringify(success)));
    global.fetch = request;
    client = new PistonClientService(new ConfigService({ pistonUrl: 'http://executor:2000/' }));
  });
  afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

  it('rejects invalid executor responses without exposing upstream payloads', async () => {
    request.mockResolvedValue(new Response('{"secret":"internal executor traceback"}'));
    await expect(client.execute('python', '3.12.0', program)).rejects.toThrow('Execution service unavailable');
  });

  it('rejects a successful compilation response that omits its run stage', async () => {
    request.mockResolvedValue(new Response(JSON.stringify({ language: 'go', version: '1.16.2', compile: { code: 0, signal: null, stdout: '', stderr: '' } })));
    await expect(client.execute('go', '1.16.2', program)).rejects.toThrow('Execution service unavailable');
  });

  it('bounds streamed response bytes before parsing', async () => {
    request.mockResolvedValue(new Response(JSON.stringify({
      ...success, run: { ...success.run, stdout: 'x'.repeat(16 * 1024 * 1024) },
    })));
    await expect(client.execute('python', '3.12.0', program)).rejects.toThrow('exceeded output limits');
  });

  it('caps concurrent execution and only releases the next queued request on completion', async () => {
    const release: (() => void)[] = [];
    request.mockImplementation(() => new Promise<Response>(resolve => release.push(() => resolve(new Response(JSON.stringify(success))))));
    const runs = Array.from({ length: 6 }, () => client.execute('python', '3.12.0', program));
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(4);
    release[0]();
    await runs[0];
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(5);
    release[1]();
    await runs[1];
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(6);
    for (let index = 2; index < release.length; index++) release[index]();
    await Promise.all(runs);
  });

  it('aborts requests at the fixed transport deadline', async () => {
    jest.useFakeTimers();
    request.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))));
    const run = client.execute('python', '3.12.0', program);
    const rejected = expect(run).rejects.toThrow('timed out');
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(20000);
    await rejected;
  });
});
