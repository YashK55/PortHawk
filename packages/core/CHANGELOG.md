# porthawk-core

## 0.1.6

### Patch Changes

- adcbb9f: Fix the actual root cause of the extension never activating: the bundled `dist/extension.js` was CommonJS content shipped under a `"type": "module"` package.json, which made the extension host's module loading of it ambiguous/version-dependent. Renamed the build output to `dist/extension.cjs`, which Node always treats as CommonJS regardless of `"type"`. Verified by actually calling `activate()` against the built bundle and confirming `porthawk.refresh` and the other commands register.

  Also: add a `porthawk.hideSystemProcesses` setting (on by default) so the sidebar shows only dev-server-like ports, not OS/service processes — a display-only filter, detection is unaffected and the CLI always shows everything. And fix several UI strings that had been mangled into mojibake (an em dash, middle dots, arrows, and an ellipsis all showed as garbled characters).

## 0.1.5

### Patch Changes

- 587c430: Fix the extension still not activating after 0.1.4, and add a README to the extension listing. VS Code's automatic activation inference wasn't reliably kicking in with activationEvents omitted, so an explicit onView activation event is declared instead.

## 0.1.4

### Patch Changes

- 3261eb2: Fix the extension never activating: an explicit empty `activationEvents` array suppressed VS Code's automatic activation inference, so the sidebar never registered its data provider. Also add a Marketplace icon.

## 0.1.3

### Patch Changes

- 4a90b71: Fix Open VSX publishing: the release workflow now creates the Open VSX namespace automatically if it doesn't exist yet, instead of failing the release.

## 0.1.2

### Patch Changes

- 5b7e556: Fix packaging/publishing: correct LICENSE file placement so the extension bundle satisfies Marketplace packaging requirements.

## 0.1.1
