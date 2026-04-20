# Hướng Dẫn FE — Tính Năng Quản Lý Backup

## Tổng quan

Hệ thống backup tự động lưu lại dữ liệu ticket mỗi khi admin thực hiện **reset ticket theo ngày** hoặc **reset toàn bộ**. Tính năng này cho phép admin xem danh sách, xem chi tiết, tải file, và xoá các bản backup đó.

> [!NOTE]
> Tất cả API đều yêu cầu **đăng nhập với role `admin`**. Gửi token trong header:
> ```
> Authorization: Bearer <token>
> ```

---

## API Endpoints

Base URL: `/api/admin/backups`

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| `GET` | `/api/admin/backups` | Lấy danh sách tất cả backup |
| `GET` | `/api/admin/backups/:id` | Xem chi tiết 1 backup |
| `GET` | `/api/admin/backups/:id/download` | Tải file backup (JSON) |
| `DELETE` | `/api/admin/backups/:id` | Xoá backup |

---

## 1. Lấy danh sách backup

```
GET /api/admin/backups
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "663f1a2b...",
      "fileName": "reset-day-2026-04-20-2026-04-20T03-30-00-000Z.json",
      "backupType": "reset-day",
      "backupLabel": "2026-04-20",
      "ticketCount": 45,
      "fileSize": 28430,
      "filePath": "backups/ticket-resets/reset-day-2026-04-20-....json",
      "createdBy": {
        "id": "660a...",
        "username": "admin",
        "fullName": "Nguyễn Văn A",
        "role": "admin"
      },
      "criteria": {
        "date": "2026-04-20",
        "start": "2026-04-19T17:00:00.000Z",
        "end": "2026-04-20T17:00:00.000Z",
        "resetScope": null
      },
      "createdAt": "2026-04-20T03:30:15.123Z",
      "updatedAt": "2026-04-20T03:30:15.123Z"
    }
  ]
}
```

> [!IMPORTANT]
> Dữ liệu trả về đã sắp xếp theo **`createdAt` giảm dần** (mới nhất trước). Phân trang và lọc (theo `backupType`, tìm kiếm, v.v.) do FE tự xử lý phía client.

### Giải thích các trường quan trọng

| Trường | Kiểu | Mô tả |
|--------|------|--------|
| `_id` | String | ID của backup, dùng cho các API chi tiết/tải/xoá |
| `fileName` | String | Tên file backup trên server |
| `backupType` | String | `"reset-day"` = reset theo ngày, `"reset-all"` = reset toàn bộ |
| `backupLabel` | String | Nhãn mô tả (VD: `"2026-04-20"` hoặc `"all-tickets"`) |
| `ticketCount` | Number | Số ticket đã backup |
| `fileSize` | Number | Kích thước file (bytes) |
| `createdBy` | Object | Thông tin admin đã thực hiện reset |
| `criteria.date` | String | Ngày được reset (chỉ có với `reset-day`) |
| `criteria.resetScope` | String | `"all"` nếu là reset toàn bộ |
| `createdAt` | String | Thời điểm tạo backup (ISO 8601) |

---

## 2. Xem chi tiết backup

```
GET /api/admin/backups/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "663f1a2b...",
    "fileName": "reset-day-2026-04-20-2026-04-20T03-30-00-000Z.json",
    "backupType": "reset-day",
    "backupLabel": "2026-04-20",
    "ticketCount": 45,
    "fileSize": 28430,
    "createdBy": { ... },
    "criteria": { ... },
    "createdAt": "2026-04-20T03:30:15.123Z"
  }
}
```

**Lỗi 404:**
```json
{
  "success": false,
  "message": "Không tìm thấy bản backup"
}
```

---

## 3. Tải file backup

```
GET /api/admin/backups/:id/download
```

- Response trả về file JSON trực tiếp (Content-Disposition: attachment).
- **Không** trả về JSON wrapper `{ success, data }`.

### Cách gọi từ FE

