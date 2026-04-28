# Hướng Dẫn FE: Quản Lý Thời Gian Mở/Đóng Dịch Vụ

Tài liệu này chỉ tập trung vào tính năng quản lý thời gian mở/đóng dịch vụ.

Mục tiêu:

- FE hiểu rõ API nào dùng cho tính năng này
- FE biết cách hiển thị danh sách schedule
- FE biết cách tạo, sửa, bật/tắt, xóa schedule
- FE hiểu rõ ý nghĩa của `serviceId = 'ALL'`
- FE tránh nhầm giữa `isEnabled` của schedule và `isOpen` của service

## 1. Tính năng này dùng để làm gì

Admin có thể cấu hình giờ mở và giờ đóng cho:

- một dịch vụ cụ thể
- hoặc toàn bộ dịch vụ trong hệ thống

Backend sẽ có scheduler chạy mỗi 60 giây:

- nếu đến `openTime` -> set `service.isOpen = true`
- nếu đến `closeTime` -> set `service.isOpen = false`

Khi service đang đóng:

- backend sẽ không cho tạo ticket mới cho service đó

## 2. Hai khái niệm FE cần phân biệt

### 2.1 `isEnabled` của schedule

Nằm trong document `ServiceSchedule`.

Ý nghĩa:

- `true`: rule đang được áp dụng
- `false`: rule vẫn còn trong DB nhưng scheduler sẽ bỏ qua

### 2.2 `isOpen` của service

Nằm trong document `Service`.

Ý nghĩa:

- `true`: dịch vụ đang mở
- `false`: dịch vụ đang tạm đóng

Tóm tắt ngắn:

- `isEnabled` = rule có hoạt động không
- `isOpen` = dịch vụ đang mở thật hay đang đóng

## 3. Dữ liệu FE sẽ nhận

### 3.1 Kiểu dữ liệu schedule

