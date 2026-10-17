'use strict';
// Kiểm tra tương phản WCAG AA (≥ 4,5:1 cho chữ thường) của chủ đề luxe, dùng đúng giá trị hiệu lực.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'tokens', 'luxe.css'), 'utf8');
function block(selector) {
  const vars = {};
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].trim() !== selector) continue;
    for (const v of m[2].matchAll(/--([\w-]+)\s*:\s*([^;]+)/g)) vars[v[1]] = v[2].trim();
  }
  return vars;
}
const root = block(':root'), dark = block('[data-theme="dark"]');
const skin = block('[data-skin="luxe"]'), skinDark = block('[data-skin="luxe"][data-theme="dark"]');
const LIGHT = { ...root, ...skin };
const DARK = { ...root, ...dark, ...skin, ...skinDark };

function lum(hex) {
  let h = hex.slice(1); if (h.length === 3) h = [...h].map(c => c + c).join('');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const isHex = v => typeof v === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v);

const PAIRS = [['ink', 'card'], ['ink', 'bg'], ['mut-aa', 'card'], ['mut-aa', 'bg'], ['mut-aa', 'th'],
  ['brand', 'card'], ['onBrand', 'brand'], ['warnFg', 'warnBg'], ['okFg', 'okBg'], ['red', 'card']];

for (const [name, T] of [['sáng', LIGHT], ['tối', DARK]]) {
  test(`luxe ${name}: chữ đạt AA ≥ 4,5:1`, () => {
    for (const [fg, bg] of PAIRS) {
      const f = T[fg], b = T[bg];
      if (!isHex(f) || !isHex(b)) continue; // nền dạng rgba: bỏ qua, không đoán màu
      assert.ok(ratio(f, b) >= 4.5, `${fg} trên ${bg} (${f} / ${b}) = ${ratio(f, b).toFixed(2)}:1`);
    }
  });
}
