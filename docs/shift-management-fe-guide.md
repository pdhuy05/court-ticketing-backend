# Hướng Dẫn FE: Shift Management và Service Schedule

Tài liệu này mô tả cách frontend tích hợp phiên bản mới của tính năng quản lý ca và lịch mở/đóng dịch vụ.

Điểm quan trọng nhất:

- Staff không còn tự mở ca / đóng ca.
- Chỉ Admin mới quản lý trạng thái ca của staff.
- Admin có thể cấu hình lịch mở/đóng cho từng dịch vụ hoặc cho toàn bộ dịch vụ.
- Khi service bị đóng theo lịch, backend sẽ chặn tạo ticket mới.

## 1. Tổng quan nghiệp vụ

Hiện tại hệ thống có 2 lớp trạng thái khác nhau:

### 1.1 Trạng thái ca của staff

Dùng field `onDuty` trên `User`.

- `onDuty = true`: staff đang trong ca
- `onDuty = false`: staff đang ngoài ca

Admin có thể:

- xem staff nào đang trong ca
- xem staff nào ngoài ca
- force mở ca
- force đóng ca
- xem lịch sử mở/đóng ca

### 1.2 Trạng thái mở/đóng của service

Dùng field `isOpen` trên `Service`.

- `isOpen = true`: dịch vụ đang mở
- `isOpen = false`: dịch vụ đang tạm đóng

Admin có thể:

- tạo lịch mở/đóng cho 1 service cụ thể
- tạo lịch áp dụng cho tất cả service bằng `serviceId = 'ALL'`
- bật/tắt rule schedule
- xóa rule schedule

## 2. Những gì FE cần bỏ từ bản cũ

Các API staff sau đây không còn tồn tại:

- `GET /api/shift/status`
- `GET /api/shift/history`
- `POST /api/shift/start`
- `POST /api/shift/end`

Frontend cần xóa toàn bộ call cũ tới `/api/shift/*`.

Nếu FE đang có màn hình staff tự quản lý ca thì cần bỏ hoặc ẩn hoàn toàn.

## 3. Dữ liệu FE sẽ nhận

### 3.1 Staff shift item

```ts
type StaffShiftItem = {
  _id: string;
  fullName: string;
  username: string;
  counterId: null | {
    _id: string;
    name: string;
    number: number;
  };
  onDuty: boolean;
  lastShiftStart: string | null;
  lastShiftEnd: string | null;
};
```

### 3.2 Shift history item

```ts
type ShiftHistoryItem = {
  action: 'start' | 'end';
  timestamp: string;
  reason: string;
  waitingTicketsCount: number;
};
```

### 3.3 Service schedule item

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

## 4. API cho Admin

Tất cả API bên dưới đều cần:

```text
Authorization: Bearer <admin_token>
```

Base path:

```text
/api/admin/shift
```

---

## 5. Nhóm API Shift Settings

### 5.1 Lấy settings hiện tại

`GET /api/admin/shift/settings`

Response:

```json
{
  "success": true,
  "data": {
    "autoStartTime": "07:30",
    "reminderMinutes": 15
  }
}
```

FE nên dùng để render block settings:

- Giờ tự động mở ca staff
- Số phút nhắc nhở

### 5.2 Cập nhật giờ tự động mở ca

`PATCH /api/admin/shift/settings/auto-start-time`

Body:

```json
{
  "time": "07:30"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "autoStartTime": "07:30"
  },
  "message": "Đã cập nhật thời gian tự động mở ca thành 07:30"
}
```

Validation:

- phải đúng định dạng `HH:MM`

### 5.3 Cập nhật số phút nhắc nhở

`PATCH /api/admin/shift/settings/reminder-minutes`

Body:

```json
{
  "minutes": 15
}
```

Response:

```json
{
  "success": true,
  "data": {
    "reminderMinutes": 15
  },
  "message": "Đã cập nhật thời gian nhắc nhở thành 15 phút"
}
```

Validation:

- là số nguyên
- từ `0` đến `120`

---

## 6. Nhóm API Quản Lý Ca Của Staff

### 6.1 Lấy tất cả staff + trạng thái ca

`GET /api/admin/shift/staff`

### 6.2 Lấy staff đang trong ca

`GET /api/admin/shift/staff/on-duty`

### 6.3 Lấy staff ngoài ca

`GET /api/admin/shift/staff/off-duty`

Response item:

```json
{
  "_id": "662f0c...",
  "fullName": "Nguyen Van A",
  "username": "staff01",
  "counterId": {
    "_id": "6611ab...",
    "name": "Quầy tiếp nhận 1",
    "number": 1
  },
  "onDuty": true,
  "lastShiftStart": "2026-04-24T00:35:00.000Z",
  "lastShiftEnd": "2026-04-23T10:10:00.000Z"
}
```

