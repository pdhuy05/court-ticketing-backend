# Admin Profile API

Tài liệu này dành cho frontend khi làm trang hồ sơ cá nhân admin/staff.

## Mục tiêu

Frontend không nên chỉ lấy thông tin profile từ `localStorage` vì dữ liệu có thể cũ sau khi admin đổi tên, đổi phân công phòng/quầy, khóa tài khoản, đổi trạng thái ca làm việc. API này trả dữ liệu mới nhất từ database theo token hiện tại.

## Endpoint

```http
GET /api/auth/me
```

Yêu cầu đăng nhập.

Header:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

Base URL tùy môi trường FE đang cấu hình, ví dụ:

```txt
http://localhost:5000/api/auth/me
```

## Khi Nào Gọi API

Frontend nên gọi API này khi:

- Vào trang `/admin/profile`.
- Reload app/admin layout và cần hydrate thông tin user thật.
- Sau login thành công nếu muốn đồng bộ user object mới nhất.
- Sau khi đổi thông tin nhân viên, phân công phòng/quầy, đổi trạng thái hoạt động hoặc ca trực.

## Response Thành Công

Status: `200`

```json
{
  "success": true,
  "data": {
    "_id": "665f...",
    "id": "665f...",
    "username": "admin",
    "fullName": "Nguyễn Văn A",
    "role": "admin",
    "counterId": null,
    "counter": null,
    "isActive": true,
    "lastLoginAt": "2026-05-12T02:10:00.000Z",
    "onDuty": true,
    "lastShiftStart": null,
    "lastShiftEnd": null,
    "createdAt": "2026-05-01T02:10:00.000Z",
    "updatedAt": "2026-05-12T02:10:00.000Z",
    "email": null,
    "phone": null,
    "address": null,
    "availableServices": [],
    "assignedServices": [],
    "effectiveServices": [],
    "serviceRestrictionConfigured": false
  }
}
```

Với tài khoản `staff`, `counter` và các danh sách quầy sẽ có dữ liệu:

```json
{
  "success": true,
  "data": {
    "_id": "665f...",
    "id": "665f...",
    "username": "staff01",
    "fullName": "Trần Thị B",
    "role": "staff",
    "counterId": "665a...",
    "counter": {
      "_id": "665a...",
      "id": "665a...",
      "code": "P01",
      "name": "Phòng 1",
      "number": 1,
      "isActive": true
    },
    "isActive": true,
    "lastLoginAt": "2026-05-12T02:10:00.000Z",
    "onDuty": true,
    "lastShiftStart": "2026-05-12T00:30:00.000Z",
    "lastShiftEnd": null,
    "createdAt": "2026-05-01T02:10:00.000Z",
    "updatedAt": "2026-05-12T02:10:00.000Z",
    "email": null,
    "phone": null,
    "address": null,
    "availableServices": [
      {
        "id": "665b...",
        "_id": "665b...",
        "code": "ND",
        "name": "NỘP ĐƠN",
        "icon": "",
        "displayOrder": 1,
        "isActive": true
      }
    ],
    "assignedServices": [
      {
        "id": "665b...",
        "_id": "665b...",
        "code": "ND",
        "name": "NỘP ĐƠN",
        "icon": "",
        "displayOrder": 1,
        "isActive": true
      }
    ],
    "effectiveServices": [
      {
        "id": "665b...",
        "_id": "665b...",
        "code": "ND",
        "name": "NỘP ĐƠN",
        "icon": "",
        "displayOrder": 1,
        "isActive": true
      }
    ],
    "serviceRestrictionConfigured": true
  }
}
```

## TypeScript Types

Frontend có thể dùng type này:

```ts
export type ProfileCounter = {
  _id?: string;
  id?: string;
  code?: string;
  name?: string;
  number?: number;
  isActive?: boolean;
};

export type ProfileService = {
  _id?: string;
  id?: string;
  code?: string;
  name?: string;
  icon?: string;
  displayOrder?: number;
  isActive?: boolean;
};

export type AdminProfile = {
  _id?: string;
  id?: string;
  username?: string;
  fullName?: string;
  role?: "admin" | "staff" | string;
  counterId?: string | null;
  counter?: ProfileCounter | null;
  isActive?: boolean;
  lastLoginAt?: string | null;
  onDuty?: boolean;
  lastShiftStart?: string | null;
  lastShiftEnd?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  availableServices?: ProfileService[];
  assignedServices?: ProfileService[];
  effectiveServices?: ProfileService[];
  serviceRestrictionConfigured?: boolean;
};

export type MeResponse = {
  success: boolean;
  data: AdminProfile;
  message?: string;
};
```

## Ví Dụ Fetch

Ví dụ dùng token đang lưu ở `localStorage`.

