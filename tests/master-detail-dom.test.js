'use strict';
// Giao diện master–detail trên DOM giả lập (jsdom).
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const MD = require('../components/master-detail.js');
const { config, data } = require('./fixtures/master-detail-demo.js');

async function setup(extra = {}) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', { pretendToBeVisual: true });
  const doc = dom.window.document, host = doc.getElementById('app');
  const model = MD.createModel(config, { data: data(), today: () => '2026-10-18', ...extra.model });
  await model.load();
  const ui = MD.mount(host, model, { confirm: () => true, ...extra.ui });
  const $ = s => host.querySelector(s), $$ = s => [...host.querySelectorAll(s)];
  const click = el => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  const key = (el, k, o = {}) => el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, ...o }));
  const btn = text => $$('button').find(b => b.textContent.trim().startsWith(text));
  const flush = () => new Promise(r => setTimeout(r, 0));
  return { dom, doc, host, model, ui, $, $$, click, key, btn, flush };
}

test('vẽ danh sách, thẻ tóm tắt, trạng thái chưa chọn', async () => {
  const t = await setup();
  assert.equal(t.$('h1').textContent, 'Hồ sơ nhân sự (dữ liệu giả)');
  assert.equal(t.$$('.hak-md-master tbody tr').length, 3);
  assert.deepEqual(t.$$('.hak-md-master thead th').map(th => th.textContent), ['Mã NV', 'Họ và tên', 'Phòng ban', 'Trạng thái']);
  assert.equal(t.$$('.hak-md-master tbody tr')[0].children[2].textContent, 'Sản xuất', 'hiển thị tên thay vì ID');
  assert.equal(t.$('.hak-md-metric strong').textContent, '3');
  assert.match(t.$('.hak-md-detail .hak-state').textContent, /Chọn một nhân viên/);
});

test('chọn dòng bằng chuột và bàn phím → hồ sơ + tab con có số lượng', async () => {
  const t = await setup();
  t.click(t.$$('.hak-md-master tbody tr')[0]);
  assert.equal(t.$('.hak-md-master tbody tr[aria-selected="true"]').dataset.id, 'nv1');
  assert.equal(t.$('.hak-md-detail-head h2').textContent, 'Nguyễn Văn An');
  assert.deepEqual(t.$$('[role=tab]').map(b => b.textContent), ['Hợp đồng 2', 'Quá trình BHXH 1']);
  assert.equal(t.$$('.hak-md-tabpanel tbody tr').length, 2);
  t.key(t.$$('.hak-md-master tbody tr')[1], 'Enter');
  assert.equal(t.$('.hak-md-detail-head h2').textContent, 'Trần Thị Bình');
});

test('tab con: chuyển bằng phím mũi tên', async () => {
  const t = await setup();
  t.model.select('nv1');
  t.key(t.$('[role=tab][aria-selected="true"]'), 'ArrowRight');
  assert.equal(t.$('[role=tab][aria-selected="true"]').dataset.tabKey, 'BHXH');
  assert.equal(t.doc.activeElement.dataset.tabKey, 'BHXH', 'focus đi theo tab');
});

test('đào sâu vào hợp đồng → breadcrumb, phụ lục có trạng thái hiệu lực, quay lại', async () => {
  const t = await setup();
  t.model.select('nv1');
  t.click(t.$$('.hak-md-tabpanel button').find(b => b.getAttribute('aria-label') === 'Xem chi tiết HD-014'));
  assert.equal(t.$('h1').textContent, 'Hợp đồng: HD-014');
  assert.deepEqual(t.$$('.hak-md-breadcrumb li').map(li => li.textContent), ['Nhân viên: Nguyễn Văn An', 'Hợp đồng: HD-014']);
  t.model.select('hd2');
  assert.deepEqual(t.$$('.hak-md-tabpanel .hak-md-tag').map(s => s.textContent), ['Hết hiệu lực', 'Đang hiệu lực', 'Chưa đến ngày']);
  assert.match(t.$$('.hak-md-tabpanel tbody tr')[0].textContent, /30\/06\/2026 \(tự đóng\)/);
  t.click(t.btn('← Quay lại'));
  assert.equal(t.$('h1').textContent, 'Hồ sơ nhân sự (dữ liệu giả)');
});

test('tìm không dấu giữ focus ô tìm kiếm', async () => {
  const t = await setup();
  const inp = t.$('.hak-md-search input'); inp.focus(); inp.value = 'tran';
  inp.dispatchEvent(new t.dom.window.Event('input', { bubbles: true }));
  assert.equal(t.$$('.hak-md-master tbody tr').length, 1);
  assert.equal(t.doc.activeElement.id, 'hak-md-q-NHANVIEN');
  inp.value = 'khong co ai'; t.doc.activeElement.value = 'khong co ai';
  t.doc.activeElement.dispatchEvent(new t.dom.window.Event('input', { bubbles: true }));
  assert.match(t.$('.hak-md-master .hak-state').textContent, /Không có nhân viên khớp/);
});