```ts
type ServiceScheduleItem = {
  _id: string;
  serviceId:
    | 'ALL'
    | {
        _id: string;
        code: string;
        name: string;
        isActive: boolean;
        isOpen: boolean;
      };
  openTime: string;
  closeTime: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### 3.2 Trường hợp đặc biệt `serviceId = 'ALL'`

Nếu API trả:

```json
{
  "serviceId": "ALL"
}
```

thì frontend cần hiểu là:

- rule này áp dụng cho tất cả dịch vụ

Gợi ý hiển thị:

- label: `Tất cả dịch vụ`

Nếu `serviceId` là object thì hiển thị:

- `serviceId.name`
- hoặc `serviceId.code + serviceId.name`

## 4. API FE cần dùng

Tất cả API bên dưới đều cần:

```text
Authorization: Bearer <admin_token>
```

Base path:

```text
/api/admin/shift/service-schedules
```

---

## 5. Lấy danh sách schedule

`GET /api/admin/shift/service-schedules`

Response mẫu:

```json
{
  "success": true,
  "data": [
    {
      "_id": "6630...",
      "serviceId": "ALL",
      "openTime": "07:30",
      "closeTime": "17:00",
      "isEnabled": true,
      "createdAt": "2026-04-24T01:00:00.000Z",
      "updatedAt": "2026-04-24T01:00:00.000Z"
    },
    {
      "_id": "6631...",
      "serviceId": {
        "_id": "6615...",
        "code": "TV",
        "name": "TU VAN",
        "isActive": true,
        "isOpen": true
      },
      "openTime": "08:00",
      "closeTime": "16:30",
      "isEnabled": true,
      "createdAt": "2026-04-24T01:05:00.000Z",
      "updatedAt": "2026-04-24T01:05:00.000Z"
    }
  ]
}
```

FE nên render bảng có các cột:

- Dịch vụ
- Giờ mở
- Giờ đóng
- Rule đang bật hay tắt
- Trạng thái hiện tại của service nếu có
- Cập nhật lần cuối
- Action

## 6. Tạo mới hoặc cập nhật schedule

`POST /api/admin/shift/service-schedules`

API này dùng cho cả 2 trường hợp:

- tạo mới
- cập nhật rule cũ

Backend xác định theo `serviceId`.

### 6.1 Body cho tất cả dịch vụ

```json
{
  "serviceId": "ALL",
  "openTime": "07:30",
  "closeTime": "17:00",
  "isEnabled": true
}
```

### 6.2 Body cho một dịch vụ cụ thể

```json
{
  "serviceId": "6615b0d4f4e7b7e0b1234567",
  "openTime": "08:00",
  "closeTime": "16:30",
  "isEnabled": true
}
```

Response mẫu:

```json
{
  "success": true,
  "data": {
    "_id": "6631...",
    "serviceId": {
      "_id": "6615...",
      "code": "TV",
      "name": "TU VAN",
      "isActive": true,
      "isOpen": true
    },
    "openTime": "08:00",
    "closeTime": "16:30",
    "isEnabled": true
  },
  "message": "Đã lưu lịch dịch vụ thành công"
}
```

### 6.3 Validation FE cần biết

- `serviceId` bắt buộc
- `serviceId` phải là:
  - `'ALL'`
  - hoặc ObjectId hợp lệ
- `openTime` đúng định dạng `HH:MM`
- `closeTime` đúng định dạng `HH:MM`
- `isEnabled` là boolean

### 6.4 Rule nghiệp vụ

- mỗi service chỉ có tối đa 1 schedule
- nếu gửi lại cùng `serviceId`, backend sẽ update chứ không tạo bản ghi mới

## 7. Bật / tắt schedule

`PATCH /api/admin/shift/service-schedules/:serviceId/toggle`

Body:

```json
{
  "isEnabled": false
}
```

Response mẫu:

```json
{
  "success": true,
  "data": {
    "_id": "6631...",
    "serviceId": {
      "_id": "6615...",
      "code": "TV",
      "name": "TU VAN",
      "isActive": true,
      "isOpen": true
    },
    "openTime": "08:00",
    "closeTime": "16:30",
    "isEnabled": false
  },
  "message": "Đã tắt lịch dịch vụ"
}
```

FE nên hiểu:

- bật/tắt schedule không phải là mở/đóng service ngay lập tức
- nó chỉ quyết định rule đó có được scheduler áp dụng hay không

## 8. Xóa schedule

`DELETE /api/admin/shift/service-schedules/:serviceId`

Ví dụ:

```text
DELETE /api/admin/shift/service-schedules/ALL
DELETE /api/admin/shift/service-schedules/6615b0d4f4e7b7e0b1234567
```

Response:

```json
{
  "success": true,
  "data": {
    "serviceId": "ALL",
    "deletedCount": 1
  },
  "message": "Đã xóa lịch dịch vụ thành công"
}
```

FE nên:

- confirm trước khi xóa
- refetch lại list sau khi xóa thành công

## 9. Gợi ý UI cho frontend

### 9.1 Danh sách schedule

Nên có:

- nút `Thêm lịch`
- bảng schedule
- filter theo:
  - tất cả
  - đang bật
  - đang tắt
- có thể search theo tên dịch vụ

### 9.2 Form tạo / sửa

Nên có:

- select dịch vụ
  - option đầu tiên: `Tất cả dịch vụ`
  - sau đó là danh sách từng service
- time picker `Giờ mở`
- time picker `Giờ đóng`
- switch `Bật rule`

### 9.3 Action trên mỗi row

- `Sửa`
- `Bật/Tắt`
- `Xóa`

## 10. Flow FE nên làm

### 10.1 Khi mở trang

Gọi:

- `GET /api/admin/shift/service-schedules`

### 10.2 Khi thêm mới

1. Mở modal
2. Chọn service hoặc `Tất cả dịch vụ`
3. Nhập `openTime`
4. Nhập `closeTime`
5. Submit `POST /api/admin/shift/service-schedules`
6. Refetch list

### 10.3 Khi sửa

1. Fill lại data cũ vào form
2. Submit lại cùng API `POST /api/admin/shift/service-schedules`
3. Refetch list

### 10.4 Khi toggle

1. Bấm switch
2. Gọi `PATCH /api/admin/shift/service-schedules/:serviceId/toggle`
3. Refetch row hoặc refetch cả list

### 10.5 Khi xóa

1. Bấm `Xóa`
2. Confirm
3. Gọi `DELETE /api/admin/shift/service-schedules/:serviceId`
4. Refetch list

## 11. Lỗi FE cần hiển thị dễ hiểu

- `Không tìm thấy dịch vụ`
- `Không tìm thấy lịch dịch vụ`
- `serviceId không hợp lệ`
- lỗi validation `HH:MM`

Nên hiển thị dưới dạng:

- toast
- inline error ở form

Không nên hiển thị chung chung kiểu `Server error`.

## 12. Ảnh hưởng tới màn hình lấy số

Khi service bị scheduler đóng:

- `service.isOpen = false`
- backend sẽ chặn tạo ticket mới

Message có thể nhận:

```json
{
  "success": false,
  "message": "Dịch vụ TU VAN hiện đang tạm đóng. Vui lòng quay lại sau."
}
```

Nếu FE public có danh sách service thì nên:

- disable service đang đóng
- hoặc hiển thị badge `Tạm đóng`

## 13. Checklist tích hợp

- Đã có page riêng cho service schedules
- Đã hiển thị đúng trường hợp `serviceId = 'ALL'`
- Đã phân biệt `isEnabled` và `isOpen`
- Đã có form tạo / sửa
- Đã có action bật/tắt
- Đã có action xóa
- Đã refetch list sau mọi thao tác
- Đã xử lý business error đẹp

## 14. Tóm tắt dễ nhớ

- schedule là rule giờ mở / giờ đóng
- `isEnabled` là bật/tắt rule
- `isOpen` là dịch vụ đang mở hay đóng thật
- `serviceId = 'ALL'` nghĩa là áp dụng cho toàn bộ dịch vụ

