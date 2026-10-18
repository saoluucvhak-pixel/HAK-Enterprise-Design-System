# Quy tắc UX cho ứng dụng HAK

Tài liệu này kết hợp **nhận diện HAK** (chủ đề luxe và các token trong `tokens/luxe.css`) với **bộ quy tắc chất lượng UX của UI UX Pro Max** (skill `ui-ux-pro-max` trong repo `HAK_AI_SKILLS`, MIT).

Nguyên tắc phân vai:
- **Design System này quyết định giao diện trông thế nào** — màu, chữ, bo góc, bố cục.
- **UI UX Pro Max quyết định giao diện dùng có tốt không** — tương phản, bàn phím, form, trạng thái, biểu đồ.
- Mâu thuẫn về nhận diện → theo Design System. Chưa có quy định → theo UI UX Pro Max rồi bổ sung vào đây.

Tra cứu chi tiết một quy tắc:
```bash
python <HAK_AI_SKILLS>/skills/ui-ux-pro-max/scripts/search.py "<vấn đề>" --domain ux
```

## Ưu tiên kiểm tra (cao → thấp)

| # | Nhóm | Bắt buộc ở HAK | Lớp CSS / token dùng |
|---|---|---|---|
| 1 | Truy cập | Chữ thường ≥ 4,5:1 cả sáng/tối; focus nhìn thấy; đi hết màn hình bằng bàn phím; nút chỉ biểu tượng có `aria-label` | `:focus-visible` (đã có), `--mut-aa` cho chữ phụ, `.hak-sr-only` |
| 2 | Tương tác | Vùng bấm ≥ 32px (desktop), ≥ 44px nếu dùng cảm ứng; có phản hồi khi đang xử lý; Esc đóng drawer và trả focus | `.hak-btn` |
| 3 | Hiệu năng hiển thị | Bảng lớn cuộn trong vùng, không làm giật trang; giữ chỗ trước khi dữ liệu về | `.hak-table-region` |
| 4 | Phong cách | Một phong cách duy nhất (luxe enterprise); biểu tượng SVG, **không dùng emoji làm biểu tượng** | token chủ đề |
| 5 | Bố cục | Không tràn ngang ở 1366×768; master–detail chuyển 1 cột dưới 1100px | `.hak-master-detail` |
| 6 | Chữ & màu | Chữ thân ≥ 13px (desktop dày đặc), line-height ≥ 1.4; **không mã màu hex trong component**; số liệu chữ số cùng độ rộng | `.hak-num`, `.hak-muted`, `var(--…)` |
| 7 | Chuyển động | ≤ 200ms, không animate width/height; tắt khi `prefers-reduced-motion` | đã có trong components |
| 8 | Form | Nhãn luôn hiện (không chỉ placeholder); lỗi ngay cạnh ô + tổng hợp lỗi khi Lưu; focus nhảy tới tổng hợp lỗi | `.hak-field-error`, `[aria-invalid]` |
| 9 | Điều hướng | Menu trái giữ trạng thái; quay lại đúng màn hình trước; tiêu đề trang rõ | `hak-workspace-layout.css` |
| 10 | Biểu đồ | Có chú giải, tooltip; không chỉ dựa vào màu để phân biệt | token `--c1/--cP/--cO/--cTC` + ký hiệu/nhãn |

## Quy tắc riêng nghiệp vụ HAK

- Tiền, khối lượng, độ ẩm: định dạng bằng `HAK_ACCOUNTING_REPORT_STANDARD` (phân cách `12.500.000`, ngày `dd/MM/yyyy`). Không tự viết hàm format trong giao diện.
- Bảng danh sách có đủ 3 trạng thái: rỗng, đang tải, lỗi (`.hak-state` với `data-state="empty|loading|error"`).
- Kỳ đã chốt: hiển thị chỉ đọc, nêu rõ lý do.
- Không thêm nút, số liệu, biểu đồ, thông báo trang trí không có chức năng thật.
- Đổi chủ đề/bảng màu không bao giờ ghi vào dữ liệu nghiệp vụ.

## Danh sách trước khi giao

- [ ] Chỉ dùng `var(--…)`, không mã màu cứng trong component.
- [ ] `npm test` của repo này đạt (tương phản, token tồn tại, không file trùng).
- [ ] Bàn phím: Tab đi đúng thứ tự, focus nhìn thấy, Esc đóng drawer/modal.
- [ ] 3 trạng thái rỗng/đang tải/lỗi cho mọi bảng.
- [ ] Không tràn ngang ở 1366×768; chụp ảnh 1366×768 và 1920×1080, luxe sáng và tối.
- [ ] Biểu đồ có chú giải, không chỉ dựa vào màu.
