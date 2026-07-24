---
"porthawk-core": patch
"porthawk": patch
"porthawk-vscode": patch
---

Fix the extension never activating: an explicit empty `activationEvents` array suppressed VS Code's automatic activation inference, so the sidebar never registered its data provider. Also add a Marketplace icon.
