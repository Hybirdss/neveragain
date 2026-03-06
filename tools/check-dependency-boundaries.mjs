import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const DEFAULT_ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const SKIP_SEGMENTS = new Set([
  '.git',
  '.worktrees',
  'node_modules',
  'dist',
  'coverage',
  '.wrangler',
]);
const DEFAULT_EXCLUDED_PREFIXES = [
  '.claude/',
  'tools/tests/fixtures/',
];

const IMPORT_PATTERN = /\b(?:import|export)\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s*['"]([^'"]+)['"]/g;

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

function shouldSkipDirectory(dirName) {
  return SKIP_SEGMENTS.has(dirName);
}

function walkSourceFiles(rootDir, currentDir, files, excludedPrefixes) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = normalizePath(path.relative(rootDir, fullPath));

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }
      if (excludedPrefixes.some((prefix) => relativePath.startsWith(prefix))) {
        continue;
      }
      walkSourceFiles(rootDir, fullPath, files, excludedPrefixes);
      continue;
    }

    if (!isSourceFile(fullPath)) {
      continue;
    }
    if (excludedPrefixes.some((prefix) => relativePath.startsWith(prefix))) {
      continue;
    }

    files.push(fullPath);
  }
}

function getSourceFiles(rootDir, excludedPrefixes = DEFAULT_EXCLUDED_PREFIXES) {
  const files = [];
  for (const topLevel of ['apps', 'packages']) {
    const startDir = path.join(rootDir, topLevel);
    if (!fs.existsSync(startDir)) {
      continue;
    }
    walkSourceFiles(rootDir, startDir, files, excludedPrefixes);
  }
  return files.sort();
}

function extractImports(sourceText) {
  const imports = [];
  for (const match of sourceText.matchAll(IMPORT_PATTERN)) {
    const importPath = match[1] ?? match[2] ?? match[3];
    if (importPath) {
      imports.push(importPath);
    }
  }
  return imports;
}

function resolveRelativeImport(rootDir, sourcePath, importPath) {
  const absoluteSourceDir = path.dirname(path.join(rootDir, sourcePath));
  const candidateBase = path.resolve(absoluteSourceDir, importPath);
  const candidates = [
    candidateBase,
    `${candidateBase}.ts`,
    `${candidateBase}.tsx`,
    `${candidateBase}.js`,
    `${candidateBase}.jsx`,
    `${candidateBase}.mjs`,
    `${candidateBase}.cjs`,
    `${candidateBase}.mts`,
    `${candidateBase}.cts`,
    path.join(candidateBase, 'index.ts'),
    path.join(candidateBase, 'index.tsx'),
    path.join(candidateBase, 'index.js'),
    path.join(candidateBase, 'index.mjs'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return normalizePath(path.relative(rootDir, candidate));
    }
  }

  return normalizePath(path.relative(rootDir, candidateBase));
}

function classifyPath(modulePath) {
  if (!modulePath) return { layer: 'unknown', scope: null };

  const normalized = normalizePath(modulePath);
  const parts = normalized.split('/');

  if (parts[0] === 'apps' && parts[1] === 'globe') {
    return { layer: 'app-globe', scope: '@namazue/globe' };
  }
  if (parts[0] === 'apps' && parts[1] === 'worker') {
    return { layer: 'app-worker', scope: '@namazue/worker' };
  }
  if (parts[0] === 'packages' && parts[1]) {
    const packageName = parts[1];
    if (packageName === 'kernel') return { layer: 'kernel', scope: '@namazue/kernel' };
    if (packageName === 'contracts') return { layer: 'contracts', scope: '@namazue/contracts' };
    if (packageName.startsWith('domain-')) return { layer: 'domain', scope: `@namazue/${packageName}` };
    if (packageName.startsWith('application-')) return { layer: 'application', scope: `@namazue/${packageName}` };
    if (packageName.startsWith('adapters-')) return { layer: 'adapters', scope: `@namazue/${packageName}` };
    if (packageName === 'ops') return { layer: 'legacy-package', scope: '@namazue/ops' };
    if (packageName === 'db') return { layer: 'legacy-package', scope: '@namazue/db' };
    return { layer: 'package-other', scope: `@namazue/${packageName}` };
  }

  return { layer: 'external', scope: null };
}

function classifyImportTarget(rootDir, sourcePath, importPath) {
  if (importPath.startsWith('.')) {
    const resolvedPath = resolveRelativeImport(rootDir, sourcePath, importPath);
    return {
      importPath,
      resolvedPath,
      ...classifyPath(resolvedPath),
    };
  }

  if (importPath.startsWith('@namazue/')) {
    const scope = importPath.split('/').slice(0, 2).join('/');
    if (scope === '@namazue/globe') return { importPath, resolvedPath: null, layer: 'app-globe', scope };
    if (scope === '@namazue/worker') return { importPath, resolvedPath: null, layer: 'app-worker', scope };
    if (scope === '@namazue/kernel') return { importPath, resolvedPath: null, layer: 'kernel', scope };
    if (scope === '@namazue/contracts') return { importPath, resolvedPath: null, layer: 'contracts', scope };
    if (scope.startsWith('@namazue/domain-')) return { importPath, resolvedPath: null, layer: 'domain', scope };
    if (scope.startsWith('@namazue/application-')) return { importPath, resolvedPath: null, layer: 'application', scope };
    if (scope.startsWith('@namazue/adapters-')) return { importPath, resolvedPath: null, layer: 'adapters', scope };
    if (scope === '@namazue/ops' || scope === '@namazue/db') {
      return { importPath, resolvedPath: null, layer: 'legacy-package', scope };
    }
    return { importPath, resolvedPath: null, layer: 'package-other', scope };
  }

  return { importPath, resolvedPath: null, layer: 'external', scope: null };
}

