---
"porthawk-core": patch
"porthawk": patch
"porthawk-vscode": patch
---

Fix the actual root cause of the extension never activating: the bundled `dist/extension.js` was CommonJS content shipped under a `"type": "module"` package.json, which made the extension host's module loading of it ambiguous/version-dependent. Renamed the build output to `dist/extension.cjs`, which Node always treats as CommonJS regardless of `"type"`. Verified by actually calling `activate()` against the built bundle and confirming `porthawk.refresh` and the other commands register.

Also: add a `porthawk.hideSystemProcesses` setting (on by default) so the sidebar shows only dev-server-like ports, not OS/service processes — a display-only filter, detection is unaffected and the CLI always shows everything. And fix several UI strings that had been mangled into mojibake (an em dash, middle dots, arrows, and an ellipsis all showed as garbled characters).
