import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as si from 'systeminformation';
import { classifyOrigin } from './classify.js';
import type { PortInfo, Protocol, ProcessInfo } from './types.js';

const execFileAsync = promisify(execFile);

// Full process tables can be a few hundred KB of JSON/text on a busy
// machine — well past Node's 1MB default maxBuffer for exec/execFile.
const PROCESS_TABLE_MAX_BUFFER = 10 * 1024 * 1024;

function isValidPid(pid: unknown): pid is number {
  return typeof pid === 'number' && Number.isInteger(pid) && pid > 0;
}

function normalizeProtocol(raw: string): Protocol {
  return raw.toLowerCase().startsWith('udp') ? 'udp' : 'tcp';
}

interface UnixProcessRecord {
  ppid: number;
  comm: string;
  args: string;
}

// One "ps" call for the whole process table, instead of one call per pid
// (plus one more per parent pid) — the earlier per-pid version re-shelled
// out for every unique pid on every refresh, which is the dominant cost
// on a machine with many listening ports.
async function queryAllUnixProcesses(): Promise<Map<number, UnixProcessRecord>> {
  const { stdout } = await execFileAsync('ps', ['-A', '-o', 'pid=,ppid=,comm=,args='], {
    maxBuffer: PROCESS_TABLE_MAX_BUFFER,
  });

  const table = new Map<number, UnixProcessRecord>();
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const [pidToken, ppidToken, commToken, ...rest] = trimmed.split(/\s+/);
    const pid = Number(pidToken);
    if (!isValidPid(pid)) continue;

    const comm = commToken ?? '';
    table.set(pid, {
      ppid: Number(ppidToken),
      comm,
      args: rest.length > 0 ? rest.join(' ') : comm,
    });
  }
  return table;
}

function resolveUnixProcessInfo(pid: number, table: Map<number, UnixProcessRecord>): ProcessInfo {
  const entry = table.get(pid);
  if (!entry) {
    throw new Error(`No process found for pid ${pid}`);
  }

  const parentEntry = isValidPid(entry.ppid) ? table.get(entry.ppid) : undefined;

  return {
    pid,
    processName: entry.comm,
    command: entry.args,
    parentName: parentEntry?.comm ?? '',
  };
}

interface WindowsProcessRecord {
  ProcessId?: number;
  Name?: string;
  CommandLine?: string;
  ParentProcessId?: number;
}

// Same batching principle as the Unix path: one Get-CimInstance call for
// every process, instead of a fresh powershell.exe spawn per pid (and
// another per parent pid) — powershell.exe's own startup overhead, not
// the WMI query itself, was what made refreshes slow with many ports open.
async function queryAllWindowsProcesses(): Promise<Map<number, WindowsProcessRecord>> {
  const script =
    'Get-CimInstance Win32_Process | ' +
    'Select-Object ProcessId,Name,CommandLine,ParentProcessId | ' +
    'ConvertTo-Json -Compress';
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    maxBuffer: PROCESS_TABLE_MAX_BUFFER,
  });

  const trimmed = stdout.trim();
  if (!trimmed) return new Map();

  const parsed: unknown = JSON.parse(trimmed);
  // ConvertTo-Json emits a bare object instead of a one-element array
  // when the pipeline only produced a single result.
  const records = (Array.isArray(parsed) ? parsed : [parsed]) as WindowsProcessRecord[];

  const table = new Map<number, WindowsProcessRecord>();
  for (const record of records) {
    if (isValidPid(record.ProcessId)) {
      table.set(record.ProcessId, record);
    }
  }
  return table;
}

function resolveWindowsProcessInfo(pid: number, table: Map<number, WindowsProcessRecord>): ProcessInfo {
  const record = table.get(pid);
  if (!record) {
    throw new Error(`No process found for pid ${pid}`);
  }

  const parentRecord = isValidPid(record.ParentProcessId) ? table.get(record.ParentProcessId) : undefined;

  return {
    pid,
    processName: record.Name ?? '',
    command: record.CommandLine ?? record.Name ?? '',
    parentName: parentRecord?.Name ?? '',
  };
}

export async function getListeningPorts(): Promise<PortInfo[]> {
  const connections = await si.networkConnections();
  const listening = connections.filter(
    (conn) => conn.state?.toUpperCase() === 'LISTEN' && isValidPid(conn.pid),
  );

  if (listening.length === 0) {
    return [];
  }

  const isWindows = process.platform === 'win32';
  const processTable = isWindows ? await queryAllWindowsProcesses() : await queryAllUnixProcesses();

  const result: PortInfo[] = [];

  for (const conn of listening) {
    const pid = conn.pid;

    let processInfo: ProcessInfo;
    try {
      processInfo = isWindows
        ? resolveWindowsProcessInfo(pid, processTable as Map<number, WindowsProcessRecord>)
        : resolveUnixProcessInfo(pid, processTable as Map<number, UnixProcessRecord>);
    } catch {
      // Process exited between the port scan and building the process
      // table — it isn't meaningfully "listening" anymore, so drop it
      // rather than surface it as unknown.
      continue;
    }

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