test('drawer thêm mới: focus ô đầu, lỗi ngay cạnh ô + tổng hợp lỗi, sửa rồi lưu thành công', async () => {
  const t = await setup();
  const open = t.btn('+ Thêm nhân viên');
  open.focus(); t.click(open);
  const dr = t.$('[role=dialog]');
  assert.ok(dr); assert.equal(dr.getAttribute('aria-modal'), 'true');
  assert.equal(t.doc.activeElement.id, 'hak-md-f-MaNV');
  t.$('#hak-md-f-MaNV').value = 'NV001';
  t.$('.hak-md-form').dispatchEvent(new t.dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await t.flush();
  assert.equal(t.$('#hak-md-f-MaNV').getAttribute('aria-invalid'), 'true');
  assert.match(t.$('#hak-md-e-MaNV').textContent, /Đã có nhân viên/);
  assert.match(t.$('#hak-md-e-HoTen').textContent, /Bắt buộc/);
  assert.equal(t.doc.activeElement.className, 'hak-md-error-summary');
  assert.equal(t.$$('.hak-md-error-summary li').length, 3);
  t.$('#hak-md-f-MaNV').value = 'NV010'; t.$('#hak-md-f-HoTen').value = '  Phạm Thị Dung  '; t.$('#hak-md-f-MaPB').value = 'pb2';
  t.$('.hak-md-form').dispatchEvent(new t.dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await t.flush();
  assert.equal(t.$('[role=dialog]'), null, 'drawer đóng sau khi lưu');
  assert.equal(t.$$('.hak-md-master tbody tr').length, 4);
  assert.equal(t.model.rows('NHANVIEN').at(-1).HoTen, 'Phạm Thị Dung', 'đã cắt khoảng trắng');
  assert.equal(t.$('.hak-md-toast').textContent, 'Đã lưu.');
});

test('drawer: Esc đóng và trả focus; bấm nền mờ đóng, bấm trong drawer không đóng; Tab vòng trong drawer', async () => {
  const t = await setup();
  const open = t.btn('+ Thêm nhân viên'); open.focus(); t.click(open);
  t.$('.hak-md-drawer').dispatchEvent(new t.dom.window.MouseEvent('mousedown', { bubbles: true }));
  assert.ok(t.$('[role=dialog]'), 'bấm trong drawer không đóng');
  const buttons = [...t.$('.hak-md-drawer').querySelectorAll('button, input, select, textarea')];
  buttons.at(-1).focus(); t.key(buttons.at(-1), 'Tab');
  assert.equal(t.doc.activeElement, buttons[0], 'Tab ở phần tử cuối quay về đầu');
  t.key(t.doc.activeElement, 'Escape');
  assert.equal(t.$('[role=dialog]'), null);
  assert.equal(t.doc.activeElement.textContent, '+ Thêm nhân viên');
  t.click(t.btn('+ Thêm nhân viên'));
  t.$('.hak-md-overlay').dispatchEvent(new t.dom.window.MouseEvent('mousedown', { bubbles: true }));
  assert.equal(t.$('[role=dialog]'), null);
});

test('sửa trong drawer điền sẵn giá trị (ngày dạng input date); thêm dòng con gắn đúng cha', async () => {
  const t = await setup();
  t.model.select('nv1');
  t.click(t.$$('.hak-md-tabpanel button').find(b => b.getAttribute('aria-label') === 'Sửa HD-001'));
  assert.equal(t.$('#hak-md-f-SoHD').value, 'HD-001');
  assert.equal(t.$('#hak-md-f-NgayKy').value, '2025-01-02');
  t.ui.closeDrawer();
  t.click(t.btn('+ Thêm hợp đồng'));
  t.$('#hak-md-f-SoHD').value = 'HD-030'; t.$('#hak-md-f-NgayKy').value = '2026-10-01';
  t.$('.hak-md-form').dispatchEvent(new t.dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await t.flush();
  assert.equal(t.model.rows('HOPDONG').at(-1)._parentId, 'nv1');
  assert.equal(t.$$('.hak-md-tabpanel tbody tr').length, 3);
});

test('xóa bị chặn khi còn dữ liệu con → thông báo; không có quyền thì ẩn nút', async () => {
  const t = await setup();
  t.model.select('nv1');
  t.click(t.$$('.hak-md-detail-head button').find(b => b.textContent === 'Xóa'));
  await t.flush(); await t.flush();
  assert.match(t.$('.hak-md-toast').textContent, /Còn dữ liệu con/);
  assert.equal(t.$('.hak-md-toast').dataset.kind, 'error');
  const ro = await setup({ model: { canEdit: () => false } });
  ro.model.select('nv1');
  assert.equal(ro.btn('+ Thêm'), undefined);
  assert.equal(ro.$$('.hak-md-detail-head button').length, 0);
});

test('dữ liệu chứa mã HTML được hiển thị như chữ (không chèn mã)', async () => {
  const d = data(); d.NHANVIEN[0].HoTen = '<img src=x onerror=alert(1)>';
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>');
  const host = dom.window.document.getElementById('app');
  const m = MD.createModel(config, { data: d }); await m.load();
  MD.mount(host, m);
  assert.equal(host.querySelectorAll('img').length, 0);
  assert.ok(host.textContent.includes('<img src=x onerror=alert(1)>'));
});

test('đang tải / lỗi tải hiển thị đúng trạng thái; destroy dọn sạch', async () => {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>');
  const host = dom.window.document.getElementById('app');
  const m = MD.createModel(config, { adapter: { load: () => Promise.reject(new Error('mất kết nối')) } });
  const ui = MD.mount(host, m);
  await m.load().catch(() => {});
  assert.match(host.querySelector('[data-state=error]').textContent, /mất kết nối/);
  ui.destroy();
  assert.equal(host.children.length, 0);
});
