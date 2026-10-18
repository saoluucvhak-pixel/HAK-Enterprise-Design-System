# Bộ component bảng cha–con (Master–Detail)

`components/master-detail.js` — một file, không thư viện ngoài. Chạy trong Apps Script HtmlService, Electron, trình duyệt; phần lõi chạy cả trong Node để test.

## Nguồn hợp nhất

| Lấy từ | Phần |
|---|---|
| Skill `quan-ly-bang-me-bang-con` | Khai báo bảng bằng cấu hình (một bộ hàm vẽ cho mọi bảng), tab con tự suy ra, đào sâu nhiều cấp, tự đóng phiên bản hiệu lực, đóng modal đúng cách (không `stopPropagation`), lấy ID cha từ chính dòng khi đào sâu |
| LuongHAK_Offline V10.4 | Bố cục: thẻ tóm tắt, danh sách trái / hồ sơ phải, tab dữ liệu con, Side Drawer để sửa |
| Design System này | Chủ đề **luxe** mặc định; thêm chủ đề thứ 5 **reu** (xanh rêu, tiêu đề bảng nền tối) — `tokens/reu.css` |
| HAK_SMART_FILTER, HAK_SHEETS_CORE, HAK_ACCOUNTING_REPORT_STANDARD | Gắn qua `opts.filter`, adapter, `opts.beforeWrite` |

## Dùng

```html
<link rel="stylesheet" href="tokens/luxe.css">
<link rel="stylesheet" href="design-system/hak-enterprise-components.css">
<script src="components/master-detail.js"></script>
<div id="app"></div>
<script>
  const MD = HAK.masterDetail;
  const model = MD.createModel({
    title: "Hồ sơ nhân sự",
    tables: {
      NHANVIEN: { label: "Nhân viên", key: ["MaNV"], titleField: "HoTen",
        fields: [{ key: "MaNV", label: "Mã NV", type: "code", required: true }, { key: "HoTen", label: "Họ và tên", required: true }],
        columns: ["MaNV", "HoTen"] },
      HOPDONG: { label: "Hợp đồng", parent: "NHANVIEN", drill: true, key: ["SoHD"],
        fields: [{ key: "SoHD", label: "Số HĐ", required: true }, { key: "NgayKy", label: "Ngày ký", type: "date" }, { key: "Luong", label: "Lương", type: "money" }],
        columns: ["SoHD", "NgayKy", "Luong"] },
      PHULUC: { label: "Phụ lục", parent: "HOPDONG",
        fields: [{ key: "SoPL", label: "Số PL", required: true }, { key: "Tu", label: "Hiệu lực từ", type: "date", required: true }, { key: "Den", label: "Hiệu lực đến", type: "date" }],
        versioning: { codeField: "SoPL", fromField: "Tu", toField: "Den" } },
    },
  }, { adapter: myAdapter, beforeWrite: khoaKy, canEdit: t => quyen.has(t) });
  MD.mount(document.getElementById("app"), model);
  model.load();
</script>
```

Kiểu field: `text code number money percent date select yesno textarea`. `select` dùng `refTable` + `refLabel` (hiện tên thay vì ID) hoặc `options`.

Dòng con nối với cha qua cột `_parentId`. Khi nhập Excel, dùng **mã nghiệp vụ** (Mã NV, Số HĐ) rồi tra ra `_parentId` — đừng bắt người dùng biết ID.

## Adapter (nơi lưu dữ liệu)

```js
{ load(): Promise<{ [bảng]: dòng[] }>, insert(bảng, dòng), update(bảng, dòng), remove(bảng, id) }
```
- **Apps Script**: bọc `google.script.run` thành Promise; nên trả cả `load()` trong **một** lần gọi (đọc tuần tự 20 bảng rất chậm).
- **Electron**: gọi IPC qua `contextBridge`; quyền ghi phải được kiểm lại ở tiến trình chính (xem skill `hak-electron-security`).
- `memoryAdapter(data)` có sẵn cho test và demo.

## Quy tắc đã cài sẵn

- Kiểm tra khi lưu: bắt buộc, số, ngày có thật (31/02 bị từ chối), danh mục tồn tại, khóa nghiệp vụ không trùng trong cùng cha, "Hiệu lực đến" sau "Hiệu lực từ"; bảng có phiên bản thì mã + hiệu lực từ không trùng.
- **Tự đóng phiên bản**: "Hiệu lực đến" để trống → hiển thị ngày trước khi phiên bản kế tiếp cùng mã bắt đầu, ghi "(tự đóng)". Ô kiểu giờ = 0 của Google Sheets (năm 1899) được hiểu là trống. Trạng thái: Đang hiệu lực / Chưa đến ngày / Hết hiệu lực. Chỉ bật `versioning` cho bảng mà mỗi mã là một chuỗi phiên bản nối tiếp.
- **Xóa**: mặc định chặn khi còn dữ liệu con và nói rõ còn gì; xóa kéo theo chỉ khi bảng khai báo `onDelete: "cascade"`.
- **Khóa kỳ / phân quyền**: `beforeWrite({action, table, before, after})` trả `{ ok:false, message }` để chặn hoặc `{ ok:true, warning }` để cảnh báo. Ví dụ với `periodLock` của HAK_ACCOUNTING_REPORT_STANDARD:
  ```js
  beforeWrite: c => { const r = periodLock.classifyChange(c.before, c.after, policyOf(c.table));
    return r.kind === "locked" ? { ok: false, message: r.message } : { ok: true, warning: r.message }; }
  ```
- Không ghép dữ liệu vào `innerHTML` — dữ liệu luôn hiện như chữ (đã có test chèn mã).
- Bàn phím: chọn dòng bằng Enter/Space, đổi tab bằng mũi tên, Esc đóng drawer và trả focus, Tab vòng trong drawer; lỗi hiện cạnh ô + tổng hợp lỗi có liên kết tới ô.
- Trạng thái đang tải / lỗi tải / rỗng / không khớp tìm kiếm.

## Demo

`npm run demo` dựng `examples/master-detail.html` (mở trực tiếp bằng trình duyệt, không cần mạng — trừ font).
