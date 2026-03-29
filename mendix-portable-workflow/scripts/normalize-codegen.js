#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

function readArg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadMap(mapPath) {
  if (!mapPath) return {};
  try {
    const raw = fs.readFileSync(mapPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[normalize] Could not read map file "${mapPath}": ${err.message}`);
    return {};
  }
}

function isLikelyDynamicValue(value) {
  return /\d/.test(value) || /[0-9a-f]{8}-[0-9a-f]{4}/i.test(value);
}

function inferContainerHint(state, mapConfig) {
  const key = `${state.lastMenu || ''}::${state.lastTab || ''}`.toLowerCase();
  if (mapConfig.contextToContainer && mapConfig.contextToContainer[key]) {
    return mapConfig.contextToContainer[key];
  }
  return mapConfig.defaultContainer || 'auto';
}

function normalizeSource(source, mapConfig, helperImport) {
  const lines = source.split(/\r?\n/);
  const state = { lastMenu: '', lastTab: '' };
  let changed = false;
  let insertedImport = false;

  const out = lines.map((line) => {
    const menuMatch = line.match(/getByRole\('menuitem',\s*\{\s*name:\s*'([^']+)'\s*\}\)\.click/);
    if (menuMatch) state.lastMenu = menuMatch[1];

    const tabMatch = line.match(/getByRole\('tab',\s*\{\s*name:\s*'([^']+)'\s*\}\)\.click/);
    if (tabMatch) state.lastTab = tabMatch[1];

    const cellMatch = line.match(
      /^(\s*)await\s+(.+?)\.getByRole\('cell',\s*\{\s*name:\s*'([^']+)'\s*\}\)\.click\(\);?\s*$/,
    );
    if (!cellMatch) return line;

    const indent = cellMatch[1];
    const scope = cellMatch[2];
    const value = cellMatch[3];
    const container = inferContainerHint(state, mapConfig);
    const dynamic = isLikelyDynamicValue(value);
    const confidence = dynamic ? 'high' : 'medium';
    changed = true;

    return `${indent}await mx.clickRowCell(${scope}, { valueHint: '${value}', container: '${container}', confidence: '${confidence}' });`;
  });

  let merged = out.join('\n');

  if (changed && helperImport && !merged.includes(`from '${helperImport}'`) && !merged.includes(`from "${helperImport}"`)) {
    const importLine = `import { mx } from '${helperImport}';`;
    if (merged.includes("import { test")) {
      merged = merged.replace(/import\s+\{\s*test[^;]*;\s*/, (m) => `${m}\n${importLine}\n`);
    } else {
      merged = `${importLine}\n${merged}`;
    }
    insertedImport = true;
  }

  return { code: merged, changed, insertedImport };
}

function main() {
  const input = readArg('input');
  const output = readArg('output');
  const mapPath = readArg('map');
  const helperImport = readArg('helperImport', '../support/mendix-pointers');

  if (!input || !output) {
    console.error('Usage: node normalize-codegen.js --input <raw.spec.ts> --output <portable.spec.ts> [--map <map.json>] [--helperImport "../support/mendix-pointers"]');
    process.exit(1);
  }

  const source = fs.readFileSync(input, 'utf-8');
  const mapConfig = loadMap(mapPath);
  const result = normalizeSource(source, mapConfig, helperImport);

  ensureDir(output);
  fs.writeFileSync(output, result.code, 'utf-8');

  console.log(`[normalize] Wrote: ${output}`);
  console.log(`[normalize] Rewrites: ${result.changed ? 'yes' : 'no changes'}`);
  if (result.insertedImport) {
    console.log('[normalize] Injected helper import.');
  }
}

main();