FE nên làm:

- 1 table staff
- filter:
  - Tất cả
  - Đang trong ca
  - Ngoài ca
- search theo tên, username, quầy

Gợi ý label:

- `onDuty = true` -> `Đang trong ca`
- `onDuty = false` -> `Ngoài ca`

### 6.4 Xem lịch sử ca của 1 staff

`GET /api/admin/shift/staff/:staffId/history?limit=50`

Response:

```json
{
  "success": true,
  "data": {
    "staffId": "662f0c...",
    "fullName": "Nguyen Van A",
    "username": "staff01",
    "onDuty": false,
    "lastShiftStart": "2026-04-24T00:35:00.000Z",
    "lastShiftEnd": "2026-04-24T04:50:00.000Z",
    "history": [
      {
        "action": "end",
        "timestamp": "2026-04-24T04:50:00.000Z",
        "reason": "Hết giờ làm việc",
        "waitingTicketsCount": 2
      },
      {
        "action": "start",
        "timestamp": "2026-04-24T00:35:00.000Z",
        "reason": "Admin mở ca thủ công",
        "waitingTicketsCount": 0
      }
    ]
  }
}
```

FE nên hiển thị:

- drawer hoặc modal chi tiết
- timeline hoặc table
- cột:
  - Hành động
  - Thời gian
  - Lý do
  - Ticket còn lại

### 6.5 Admin force mở ca cho staff

`POST /api/admin/shift/staff/:staffId/start`

Body:

```json
{}
```

Response:

```json
{
  "success": true,
  "data": {
    "onDuty": true,
    "lastShiftStart": "2026-04-24T00:35:00.000Z"
  },
  "message": "Đã mở ca cho nhân viên"
}
```

Lỗi có thể gặp:

- `404`: `Không tìm thấy nhân viên`
- `400`: `Nhân viên đang trong ca làm việc`

### 6.6 Admin force đóng ca cho staff

`POST /api/admin/shift/staff/:staffId/end`

Body:

```json
{
  "reason": "Hết giờ làm việc"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "onDuty": false,
    "lastShiftEnd": "2026-04-24T04:50:00.000Z",
    "waitingTicketsCount": 2
  },
  "message": "Đã kết thúc ca cho nhân viên"
}
```

Ý nghĩa `waitingTicketsCount`:

- là số ticket còn lại tại quầy của staff lúc đóng ca

FE nên:

- mở modal nhập lý do trước khi submit
- nếu `waitingTicketsCount > 0`, có thể hiển thị warning nhẹ sau khi đóng ca

---

## 7. Nhóm API Service Schedule

Đây là phần mới quan trọng nhất cho FE.

### 7.1 Lấy danh sách schedule

`GET /api/admin/shift/service-schedules`

Response:

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

FE phải xử lý 2 trường hợp:

- `serviceId === 'ALL'`
- `serviceId` là object service

Gợi ý hiển thị:

- nếu `ALL` -> label `Tất cả dịch vụ`
- nếu object -> hiển thị `serviceId.name`

### 7.2 Tạo hoặc cập nhật schedule

`POST /api/admin/shift/service-schedules`

Body cho rule toàn hệ thống:

```json
{
  "serviceId": "ALL",
  "openTime": "07:30",
  "closeTime": "17:00",
  "isEnabled": true
}
```

Body cho 1 service cụ thể:

```json
{
  "serviceId": "6615b0d4f4e7b7e0b1234567",
  "openTime": "08:00",
  "closeTime": "16:30",
  "isEnabled": true
}
```

Response:

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

Rule nghiệp vụ:

- 1 service chỉ có tối đa 1 schedule
- gọi lại API với cùng `serviceId` sẽ update, không tạo dòng mới

Validation:

- `serviceId` bắt buộc
- `serviceId` là `'ALL'` hoặc ObjectId
- `openTime` đúng `HH:MM`
- `closeTime` đúng `HH:MM`

### 7.3 Bật / tắt schedule

`PATCH /api/admin/shift/service-schedules/:serviceId/toggle`

Body:

```json
{
  "isEnabled": false
}
```

Response:

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

Ý nghĩa:

- rule vẫn tồn tại
- scheduler sẽ bỏ qua rule nếu `isEnabled = false`

### 7.4 Xóa schedule

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

---

## 8. Scheduler hoạt động như thế nào

Backend có 2 scheduler chạy mỗi 60 giây:

### 8.1 Scheduler auto mở ca staff

- đọc `autoStartTime`
- nếu đúng giờ thì mở ca cho các staff đang `offDuty`

### 8.2 Scheduler service schedule

- lấy tất cả schedule đang `isEnabled = true`
- nếu giờ hiện tại = `openTime` -> set `isOpen = true`
- nếu giờ hiện tại = `closeTime` -> set `isOpen = false`

