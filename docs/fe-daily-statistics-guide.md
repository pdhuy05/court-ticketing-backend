# Hướng dẫn FE: Thống kê hàng ngày (DailyStatistics)

Tài liệu này mô tả tính năng **lưu thống kê theo ngày** sau khi admin **reset ticket theo ngày**, và cách **gọi API** để hiển thị trên màn admin / báo cáo.

---

## 1) Bản chất tính năng (để hiểu nhanh)

- Mỗi lần admin gọi **reset ticket theo ngày** (`POST /api/admin/tickets/reset-day`), backend **trước khi xóa ticket** sẽ:
  - đọc tất cả ticket có `createdAt` thuộc ngày đó
  - tính tổng hợp (tổng vé, hoàn thành, bỏ qua, tỷ lệ %, thời gian trung bình, nhóm theo dịch vụ / quầy / nhân viên)
  - **ghi vào database** (collection `daily_statistics`, một bản ghi / một ngày `YYYY-MM-DD`)
- Sau đó backend **xóa ticket** như cũ. Dữ liệu thống kê **vẫn còn** để xem lại lịch sử.

**Lưu ý quan trọng cho UI:**

- Nếu reset một ngày **không có ticket nào** (`deletedCount: 0`), backend **không tạo** bản ghi `DailyStatistics` cho ngày đó.
- Nếu admin reset **cùng một ngày lần 2** sau khi đã xóa hết ticket, lần đó **không còn ticket** nên cũng **không cập nhật** thống kê (trường hợm hiếm).

---

## 2) Quyền và xác thực

Tất cả API thống kê chỉ dành cho **admin**.

| Yêu cầu | Giá trị |
|--------|---------|
| Header | `Authorization: Bearer <access_token>` |
| Role | `admin` (token JWT phải là tài khoản admin) |

Nếu không đăng nhập / token sai: **401**.  
Nếu đăng nhập nhưng không phải admin: **403** với message dạng `Chỉ admin mới có quyền truy cập`.

---

## 3) Base URL

Giống các API khác của backend, ví dụ:

```text
https://<host>/api/statistics
```

---

## 4) API 1: Lấy thống kê **một ngày**

### Request

```http
GET /api/statistics/daily?date=2026-04-19
Authorization: Bearer <admin_token>
```

### Query bắt buộc

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---------|------|----------|--------|
| `date` | string | Có | Định dạng **YYYY-MM-DD** (ví dụ `2026-04-19`) |

### Response thành công (200)

```json
{
  "success": true,
  "data": {
    "date": "2026-04-19",
    "totalTickets": 120,
    "completedTickets": 100,
    "skippedTickets": 5,
    "completionRate": 83.33,
    "skipRate": 4.17,
    "avgWaitingTime": 180.5,
    "avgProcessingTime": 420.25,
    "byService": [
      {
        "serviceId": "6800f94f6a3b0b7f6a1f0001",
        "serviceCode": "ND",
        "serviceName": "Nộp đơn",
        "total": 60,
        "completed": 50,
        "skipped": 2,
        "avgWaitingTime": 150,
        "avgProcessingTime": 400
      }
    ],
    "byCounter": [
      {
        "counterId": "6800f8ec6a3b0b7f6a1e9999",
        "counterName": "QUẦY 1",
        "counterNumber": 1,
        "processedCount": 55,
        "avgProcessingTime": 410
      }
    ],
    "byStaff": [
      {
        "staffId": "6800f8ec6a3b0b7f6a1e8888",
        "staffName": "Nguyễn Văn A",
        "username": "staff.a",
        "processedCount": 30,
        "avgProcessingTime": 380,
        "skipCount": 4
      }
    ],
    "resetBy": {
      "id": "6800f7aa6a3b0b7f6a1e7777",
      "username": "admin",
      "fullName": "Quản trị viên"
    },
    "resetAt": "2026-04-19T22:30:00.000Z",
    "createdAt": "2026-04-19T22:30:00.100Z",
    "updatedAt": "2026-04-19T22:30:00.100Z",
    "_id": "..."
  }
}
```

- `createdAt` / `updatedAt`: Mongoose timestamps (lần tạo / lần sửa bản ghi thống kê).
- `resetAt`: thời điểm backend **lưu snapshot** thống kê (ngay reset).
- `resetBy`: admin thực hiện reset (nếu có).

### Lỗi thường gặp

| HTTP | Khi nào | Body gọn |
|------|---------|----------|
| **400** | Thiếu `date` hoặc sai định dạng | `{ "success": false, "message": "Validation error", "errors": [...] }` |
| **404** | Chưa có thống kê cho ngày đó | `{ "success": false, "message": "Không tìm thấy thống kê cho ngày này" }` |
| **401** | Chưa login / token hết hạn | `{ "success": false, "message": "..." }` |
| **403** | Không phải admin | `{ "success": false, "message": "Chỉ admin mới có quyền truy cập" }` |

