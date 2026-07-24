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
