#!/usr/bin/env node
// Lightweight health check for the TeacherSwap frontend.
// Validates that every .js file parses (syntax check) and that every .html
// page references only existing local assets.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'frontend');
let errors = 0;

function walk(dir, ext, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

// 1) JS syntax check (avatar.js uses ES6 classes; use a modern script context).
const jsFiles = walk(root, '.js', []);
for (const f of jsFiles) {
  try {
    const code = fs.readFileSync(f, 'utf8');
    new vm.Script(code, { filename: path.relative(root, f) });
  } catch (err) {
    errors++;
    console.error(`[JS ERROR] ${path.relative(root, f)}: ${err.message}`);
  }
}
console.log(`Checked ${jsFiles.length} JS files.`);

// 2) HTML local-asset reference check.
const htmlFiles = walk(root, '.html', []);
const existing = new Set();
for (const f of jsFiles.concat(htmlFiles)) existing.add(path.relative(root, f).replace(/\\/g, '/'));
for (const f of walk(root, '.css', [])) existing.add(path.relative(root, f).replace(/\\/g, '/'));
// images
for (const f of walk(root, '.png', []).concat(walk(root, '.svg', []), walk(root, '.jpg', []), walk(root, '.webp', [])))
  existing.add(path.relative(root, f).replace(/\\/g, '/'));

  for (const f of htmlFiles) {
    let html = fs.readFileSync(f, 'utf8');
    // Strip <script>...</script> blocks so dynamic JS string literals
    // (e.g. src="' + t.avatar + '") are not treated as static asset refs.
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    // Local, same-directory-relative references only (css/js/images), not URLs.
    const refs = [...html.matchAll(/(?:src|href)="(?!https?:|\/\/|data:|#|mailto:)([^"#?]+)/g)].map(m => m[1]);
  for (const ref of new Set(refs)) {
    // ./img/... and img/... both resolve relative to the html file's dir.
    const base = path.dirname(f);
    const cleaned = ref.replace(/^\.\//, '');
    const abs = path.resolve(base, cleaned).replace(/\\/g, '/');
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    if (!existing.has(rel)) {
      errors++;
      console.error(`[ASSET MISSING] ${path.relative(root, f)} -> "${ref}" (${rel})`);
    }
  }
}
console.log(`Checked ${htmlFiles.length} HTML pages for local asset references.`);

if (errors > 0) {
  console.error(`\n${errors} issue(s) found.`);
  process.exit(1);
} else {
  console.log('\nFrontend check passed: no JS syntax errors, all local assets resolve.');
}
