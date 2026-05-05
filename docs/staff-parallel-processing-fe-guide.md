# Hướng Dẫn FE: Nhiều Nhân Viên Cùng phòng Xử Lý Vé Độc Lập

Tài liệu này mô tả thay đổi mới của backend liên quan đến việc nhiều nhân viên cùng một phòng có thể xử lý vé song song.

Mục tiêu:

- FE hiểu rõ backend đã đổi hành vi gì
- FE biết trường hợp nào không cần sửa
- FE biết trường hợp nào cần sửa UI / state / logic hiển thị
- FE tránh giả định sai rằng một phòng chỉ có thể có một vé đang xử lý

## 1. Backend đã thay đổi gì

Trước đây:

- backend check vé `PROCESSING` theo `counterId`
- nghĩa là chỉ cần trong phòng đã có 1 vé đang xử lý
- thì tất cả staff khác trong cùng phòng đều bị chặn gọi vé mới

Hiện tại:

- nếu request có `staffId`
- backend sẽ check vé `PROCESSING` theo `staffId`
- mỗi staff chỉ bị chặn nếu chính staff đó đang xử lý một vé khác

Nói đơn giản:

- staff A đang xử lý vé -> staff A chưa được gọi vé tiếp theo
- staff B cùng phòng vẫn có thể gọi vé nếu staff B đang rảnh

## 2. API có đổi không

Không có thay đổi endpoint.

Các API staff vẫn giữ nguyên:

- `POST /api/tickets/call-next`
- `POST /api/tickets/call-by-id`
- `POST /api/tickets/:id/recall`

Payload chính không đổi.

Backend thay đổi ở logic xử lý bên trong, không phải contract API.

## 3. FE có cần sửa không

### 3.1 Trường hợp có thể không cần sửa

Nếu FE đang:

- gọi API như cũ
- join staff display theo `staffId`
- render current ticket theo staff hiện tại

thì thường có thể chạy ngay mà không cần đổi API layer.

### 3.2 Trường hợp cần sửa

FE cần rà lại nếu đang có một trong các giả định sau:

- một phòng chỉ có đúng 1 vé `PROCESSING`
- nếu phòng có vé đang xử lý thì disable luôn nút `Call next` cho tất cả staff
- current ticket đang hiển thị chung theo phòng chứ không theo nhân viên
- socket đang join theo `counterId` nhưng FE lại kỳ vọng dữ liệu riêng cho staff

## 4. Điều FE cần hiểu đúng

### 4.1 `counterId`

Là phòng.

Một phòng có thể có:

- nhiều staff
- nhiều staff cùng xử lý vé song song

### 4.2 `staffId`

Là nhân viên cụ thể.

Backend bây giờ check giới hạn gọi vé theo staff:

- nếu staff đó đang có vé `PROCESSING` -> chặn staff đó
- staff khác trong cùng phòng không bị ảnh hưởng

## 5. Error message FE có thể gặp

### 5.1 Trường hợp có staffId

Backend có thể trả:

```json
{
  "success": false,
  "message": "Nhân viên đang xử lý vé 101. Vui lòng hoàn thành hoặc bỏ qua vé hiện tại trước"
}
```

Ý nghĩa:

- chính staff hiện tại đang bận
- chỉ block staff này thôi

### 5.2 Trường hợp không có staffId

Backend có thể trả:

```json
{
  "success": false,
  "message": "phòng đang xử lý vé 101. Vui lòng hoàn thành hoặc bỏ qua vé hiện tại trước"
}
```

Ý nghĩa:

- đây là mode xử lý theo phòng
- thường dùng cho case không có staff cụ thể

## 6. FE nên kiểm tra chỗ nào

### 6.1 Màn hình staff ticket

Rà lại các logic:

- disable nút `Call next`
- disable nút `Call by id`
- disable nút `Recall`

Nếu hiện tại FE đang disable theo trạng thái của cả phòng thì cần sửa.

FE chỉ nên disable khi:

