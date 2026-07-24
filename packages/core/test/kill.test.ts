import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { killProcess } from '../src/kill.js';

vi.mock('node:child_process', () => {
  const execFileMock = vi.fn();
  return {
    execFile: Object.assign(execFileMock, {
      [Symbol.for('nodejs.util.promisify.custom')]: (...args: unknown[]) =>
        new Promise((resolve, reject) => {
          execFileMock(...args, (error: Error | null, stdout: string, stderr: string) => {
            if (error) reject(error);
            else resolve({ stdout, stderr });
          });
        }),
    }),
  };
});

const mockedExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

describe('killProcess', () => {
  let originalPlatform: PropertyDescriptor | undefined;
  const originalKill = process.kill;
  let killSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    mockedExecFile.mockReset();
    mockedExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, stdout: string, stderr: string) => void;
      callback(null, '', '');
    });
    killSpy = vi.fn(() => true);
    process.kill = killSpy as unknown as typeof process.kill;
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
    process.kill = originalKill;
  });

  it('rejects a non-integer pid', async () => {
    await expect(killProcess(1.5)).rejects.toThrow('Invalid pid');
  });

  it('rejects a non-positive pid', async () => {
    await expect(killProcess(-1)).rejects.toThrow('Invalid pid');
    await expect(killProcess(0)).rejects.toThrow('Invalid pid');
  });

  it('uses process.kill on unix', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    await killProcess(4242);
    expect(killSpy).toHaveBeenCalledWith(4242);
    expect(mockedExecFile).not.toHaveBeenCalled();
  });

  it('uses taskkill via execFile with an argument array on windows', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    await killProcess(4242);
    expect(mockedExecFile).toHaveBeenCalledWith(
      'taskkill',
      ['/PID', '4242', '/F'],
      expect.any(Function),
    );
    expect(killSpy).not.toHaveBeenCalled();
  });
});
