import 'mocha';
import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseSemgrep } from '../../src/scanners/parsers/semgrepParser';
import { parseBandit } from '../../src/scanners/parsers/banditParser';
import { parseGitleaks } from '../../src/scanners/parsers/gitleaksParser';
import { parseTrivy } from '../../src/scanners/parsers/trivyParser';
import { parseOsv } from '../../src/scanners/parsers/osvParser';
import { filterBaseline } from '../../src/utils/baseline';
import { loadIgnoreConfig, isIgnored } from '../../src/utils/ignore';
import { buildSarif } from '../../src/scanners/parsers/sarif';

const fixturesRoot = path.resolve(__dirname, '..', 'fixtures');
process.env.SAFECHECK_TEST_WORKSPACE = fixturesRoot;

describe('SafeCheck parsing pipeline', () => {
  it('normalises findings and filters baseline', () => {
    const semgrepOut = fs.readFileSync(path.join(fixturesRoot, 'semgrep-sample.json'), 'utf8');
    const banditOut = fs.readFileSync(path.join(fixturesRoot, 'bandit-sample.json'), 'utf8');
    const gitleaksOut = fs.readFileSync(path.join(fixturesRoot, 'gitleaks-sample.json'), 'utf8');
    const trivyOut = fs.readFileSync(path.join(fixturesRoot, 'trivy-sample.json'), 'utf8');
    const osvOut = fs.readFileSync(path.join(fixturesRoot, 'osv-sample.json'), 'utf8');

    const findings = [
      ...parseSemgrep(semgrepOut, fixturesRoot),
      ...parseBandit(banditOut, fixturesRoot),
      ...parseGitleaks(gitleaksOut, fixturesRoot),
      ...parseTrivy(trivyOut, fixturesRoot),
      ...parseOsv(osvOut, fixturesRoot, 'package-lock.json')
    ];

    expect(findings).to.have.length(5);

    const baseline = {
      findings: [
        {
          ruleId: findings[0].ruleId,
          file: findings[0].file,
          line: findings[0].line
        }
      ]
    };

    const filtered = filterBaseline(findings, baseline);
    expect(filtered).to.have.length(4);

    const sarif = buildSarif(filtered, fixturesRoot) as any;
    expect(sarif.runs[0].results).to.have.length(4);
  });

  it('respects ignore file rules', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safecheck-test-'));
    const ignorePath = path.join(tempDir, '.safecheckignore');
    fs.writeFileSync(ignorePath, 'py-demo/*\nrule:hardcoded-secret\n');
    const ignoreConfig = loadIgnoreConfig(tempDir);

    const shouldIgnoreFile = isIgnored(ignoreConfig, tempDir, path.join(tempDir, 'py-demo/app.py'), 'any');
    const shouldIgnoreRule = isIgnored(ignoreConfig, tempDir, path.join(tempDir, 'js-demo/server.js'), 'hardcoded-secret');
    const shouldNotIgnore = isIgnored(ignoreConfig, tempDir, path.join(tempDir, 'Dockerfile'), 'CVE-1234');

    expect(shouldIgnoreFile).to.be.true;
    expect(shouldIgnoreRule).to.be.true;
    expect(shouldNotIgnore).to.be.false;
  });
});
