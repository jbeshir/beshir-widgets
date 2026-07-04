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

  // Optional data block validation
  if (widget.data !== undefined) {
    if (widget.data === null || typeof widget.data !== 'object') {
      errors.push(`${slug}: widget.data must be an object`);
    } else {
      const data = widget.data;
      const validModes = ['static', 'prebake', 'live'];
      if (!validModes.includes(data.mode)) {
        errors.push(`${slug}: widget.data.mode "${data.mode}" must be one of static|prebake|live`);
      } else {
        const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
        if (data.mode === 'prebake') {
          if (!nonEmpty(data.sample)) errors.push(`${slug}: widget.data.sample must be a non-empty string for mode "prebake"`);
          else if (!fs.existsSync(path.join(widgetPath, data.sample))) errors.push(`${slug}: widget.data.sample file "${data.sample}" does not exist`);
          if (!nonEmpty(data.output)) errors.push(`${slug}: widget.data.output must be a non-empty string for mode "prebake"`);
          if (!nonEmpty(data.prebake)) errors.push(`${slug}: widget.data.prebake must be a non-empty string for mode "prebake"`);
        } else if (data.mode === 'live') {
          if (!nonEmpty(data.sample)) errors.push(`${slug}: widget.data.sample must be a non-empty string for mode "live"`);
          else if (!fs.existsSync(path.join(widgetPath, data.sample))) errors.push(`${slug}: widget.data.sample file "${data.sample}" does not exist`);
        }
      }
    }
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

  // Favicon assertions: index.html must reference both icon files, and the
  // referenced files must exist in public/ so Vite copies them into dist/.
  const indexHtmlPath = path.join(widgetPath, 'index.html');
  let indexHtml;
  try {
    indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  } catch (e) {
    errors.push(`${slug}: failed to read index.html: ${e.message}`);
  }
  if (indexHtml !== undefined) {
    const icons = [
      { rel: 'svg favicon', re: /<link[^>]*rel="icon"[^>]*type="image\/svg\+xml"[^>]*href="\.\/favicon\.svg"/, file: 'public/favicon.svg' },
      { rel: 'ico favicon', re: /<link[^>]*rel="icon"[^>]*href="\.\/favicon\.ico"/, file: 'public/favicon.ico' },
    ];
    for (const icon of icons) {
      if (!icon.re.test(indexHtml)) {
        errors.push(`${slug}: index.html is missing the ${icon.rel} <link> (href="./${path.basename(icon.file)}")`);
      }
      if (!fs.existsSync(path.join(widgetPath, icon.file))) {
        errors.push(`${slug}: ${icon.file} does not exist`);
      }
    }
  }

  // Optional journey.json sidecar (the interaction/UX testing spec — see TESTING.md).
  // Absent = the widget skips the journey gate; present = validate its shape.
  const journeyPath = path.join(widgetPath, 'journey.json');
  if (fs.existsSync(journeyPath)) {
    let journey;
    try {
      journey = JSON.parse(fs.readFileSync(journeyPath, 'utf8'));
    } catch (e) {
      errors.push(`${slug}: failed to parse journey.json: ${e.message}`);
      journey = null;
    }
    if (journey !== null) {
      const isStr = (v) => typeof v === 'string' && v.length > 0;
      const viewportRe = /^[a-z0-9-]+:\d+x\d+$/;
      const validSchemes = ['light', 'dark'];

      const matrix = journey.matrix;
      if (matrix === null || typeof matrix !== 'object') {
        errors.push(`${slug}: journey.matrix must be an object`);
      } else {
        if (!Array.isArray(matrix.viewports) || matrix.viewports.length === 0) {
          errors.push(`${slug}: journey.matrix.viewports must be a non-empty array`);
        } else {
          for (const vp of matrix.viewports) {
            if (!isStr(vp) || !viewportRe.test(vp)) {
              errors.push(`${slug}: journey.matrix.viewports entry "${vp}" must match label:WIDTHxHEIGHT (e.g. "mobile:390x844")`);
            }
          }
        }
        if (!Array.isArray(matrix.schemes) || matrix.schemes.length === 0) {
          errors.push(`${slug}: journey.matrix.schemes must be a non-empty array`);
        } else {
          for (const sc of matrix.schemes) {
            if (!validSchemes.includes(sc)) {
              errors.push(`${slug}: journey.matrix.schemes entry "${sc}" must be one of light|dark`);
            }
          }
        }
      }

      if (!Array.isArray(journey.states) || journey.states.length === 0) {
        errors.push(`${slug}: journey.states must be a non-empty array`);
      } else {
        const seenLabels = new Set();
        // One recognised key per step, with its expected payload shape.
        const stepCheck = {
          click: (v) => isStr(v),
          clickRole: (v) => v !== null && typeof v === 'object' && isStr(v.role) && (v.name === undefined || isStr(v.name)),
          fill: (v, step) => isStr(v) && typeof step.value === 'string',
          press: (v) => isStr(v),
          hover: (v) => isStr(v),
          waitFor: (v) => isStr(v),
          eval: (v) => isStr(v),
          mockFetch: (v) =>
            v !== null &&
            typeof v === 'object' &&
            !Array.isArray(v) &&
            isStr(v.urlPattern) &&
            (v.method === undefined || isStr(v.method)) &&
            (v.status === undefined || (typeof v.status === 'number' && Number.isInteger(v.status))) &&
            (v.contentType === undefined || isStr(v.contentType)) &&
            (v.headers === undefined || (v.headers !== null && typeof v.headers === 'object' && !Array.isArray(v.headers))),
        };
        journey.states.forEach((state, i) => {
          const where = `journey.states[${i}]`;
          if (state === null || typeof state !== 'object') {
            errors.push(`${slug}: ${where} must be an object`);
            return;
          }
          if (!isStr(state.label)) {
            errors.push(`${slug}: ${where}.label must be a non-empty string`);
          } else if (seenLabels.has(state.label)) {
            errors.push(`${slug}: ${where}.label "${state.label}" is duplicated (labels must be unique)`);
          } else {
            seenLabels.add(state.label);
          }
          const lbl = isStr(state.label) ? state.label : `#${i}`;
          if (!Array.isArray(state.steps)) {
            errors.push(`${slug}: state "${lbl}" steps must be an array`);
          } else {
            state.steps.forEach((step, j) => {
              if (step === null || typeof step !== 'object' || Array.isArray(step)) {
                errors.push(`${slug}: state "${lbl}" step[${j}] must be an object`);
                return;
              }
              const keys = Object.keys(step).filter((k) => k !== 'value');
              if (keys.length !== 1 || !(keys[0] in stepCheck)) {
                errors.push(`${slug}: state "${lbl}" step[${j}] must have exactly one action key from click|clickRole|fill|press|hover|waitFor|eval|mockFetch`);
                return;
              }
              const k = keys[0];
              if (!stepCheck[k](step[k], step)) {
                errors.push(`${slug}: state "${lbl}" step[${j}] "${k}" has an invalid payload`);
              }
            });
          }
          const exp = state.expect;
          if (exp === null || typeof exp !== 'object') {
            errors.push(`${slug}: state "${lbl}" expect must be an object`);
          } else if (!(isStr(exp.state) || isStr(exp.selector))) {
            errors.push(`${slug}: state "${lbl}" expect must have a non-empty "state" or "selector" string`);
          }
        });
      }
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
