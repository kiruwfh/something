# SafeCheck VS Code Extension

SafeCheck is a privacy-first security scanning companion for Visual Studio Code. It runs popular open source security tools locally, aggregates their results, and surfaces actionable findings directly inside the editor. The extension normalises findings into a consistent format, highlights issues inline via Diagnostics, and provides quick fixes for frequent security mistakes. No source code ever leaves your machine unless you explicitly enable the optional AI assistant.

## Why SafeCheck?

- **Local-first:** SafeCheck shells out to tools you install on your machine. There is no telemetry and no project data leaves your device.
- **Unified results:** Findings from Semgrep, Bandit, OSV-Scanner, Gitleaks, and Trivy are normalised into SARIF 2.1.0 and surfaced as VS Code diagnostics.
- **Actionable:** Inspect findings in a dedicated panel, jump to affected lines, ignore noisy rules, record baselines, and export reports.
- **Optional AI:** When enabled, SafeCheck can request patch suggestions from an OpenRouter-compatible LLM using minimal snippets. The feature is disabled by default.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm
- VS Code 1.85.0 or newer

### Install Dependencies

```bash
npm install
npm run build
```

Open the project in VS Code and press `F5` (Run → Start Debugging) to launch an Extension Development Host with SafeCheck loaded.

### External Scanners

Install the tools you want SafeCheck to orchestrate and ensure they are available on your PATH.

| Tool | Purpose | Install |
| --- | --- | --- |
| Semgrep | Static analysis with OWASP Top Ten rules | [Docs](https://semgrep.dev/docs/getting-started/) |
| Bandit | Python AST security checks | `pip install bandit` |
| OSV-Scanner | Dependency vulnerability scanning | [GitHub releases](https://github.com/google/osv-scanner#installation) |
| Gitleaks | Secret detection | `brew install gitleaks` or [releases](https://github.com/gitleaks/gitleaks#installation) |
| Trivy | FS / IaC scanning | `brew install trivy` or [docs](https://aquasecurity.github.io/trivy/latest/getting-started/installation/) |

If a binary is missing, SafeCheck shows a friendly notification and continues with the remaining tools.

### Configuration

SafeCheck reads settings from VS Code (`safecheck.*`) and an optional `safecheck.config.json` file in your workspace root. Key settings include:

- `safecheck.enableSemgrep`, `safecheck.enableBandit`, `safecheck.enableOsv`, `safecheck.enableGitleaks`, `safecheck.enableTrivy`
- `safecheck.paths.<tool>` to override binary locations
- `safecheck.baseline.enabled` / `safecheck.baseline.path`
- `safecheck.ignoreFile`
- `safecheck.severity.levels`
- `safecheck.llm.enabled`, `safecheck.llm.model`, `safecheck.llm.baseUrl`

Run **SafeCheck: Scan Workspace** from the Command Palette to trigger a scan.

### Baseline & Ignore

- **Baseline:** Execute **SafeCheck: Toggle Baseline** to snapshot the current findings into `.safecheck/baseline.json`. Future scans will suppress entries found in the baseline when baseline filtering is enabled.
- **Ignore:** Add glob patterns or `rule:<ruleId>` directives to `.safecheckignore` to silence files or rules permanently.

### Quick Fixes

SafeCheck ships with four quick fixes that do not rely on AI:

1. Replace insecure `yaml.load` with `yaml.safe_load`.
2. Convert `subprocess.run(..., shell=True)` into a safer invocation with `shell=False` and `check=True`.
3. Insert Express `helmet()` middleware if missing.
4. Switch insecure crypto hashes such as `md5` to `sha256` in JS/TS files.

### Reports

- **SARIF:** Run **SafeCheck: Export SARIF Report** to write `.safecheck/reports/latest.sarif`.
- **HTML:** The same command also produces `.safecheck/reports/latest.html` summarising findings.

### Optional AI Assistance

1. Enable via `"safecheck.llm.enabled": true`.
2. Provide credentials via environment variables or settings:
   - `SAFE_LLM_PROVIDER=openrouter`
   - `OPENROUTER_API_KEY=<key>`
   - `OPENROUTER_BASE_URL` (defaults to `https://openrouter.ai/api/v1`)
   - `OPENROUTER_MODEL` (defaults to `openrouter/auto`)
3. The results panel shows a **Suggest AI Fix** button. SafeCheck sends only a small snippet (±30 lines), the rule ID, and message. Returned unified diffs are shown for manual review before applying.

### Testing

Run automated tests with:

```bash
npm test
```

Fixtures under `test/fixtures` contain intentionally vulnerable code to exercise the parsers and baseline/ignore logic.

### Packaging

Create a VSIX by running:

```bash
npm run package
```

This uses `vsce` to produce `safecheck-vscode.vsix`.

## Manual Verification

1. Install at least one supported scanner.
2. Open a fixture workspace (for example `test/fixtures/js-demo`).
3. Run **SafeCheck: Scan Workspace**.
4. Review diagnostics, panel entries, and try quick fixes.

## License

SafeCheck is distributed under the [MIT License](./LICENSE).
