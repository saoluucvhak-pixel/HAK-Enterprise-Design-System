# HAK Enterprise Design System

Thư viện tiêu chuẩn giao diện dùng chung cho các ứng dụng HAK (Electron offline và web).

## Nội dung
- `tokens/luxe.css` — token chủ đề **luxe V10.3** (mặc định): navy + champagne, nền ngà, sáng/tối. Giá trị gốc được giữ nguyên; thêm `--mut-aa` cho chữ phụ đạt tương phản AA.
- `design-system/hak-workspace-layout.css` — bố cục workspace (master–detail, tiêu đề, lưới) — bản đồng bộ với `workspace-v104.css` của ứng dụng.
- `design-system/hak-enterprise-components.css` — thành phần dùng chung (khung, thanh công cụ, tab chi tiết).
- `design-system/V10.4-LAYOUT.md` — quy ước bố cục danh mục dùng chung và tiêu chí kiểm tra 1366×768 / 1920×1080.
- `docs/DESIGN_SYSTEM_V10_4.md` — tham chiếu các chủ đề `luxe`, `classic`, `neutral`, `champagne` và mẫu cha–con.

## Nguồn
Chuyển từ `HAK_LUONG_OFFLINE`, nhánh `design/hak-enterprise-v10-4`, commit `715b043` (thư mục `design-system/`, `LuongHAK_Offline/style.css`). Thay đổi so với nguồn: thêm `--mut-aa` và kiểm thử tương phản.

## Kiểm thử
```sh
npm test
```
Kiểm tra tương phản WCAG AA (≥ 4,5:1) của các cặp chữ/nền chính ở chủ đề luxe sáng và tối.

## Quy tắc
- Đổi chủ đề hoặc bảng màu không được ghi vào dữ liệu nghiệp vụ.
- Không dùng mockup làm logic nghiệp vụ; thành phần chỉ được đưa vào ứng dụng sau khi có kiểm thử tích hợp.
