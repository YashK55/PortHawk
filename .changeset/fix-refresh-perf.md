---
"porthawk-core": patch
"porthawk": patch
"porthawk-vscode": patch
---

Fix slow refreshes: the Windows and Unix process lookups now query the whole process table in a single call instead of spawning a fresh shell process per listening port (and another per parent process). Measured roughly a 10x speedup on a real machine with about 15 listening ports.
