'use strict';
// Lõi master–detail: không cần DOM.
const test = require('node:test');
const assert = require('node:assert/strict');
const MD = require('../components/master-detail.js');
const { config, data } = require('./fixtures/master-detail-demo.js');

const make = (extra = {}) => MD.createModel(config, { data: data(), today: () => '2026-10-18', ...extra });
const ids = list => list.map(r => r._id);

test('cấu hình sai bị từ chối rõ ràng', () => {
  assert.throws(() => MD.createModel({ tables: {} }), /không được rỗng/);
  assert.throws(() => MD.createModel({ tables: { A: { label: 'A', fields: [{ key: 'x', label: 'X' }], columns: ['y'] } } }), /cột y/);
  assert.throws(() => MD.createModel({ tables: { A: { label: 'A', parent: 'B', fields: [{ key: 'x', label: 'X' }] }, B: { label: 'B', parent: 'A', fields: [{ key: 'x', label: 'X' }] } } }), /Vòng cha–con/);
  assert.throws(() => MD.createModel({ tables: { A: { label: 'A', fields: [{ key: 'x', label: 'X', type: 'abc' }] } } }), /type không hỗ trợ/);
});

test('bảng con suy ra từ cấu hình; lọc theo cha', async () => {
  const m = make(); await m.load();
  assert.deepEqual(m.childTables('NHANVIEN'), ['HOPDONG', 'BHXH']);
  assert.deepEqual(ids(m.rowsFor('HOPDONG', 'nv1')), ['hd1', 'hd2']);
  assert.deepEqual(ids(m.rowsFor('NHANVIEN')), ['nv1', 'nv2', 'nv3']);
});

test('tìm không dấu, kể cả theo tên tra cứu từ danh mục', async () => {
  const m = make(); await m.load();
  m.setSearch('NHANVIEN', 'duc cuong'); assert.deepEqual(ids(m.rowsFor('NHANVIEN')), ['nv3']);
  m.setSearch('NHANVIEN', 'ke toan'); assert.deepEqual(ids(m.rowsFor('NHANVIEN')), ['nv2']);
});

test('hiển thị: tiền, ngày, tra cứu tên, căn lề', async () => {
  const m = make(); await m.load();
  const hd = m.getRow('HOPDONG', 'hd2');
  assert.equal(m.displayValue('HOPDONG', 'LuongCB', hd), '7.200.000');
  assert.equal(m.displayValue('HOPDONG', 'NgayKy', hd), '02/01/2026');
  assert.equal(m.displayValue('NHANVIEN', 'MaPB', m.getRow('NHANVIEN', 'nv1')), 'Sản xuất');
  assert.equal(m.align('HOPDONG', 'LuongCB'), 'right');
  assert.equal(m.align('HOPDONG', 'NgayKy'), 'center');
});

test('phiên bản: tự đóng khi có bản mới cùng mã, trạng thái hiện tại/tương lai/hết hạn', async () => {
  const m = make(); await m.load();
  const [pl1, pl2, pl3] = ['pl1', 'pl2', 'pl3'].map(id => m.getRow('PHULUC', id));
  assert.equal(m.effectiveTo('PHULUC', pl1), '2026-06-30');
  assert.equal(m.effectiveTo('PHULUC', pl2), null);
  assert.equal(m.displayValue('PHULUC', 'HieuLucDen', pl1), '30/06/2026 (tự đóng)');
  assert.equal(m.displayValue('PHULUC', 'HieuLucDen', pl2), 'Còn hiệu lực');
  assert.deepEqual([m.versionStatus('PHULUC', pl1), m.versionStatus('PHULUC', pl2), m.versionStatus('PHULUC', pl3)], ['expired', 'current', 'future']);
  assert.deepEqual(m.summary('PHULUC', 'hd2'), { total: 3, current: 1, codes: 2 });
});

test('đào sâu: breadcrumb, quay lại, dựng lại đường đi từ chính dòng khi điều hướng lệch', async () => {
  const m = make(); await m.load();
  m.select('nv1');
  m.drill('HOPDONG', 'hd2');
  assert.deepEqual(m.breadcrumb().map(b => b.label), ['Nhân viên: Nguyễn Văn An', 'Hợp đồng: HD-014']);
  m.back(0);
  assert.equal(m.nav().length, 1);
  m.select('nv2');               // đang chọn nv2…
  m.drill('HOPDONG', 'hd2');     // …nhưng đào vào hợp đồng của nv1 → phải lấy cha từ dòng
  assert.deepEqual(m.nav().map(n => n.id), ['nv1', 'hd2']);
  assert.throws(() => m.drill('BHXH', 'bh1'), /không cho đào sâu/);
});

test('lưu mới: gắn đúng cha, chuẩn hóa ngày, kiểm tra bắt buộc / kiểu / danh mục / trùng khóa', async () => {
  const m = make(); await m.load();
  let r = await m.save('HOPDONG', { SoHD: 'HD-020', NgayKy: '15/10/2026', LuongCB: '7500000' }, 'nv2');
  assert.equal(r.ok, true);
  assert.equal(r.row._parentId, 'nv2');
  assert.equal(r.row.NgayKy, '2026-10-15');
  r = await m.save('HOPDONG', { SoHD: '', NgayKy: '31/02/2026', LuongCB: 'abc' }, 'nv2');
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['LuongCB', 'NgayKy', 'SoHD']);
  r = await m.save('NHANVIEN', { MaNV: 'NV001', HoTen: 'Trùng', MaPB: 'pb1' });
  assert.match(r.errors.MaNV, /Đã có nhân viên/);
  r = await m.save('NHANVIEN', { MaNV: 'NV009', HoTen: 'X', MaPB: 'khong-co' });
  assert.match(r.errors.MaPB, /không có trong danh mục/);
  r = await m.save('HOPDONG', { SoHD: 'HD-x', NgayKy: '2026-01-01' }, 'khong-co');
  assert.match(r.message, /Chưa chọn nhân viên/);
});

