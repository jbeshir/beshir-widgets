#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetsDir = path.resolve(__dirname, '..', 'widgets');

function stripJsonComments(src) {
  let result = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '"') {
      // String literal: copy verbatim, handling escape sequences.
      result += src[i++];
      while (i < src.length) {
        if (src[i] === '\\') {
          result += src[i++];
          if (i < src.length) result += src[i++];
        } else if (src[i] === '"') {
          result += src[i++];
          break;
        } else {
          result += src[i++];
        }
      }
    } else if (src[i] === '/' && i + 1 < src.length && src[i + 1] === '/') {
      // Line comment: skip to end of line.
      while (i < src.length && src[i] !== '\n') i++;
    } else if (src[i] === '/' && i + 1 < src.length && src[i + 1] === '*') {
      // Block comment: skip to closing */.
      i += 2;
      while (i < src.length && !(src[i] === '*' && i + 1 < src.length && src[i + 1] === '/')) i++;
      i += 2;
    } else {
      result += src[i++];
    }
  }
  return result;
}

const errors = [];
let widgetCount = 0;

let entries;
try {
  entries = fs.readdirSync(widgetsDir);
} catch {
  console.error('Could not read widgets directory:', widgetsDir);
  process.exit(1);
}

for (const entry of entries) {
  const widgetPath = path.join(widgetsDir, entry);
  const stat = fs.statSync(widgetPath);
  if (!stat.isDirectory()) continue;

  const slug = entry;
  widgetCount++;

  const widgetJsonPath = path.join(widgetPath, 'widget.json');
  const wranglerPath = path.join(widgetPath, 'wrangler.jsonc');

  let widget;
  try {
    widget = JSON.parse(fs.readFileSync(widgetJsonPath, 'utf8'));
  } catch (e) {
    errors.push(`${slug}: failed to parse widget.json: ${e.message}`);
    continue;
  }

  let wrangler;
  try {
    const raw = fs.readFileSync(wranglerPath, 'utf8');
    wrangler = JSON.parse(stripJsonComments(raw));
  } catch (e) {
    errors.push(`${slug}: failed to parse wrangler.jsonc: ${e.message}`);
    continue;
  }

  // widget.json assertions
  if (widget.slug !== slug) {
    errors.push(`${slug}: widget.slug "${widget.slug}" does not match dir name "${slug}"`);
  }
  if (widget.workerName !== 'widget-' + slug) {
    errors.push(`${slug}: widget.workerName "${widget.workerName}" should be "widget-${slug}"`);
  }
  if (widget.hostname !== slug + '.widgets.beshir.org') {
    errors.push(`${slug}: widget.hostname "${widget.hostname}" should be "${slug}.widgets.beshir.org"`);
  }

  const requiredKeys = ['schemaVersion', 'slug', 'title', 'description', 'framework', 'buildCommand', 'outputDirectory', 'dataSources', 'embeddable'];
  for (const key of requiredKeys) {
    if (!(key in widget)) {
      errors.push(`${slug}: widget.json missing required key "${key}"`);
    }
  }
  if ('dataSources' in widget && !Array.isArray(widget.dataSources)) {
    errors.push(`${slug}: widget.dataSources must be an Array`);
  }

  // wrangler.jsonc assertions
  if (wrangler.name !== widget.workerName) {
    errors.push(`${slug}: wrangler.name "${wrangler.name}" should equal widget.workerName "${widget.workerName}"`);
  }

  if (!Array.isArray(wrangler.routes) || wrangler.routes.length === 0) {
    errors.push(`${slug}: wrangler.routes must be a non-empty array`);
  } else {
    const route = wrangler.routes[0];
    if (route.pattern !== widget.hostname) {
      errors.push(`${slug}: wrangler.routes[0].pattern "${route.pattern}" should equal widget.hostname "${widget.hostname}"`);
    }
    if (route.custom_domain !== true) {
      errors.push(`${slug}: wrangler.routes[0].custom_domain must be true`);
    }
  }

  if (!wrangler.assets || !wrangler.assets.directory) {
    errors.push(`${slug}: wrangler.assets.directory is missing`);
  } else {
    const normalized = wrangler.assets.directory.replace(/^\.\//, '').replace(/\/+$/, '');
    if (normalized !== widget.outputDirectory) {
      errors.push(`${slug}: wrangler.assets.directory "${wrangler.assets.directory}" normalises to "${normalized}" but widget.outputDirectory is "${widget.outputDirectory}"`);
    }
  }
}

if (errors.length > 0) {
  for (const err of errors) {
    console.error(err);
  }
  process.exit(1);
}

console.log(`OK: ${widgetCount} widget(s) valid`);
