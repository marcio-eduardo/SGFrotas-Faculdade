#!/usr/bin/env node
/**
 * Guardião de Design Tokens — Fonte Única da Verdade (`tailwind.config.js`)
 *
 * Bloqueia qualquer código de cor (#hex, rgb, rgba, hsl, hsla, oklch/oklab),
 * tag `<style>` embutida ou regra CSS manual fora de `tailwind.config.js`.
 * Executado automaticamente via `npm run lint:tokens` e antes de cada `npm run build`.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, 'src');
const TARGET_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css']);

const FORBIDDEN_PATTERNS = [
  {
    name: 'Cor hexadecimal hardcoded (#RGB/#RRGGBB)',
    regex: /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z_-])/g,
  },
  {
    name: 'Função de cor rgb()/rgba()',
    regex: /\brgba?\s*\(/gi,
  },
  {
    name: 'Função de cor hsl()/hsla()',
    regex: /\bhsla?\s*\(/gi,
  },
  {
    name: 'Função de cor oklch()/oklab()',
    regex: /\bokl(?:ch|ab)\s*\(/gi,
  },
  {
    name: 'Bloco <style> embutido em componente/template',
    regex: /<style[\s>]/gi,
  },
];

function collectFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (TARGET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

function scanFile(filePath) {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const violations = [];

  lines.forEach((lineText, idx) => {
    const lineNumber = idx + 1;
    for (const rule of FORBIDDEN_PATTERNS) {
      rule.regex.lastIndex = 0;
      let match;
      while ((match = rule.regex.exec(lineText)) !== null) {
        violations.push({
          file: relPath,
          line: lineNumber,
          rule: rule.name,
          snippet: match[0],
        });
      }
    }
  });

  // Em arquivos .css dentro de src/, somente diretivas `@tailwind ...;` e comentários são permitidos
  if (path.extname(filePath).toLowerCase() === '.css') {
    const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '');
    const cssLines = withoutComments.split(/\r?\n/);
    cssLines.forEach((rawLine, idx) => {
      const trimmed = rawLine.trim();
      if (!trimmed) return;
      if (!/^@tailwind\s+(base|components|utilities)\s*;$/.test(trimmed)) {
        violations.push({
          file: relPath,
          line: idx + 1,
          rule: 'Regra CSS manual fora de tailwind.config.js',
          snippet: trimmed,
        });
      }
    });
  }

  return violations;
}

if (!fs.existsSync(SRC_DIR)) {
  console.error('[check-design-tokens] Diretório src/ não encontrado.');
  process.exit(1);
}

const files = collectFiles(SRC_DIR);
const allViolations = files.flatMap(scanFile);

if (allViolations.length > 0) {
  console.error('\n❌ Violação da Fonte Única da Verdade (tailwind.config.js):\n');
  for (const v of allViolations) {
    console.error(`  - ${v.file}:${v.line} -> ${v.rule} ("${v.snippet}")`);
  }
  console.error('\nMova cores e regras de estilo para `tailwind.config.js` e use tokens Tailwind ou `var(--...)`.\n');
  process.exit(1);
}

console.log(`✅ Design Tokens OK: ${files.length} arquivos verificados em src/ (0 cores/estilos fora de tailwind.config.js).`);
