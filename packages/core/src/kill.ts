import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function assertValidPid(pid: number): void {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`Invalid pid: ${pid}`);
  }
}

export async function killProcess(pid: number): Promise<void> {
  assertValidPid(pid);

  if (process.platform === 'win32') {
    await execFileAsync('taskkill', ['/PID', String(pid), '/F']);
    return;
  }

  process.kill(pid);
}