test('phiên bản: trùng mã + hiệu lực từ bị chặn; hiệu lực đến trước hiệu lực từ bị chặn', async () => {
  const m = make(); await m.load();
  let r = await m.save('PHULUC', { SoPL: 'PL-PC', HieuLucTu: '01/07/2026' }, 'hd2');
  assert.match(r.errors.SoPL, /Đã có phụ lục/);
  r = await m.save('PHULUC', { SoPL: 'PL-NEW', HieuLucTu: '01/07/2026', HieuLucDen: '01/06/2026' }, 'hd2');
  assert.match(r.errors.HieuLucDen, /phải sau/);
});

test('sửa: chỉ đổi field cho phép, giữ _id và _parentId', async () => {
  const m = make(); await m.load();
  const r = await m.save('HOPDONG', { _id: 'hd1', LuongCB: 6800000, _parentId: 'nv2' });
  assert.equal(r.ok, true);
  assert.equal(m.getRow('HOPDONG', 'hd1').LuongCB, 6800000);
  assert.equal(m.getRow('HOPDONG', 'hd1')._parentId, 'nv1', 'không cho đổi cha qua form');
  assert.match((await m.save('HOPDONG', { _id: 'khong-co', LuongCB: 1 })).message, /đã bị xóa/);
});

test('xóa: chặn khi còn dữ liệu con, kéo theo khi khai báo cascade; điều hướng tự lùi', async () => {
  const m = make(); await m.load();
  let r = await m.remove('NHANVIEN', 'nv1');
  assert.equal(r.ok, false);
  for (const part of [/2 hợp đồng/, /3 phụ lục/, /1 quá trình BHXH/]) assert.match(r.message, part);
  const cfg2 = JSON.parse(JSON.stringify(config)); cfg2.tables.NHANVIEN.onDelete = 'cascade';
  const m2 = MD.createModel(cfg2, { data: data() }); await m2.load();
  m2.select('nv1'); m2.drill('HOPDONG', 'hd2');
  r = await m2.remove('NHANVIEN', 'nv1');
  assert.deepEqual([r.ok, r.removed], [true, 7]);
  assert.equal(m2.rows('PHULUC').length, 0);
  assert.deepEqual(m2.nav(), [{ table: 'NHANVIEN', id: null }]);
});

test('beforeWrite: khóa kỳ chặn hoặc cảnh báo; canEdit chặn ghi', async () => {
  const calls = [];
  const m = make({ beforeWrite: c => { calls.push(c.action + ':' + c.table); return c.table === 'HOPDONG' && c.before && c.before.NgayKy < '2026-01-01' ? { ok: false, message: 'Thuộc kỳ đã chốt' } : { ok: true, warning: c.table === 'PHULUC' ? 'Hồi tố kỳ 9/2026' : '' }; } });
  await m.load();
  assert.equal((await m.save('HOPDONG', { _id: 'hd1', LuongCB: 1 })).message, 'Thuộc kỳ đã chốt');
  assert.equal((await m.remove('HOPDONG', 'hd1')).ok, false);
  const ok = await m.save('PHULUC', { SoPL: 'PL-X', HieuLucTu: '2026-09-01' }, 'hd2');
  assert.deepEqual([ok.ok, ok.warning], [true, 'Hồi tố kỳ 9/2026']);
  assert.ok(calls.includes('insert:PHULUC'));
  const ro = make({ canEdit: t => t !== 'NHANVIEN' }); await ro.load();
  assert.match((await ro.save('NHANVIEN', { MaNV: 'N', HoTen: 'x', MaPB: 'pb1' })).message, /không có quyền/);
});

test('adapter lỗi → báo lỗi, không làm hỏng dữ liệu trong bộ nhớ; tải lỗi → state.error', async () => {
  const bad = { load: () => Promise.resolve(data()), insert: () => Promise.reject(new Error('mất mạng')), update: () => Promise.reject(new Error('x')), remove: () => Promise.reject(new Error('x')) };
  const m = MD.createModel(config, { adapter: bad }); await m.load();
  const r = await m.save('PHONGBAN', { MaPB: 'QL', TenPB: 'Quản lý' });
  assert.match(r.message, /mất mạng/);
  assert.equal(m.rows('PHONGBAN').length, 2);
  const m2 = MD.createModel(config, { adapter: { load: () => Promise.reject(new Error('hỏng')) } });
  await assert.rejects(m2.load());
  assert.match(m2.state.error, /hỏng/);
});

test('ngày: ô Time=0 của Sheets = trống, từ chối ngày sai lịch', () => {
  assert.equal(MD.toISO(new Date(1899, 11, 30)), null);
  assert.equal(MD.toISO('29/02/2028'), '2028-02-29');
  assert.equal(MD.toISO('29/02/2027'), null);
});
