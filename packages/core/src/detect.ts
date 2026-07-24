import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as si from 'systeminformation';
import { classifyOrigin } from './classify.js';
import type { PortInfo, Protocol, ProcessInfo } from './types.js';

const execFileAsync = promisify(execFile);

function isValidPid(pid: unknown): pid is number {
  return typeof pid === 'number' && Number.isInteger(pid) && pid > 0;
}

function normalizeProtocol(raw: string): Protocol {
  return raw.toLowerCase().startsWith('udp') ? 'udp' : 'tcp';
}

async function getUnixProcessInfo(pid: number): Promise<ProcessInfo> {
  const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', 'ppid=,comm=,args=']);
  const line = stdout.trim();
  const [ppidToken, commToken, ...rest] = line.split(/\s+/);
  const processName = commToken ?? '';
  const command = rest.length > 0 ? rest.join(' ') : processName;
  const ppid = Number(ppidToken);

  let parentName = '';
  if (isValidPid(ppid)) {
    try {
      const { stdout: parentStdout } = await execFileAsync('ps', ['-p', String(ppid), '-o', 'comm=']);
      parentName = parentStdout.trim();
    } catch {
      parentName = '';
    }
  }

  return { pid, processName, command, parentName };
}

interface WindowsProcessRecord {
  Name?: string;
  CommandLine?: string;
  ParentProcessId?: number;
}

async function queryWindowsProcess(pid: number): Promise<WindowsProcessRecord | undefined> {
  const script = `Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object Name,CommandLine,ParentProcessId | ConvertTo-Json -Compress`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  const trimmed = stdout.trim();
  if (!trimmed) return undefined;
  return JSON.parse(trimmed) as WindowsProcessRecord;
}

async function getWindowsProcessInfo(pid: number): Promise<ProcessInfo> {
  const record = await queryWindowsProcess(pid);
  if (!record) {
    throw new Error(`No process found for pid ${pid}`);
  }

  let parentName = '';
  if (isValidPid(record.ParentProcessId)) {
    try {
      const parentRecord = await queryWindowsProcess(record.ParentProcessId);
      parentName = parentRecord?.Name ?? '';
    } catch {
      parentName = '';
    }
  }

  return {
    pid,
    processName: record.Name ?? '',
    command: record.CommandLine ?? record.Name ?? '',
    parentName,
  };
}

async function getProcessInfo(pid: number): Promise<ProcessInfo> {
  return process.platform === 'win32' ? getWindowsProcessInfo(pid) : getUnixProcessInfo(pid);
}

export async function getListeningPorts(): Promise<PortInfo[]> {
  const connections = await si.networkConnections();
  const listening = connections.filter(
    (conn) => conn.state?.toUpperCase() === 'LISTEN' && isValidPid(conn.pid),
  );

  const processInfoByPid = new Map<number, ProcessInfo | null>();

  const result: PortInfo[] = [];

  for (const conn of listening) {
    const pid = conn.pid;

    if (!processInfoByPid.has(pid)) {
      try {
        processInfoByPid.set(pid, await getProcessInfo(pid));
      } catch {
        processInfoByPid.set(pid, null);
      }
    }

    const processInfo = processInfoByPid.get(pid);
    if (!processInfo) continue;

    const port = Number(conn.localPort);
    if (!Number.isInteger(port)) continue;

    result.push({
      port,
      pid,
      protocol: normalizeProtocol(conn.protocol),
      processName: processInfo.processName,
      command: processInfo.command,
      origin: classifyOrigin(processInfo),
    });
  }

  const seen = new Set<string>();
  return result.filter((entry) => {
    const key = `${entry.pid}:${entry.port}:${entry.protocol}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
