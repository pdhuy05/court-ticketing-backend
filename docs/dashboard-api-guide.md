# Hướng Dẫn Frontend Kết Nối Dashboard APIs

## Tổng Quan

Hệ thống Dashboard cung cấp 8 APIs để lấy dữ liệu thống kê realtime cho giao diện quản trị. Tất cả APIs đều hỗ trợ Socket.IO để cập nhật dữ liệu tự động.

## Cấu Hình Chung

### Base URL
```
http://your-api-domain/api/dashboard
```

### Authentication
- Tất cả APIs đều yêu cầu authentication (Bearer token)
- Header: `Authorization: Bearer <token>`

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Thành công"
}
```

### Socket.IO Connection
```javascript
import io from 'socket.io-client';

const socket = io('http://your-api-domain', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Lắng nghe events từ room 'admin-dashboard'
socket.on('dashboard:*', (data) => {
  console.log('Dashboard update:', data);
});
```

## Chi Tiết Các APIs

### 1. GET /api/dashboard/tickets/overview
**Mục đích:** Lấy thống kê tổng quan vé từ trước đến nay

**Response:**
```json
{
  "totalTickets": 1250,
  "statusCounts": {
    "waiting": 45,
    "processing": 12,
    "completed": 1100,
    "skipped": 93
  },
  "serviceCounts": [
    {
      "serviceId": "64f...",
      "serviceName": "Quầy A",
      "count": 450
    }
  ]
}
```

**Socket Event:** `dashboard:ticketOverview`

### 2. GET /api/dashboard/counters/status
**Mục đích:** Thống kê trạng thái phòng/quầy

**Response:**
```json
{
  "totalCounters": 10,
  "activeCounters": 8,
  "inactiveCounters": 2,
  "countersList": [
    {
      "code": "A01",
      "name": "Phòng A1",
      "number": 1,
      "isActive": true
    }
  ]
}
```

**Socket Event:** `dashboard:counterStatus`

### 3. GET /api/dashboard/staff
**Mục đích:** Danh sách và thống kê nhân viên

**Response:**
```json
{
  "totalStaff": 25,
  "onDutyStaff": [...],
  "offDutyStaff": [...],
  "staffList": [
    {
      "fullName": "Nguyễn Văn A",
      "username": "nguyenvana",
      "isActive": true,
      "onDuty": true,
      "counterId": {
        "name": "Phòng A1",
        "number": 1
      }
    }
  ]
}
```

**Socket Event:** `dashboard:staffList`

### 4. GET /api/dashboard/tickets/today
**Mục đích:** Thống kê vé trong ngày hiện tại

**Response:**
```json
{
  "totalToday": 120,
  "statusCounts": {
    "completed": 95,
    "skipped": 8,
    "waiting": 12,
    "processing": 5
  },
  "percentages": {
    "completed": 79,
    "skipped": 7,
    "waiting": 10,
    "processing": 4
  }
}
```

**Socket Event:** `dashboard:ticketsToday`

### 5. GET /api/dashboard/tickets/recent
**Mục đích:** 5 vé gần nhất của mỗi phòng và mỗi quầy

**Response:**
```json
{
  "recentByCounter": [
    {
      "counterId": "64f...",
      "tickets": [
        {
          "number": 125,
          "ticketNumber": "A00125",
          "status": "waiting",
          "createdAt": "2024-01-01T10:00:00Z",
          "serviceId": { "name": "Quầy A", "code": "A" },
          "staffId": { "fullName": "Nguyễn Văn A" }
        }
      ]
    }
  ],
  "recentByService": [
    {
      "serviceId": "64f...",
      "tickets": [...]
    }
  ]
}
```

**Socket Event:** `dashboard:recentTickets`

### 6. GET /api/dashboard/tickets/ratio
**Mục đích:** Tỷ lệ vé theo từng phòng/quầy từ trước đến nay

**Response:**
```json
[
  {
    "counterId": "64f...",
    "counterName": "Phòng A1",
    "total": 450,
    "completed": 400,
    "skipped": 30,
    "waiting": 20,
    "percentages": {
      "completed": 89,
      "skipped": 7,
      "waiting": 4
    }
  }
]
```

**Socket Event:** `dashboard:ticketRatio`

### 7. GET /api/dashboard/tickets/trend?groupBy=day|month|year
**Mục đích:** Xu hướng số lượng vé theo thời gian

**Query Params:**
- `groupBy`: `day` (mặc định), `month`, `year`

**Response:**
```json
[
  {
    "label": "2024-01-01",
    "completed": 95,
    "skipped": 8,
    "waiting": 12,
    "total": 120
  }
]
```

**Socket Event:** `dashboard:ticketTrend`

### 8. GET /api/dashboard/counters/alert
**Mục đích:** Cảnh báo quầy quá tải (≥50 vé waiting)

**Response:**
```json
[
  {
    "counterId": "64f...",
    "counterName": "Phòng A1",
    "waitingCount": 55,
    "isAlert": true
  }
]
```

**Socket Event:** `dashboard:counterAlert`
- **Lưu ý:** Event này cũng tự động emit khi có vé mới được tạo

## Cách Sử Dụng Trong React/Vue

### 1. Setup Socket.IO
```javascript
// Trong component Dashboard
useEffect(() => {
  const socket = io(API_BASE_URL, {
    auth: { token: localStorage.getItem('token') }
  });

  socket.on('dashboard:ticketOverview', (data) => {
    setTicketOverview(data);
  });

  socket.on('dashboard:counterAlert', (data) => {
    setAlerts(data);
    // Hiển thị notification nếu có alert mới
  });

  return () => socket.disconnect();
}, []);
```

### 2. Fetch Initial Data
```javascript
const loadDashboardData = async () => {
  try {
    const [overview, counters, staff, today] = await Promise.all([
      api.get('/api/dashboard/tickets/overview'),
      api.get('/api/dashboard/counters/status'),
      api.get('/api/dashboard/staff'),
      api.get('/api/dashboard/tickets/today')
    ]);

    setData({
      overview: overview.data,
      counters: counters.data,
      staff: staff.data,
      today: today.data
    });
  } catch (error) {
    console.error('Failed to load dashboard:', error);
  }
};
```

### 3. Real-time Updates
```javascript
// Socket listeners sẽ tự động cập nhật state
// Không cần polling manual
```

## Lưu Ý Quan Trọng

1. **Authentication:** Đảm bảo token hợp lệ cho cả HTTP requests và Socket.IO
2. **Error Handling:** Xử lý trường hợp mất kết nối Socket.IO
3. **Performance:** Chỉ fetch data cần thiết, sử dụng caching nếu có thể
4. **Real-time:** Socket events sẽ tự động cập nhật UI, không cần refresh manual
5. **Timezone:** API sử dụng timezone của server, đảm bảo đồng bộ

## Troubleshooting

- **Không nhận được socket events:** Kiểm tra token authentication
- **Data không cập nhật:** Kiểm tra kết nối Socket.IO và room 'admin-dashboard'
- **API trả về 401:** Refresh token hoặc login lại
- **Performance chậm:** Sử dụng pagination cho danh sách lớn nếu cần