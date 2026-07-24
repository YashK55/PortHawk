# porthawk-vscode

## 0.1.5

### Patch Changes

- 587c430: Fix the extension still not activating after 0.1.4, and add a README to the extension listing. VS Code's automatic activation inference wasn't reliably kicking in with activationEvents omitted, so an explicit onView activation event is declared instead.
- Updated dependencies [587c430]
  - porthawk-core@0.1.5

## 0.1.4

### Patch Changes

- 3261eb2: Fix the extension never activating: an explicit empty `activationEvents` array suppressed VS Code's automatic activation inference, so the sidebar never registered its data provider. Also add a Marketplace icon.
- Updated dependencies [3261eb2]
  - porthawk-core@0.1.4

## 0.1.3

### Patch Changes

- 4a90b71: Fix Open VSX publishing: the release workflow now creates the Open VSX namespace automatically if it doesn't exist yet, instead of failing the release.
- Updated dependencies [4a90b71]
  - porthawk-core@0.1.3

## 0.1.2

### Patch Changes

- 5b7e556: Fix packaging/publishing: correct LICENSE file placement so the extension bundle satisfies Marketplace packaging requirements.
- Updated dependencies [5b7e556]
  - porthawk-core@0.1.2

## 0.1.1

### Patch Changes

- d8f923a: Add a publisher id to the extension manifest so it can be packaged and published.
  - porthawk-core@0.1.1
