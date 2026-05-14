# Hướng dẫn Frontend — `doublePrint` (in 1 hoặc 2 vé theo dịch vụ)

Tài liệu mô tả cách **admin** bật/tắt in **hai tờ** (vé đầy đủ + tờ nhỏ kẹp hồ sơ) **cho từng dịch vụ (quầy)** qua API, và cách FE hiển thị / đồng bộ dữ liệu.

## Hành vi hệ thống (backend)

| `doublePrint` | Khi in vé (máy in mặc định / API in) |
|---------------|--------------------------------------|
| `true`        | In **2 tờ**: vé đầy đủ (QR, thông tin đương sự…) + **tờ nhỏ** (số thứ tự, tên dịch vụ, kẹp hồ sơ). |
| `false` (mặc định) | Chỉ in **1 tờ** (vé đầy đủ). |

- Giá trị mặc định trong DB cho dịch vụ cũ: **`false`** (nếu document chưa có field, Mongoose coi như `false` khi đọc/ghi mới).
- In vé luôn dùng **document Service** đã load từ DB (có `doublePrint`). FE chỉ cần gọi API cấu hình; **không** cần gửi `doublePrint` khi gọi in vé.

## Base URL

Giả sử API gốc giống các module khác: **`/api/services`**.

Ví dụ dev: `http://localhost:5000/api/services` (thay bằng `VITE_API_URL` / `NEXT_PUBLIC_API_URL` của dự án).

---

## 1. Toggle in 2 vé (Admin)

### Endpoint

```http
PATCH /api/services/:id/double-print
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

### Body (bắt buộc)

```json
{ "doublePrint": true }
```

hoặc

```json
{ "doublePrint": false }
```

- `doublePrint` phải là **boolean** (`true` / `false`), không dùng chuỗi `"true"`.
- Thiếu field → `400` với thông báo validation.

### Response thành công (200)

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "code": "ND",
    "name": "NỘP ĐƠN",
    "doublePrint": true,
    "...": "các field khác của Service"
  },
  "message": "Đã bật in 2 vé cho dịch vụ \"NỘP ĐƠN\""
}
```

Khi tắt: `"message": "Đã tắt in 2 vé cho dịch vụ \"...\""`.

### Lỗi thường gặp

| HTTP | Ý nghĩa |
|------|---------|
| `401` | Chưa đăng nhập / token hết hạn. |
| `403` | Không phải admin (`adminOnly`). |
| `400` | Validation (ví dụ thiếu `doublePrint`, sai kiểu). |
| `404` | Không tìm thấy dịch vụ với `:id`. |

### Ví dụ `fetch`

```javascript
async function setServiceDoublePrint(serviceId, doublePrint, accessToken) {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/api/services/${serviceId}/double-print`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ doublePrint }),
    },
  );

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || json.errors?.[0]?.message || res.statusText);
  }
  return json;
}
```

### Ví dụ Axios

```javascript
import axios from "axios";

export function toggleDoublePrint(serviceId, doublePrint) {
  return axios.patch(
    `/api/services/${serviceId}/double-print`,
    { doublePrint },
    { headers: { Authorization: `Bearer ${getToken()}` } },
  );
}
```

(Gắn `baseURL` trong instance Axios cho đúng môi trường.)

---

## 2. Đọc / cập nhật `doublePrint` qua CRUD dịch vụ (tùy chọn)

Ngoài PATCH riêng, field có trong model và validation:

### Tạo dịch vụ (`POST /api/services`, admin)

Body có thể gồm:

```json
{
  "code": "ND",
  "name": "NỘP ĐƠN",
  "doublePrint": true
}
```

Nếu không gửi: mặc định **`false`**.

### Cập nhật dịch vụ (`PUT /api/services/:id`, admin)

```json
{
  "doublePrint": false
}
```

Có thể gửi kèm field khác; schema update yêu cầu **ít nhất một** field hợp lệ.

### Đọc danh chi tiết

- **`GET /api/services/:id`** — object `data` có `doublePrint` (nếu đã lưu trong DB).
- **`GET /api/services`** — mỗi phần tử trong `data` có đủ field model.
- **`GET /api/services/active`** — trong `select` có **`doublePrint`**: kiosk / màn hình lấy số có thể hiển thị trạng thái (ví dụ icon “2 vé”) nếu cần.

---

## 3. TypeScript gợi ý

```typescript
export interface Service {
  _id: string;
  code: string;
  name: string;
  doublePrint?: boolean;
  // ... các field khác
}

export interface ToggleDoublePrintResponse {
  success: boolean;
  data: Service;
  message: string;
}
```

---

## 4. Đồng bộ UI sau khi toggle

Sau `PATCH .../double-print` thành công:

1. Cập nhật **state cục bộ** (React Query / Zustand / Redux): gán `data` từ response cho đúng `serviceId`.
2. Nếu dùng **danh sách dịch vụ** đã cache từ `GET /api/services` hoặc `/active`, nên **invalidate** query hoặc merge `data` vào list.

Backend còn gọi `emitDashboardUpdateSafe('service-updated')`. Nếu FE dashboard đã lắng nghe socket/dashboard event tương ứng, có thể refetch danh sách dịch vụ khi nhận event (tùy cách triển khai socket hiện tại).

---

## 5. Liên quan tới in vé (cho đúng ngữ cảnh, không bắt buộc gọi từ FE thường)

- **`POST /api/tickets/:id/print`** — server queue in trên **máy in mặc định**, dùng `doublePrint` của **service** gắn với vé (đã populate từ DB).
- **`POST /api/printers/print`** (admin) — in theo `ticketId` + `printerCode`; service lấy từ ticket populate — có đủ `doublePrint`.

FE **không** truyền thêm tham số in 1/2 tờ; mọi thứ theo cấu hình dịch vụ trên server.

---

## 6. Checklist tích hợp Admin UI

- [ ] Màn hình chi tiết / danh sách dịch vụ: switch hoặc nút “In 2 vé (tờ nhỏ kẹp hồ sơ)” gọi `PATCH .../double-print` với `{ doublePrint: true | false }`.
- [ ] Hiển thị trạng thái hiện tại từ `GET` (hoặc từ cache sau toggle).
- [ ] Xử lý lỗi 400 (validation), 401/403, 404.
- [ ] (Tùy chọn) Form tạo/sửa dịch vụ: thêm checkbox đồng bộ với `doublePrint` qua `POST` / `PUT`.

---

## 7. CURL kiểm thử nhanh

```bash
curl -sS -X PATCH "http://localhost:5000/api/services/SERVICE_OBJECT_ID/double-print" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"doublePrint":true}'
```

Thay `SERVICE_OBJECT_ID` và token cho đúng môi trường.