```javascript
const downloadBackup = async (backupId) => {
  try {
    const response = await fetch(`/api/admin/backups/${backupId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    // Lấy tên file từ header hoặc tự đặt
    const contentDisposition = response.headers.get('Content-Disposition');
    let fileName = 'backup.json';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+?)"?$/);
      if (match) fileName = match[1];
    }

    // Tạo blob và tải
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Tải backup thất bại:', error.message);
  }
};
```

**Lỗi 404:** Trả về JSON nếu file không tồn tại trên server:
```json
{
  "success": false,
  "message": "File backup không tồn tại trên hệ thống"
}
```

---

## 4. Xoá backup

```
DELETE /api/admin/backups/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fileName": "reset-day-2026-04-20-....json"
  },
  "message": "Đã xoá backup: reset-day-2026-04-20-....json"
}
```

> [!WARNING]
> Thao tác này **không thể hoàn tác**. Cả record trong DB lẫn file trên disk đều bị xoá vĩnh viễn. Nên hiển thị dialog xác nhận trước khi gọi API.

---

## Gợi ý thiết kế UI

### Trang danh sách backup

```
┌──────────────────────────────────────────────────────────────────┐
│  📦 Quản lý Backup                          [Lọc ▼] [Tìm kiếm]│
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📋 Reset ngày 2026-04-20             45 ticket  ·  28 KB  │  │
│  │ Admin: Nguyễn Văn A  ·  20/04/2026 10:30                  │  │
│  │                                    [📥 Tải] [🗑️ Xoá]     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 🔄 Reset toàn bộ                   120 ticket  ·  85 KB   │  │
│  │ Admin: Nguyễn Văn A  ·  19/04/2026 17:00                  │  │
│  │                                    [📥 Tải] [🗑️ Xoá]     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Hiển thị 2 / 2 bản backup                                      │
└──────────────────────────────────────────────────────────────────┘
```

### Các tính năng FE nên tự xử lý

| Tính năng | Gợi ý |
|-----------|-------|
| **Lọc theo loại** | Dropdown: Tất cả / Reset theo ngày / Reset toàn bộ — lọc theo `backupType` |
| **Tìm kiếm** | Tìm theo `backupLabel`, `fileName`, hoặc `createdBy.fullName` |
| **Sắp xếp** | Theo ngày tạo, số ticket, kích thước file |
| **Phân trang** | Hiển thị 10-20 item/trang nếu danh sách nhiều |
| **Format fileSize** | Đổi bytes → KB/MB (VD: `28430` → `"27.8 KB"`) |
| **Format ngày** | Đổi ISO string → format đọc được (VD: `"20/04/2026 10:30"`) |

### Ví dụ format fileSize

```javascript
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};
```

### Ví dụ lọc + tìm kiếm phía client

```javascript
const [backups, setBackups] = useState([]);
const [filterType, setFilterType] = useState('all');   // 'all' | 'reset-day' | 'reset-all'
const [searchText, setSearchText] = useState('');

const filteredBackups = useMemo(() => {
  return backups.filter((b) => {
    // Lọc theo loại
    if (filterType !== 'all' && b.backupType !== filterType) return false;

    // Tìm kiếm
    if (searchText) {
      const keyword = searchText.toLowerCase();
      return (
        b.backupLabel.toLowerCase().includes(keyword) ||
        b.fileName.toLowerCase().includes(keyword) ||
        b.createdBy?.fullName?.toLowerCase().includes(keyword)
      );
    }

    return true;
  });
}, [backups, filterType, searchText]);
```

---

## Xử lý lỗi chung

Tất cả API trả về format thống nhất khi lỗi:

```json
{
  "success": false,
  "message": "Mô tả lỗi"
}
```

| HTTP Status | Ý nghĩa |
|-------------|----------|
| `401` | Chưa đăng nhập hoặc token hết hạn |
| `403` | Không phải admin |
| `404` | Backup không tồn tại |
| `500` | Lỗi server |

---

## Khi nào backup được tạo?

Backup được tạo **tự động** khi admin gọi:
- `POST /api/admin/tickets/reset-day` → tạo backup loại `reset-day`
- `POST /api/admin/tickets/reset-all` → tạo backup loại `reset-all`

FE **không cần** gọi API tạo backup. Chỉ cần hiển thị và quản lý các backup đã có.