function evaluateBoundaryRules(sourceMeta, targetMeta) {
  const violations = [];
  const sameScope = sourceMeta.scope !== null && sourceMeta.scope === targetMeta.scope;

  if (sourceMeta.layer === 'app-worker' && targetMeta.layer === 'app-globe') {
    violations.push({
      ruleId: 'worker-no-globe',
      message: 'apps/worker must not import apps/globe directly.',
    });
  }

  if (sourceMeta.layer === 'app-globe' && targetMeta.layer === 'app-worker') {
    violations.push({
      ruleId: 'globe-no-worker',
      message: 'apps/globe must not import apps/worker directly.',
    });
  }

  if (sourceMeta.layer === 'app-globe' && targetMeta.layer === 'adapters') {
    violations.push({
      ruleId: 'globe-no-adapters',
      message: 'apps/globe must not import adapter packages directly.',
    });
  }

  if (
    ['legacy-package', 'kernel', 'contracts', 'domain', 'application', 'adapters', 'package-other'].includes(sourceMeta.layer)
    && ['app-globe', 'app-worker'].includes(targetMeta.layer)
  ) {
    violations.push({
      ruleId: 'packages-no-apps',
      message: 'packages must not import app code.',
    });
  }

  if (sourceMeta.layer === 'kernel' && !sameScope && ['contracts', 'domain', 'application', 'adapters', 'legacy-package', 'package-other', 'app-globe', 'app-worker'].includes(targetMeta.layer)) {
    violations.push({
      ruleId: 'kernel-only-self',
      message: 'packages/kernel must remain dependency-free except for itself and external libs.',
    });
  }

  if (sourceMeta.layer === 'contracts' && !sameScope && !['kernel', 'external'].includes(targetMeta.layer)) {
    violations.push({
      ruleId: 'contracts-kernel-only',
      message: 'packages/contracts may depend only on packages/kernel and external libs.',
    });
  }

  if (sourceMeta.layer === 'domain' && !sameScope && !['kernel', 'external'].includes(targetMeta.layer)) {
    violations.push({
      ruleId: 'domain-kernel-only',
      message: 'domain packages may depend only on kernel and themselves.',
    });
  }

  if (sourceMeta.layer === 'application' && !sameScope && !['kernel', 'contracts', 'domain', 'external'].includes(targetMeta.layer)) {
    violations.push({
      ruleId: 'application-layering',
      message: 'application packages may depend only on kernel, contracts, and domain packages.',
    });
  }

  if (sourceMeta.layer === 'adapters' && !sameScope && !['kernel', 'contracts', 'domain', 'external'].includes(targetMeta.layer)) {
    violations.push({
      ruleId: 'adapters-layering',
      message: 'adapter packages may depend only on kernel, contracts, domain packages, and themselves.',
    });
  }

  return violations;
}

export function collectDependencyBoundaryViolations({
  rootDir = DEFAULT_ROOT_DIR,
  excludedPrefixes = DEFAULT_EXCLUDED_PREFIXES,
} = {}) {
  const normalizedRoot = path.resolve(rootDir);
  const violations = [];

  for (const absolutePath of getSourceFiles(normalizedRoot, excludedPrefixes)) {
    const sourcePath = normalizePath(path.relative(normalizedRoot, absolutePath));
    const sourceMeta = classifyPath(sourcePath);
    const sourceText = fs.readFileSync(absolutePath, 'utf8');

    for (const importPath of extractImports(sourceText)) {
      const targetMeta = classifyImportTarget(normalizedRoot, sourcePath, importPath);
      const failedRules = evaluateBoundaryRules(sourceMeta, targetMeta);

      for (const failedRule of failedRules) {
        violations.push({
          ...failedRule,
          sourcePath,
          importPath,
          resolvedPath: targetMeta.resolvedPath,
        });
      }
    }
  }

  return violations.sort((left, right) =>
    left.ruleId.localeCompare(right.ruleId)
    || left.sourcePath.localeCompare(right.sourcePath)
    || left.importPath.localeCompare(right.importPath),
  );
}

export function summarizeDependencyBoundaryViolations(violations) {
  if (violations.length === 0) {
    return 'No dependency boundary violations found.';
  }

  return violations
    .map((entry) => `${entry.ruleId}: ${entry.sourcePath} -> ${entry.importPath}${entry.resolvedPath ? ` (${entry.resolvedPath})` : ''}`)
    .join('\n');
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;

if (isDirectRun) {
  const violations = collectDependencyBoundaryViolations();
  if (violations.length > 0) {
    console.error(summarizeDependencyBoundaryViolations(violations));
    process.exitCode = 1;
  } else {
    console.log('No dependency boundary violations found.');
  }
}
