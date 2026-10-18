# Mẫu "Lưu trữ theo năm" (Yearbook / Archive)

Mẫu giao diện và quy tắc dữ liệu dùng chung cho các ứng dụng HAK có hồ sơ chứng từ tích lũy theo năm. Nguồn tham chiếu: `HAK_XUATHANG_APP` v2.10.0 – v2.11.1 (`app/js/yearbook.js`, `app/js/year-close.js`, `app/js/archive.js`). Đây là quy ước thiết kế; chỉ đưa vào ứng dụng khác sau khi có kiểm thử tích hợp.

## 1. Khái niệm
| Thuật ngữ | Ý nghĩa |
|---|---|
| **Năm làm việc** | Năm đang chọn trên thanh đầu. Hồ sơ mới thuộc năm này. Không tự chia một hồ sơ qua hai năm. |
| **Hồ sơ năm** | Bản ghi có `year`, `revision`, `status`, các `versions` cũ. Khác "kho Lưu trữ" cũ (chỉ để tạo lại Word/PDF/Excel). |
| **Lưu trữ (ẩn)** | Ẩn khỏi danh sách dùng hằng ngày, có nút Khôi phục. Không xóa vĩnh viễn. |
| **Sao lưu năm** | Xuất ZIP/JSON của một năm, **vẫn giữ** dữ liệu trong máy. |
| **Đóng năm** | Sao lưu năm + kiểm chứng file + dọn dữ liệu năm đó khỏi kho làm việc. Chỉ Quản trị. |
| **Xem năm cũ** | Mở file năm chỉ-đọc, không nhập vào kho làm việc. |

## 2. Quy tắc xác định năm
- Năm của hồ sơ = năm của **ngày bắt đầu nghiệp vụ** (ví dụ ngày cân sớm nhất), **không** phải ngày sửa/cập nhật.
- Báo cáo, sao lưu năm và đóng năm phải dùng **cùng một hàm tính năm** để số liệu không lệch.
- Ngày không rõ → giữ lại, không đưa vào đóng năm.

## 3. Mô hình dữ liệu tối thiểu
```
Record {
  id, type, year, revision, createdAt, updatedAt,
  title, params, rows, context,           // context = hợp đồng/PDF/cấu hình đã chụp lúc lưu
  status: 'draft' | 'exported' | 'legacy' | 'archived',
  versions: [{ revision, updatedAt, params, rows }]   // phiên bản trước, không ghi đè
}
Store { revision, records[] }             // ghi bằng compare-and-swap theo revision
```
- Lưu: nếu `storeRevision` hoặc `revision` của hồ sơ đã đổi → từ chối, yêu cầu mở lại (chống ghi đè).
- Lỗi ghi IndexedDB phải báo lỗi, **không** thay bằng RAM rồi báo "đã lưu".
- Sao chép hồ sơ cũ vào năm: tạo bản `legacy` có `legacyId`, không sửa/xóa bản gốc, bỏ qua bản đã sao chép.

## 4. Định dạng file năm
- `app: "hak-yearbook"`, kèm phiên bản schema, năm, phạm vi công ty, danh sách đối tượng và **SHA-256 + kích thước** của từng phần.
- ZIP đóng năm tên dạng `HAK_NamDaDong_<năm>_….zip`; sao lưu năm nhận cả ZIP và JSON.
- Khôi phục: kiểm tra trước khi ghi → gộp, giữ phiên bản mới hơn; cùng phiên bản nhưng khác nội dung thì **dừng**, không đoán.
- Không thay danh mục/hợp đồng đang hoạt động bằng bản cũ.

## 5. Luồng Đóng năm (an toàn trước, tiện sau)
1. Điều kiện: Quản trị, xem tất cả công ty, hồ sơ đang sửa đã lưu, dữ liệu nền đã đọc xong.
2. Tạo ZIP → người dùng chọn nơi lưu.
3. **Đọc lại file đã ghi trên đĩa**, so SHA-256 và kích thước với nội dung đã tạo. Hủy hoặc sai → không dọn gì.
4. Hiện số hồ sơ/đợt sẽ gỡ → người dùng xác nhận (bấm 2 lần).
5. Dọn trong giao dịch: nếu dữ liệu đã đổi giữa lúc lưu và dọn → chặn. Chỉ gỡ đối tượng **đã có trong file đã kiểm chứng**.
6. Ghi dấu vết (đường dẫn, mã kiểm tra, số lượng) **trước** khi dọn; trạng thái `đang dở` nếu chưa xong. Dấu vết không giữ bản sao nội dung.
7. Thành công → yêu cầu tải lại app để giải phóng RAM; trước khi tải lại, khóa ghi hồ sơ mới.

**Giữ lại, không dọn:** danh mục/hợp đồng dùng chung, PDF trong danh mục, nhật ký số chứng từ (để không đứt liên kết hoặc mất cảnh báo trùng số), đợt lẫn nhiều năm hoặc chưa đọc được.
Hai kho riêng không có giao dịch chung; lỗi ở kho sau có thể đã dọn kho trước — vì vậy luôn kiểm chứng file trước.

## 6. Thành phần giao diện
- **Chọn năm làm việc** (thanh đầu) + nhãn năm trên mọi form lập hồ sơ.
- **Sổ hồ sơ năm**: bảng theo năm, lọc (công ty, loại, trạng thái), nút `Mở / Sửa`, `Lưu trữ / Khôi phục`, `PDF kèm theo`.
- **Hành động cấp năm**: `Sao lưu năm`, `Khôi phục năm`, `Đưa bản sao hồ sơ cũ vào năm này`, `Mở file năm cũ (chỉ xem)`, `Đóng năm ra file và dọn kho` (nút nguy hiểm, chỉ Quản trị).
- **Chế độ chỉ xem**: dải thông báo cố định "Đang xem file năm <năm> — chỉ đọc"; vô hiệu nút Lưu; có nút `Về kho làm việc`.
- **Báo cáo**: ô `Năm` (điền nhanh 01/01–31/12) + bảng và sheet Excel `Theo năm`; tên file xuất có kỳ báo cáo, ví dụ `BaoCaoTongHop_Nam2025_xuat20261018.xlsx`.
- Nút xóa/dọn dùng kiểu "bấm lần nữa để xác nhận"; toast nêu rõ số lượng và tên file.

## 7. Nội dung cảnh báo bắt buộc
- Báo cáo chỉ tính hồ sơ **đang có trong kho**: đóng năm nào thì báo cáo năm đó trống cho tới khi khôi phục.
- Sao lưu toàn bộ **không** tự chép các ZIP năm bên ngoài — phải giữ/chuyển riêng.
- Mất file ZIP = mất dữ liệu năm đã dọn. Khuyến nghị lưu ở Drive/OneDrive hoặc ổ rời.

## 8. QA chấp nhận
- ZIP thật được mở lại; Hủy giữa chừng không dọn; checksum sai bị từ chối; dữ liệu đổi giữa lúc dọn bị chặn; giao dịch dọn thất bại không mất dữ liệu.
- Chế độ chỉ xem không ghi vào IndexedDB.
- Báo cáo năm = tổng các tháng của năm; hồ sơ qua ranh giới 31/12 → 01/01 tính theo ngày bắt đầu.
- Giao diện đạt 1366×768 và 1920×1080, tương phản AA (xem `tests/contrast.test.js`).
- Đổi chủ đề không làm đổi dữ liệu nghiệp vụ.
