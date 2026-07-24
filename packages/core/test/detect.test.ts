import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as si from 'systeminformation';
import { execFile } from 'node:child_process';
import { getListeningPorts } from '../src/detect.js';

vi.mock('systeminformation', () => ({
  networkConnections: vi.fn(),
}));

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

const mockedNetworkConnections = si.networkConnections as unknown as ReturnType<typeof vi.fn>;
const mockedExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

function respondWith(stdout: string) {
  mockedExecFile.mockImplementationOnce((...args: unknown[]) => {
    const callback = args[args.length - 1] as (err: Error | null, stdout: string, stderr: string) => void;
    callback(null, stdout, '');
  });
}

function respondWithError(message: string) {
  mockedExecFile.mockImplementationOnce((...args: unknown[]) => {
    const callback = args[args.length - 1] as (err: Error | null, stdout: string, stderr: string) => void;
    callback(new Error(message), '', '');
  });
}

describe('getListeningPorts', () => {
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    mockedExecFile.mockReset();
    mockedNetworkConnections.mockReset();
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

  it('detects a normal listening process on unix', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });

    mockedNetworkConnections.mockResolvedValue([
      {
        protocol: 'tcp',
        localAddress: '127.0.0.1',
        localPort: '3000',
        peerAddress: '',
        peerPort: '',
        state: 'LISTEN',
        pid: 4242,
        process: 'node',
      },
    ]);

    respondWith('1 node /usr/bin/node server.js\n');
    respondWith('bash\n');

    const ports = await getListeningPorts();

    expect(ports).toEqual([
      {
        port: 3000,
        pid: 4242,
        protocol: 'tcp',
        processName: 'node',
        command: '/usr/bin/node server.js',
        origin: 'unknown',
      },
    ]);
  });

  it('omits a port whose process exited before lookup (race condition)', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });

    mockedNetworkConnections.mockResolvedValue([
      {
        protocol: 'tcp',
        localAddress: '127.0.0.1',
        localPort: '5173',
        peerAddress: '',
        peerPort: '',
        state: 'LISTEN',
        pid: 9999,
        process: '',
      },
    ]);

    respondWithError('ps: process not found');

    const ports = await getListeningPorts();

    expect(ports).toEqual([]);
  });

  it('detects a listening process on windows via PowerShell', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    mockedNetworkConnections.mockResolvedValue([
      {
        protocol: 'tcp',
        localAddress: '0.0.0.0',
        localPort: '8080',
        peerAddress: '',
        peerPort: '',
        state: 'LISTEN',
        pid: 1234,
        process: 'node.exe',
      },
    ]);

    respondWith(
      JSON.stringify({ Name: 'node.exe', CommandLine: 'node.exe server.js', ParentProcessId: 500 }),
    );
    respondWith(JSON.stringify({ Name: 'Code.exe', CommandLine: 'Code.exe', ParentProcessId: 1 }));

    const ports = await getListeningPorts();

    expect(ports).toEqual([
      {
        port: 8080,
        pid: 1234,
        protocol: 'tcp',
        processName: 'node.exe',
        command: 'node.exe server.js',
        origin: 'agent',
      },
    ]);

    const [file] = mockedExecFile.mock.calls[0] as [string, string[]];
    expect(file).toBe('powershell.exe');
  });

  it('ignores non-LISTEN states and invalid pids', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });

    mockedNetworkConnections.mockResolvedValue([
      {
        protocol: 'tcp',
        localAddress: '127.0.0.1',
        localPort: '443',
        peerAddress: '1.2.3.4',
        peerPort: '51000',
        state: 'ESTABLISHED',
        pid: 111,
        process: 'node',
      },
      {
        protocol: 'tcp',
        localAddress: '127.0.0.1',
        localPort: '80',
        peerAddress: '',
        peerPort: '',
        state: 'LISTEN',
        pid: 0,
        process: '',
      },
    ]);

    const ports = await getListeningPorts();

    expect(ports).toEqual([]);
    expect(mockedExecFile).not.toHaveBeenCalled();
  });
});