**Gợi ý UI:** Nếu 404, hiển thị dạng *"Chưa có dữ liệu thống kê cho ngày này (có thể chưa từng reset ticket ngày này hoặc ngày đó không có ticket)."*

---

## 5) API 2: Lấy thống kê **theo khoảng ngày**

### Request

```http
GET /api/statistics/range?startDate=2026-04-01&endDate=2026-04-30
Authorization: Bearer <admin_token>
```

### Query bắt buộc

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---------|------|----------|--------|
| `startDate` | string | Có | **YYYY-MM-DD** |
| `endDate` | string | Có | **YYYY-MM-DD** |

Backend so sánh chuỗi `startDate` và `endDate` theo thứ tự từ điển (phù hợp với định dạng ISO ngày). Nếu `startDate > endDate` → **400**.

### Response thành công (200)

```json
{
  "success": true,
  "count": 3,
  "data": [
    { "date": "2026-04-01", "totalTickets": 10 },
    { "date": "2026-04-15", "totalTickets": 50 },
    { "date": "2026-04-19", "totalTickets": 120 }
  ]
}
```

- `data` là **mảng** các bản ghi cùng cấu trúc với `GET /daily`, sắp xếp **`date` tăng dần**.
- `count` = `data.length` (số ngày **có** bản ghi thống kê trong khoảng, **không** tự chèn các ngày trống).

**Gợi ý UI:** Nếu cần biểu đồ liên tục theo lịch, FE tự điền các ngày trong khoảng và map với `data` theo `date`; ngày không có trong `data` → coi như 0 hoặc "không có dữ liệu".

---

## 6) Ý nghĩa từng field (để làm dashboard / bảng)

### 6.1 Nhóm tổng quan (trên `data`)

| Field | Đơn vị / kiểu | Ý nghĩa |
|-------|----------------|--------|
| `date` | string `YYYY-MM-DD` | Ngày thống kê (theo **ngày tạo ticket** trong logic reset) |
| `totalTickets` | number | Tổng số ticket **được tạo** trong ngày đó (`createdAt` thuộc ngày) |
| `completedTickets` | number | Số ticket có `status === "completed"` |
| `skippedTickets` | number | Số ticket có `status === "skipped"` (**không** tính vé đang `waiting` / recall) |
| `completionRate` | number (%) | `(completedTickets / totalTickets) * 100`, làm tròn 2 chữ số; nếu `totalTickets = 0` thì `0` |
| `skipRate` | number (%) | `(skippedTickets / totalTickets) * 100`, làm tròn 2 chữ số |
| `avgWaitingTime` | number (giây) | Trung bình `waitingDuration` của **tất cả** ticket trong ngày |
| `avgProcessingTime` | number (giây) | Trung bình `processingDuration` của **tất cả** ticket trong ngày |

**Hiển thị UI:**

- Tỷ lệ: có thể thêm `%` sau giá trị (`completionRate.toFixed(2) + '%'`).
- Thời gian: có thể format `mm:ss` hoặc `X phút Y giây` từ số giây.

### 6.2 Mảng `byService` (bảng / biểu đồ theo dịch vụ)

Mỗi phần tử:

| Field | Mô tả |
|-------|--------|
| `serviceId` | ObjectId dịch vụ |
| `serviceCode` | Mã dịch vụ (ví dụ `ND`) |
| `serviceName` | Tên dịch vụ |
| `total` | Tổng ticket thuộc dịch vụ trong ngày |
| `completed` / `skipped` | Đếm theo `status` |
| `avgWaitingTime` | Trung bình `waitingDuration` trong nhóm dịch vụ (giây) |
| `avgProcessingTime` | Trung bình `processingDuration` trong nhóm dịch vụ (giây) |

Thứ tự phần tử: backend sắp xếp theo `serviceCode` tăng dần (ổn định cho bảng).

### 6.3 Mảng `byCounter` (theo quầy)

**Chỉ tính ticket đã hoàn thành** (`status === "completed"`) và có `counterId`.

| Field | Mô tả |
|-------|--------|
| `counterId` | Quầy xử lý |
| `counterName` / `counterNumber` | Hiển thị |
| `processedCount` | Số vé **completed** tại quầy đó trong ngày |
| `avgProcessingTime` | Trung bình `processingDuration` của các vé completed đó (giây) |

Sắp xếp: theo `counterNumber` tăng dần.

### 6.4 Mảng `byStaff` (theo nhân viên)

Lấy tất cả ticket trong ngày **có** `staffId` (bất kỳ `status`), rồi nhóm theo nhân viên.

| Field | Mô tả |
|-------|--------|
| `staffId` | User nhân viên |
| `staffName` | Họ tên |
| `username` | Tên đăng nhập |
| `processedCount` | Số vé **completed** mà staff đó tham gia (`staffId` khớp) |
| `avgProcessingTime` | Trung bình `processingDuration` chỉ trên các vé **completed** của staff đó (giây) |
| `skipCount` | **Tổng** giá trị field `skipCount` trên các ticket của staff trong ngày (tích lũy trên vé, không phải đếm số lần gọi API skip) |