```ts
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

export async function getMyProfile() {
  const token = localStorage.getItem("adminToken");

  if (!token) {
    throw new Error("NO_TOKEN");
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || "Không thể tải hồ sơ");
  }

  return payload.data;
}
```

## Tích Hợp Vào Trang Profile Hiện Tại

Thay vì chỉ đọc `adminUser` từ `localStorage`, frontend nên:

1. Đọc token.
2. Gọi `/api/auth/me`.
3. Set state bằng response `data`.
4. Cập nhật lại `localStorage.adminUser` nếu vẫn muốn cache.
5. Nếu lỗi `401`, clear session và redirect về `/admin/login`.

Ví dụ:

```tsx
useEffect(() => {
  let isMounted = true;

  const loadProfile = async () => {
    const token = localStorage.getItem("adminToken");

    if (!token) {
      router.replace(LOGIN_PATH);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || "Không thể tải hồ sơ");
      }

      if (!isMounted) return;

      setAdminUser(payload.data);
      localStorage.setItem("adminUser", JSON.stringify(payload.data));
      setIsReady(true);
    } catch (error) {
      clearAdminSession();
      router.replace(LOGIN_PATH);
    }
  };

  loadProfile();

  return () => {
    isMounted = false;
  };
}, [router]);
```

## Mapping Dữ Liệu Vào UI

Các field trong component hiện tại có thể map như sau:

| UI | Field |
| --- | --- |
| Họ và tên | `fullName` |
| Tên đăng nhập | `username` |
| Vai trò | `role` |
| Trạng thái tài khoản | `isActive` |
| Trạng thái làm việc | `onDuty` |
| Quầy/phòng phụ trách | `counter.name`, fallback `counterId` |
| Mã phòng | `counter.code` |
| Số phòng | `counter.number` |
| Lần đăng nhập cuối | `lastLoginAt` |
| Bắt đầu ca gần nhất | `lastShiftStart` |
| Kết thúc ca gần nhất | `lastShiftEnd` |
| Ngày tạo | `createdAt` |
| Cập nhật lần cuối | `updatedAt` |
| Quầy được phân quyền | `effectiveServices` |

Gợi ý đổi phần “Quầy phụ trách”:

```tsx
<InfoRow label="Phòng phụ trách" icon={<FiBriefcase size={12} />}>
  {adminUser.counter ? (
    <StatusBadge tone="blue">
      {adminUser.counter.name}
      {adminUser.counter.number ? ` - Số ${adminUser.counter.number}` : ""}
    </StatusBadge>
  ) : (
    "—"
  )}
</InfoRow>
```

Hiển thị danh sách quầy được phân quyền cho staff:

```tsx
const services = adminUser.effectiveServices || [];

<InfoRow label="Quầy được phân quyền">
  {services.length > 0
    ? services.map((service) => service.name || service.code).join(", ")
    : "—"}
</InfoRow>
```

## Login Response Mới

`POST /api/auth/login` vẫn giữ nguyên endpoint, nhưng `data.user` đã trả cùng shape với `/api/auth/me`.

Ví dụ:

```json
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "user": {
      "_id": "665f...",
      "id": "665f...",
      "username": "admin",
      "fullName": "Nguyễn Văn A",
      "role": "admin",
      "counterId": null,
      "counter": null,
      "isActive": true
    }
  }
}
```

Frontend sau login nên lưu:

```ts
localStorage.setItem("adminToken", result.data.token);
localStorage.setItem("adminUser", JSON.stringify(result.data.user));
```

## Xử Lý Lỗi

Các lỗi thường gặp:

### Chưa gửi token

Status: `401`

```json
{
  "success": false,
  "message": "Chưa đăng nhập"
}
```

Hành động FE: clear session và redirect `/admin/login`.

### Token sai hoặc hết hạn

Status: `401`

```json
{
  "success": false,
  "message": "Token không hợp lệ hoặc đã hết hạn"
}
```

Hành động FE: clear session và redirect `/admin/login`.

### Tài khoản bị khóa hoặc không tồn tại

Status: `401`

```json
{
  "success": false,
  "message": "Tài khoản không tồn tại hoặc đã bị vô hiệu hóa"
}
```

Hành động FE: clear session, redirect login, có thể toast thông báo.

## Lưu Ý Hiện Tại

- Model `User` backend hiện chưa khai báo field `email`, `phone`, `address`, nên API đang trả các field này là `null`. Nếu FE muốn chỉnh sửa/lưu thật các field này, backend cần bổ sung schema và API update profile.
- `counterId` vẫn là string để tương thích FE cũ.
- `counter` là object chi tiết để FE hiển thị tên phòng, mã phòng và số phòng.
- Với admin, các mảng service thường là rỗng vì admin không bị phân quyền theo quầy như staff.
- Với staff, `effectiveServices` là danh sách quầy nhân viên thực sự được xử lý tại phòng hiện tại.
