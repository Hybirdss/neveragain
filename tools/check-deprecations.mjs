import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const DOC_PATH = path.join(ROOT_DIR, 'docs', 'architecture', 'deprecations.md');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const SKIP_SEGMENTS = new Set(['.git', '.worktrees', 'node_modules', 'dist', 'coverage', '.wrangler']);
const IMPORT_PATTERN = /\b(?:import|export)\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s*['"]([^'"]+)['"]/g;

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function parseRegistry() {
  const doc = fs.readFileSync(DOC_PATH, 'utf8');
  const match = doc.match(/```json\n([\s\S]*?)\n```/);
  if (!match) {
    throw new Error(`Failed to locate JSON registry in ${DOC_PATH}`);
  }
  return JSON.parse(match[1]);
}

function resolveRelativeImport(sourcePath, importPath) {
  const sourceDir = path.dirname(path.join(ROOT_DIR, sourcePath));
  const candidateBase = path.resolve(sourceDir, importPath);
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
      return normalizePath(path.relative(ROOT_DIR, candidate));
    }
  }

  return normalizePath(path.relative(ROOT_DIR, candidateBase));
}

function walkSourceFiles(currentDir, files) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_SEGMENTS.has(entry.name)) {
        continue;
      }
      walkSourceFiles(fullPath, files);
      continue;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
}

function getSourceFiles() {
  const files = [];
  for (const topLevel of ['apps', 'packages']) {
    const startDir = path.join(ROOT_DIR, topLevel);
    if (fs.existsSync(startDir)) {
      walkSourceFiles(startDir, files);
    }
  }
  return files;
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

const registry = parseRegistry();
const enforced = registry.enforced ?? [];
const failures = [];
const today = new Date().toISOString().slice(0, 10);

for (const entry of enforced) {
  const normalizedPath = normalizePath(entry.path);
  const absolutePath = path.join(ROOT_DIR, normalizedPath);

  if (today > entry.removeBy && fs.existsSync(absolutePath)) {
    failures.push(
      `deprecation expired: ${normalizedPath} should be removed by ${entry.removeBy}`,
    );
  }
}

for (const absoluteSourcePath of getSourceFiles()) {
  const sourcePath = normalizePath(path.relative(ROOT_DIR, absoluteSourcePath));
  const sourceText = fs.readFileSync(absoluteSourcePath, 'utf8');

  for (const importPath of extractImports(sourceText)) {
    if (!importPath.startsWith('.')) {
      continue;
    }

    const resolved = resolveRelativeImport(sourcePath, importPath);
    for (const entry of enforced) {
      if (resolved === normalizePath(entry.path) && sourcePath !== normalizePath(entry.path)) {
        failures.push(
          `deprecated shim import: ${sourcePath} -> ${resolved} (replace with ${entry.replacement})`,
        );
      }
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

for (const entry of enforced) {
  console.log(`enforced deprecation: ${entry.path} -> ${entry.replacement} (remove by ${entry.removeBy})`);
}
