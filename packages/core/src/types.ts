export type Protocol = 'tcp' | 'udp';

export type Origin = 'agent' | 'manual' | 'unknown';

export interface ProcessInfo {
  pid: number;
  processName: string;
  command: string;
  parentName: string;
}

export interface PortInfo {
  port: number;
  pid: number;
  protocol: Protocol;
  processName: string;
  command: string;
  origin: Origin;
}

export interface ClassifyRule {
  namePattern: RegExp;
  parentPattern?: RegExp;
  origin: Origin;
}