Sắp xếp: theo `username` tăng dần.

### 6.5 `resetBy` / `resetAt`

| Field | Mô tả |
|-------|--------|
| `resetBy` | `{ id, username, fullName }` hoặc `null` |
| `resetAt` | ISO datetime lúc lưu thống kê |

Dùng để hiển thị footer: *"Dữ liệu snapshot lúc … bởi …"*.

---

## 7) Luồng làm việc FE đề xuất (từng bước)

### Màn "Báo cáo theo ngày"

1. Dùng date picker → chọn `date` dạng `YYYY-MM-DD`.
2. Gọi `GET /api/statistics/daily?date=...`.
3. Nếu 200: render:
   - 4 thẻ (cards): `totalTickets`, `completedTickets`, `skippedTickets`, `completionRate` / `skipRate`.
   - 2 chỉ số thời gian: `avgWaitingTime`, `avgProcessingTime`.
   - 3 bảng: `byService`, `byCounter`, `byStaff`.
4. Nếu 404: hiển thị empty state + hướng dẫn (xem mục 4).

### Màn "Báo cáo khoảng thời gian"

1. Hai date picker: `startDate`, `endDate`.
2. Gọi `GET /api/statistics/range?startDate=...&endDate=...`.
3. Vẽ line chart / bar chart:
   - trục X: `date`
   - trục Y: ví dụ `totalTickets` hoặc `completedTickets`
4. Click một cột / điểm → có thể điều hướng sang màn chi tiết ngày và gọi lại API `daily`.

### Sau khi admin reset ngày (tùy chọn)

- Response `POST /api/admin/tickets/reset-day` **không** kèm object thống kê trong body (hiện tại).
- Nếu muốn refresh thống kê ngay lập tức: sau khi reset thành công, FE gọi lại `GET /api/statistics/daily?date=<cùng ngày reset>`.

---

## 8) Ví dụ gọi bằng `fetch` (browser / Node)

```javascript
const baseUrl = 'https://your-api.com';
const token = localStorage.getItem('adminToken');

async function getDaily(date) {
  const res = await fetch(`${baseUrl}/api/statistics/daily?date=${encodeURIComponent(date)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || res.statusText);
  return json.data;
}

async function getRange(startDate, endDate) {
  const q = new URLSearchParams({ startDate, endDate });
  const res = await fetch(`${baseUrl}/api/statistics/range?${q}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || res.statusText);
  return json.data;
}
```

---

## 9) TypeScript (gợi ý — không bắt buộc)

```ts
type DailyStatistics = {
  _id: string;
  date: string;
  totalTickets: number;
  completedTickets: number;
  skippedTickets: number;
  completionRate: number;
  skipRate: number;
  avgWaitingTime: number;
  avgProcessingTime: number;
  byService: Array<{
    serviceId: string;
    serviceCode: string;
    serviceName: string;
    total: number;
    completed: number;
    skipped: number;
    avgWaitingTime: number;
    avgProcessingTime: number;
  }>;
  byCounter: Array<{
    counterId: string;
    counterName: string;
    counterNumber: number;
    processedCount: number;
    avgProcessingTime: number;
  }>;
  byStaff: Array<{
    staffId: string;
    staffName: string;
    username: string;
    processedCount: number;
    avgProcessingTime: number;
    skipCount: number;
  }>;
  resetBy: null | { id: string; username: string; fullName: string };
  resetAt: string;
  createdAt: string;
  updatedAt: string;
};
```

---

## 10) Checklist nhanh trước khi ship FE

- [ ] Chỉ gọi API thống kê khi user đã login **admin**
- [ ] Luôn gửi header `Authorization: Bearer ...`
- [ ] Validate `YYYY-MM-DD` phía FE trước khi gọi (giảm 400)
- [ ] Xử lý 404 `daily` bằng empty state rõ ràng
- [ ] Range: xử lý `startDate > endDate` (hoặc để backend trả 400 và hiện message)
- [ ] Format số thập phân / thời gian theo UX Việt Nam

---

## 11) Liên quan backend (không phải API FE nhưng cần biết)

- Thống kê được tạo khi admin: `POST /api/admin/tickets/reset-day` với body `{ "date": "YYYY-MM-DD" }` và **có ít nhất một ticket** trong ngày đó.
- Dữ liệu nguồn: ticket trước khi xóa, theo `createdAt` trong khoảng `[00:00:00, 24:00:00)` **theo timezone của server** (cùng logic `getDateRange` trong backend).

Nếu cần đổi hành vi timezone, đó là thay đổi BE; FE chỉ cần truyền đúng chuỗi ngày theo quy ước đã thống nhất với admin.
