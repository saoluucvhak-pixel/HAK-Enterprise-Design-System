'use strict';
// Dựng examples/master-detail.html (một file, mở offline được) từ token + CSS + component + dữ liệu giả.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(R, p), 'utf8');
const css = ['tokens/luxe.css', 'tokens/reu.css', 'design-system/hak-enterprise-components.css'].map(read).join('\n');
const fx = read('tests/fixtures/master-detail-demo.js').replace("'use strict';", '').replace('module.exports = { config, data };', 'var DEMO = { config: config, data: data };');
const out = read('examples/master-detail.shell.html').replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => read('components/master-detail.js')).replace('/*__DATA__*/', () => fx);
fs.writeFileSync(path.join(R, 'examples', 'master-detail.html'), '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n' + out + '\n</body></html>\n');
console.log('examples/master-detail.html');
