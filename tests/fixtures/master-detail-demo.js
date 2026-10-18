'use strict';
// Cấu hình + dữ liệu GIẢ dùng cho test và trang demo: Phòng ban (danh mục) · Nhân viên → Hợp đồng → Phụ lục; Đơn giá có phiên bản.
const config = {
  title: 'Hồ sơ nhân sự (dữ liệu giả)',
  root: 'NHANVIEN',
  tables: {
    PHONGBAN: { label: 'Phòng ban', labelPlural: 'Phòng ban', key: ['MaPB'], fields: [
      { key: 'MaPB', label: 'Mã phòng ban', type: 'code', required: true },
      { key: 'TenPB', label: 'Tên phòng ban', type: 'text', required: true },
    ], columns: ['MaPB', 'TenPB'] },
    NHANVIEN: { label: 'Nhân viên', labelPlural: 'Nhân viên', key: ['MaNV'], titleField: 'HoTen', fields: [
      { key: 'MaNV', label: 'Mã NV', type: 'code', required: true },
      { key: 'HoTen', label: 'Họ và tên', type: 'text', required: true },
      { key: 'MaPB', label: 'Phòng ban', type: 'select', refTable: 'PHONGBAN', refLabel: 'TenPB', required: true },
      { key: 'TrangThai', label: 'Trạng thái', type: 'select', options: ['Đang làm việc', 'Đã nghỉ'] },
    ], columns: ['MaNV', 'HoTen', 'MaPB', 'TrangThai'] },
    HOPDONG: { label: 'Hợp đồng', labelPlural: 'Hợp đồng', parent: 'NHANVIEN', drill: true, key: ['SoHD'], titleField: 'SoHD', fields: [
      { key: 'SoHD', label: 'Số hợp đồng', type: 'code', required: true },
      { key: 'NgayKy', label: 'Ngày ký', type: 'date', required: true },
      { key: 'LuongCB', label: 'Lương cơ bản', type: 'money' },
    ], columns: ['SoHD', 'NgayKy', 'LuongCB'] },
    PHULUC: { label: 'Phụ lục', labelPlural: 'Phụ lục', parent: 'HOPDONG', titleField: 'SoPL', fields: [
      { key: 'SoPL', label: 'Số phụ lục', type: 'code', required: true },
      { key: 'HieuLucTu', label: 'Hiệu lực từ', type: 'date', required: true },
      { key: 'HieuLucDen', label: 'Hiệu lực đến', type: 'date' },
      { key: 'PhuCap', label: 'Phụ cấp', type: 'money' },
    ], columns: ['SoPL', 'HieuLucTu', 'HieuLucDen', 'PhuCap'],
    versioning: { codeField: 'SoPL', fromField: 'HieuLucTu', toField: 'HieuLucDen' } },
    BHXH: { label: 'Quá trình BHXH', parent: 'NHANVIEN', fields: [
      { key: 'TuThang', label: 'Từ tháng', type: 'date', required: true },
      { key: 'MucDong', label: 'Mức đóng', type: 'money' },
    ], columns: ['TuThang', 'MucDong'] },
  },
};

const data = () => ({
  PHONGBAN: [{ _id: 'pb1', MaPB: 'SX', TenPB: 'Sản xuất' }, { _id: 'pb2', MaPB: 'KT', TenPB: 'Kế toán' }],
  NHANVIEN: [
    { _id: 'nv1', MaNV: 'NV001', HoTen: 'Nguyễn Văn An', MaPB: 'pb1', TrangThai: 'Đang làm việc' },
    { _id: 'nv2', MaNV: 'NV002', HoTen: 'Trần Thị Bình', MaPB: 'pb2', TrangThai: 'Đang làm việc' },
    { _id: 'nv3', MaNV: 'NV003', HoTen: 'Lê Đức Cường', MaPB: 'pb1', TrangThai: 'Đã nghỉ' },
  ],
  HOPDONG: [
    { _id: 'hd1', _parentId: 'nv1', SoHD: 'HD-001', NgayKy: '2025-01-02', LuongCB: 6500000 },
    { _id: 'hd2', _parentId: 'nv1', SoHD: 'HD-014', NgayKy: '2026-01-02', LuongCB: 7200000 },
    { _id: 'hd3', _parentId: 'nv2', SoHD: 'HD-002', NgayKy: '2025-03-01', LuongCB: 8000000 },
  ],
  PHULUC: [
    { _id: 'pl1', _parentId: 'hd2', SoPL: 'PL-PC', HieuLucTu: '2026-01-02', HieuLucDen: '', PhuCap: 500000 },
    { _id: 'pl2', _parentId: 'hd2', SoPL: 'PL-PC', HieuLucTu: '2026-07-01', HieuLucDen: '', PhuCap: 700000 },
    { _id: 'pl3', _parentId: 'hd2', SoPL: 'PL-CV', HieuLucTu: '2026-12-01', HieuLucDen: '', PhuCap: 300000 },
  ],
  BHXH: [{ _id: 'bh1', _parentId: 'nv1', TuThang: '2025-01-01', MucDong: 6500000 }],
});

module.exports = { config, data };
