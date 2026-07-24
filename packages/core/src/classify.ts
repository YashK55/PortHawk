import type { ClassifyRule, Origin, ProcessInfo } from './types.js';

const agentHostPattern = /^(code|code-oss|cursor|windsurf)(\.exe|\s.*)?$/i;

const rules: ClassifyRule[] = [
  { namePattern: /claude/i, origin: 'agent' },
  { namePattern: /^(node|python|python3|deno|bun)(\.exe)?$/i, parentPattern: agentHostPattern, origin: 'agent' },
  { namePattern: /^(bash|zsh|sh|fish|powershell|pwsh|cmd)(\.exe)?$/i, parentPattern: agentHostPattern, origin: 'agent' },
];

export function classifyOrigin(processInfo: ProcessInfo): Origin {
  for (const rule of rules) {
    if (!rule.namePattern.test(processInfo.processName)) continue;
    if (rule.parentPattern && !rule.parentPattern.test(processInfo.parentName)) continue;
    return rule.origin;
  }
  return 'unknown';
}

// Well-known OS/service process names — used only to declutter a display
// (e.g. the VS Code sidebar's "hide system processes" setting), never to
// change what getListeningPorts() actually detects. A process spoofing one
// of these names would be just as invisible to a plain "netstat" read, so
// this is a display convenience, not a security boundary.
const systemProcessPattern =
  /^(System|System Idle Process|Registry|smss|csrss|wininit|winlogon|services|lsass|lsaiso|svchost|dwm|fontdrvhost|spoolsv|taskhostw|SearchIndexer|MsMpEng|WmiPrvSE|dllhost|conhost|RuntimeBroker|sihost|ctfmon|explorer|systemd|launchd|kernel_task|init|rpcbind|dbus-daemon|cupsd|mDNSResponder|coreaudiod|WindowServer|loginwindow|SystemUIServer|configd|syslogd|logind|cron|rsyslogd|NetworkManager|polkitd|udevd|avahi-daemon)(\.exe)?$/i;

export function isSystemProcess(processName: string): boolean {
  return systemProcessPattern.test(processName);
}
