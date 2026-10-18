'use strict';
// Thành phần dùng chung chỉ được dùng token có thật, không mã màu cứng; repo không có file trùng.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const tokens = fs.readFileSync(path.join(ROOT, 'tokens', 'luxe.css'), 'utf8');
const components = fs.readFileSync(path.join(ROOT, 'design-system', 'hak-enterprise-components.css'), 'utf8');
const defined = new Set([...tokens.matchAll(/--([\w-]+)\s*:/g)].map(m => m[1]));
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

test('components: không có mã màu hex/rgb cứng', () => {
  const css = stripComments(components);
  const hex = css.match(/#[0-9a-f]{3,8}\b/gi) || [];
  const rgb = css.match(/\brgba?\(/gi) || [];
  assert.deepEqual([...hex, ...rgb], [], 'dùng var(--token) thay vì màu cứng');
});

test('components: mọi var(--x) đều có trong tokens (hoặc có giá trị dự phòng)', () => {
  const missing = [];
  for (const m of stripComments(components).matchAll(/var\(--([\w-]+)\s*(,)?/g)) {
    if (!defined.has(m[1]) && !m[2]) missing.push(m[1]);
  }
  assert.deepEqual([...new Set(missing)], []);
});

test('components: có focus nhìn thấy và tôn trọng giảm chuyển động', () => {
  assert.match(components, /:focus-visible/);
  assert.match(components, /prefers-reduced-motion:\s*reduce/);
});

test('repo: không có hai file nội dung trùng nhau', () => {
  const seen = new Map(), dup = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['.git', 'node_modules'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
      if (seen.has(h)) dup.push(`${path.relative(ROOT, p)} = ${seen.get(h)}`); else seen.set(h, path.relative(ROOT, p));
    }
  })(ROOT);
  assert.deepEqual(dup, []);
});
