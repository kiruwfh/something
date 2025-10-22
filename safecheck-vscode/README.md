# SafeCheck VS Code Extension

SafeCheck is a local-first security companion for Visual Studio Code, Cursor, and Windsurf. The extension orchestrates your on-disk security scanners, aggregates their results, and helps you review and remediate vulnerabilities without sending full files to the cloud. Optional AI suggestions use OpenRouter only when you explicitly request them.

## Features

- **Scan Workspace:** Run Semgrep, Bandit, OSV-Scanner, Gitleaks, and (optionally) Trivy against the current project.
- **Unified Findings:** Diagnostics appear inline in the editor and inside the SafeCheck findings panel with filters, search, and jump-to-location.
- **Noise Reduction:** Maintain a baseline snapshot to hide known issues and use `.safecheckignore` for file or rule suppressions.
- **Reports:** Export SARIF 2.1.0 and HTML summaries into `.safecheck/reports/`.
- **AI-on-demand:** Request a unified diff fix for any finding. Only a minimal, redacted snippet (±30 lines) leaves your machine.

## Requirements

- [Node.js](https://nodejs.org/) 18 or later
- VS Code 1.85.0+, Cursor, or Windsurf
- External scanners installed locally (see below)

## Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   npm run build
   ```
2. Launch VS Code, run **Run and Debug → Start Debugging** (F5) to open an Extension Development Host with SafeCheck.
3. To produce an installable package, run `npm run package` and install the generated `.vsix` in VS Code, Cursor, or Windsurf (Extensions view → `…` menu → **Install from VSIX…**).

## External scanners

SafeCheck shells out to the scanners on your PATH. Install the tools you need and make sure they are discoverable.

### Arch Linux (paru examples)
```bash
# Semgrep
paru -S semgrep  # или pipx install semgrep
# Bandit
pipx install bandit
# OSV-Scanner
paru -S osv-scanner
# gitleaks
paru -S gitleaks
# Trivy (опционально)
paru -S trivy
```

### Other platforms

- **Semgrep:** `pipx install semgrep` or follow the [official quick start](https://semgrep.dev/docs/getting-started/).
- **Bandit:** `pipx install bandit` or `pip install bandit` inside a virtual environment.
- **OSV-Scanner:** Download binaries from the [GitHub releases page](https://github.com/google/osv-scanner#installation) or use your package manager.
- **Gitleaks:** `brew install gitleaks` on macOS, or grab binaries from [GitHub releases](https://github.com/gitleaks/gitleaks#installation).
- **Trivy (optional):** Follow the [official installation guide](https://aquasecurity.github.io/trivy/latest/getting-started/installation/) for your platform.

If a tool is missing, SafeCheck shows a gentle reminder and continues with the remaining scanners.

## Usage

### Run a scan

1. Open a workspace folder containing your project.
2. Run **SafeCheck: Scan Workspace** from the Command Palette.
3. Findings appear as diagnostics and inside **SafeCheck: Open Findings Panel**.
4. Use the panel filters (tool, severity, search) and click a finding to jump to the affected location.

### Baseline and ignore

- **Baseline:** Run **SafeCheck: Snapshot Baseline** to capture current findings into `.safecheck/baseline.json`. When `safecheck.baseline.enabled` (default), only new findings are shown.
- **Ignore rules/files:** Create `.safecheckignore` in the workspace root. List glob patterns per line or use `rule:<ruleId>` to suppress specific rules.

Example `.safecheckignore`:
```
# Ignore generated code
build/**
rule:SEMGRP001
```

### Reports

Run **SafeCheck: Export Reports** to generate:

- `.safecheck/reports/latest.sarif` (SARIF 2.1.0)
- `.safecheck/reports/latest.html`

These files are overwritten on each export.

## Optional AI suggestions

AI suggestions are disabled by default. SafeCheck only calls OpenRouter when you press **Suggest AI Fix** on a finding.

1. Run **SafeCheck: Open Settings**.
2. Enable **AI suggestions**, choose the model (`deepseek/deepseek-chat-v3.1:free` by default), and set the base URL (defaults to `https://openrouter.ai/api/v1`).
3. Enter your OpenRouter API key. The key is stored securely via VS Code `SecretStorage`. You can also set `OPENROUTER_API_KEY` in the environment.
4. Click **Test Connection** to confirm access.
5. In the findings panel, click **Suggest AI Fix** to request a patch. A diff preview opens; you can copy or apply it after manual review.

### Privacy and context control

- Only a snippet of ±30 lines around the finding, the `ruleId`, message, language, and file path are sent.
- Obvious secrets (e.g., `API_KEY=...`) are redacted before transmission.
- SafeCheck warns before the first snippet leaves your machine.

## Configuration reference

All settings live under the `safecheck` namespace (Settings UI or `settings.json`). Key options:

- `safecheck.tools.semgrep.enabled` (default `true`)
- `safecheck.tools.bandit.enabled` (default `true`)
- `safecheck.tools.osv.enabled` (default `true`)
- `safecheck.tools.gitleaks.enabled` (default `true`)
- `safecheck.tools.trivy.enabled` (default `false`)
- `safecheck.scan.exclude`: additional glob exclusions passed to Semgrep.
- `safecheck.baseline.enabled`: hide findings present in the baseline snapshot.
- `safecheck.baseline.path`: relative path to the baseline file (default `.safecheck/baseline.json`).
- `safecheck.reports.outputDir`: reports folder (default `.safecheck/reports`).
- `safecheck.llm.enabled`, `safecheck.llm.baseUrl`, `safecheck.llm.model` for AI control.

## Development

- Build: `npm run build`
- Watch: `npm run watch`
- Lint/type-check: `npm run lint`
- Tests: `npm test`
- Package: `npm run package`

End-to-end tests mock scanner JSON outputs to verify parsing, baseline filtering, SARIF generation, and ignore rules.

## Privacy statement

SafeCheck is local-first. No source code leaves your machine unless you enable AI suggestions, in which case only the minimal snippet described above is sent to the configured OpenRouter endpoint. API keys are stored via VS Code SecretStorage.

## License

SafeCheck is distributed under the [MIT License](./LICENSE).