- chính staff hiện tại đang có current ticket
- hoặc request đang pending

### 6.2 Màn hình current ticket

Nếu FE đang hiển thị:

- 1 current ticket chung cho cả phòng

thì cần xác nhận lại mong muốn nghiệp vụ.

Với logic mới, mỗi staff có thể có current ticket riêng.

Khi đó FE nên ưu tiên:

- hiển thị current ticket của staff hiện tại
- không nên lấy snapshot chung của cả phòng rồi coi đó là ticket của mình

### 6.3 Socket join

FE nên kiểm tra cách join socket.

Nếu muốn dữ liệu riêng theo staff thì nên join theo staff:

```js
socket.emit('join-staff-display', {
  staffId,
  counterId
});
```

Không nên chỉ join room theo phòng nếu màn hình cần dữ liệu riêng cho nhân viên hiện tại.

## 7. Flow FE đúng nên là gì

### 7.1 Khi staff login

FE nên có:

- `staffId`
- `counterId`
- `token`

Sau đó:

1. load dữ liệu staff display của staff hiện tại
2. join socket theo `staffId`

### 7.2 Khi staff bấm Call Next

Flow:

1. gọi `POST /api/tickets/call-next`
2. nếu thành công:
   - update current ticket của staff hiện tại
3. nếu fail với message `Nhân viên đang xử lý vé ...`:
   - hiện warning
   - không coi là lỗi hệ thống

### 7.3 Khi nhiều staff cùng dùng một phòng

Kỳ vọng đúng:

- staff A gọi số được
- staff B vẫn gọi số được nếu staff B chưa có vé processing
- staff A không gọi tiếp được khi staff A chưa complete / skip vé cũ

## 8. FE nên sửa gì nếu đang có bug cũ

### 8.1 Nếu FE đang disable theo cả phòng

Ví dụ logic cũ kiểu:

```ts
const disableCallNext = Boolean(counter.currentTicket);
```

Logic này có thể sai với nghiệp vụ mới.

Nên đổi sang logic theo staff hiện tại, ví dụ:

```ts
const disableCallNext = Boolean(myCurrentTicket);
```

Trong đó:

- `myCurrentTicket` là vé processing của chính staff đang login

### 8.2 Nếu FE đang dùng snapshot chung của phòng

Nếu backend/socket đang hỗ trợ snapshot staff riêng, FE nên dùng dữ liệu staff-specific thay vì counter-wide.

## 9. FE có cần sửa API service không

Thông thường:

- không cần đổi endpoint
- không cần đổi body request chính

Nhưng FE có thể cần sửa:

- state management
- rule disable button
- cách render current ticket
- cách join socket

## 10. Gợi ý checklist cho FE

- Màn hình staff có đang disable nút gọi số theo cả phòng không
- Current ticket đang là của staff hiện tại hay của cả phòng
- Socket đã join theo `staffId` chưa
- Có hiển thị đúng message `Nhân viên đang xử lý vé...` chưa
- Có test case 2 staff cùng phòng chưa

## 11. Test case FE nên tự test

### Case 1

- staff A và staff B cùng thuộc phòng 1
- staff A gọi 1 vé
- staff B gọi tiếp 1 vé khác

Kết quả mong đợi:

- cả 2 đều gọi được

### Case 2

- staff A đã có 1 vé `PROCESSING`
- staff A bấm `Call next` lần nữa

Kết quả mong đợi:

- backend trả lỗi `Nhân viên đang xử lý vé ...`

### Case 3

- staff A đang xử lý vé
- staff B chưa có vé
- staff B bấm `Call next`

Kết quả mong đợi:

- staff B vẫn gọi được bình thường

## 12. Tóm tắt ngắn

- Backend mới block theo `staffId`, không block cả `counterId` nữa khi có nhân viên cụ thể
- API gần như không đổi
- FE có thể chạy ngay nếu đã làm đúng theo staff-specific flow
- FE cần sửa nếu đang giả định “một phòng chỉ có một vé processing”

