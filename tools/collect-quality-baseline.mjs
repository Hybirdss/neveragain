import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync, execSync } from 'node:child_process';

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, 'docs/ops/quality-baseline-2026-03.md');
const SCAN_ROOTS = ['apps', 'packages', 'workers', 'tools'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.wrangler']);
const HOTSPOT_LIMIT = 10;
const TODO_REGEX = /\b(TODO|FIXME|HACK|XXX)\b/g;

const DURATION_COMMANDS = [
  ['globe test', 'npm run test -w @namazue/globe'],
  ['worker test', 'npm run test -w @namazue/worker'],
  ['worker typecheck', 'npm run typecheck -w @namazue/worker'],
  ['globe build', 'npm run build -w @namazue/globe'],
];

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      if (entry.name !== '.github') continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(fullPath, out);
      continue;
    }
    const ext = path.extname(entry.name);
    if (SOURCE_EXTENSIONS.has(ext)) {
      out.push(fullPath);
    }
  }
}

function getSourceFiles() {
  const files = [];
  for (const root of SCAN_ROOTS) {
    const dir = path.join(ROOT, root);
    if (!fs.existsSync(dir)) continue;
    walk(dir, files);
  }
  return files.sort();
}

function countLines(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (!text) return 0;
  return text.split('\n').length;
}

function countTodoTokens(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const matches = text.match(TODO_REGEX);
  return matches ? matches.length : 0;
}

function countTests(files) {
  return files.filter((file) => file.includes('__tests__') || file.includes('.test.')).length;
}

function safeGitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function runDurationCommand(name, command) {
  const start = performance.now();
  const result = spawnSync(command, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    timeout: 10 * 60 * 1000,
  });
  const elapsedMs = performance.now() - start;
  return {
    name,
    command,
    seconds: Number((elapsedMs / 1000).toFixed(2)),
    status: result.status === 0 ? 'pass' : 'fail',
    exitCode: result.status ?? -1,
    stderrPreview: (result.stderr || '').trim().split('\n').slice(-3).join('\n'),
  };
}

function renderMarkdown({
  generatedAt,
  gitSha,
  sourceCount,
  testCount,
  todoCount,
  hotspots,
  durations,
}) {
  const hotspotLines = hotspots
    .map((item, idx) => `${idx + 1}. \`${item.path}\` — ${item.lines} LOC`)
    .join('\n');

  const durationTable = durations
    .map((d) => `| ${d.name} | \`${d.command}\` | ${d.status} | ${d.seconds}s | ${d.exitCode} |`)
    .join('\n');

  const failedDiagnostics = durations
    .filter((d) => d.status === 'fail' && d.stderrPreview)
    .map((d) => `- ${d.name}: \`${d.stderrPreview.replace(/`/g, "'")}\``)
    .join('\n');

  return `# Quality Baseline (2026-03)

Generated at: ${generatedAt}  
Git SHA: \`${gitSha}\`

## Snapshot Metrics

- Source files scanned: **${sourceCount}**
- Test files: **${testCount}**
- Inline debt markers (TODO/FIXME/HACK/XXX): **${todoCount}**

## Largest Source Files (Top ${HOTSPOT_LIMIT})

${hotspotLines || '_No source files found._'}

## Command Duration Baseline

| Command | Invocation | Status | Duration | Exit code |
|---|---|---|---:|---:|
${durationTable}

${failedDiagnostics ? `### Failed Command Diagnostics\n\n${failedDiagnostics}\n` : ''}
## Notes

- This report is a baseline, not a target judgment.
- Use month-over-month comparisons to verify quality trend improvements.
`;
}

function main() {
  const files = getSourceFiles();
  const sourceCount = files.length;
  const testCount = countTests(files);
  const todoCount = files.reduce((acc, file) => acc + countTodoTokens(file), 0);
  const hotspots = files
    .map((file) => ({
      path: path.relative(ROOT, file),
      lines: countLines(file),
    }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, HOTSPOT_LIMIT);

  const durations = DURATION_COMMANDS.map(([name, command]) => runDurationCommand(name, command));

  const markdown = renderMarkdown({
    generatedAt: new Date().toISOString(),
    gitSha: safeGitSha(),
    sourceCount,
    testCount,
    todoCount,
    hotspots,
    durations,
  });

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, markdown, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main();