Nếu `serviceId = 'ALL'`:

- backend update `isOpen` cho toàn bộ service

Nếu `serviceId` là 1 service cụ thể:

- backend chỉ update service đó

Lưu ý cho FE:

- hiện chưa có socket event riêng cho schedule
- sau các thao tác create / update / toggle / delete, FE nên refetch lại danh sách

---

## 9. Ảnh hưởng tới màn hình public lấy số

Khi tạo ticket mới, backend kiểm tra:

1. service có active hay không
2. service có `isOpen = true` hay không
3. có staff đang `onDuty` cho service đó hay không

Nếu service đang đóng:

```json
{
  "success": false,
  "message": "Dịch vụ TU VAN hiện đang tạm đóng. Vui lòng quay lại sau."
}
```

Nếu service không có staff đang trong ca:

```json
{
  "success": false,
  "message": "Dịch vụ này hiện không có nhân viên đang làm ca. Vui lòng quay lại sau."
}
```

FE public nên:

- coi đây là business error
- hiển thị message thân thiện
- nếu có danh sách service, nên đánh dấu service đang đóng nếu có dữ liệu `isOpen`

---

## 10. Gợi ý UI cho FE Admin

### 10.1 Block Shift Settings

Nên có:

- time picker: `Giờ tự động mở ca`
- number input: `Số phút nhắc nhở`

### 10.2 Block Staff Shift Monitor

Nên có:

- table staff
- filter theo trạng thái ca
- action:
  - `Mở ca`
  - `Đóng ca`
  - `Xem lịch sử`

### 10.3 Block Service Schedule Manager

Nên có:

- table schedule
- cột:
  - Dịch vụ
  - Giờ mở
  - Giờ đóng
  - Trạng thái rule
  - Trạng thái hiện tại của service nếu có
- action:
  - `Sửa`
  - `Bật/Tắt`
  - `Xóa`

Form create/update nên có:

- select service:
  - `Tất cả dịch vụ`
  - từng service cụ thể
- `openTime`
- `closeTime`
- switch `isEnabled`

---

## 11. Gợi ý flow FE

### 11.1 Khi vào trang Admin Shift

Gọi song song:

- `GET /api/admin/shift/settings`
- `GET /api/admin/shift/staff`
- `GET /api/admin/shift/service-schedules`

### 11.2 Khi admin force mở/đóng ca

1. chọn staff
2. bấm action
3. nếu là đóng ca -> nhập `reason`
4. submit
5. refetch list staff
6. nếu đang mở drawer history -> refetch history

### 11.3 Khi admin tạo/sửa schedule

1. mở modal form
2. chọn service hoặc `ALL`
3. nhập giờ mở / giờ đóng
4. chọn enabled/disabled
5. submit `POST /api/admin/shift/service-schedules`
6. refetch list

### 11.4 Khi admin toggle schedule

1. bấm switch
2. gọi `PATCH /api/admin/shift/service-schedules/:serviceId/toggle`
3. refetch row hoặc refetch list

### 11.5 Khi admin xóa schedule

1. confirm
2. gọi `DELETE /api/admin/shift/service-schedules/:serviceId`
3. refetch list

---

## 12. Những lỗi FE cần xử lý đẹp

- `Không tìm thấy nhân viên`
- `Nhân viên đang trong ca làm việc`
- `Nhân viên không đang trong ca làm việc`
- `Không tìm thấy dịch vụ`
- `Không tìm thấy lịch dịch vụ`
- `Dịch vụ ... hiện đang tạm đóng. Vui lòng quay lại sau.`
- `Dịch vụ này hiện không có nhân viên đang làm ca. Vui lòng quay lại sau.`

Nên hiển thị dưới dạng:

- toast
- inline alert
- modal warning

Không nên hiển thị generic message kiểu `Server error`.

---

## 13. Checklist tích hợp

- Đã bỏ toàn bộ call tới `/api/shift/*`
- Đã có page admin shift settings
- Đã có table staff on-duty/off-duty
- Đã có action force mở ca / đóng ca
- Đã có modal xem lịch sử ca
- Đã có CRUD service schedules
- Đã xử lý riêng trường hợp `serviceId = 'ALL'`
- Đã xử lý state `isEnabled`
- Đã hiểu `isEnabled` khác `isOpen`
- Đã xử lý business error cho public create ticket

---

## 14. Tóm tắt để FE nhớ nhanh

- `onDuty` = staff có đang làm việc hay không
- `isOpen` = service có đang mở nhận số hay không
- Admin quản lý cả 2
- Staff không còn tự quản lý ca
- Muốn service cấp số được thì cần:
  - service đang `isOpen = true`
  - có staff đang `onDuty`

