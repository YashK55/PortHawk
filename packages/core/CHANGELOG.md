# porthawk-core

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
