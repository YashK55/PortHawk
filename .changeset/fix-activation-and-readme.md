---
"porthawk-core": patch
"porthawk": patch
"porthawk-vscode": patch
---

Fix the extension still not activating after 0.1.4, and add a README to the extension listing. VS Code's automatic activation inference wasn't reliably kicking in with activationEvents omitted, so an explicit onView activation event is declared instead.
