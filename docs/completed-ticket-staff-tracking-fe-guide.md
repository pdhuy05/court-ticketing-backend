# Hướng Dẫn FE: Theo Dõi Nhân Viên Hoàn Thành Vé

Tài liệu này mô tả thay đổi mới của backend liên quan đến việc lưu lại nhân viên đã hoàn thành vé.

Mục tiêu:

- FE hiểu vì sao có field mới `completedByStaffId`
- FE biết khi nào dùng `staffId`, khi nào dùng `completedByStaffId`
- FE tránh hiển thị sai người xử lý vé đã hoàn thành
- FE biết ảnh hưởng tới thống kê / lịch sử / báo cáo

## 1. Vấn đề trước đây là gì

Trước đây khi vé được hoàn thành, backend làm:

```js
ticket.staffId = null;
```

Điều này gây ra vấn đề:

- vé đã hoàn thành không còn biết ai là người xử lý cuối cùng
- các màn hình thống kê theo staff bị thiếu dữ liệu
- các báo cáo về năng suất staff bị sai

## 2. Backend đã thay đổi gì

Backend đã thêm field mới vào `Ticket`:

```js
completedByStaffId
```

Ý nghĩa:

- lưu lại nhân viên đã hoàn thành vé

Flow mới khi complete ticket:

1. backend lấy `ticket.staffId`
2. copy sang `ticket.completedByStaffId`
3. sau đó mới reset `ticket.staffId = null`

Tức là:

- `staffId` dùng cho vé đang được xử lý
- `completedByStaffId` dùng cho vé đã hoàn thành

## 3. FE cần hiểu đúng 2 field này

### 3.1 `staffId`

Ý nghĩa:

- nhân viên đang xử lý vé ở thời điểm hiện tại

Thường dùng cho:

- vé `PROCESSING`
- current ticket của staff
- màn hình thao tác realtime của staff

### 3.2 `completedByStaffId`

Ý nghĩa:

- nhân viên đã hoàn thành vé

Thường dùng cho:

- vé `COMPLETED`
- thống kê theo nhân viên
- lịch sử xử lý vé
- báo cáo năng suất staff

## 4. Quy tắc FE nên dùng

### 4.1 Nếu vé đang PROCESSING

Ưu tiên dùng:

```ts
ticket.staffId
```

### 4.2 Nếu vé đã COMPLETED

Ưu tiên dùng:

```ts
ticket.completedByStaffId
```

### 4.3 Nếu FE muốn hiển thị “người xử lý vé”

FE nên dùng logic:

```ts
const handledBy = ticket.completedByStaffId || ticket.staffId || null;
```

Ý nghĩa:

- completed thì lấy `completedByStaffId`
- chưa completed thì fallback sang `staffId`

## 5. Những màn hình FE có thể bị ảnh hưởng

### 5.1 Màn hình lịch sử vé

Nếu FE có trang hiển thị ticket history:

- với vé `COMPLETED`, đừng chỉ đọc `staffId`
- vì `staffId` có thể đã là `null`

Nên đọc:

```ts
ticket.completedByStaffId
```

hoặc:

```ts
ticket.completedByStaffId || ticket.staffId
```

### 5.2 Màn hình thống kê staff

Nếu FE render thống kê từ API statistics:

- backend đã được sửa để tính theo `completedByStaffId`
- FE không cần tự tính lại

Nhưng FE nên hiểu:

- số lượng vé hoàn thành theo staff giờ sẽ đúng hơn trước

### 5.3 Màn hình chi tiết ticket completed

Nếu có phần:

- “Nhân viên xử lý”

thì nên hiển thị từ:

```ts
completedByStaffId
```

không nên chỉ dùng `staffId`

## 6. Dữ liệu FE có thể nhận

Tùy API, `completedByStaffId` có thể là:

- `null`
- ObjectId string
- object đã populate

FE nên code phòng thủ.

Ví dụ kiểu dữ liệu:

```ts
type TicketHandler =
  | null
  | string
  | {
      _id: string;
      fullName?: string;
      username?: string;
    };
```

Ví dụ ticket:

```ts
type TicketItem = {
  _id: string;
  status: 'waiting' | 'processing' | 'completed' | 'skipped';
  staffId?: TicketHandler;
  completedByStaffId?: TicketHandler;
};
```

## 7. Gợi ý helper cho frontend

FE có thể tạo helper dùng chung:

```ts
function getTicketHandledBy(ticket: {
  staffId?: any;
  completedByStaffId?: any;
}) {
  return ticket.completedByStaffId || ticket.staffId || null;
}
```

Nếu cần lấy label:

```ts
function getTicketHandledByLabel(ticket: {
  staffId?: any;
  completedByStaffId?: any;
}) {
  const actor = ticket.completedByStaffId || ticket.staffId;

  if (!actor) return 'Không xác định';
  if (typeof actor === 'string') return actor;

  return actor.fullName || actor.username || actor._id;
}
```

## 8. FE có cần sửa API call không

Thông thường:

- không cần đổi endpoint
- không cần đổi body request

Thay đổi chủ yếu nằm ở:

- cách FE đọc dữ liệu trả về
- cách FE hiển thị staff của vé completed

## 9. FE có cần sửa thống kê không

Nếu FE chỉ render dữ liệu từ backend statistics:

- thường không cần sửa logic tính toán

Nếu FE đang tự group ticket theo `staffId` ở client:

- cần đổi sang:

```ts
ticket.completedByStaffId || ticket.staffId
```

để không làm rơi vé completed

## 10. Các case FE nên tự test

### Case 1: Vé đang xử lý

Input:

- ticket.status = `processing`
- ticket.staffId` có giá trị
- `completedByStaffId = null`

Kỳ vọng:

- FE hiển thị đúng staff hiện tại từ `staffId`

### Case 2: Vé đã hoàn thành

Input:

- ticket.status = `completed`
- `staffId = null`
- `completedByStaffId` có giá trị

Kỳ vọng:

- FE vẫn hiển thị đúng người xử lý từ `completedByStaffId`

### Case 3: Thống kê staff

Input:

- danh sách ticket completed của ngày
- `staffId = null`
- `completedByStaffId` có dữ liệu

Kỳ vọng:

- thống kê staff không bị thiếu vé completed

## 11. FE nên sửa ở đâu

Rà lại các chỗ sau:

- bảng lịch sử ticket
- modal chi tiết ticket
- dashboard theo staff
- báo cáo năng suất staff
- bất kỳ helper nào đang đọc `ticket.staffId` cho vé completed

## 12. Cách hiển thị đề xuất

### 12.1 Label đơn giản

Nếu vé completed:

```text
Nhân viên hoàn thành: <tên staff>
```

Nếu vé processing:

```text
Nhân viên đang xử lý: <tên staff>
```

### 12.2 Dùng chung 1 field hiển thị

Nếu FE muốn đơn giản:

- dùng 1 label chung:

```text
Người xử lý vé
```

và map bằng:

```ts
completedByStaffId || staffId
```

## 13. Checklist tích hợp cho FE

- Đã biết `staffId` có thể bị reset về `null` sau khi complete
- Đã dùng `completedByStaffId` cho vé completed
- Đã fallback `completedByStaffId || staffId` khi cần
- Đã test lịch sử vé completed
- Đã test thống kê staff
- Đã rà các component hiển thị người xử lý vé

## 14. Tóm tắt ngắn

- `staffId` = người đang xử lý vé
- `completedByStaffId` = người đã hoàn thành vé
- vé completed không nên đọc staff từ `staffId` nữa
- FE nên ưu tiên:

```ts
ticket.completedByStaffId || ticket.staffId
```

