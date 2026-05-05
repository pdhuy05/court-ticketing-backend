# Dashboard API Guide

Tài liệu hướng dẫn tích hợp 8 Dashboard APIs cho hệ thống lấy số thứ tự tự động. Tất cả API đều hỗ trợ Socket.IO realtime.

---

## Mục lục

1. [Cấu hình chung](#1-cấu-hình-chung)
2. [Thiết lập Axios](#2-thiết-lập-axios)
3. [Thiết lập Socket.IO](#3-thiết-lập-socketio)
4. [API 1 — Tổng quan vé](#4-api-1--tổng-quan-vé)
5. [API 2 — Trạng thái phòng/quầy](#5-api-2--trạng-thái-phòngquầy)
6. [API 3 — Danh sách nhân viên](#6-api-3--danh-sách-nhân-viên)
7. [API 4 — Vé hôm nay](#7-api-4--vé-hôm-nay)
8. [API 5 — 5 vé gần nhất](#8-api-5--5-vé-gần-nhất)
9. [API 6 — Tỷ lệ vé theo phòng/quầy](#9-api-6--tỷ-lệ-vé-theo-phòngquầy)
10. [API 7 — Xu hướng vé theo thời gian](#10-api-7--xu-hướng-vé-theo-thời-gian)
11. [API 8 — Cảnh báo quầy quá tải](#11-api-8--cảnh-báo-quầy-quá-tải)
12. [Tổng hợp socket events](#12-tổng-hợp-socket-events)
13. [Load toàn bộ dashboard](#13-load-toàn-bộ-dashboard)
14. [Xử lý lỗi & reconnect](#14-xử-lý-lỗi--reconnect)

---

## 1. Cấu hình chung

### Base URL

```
http://your-api-domain/api/dashboard
```

### Authentication

Tất cả API yêu cầu JWT token trong header:

```
Authorization: Bearer <token>
```

### Response format chuẩn

```json
{
  "success": true,
  "data": { ... },
  "message": "Lấy thống kê tổng quan vé thành công"
}
```

### Trạng thái vé (TicketStatus)

| Giá trị | Ý nghĩa |
|---------|---------|
| `waiting` | Đang chờ |
| `processing` | Đang xử lý |
| `completed` | Hoàn thành |
| `skipped` | Bỏ qua |

---

## 2. Thiết lập Axios

Tạo file `src/api/axiosInstance.js`:

```js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Tự động đính kèm token vào mỗi request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Xử lý response và token hết hạn
api.interceptors.response.use(
  (response) => response.data, // unwrap .data để dùng trực tiếp res.data, res.message
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Thử refresh token nếu có
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post('/api/auth/refresh', { refreshToken });
          const newToken = res.data.token;
          localStorage.setItem('token', newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch {
          // Refresh thất bại → logout
        }
      }

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }

    return Promise.reject(error.response?.data || error);
  }
);

export default api;
```

### Sử dụng

```js
import api from '@/api/axiosInstance';

// Kết quả trả về trực tiếp là { success, data, message }
const res = await api.get('/dashboard/tickets/overview');
console.log(res.data.totalTickets);
```

---

## 3. Thiết lập Socket.IO

### Cài đặt

```bash
npm install socket.io-client
```

### Tạo file `src/api/socket.js`

```js
import { io } from 'socket.io-client';

let socket = null;

export const connectSocket = () => {
  const token = localStorage.getItem('token');

  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000', {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // Join room admin-dashboard để nhận events dashboard
  socket.on('connect', () => {
    console.log('[Socket] Kết nối thành công:', socket.id);
    socket.emit('join-room', 'admin-dashboard');
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Mất kết nối:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Lỗi kết nối:', err.message);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('[Socket] Kết nối lại lần:', attemptNumber);
    socket.emit('join-room', 'admin-dashboard'); // Join lại room sau reconnect
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
```

### Dùng trong React (custom hook)

```js
// src/hooks/useDashboardSocket.js
import { useEffect } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '@/api/socket';

export const useDashboardSocket = (handlers = {}) => {
  useEffect(() => {
    const socket = connectSocket();

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.keys(handlers).forEach((event) => {
        socket.off(event);
      });
      disconnectSocket();
    };
  }, []);
};
```

### Ví dụ dùng hook

```js
useDashboardSocket({
  'dashboard:ticketOverview': (data) => setOverview(data),
  'dashboard:ticketsToday':   (data) => setToday(data),
  'dashboard:counterAlert':   (data) => handleAlert(data),
});
```

---

## 4. API 1 — Tổng quan vé

### Endpoint

```
GET /api/dashboard/tickets/overview
```

### Mô tả

Thống kê toàn bộ vé từ trước đến nay: tổng số lượng, số lượng theo trạng thái, số lượng theo từng dịch vụ.

### Response

```json
{
  "success": true,
  "message": "Lấy thống kê tổng quan vé thành công",
  "data": {
    "totalTickets": 1250,
    "statusCounts": {
      "waiting": 45,
      "processing": 12,
      "completed": 1100,
      "skipped": 93
    },
    "serviceCounts": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "serviceId": "64f1a2b3c4d5e6f7a8b9c0d1",
        "serviceName": "Nộp đơn",
        "count": 450
      },
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
        "serviceId": "64f1a2b3c4d5e6f7a8b9c0d2",
        "serviceName": "Nhận kết quả",
        "count": 380
      }
    ]
  }
}
```

### Socket Event

**Event:** `dashboard:ticketOverview`  
Emit khi API được gọi, payload giống phần `data` ở trên.

### Ví dụ fetch

```js
const fetchTicketsOverview = async () => {
  const res = await api.get('/dashboard/tickets/overview');
  return res.data; // { totalTickets, statusCounts, serviceCounts }
};
```

---

## 5. API 2 — Trạng thái phòng/quầy

### Endpoint

```
GET /api/dashboard/counters/status
```

### Mô tả

Thống kê tổng số phòng/quầy, số đang hoạt động, số ngừng hoạt động, kèm danh sách chi tiết.

### Response

```json
{
  "success": true,
  "message": "Lấy trạng thái phòng/quầy thành công",
  "data": {
    "totalCounters": 10,
    "activeCounters": 8,
    "inactiveCounters": 2,
    "countersList": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "code": "PH01",
        "name": "Phòng số 1",
        "number": 1,
        "isActive": true
      },
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
        "code": "PH02",
        "name": "Phòng số 2",
        "number": 2,
        "isActive": false
      }
    ]
  }
}
```

### Socket Event

**Event:** `dashboard:counterStatus`  
Emit khi API được gọi.

### Ví dụ fetch

```js
const fetchCountersStatus = async () => {
  const res = await api.get('/dashboard/counters/status');
  return res.data; // { totalCounters, activeCounters, inactiveCounters, countersList }
};
```

---

## 6. API 3 — Danh sách nhân viên

### Endpoint

```
GET /api/dashboard/staff
```

### Mô tả

Danh sách toàn bộ nhân viên (role = `staff`), phân loại theo trạng thái trực ca, kèm thông tin phòng đang phụ trách.

### Response

```json
{
  "success": true,
  "message": "Lấy danh sách nhân viên thành công",
  "data": {
    "totalStaff": 15,
    "onDutyStaff": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "fullName": "Nguyễn Văn A",
        "username": "nguyenvana",
        "isActive": true,
        "onDuty": true,
        "counterId": {
          "_id": "64f1a2b3c4d5e6f7a8b9c0d5",
          "name": "Phòng số 1",
          "number": 1
        }
      }
    ],
    "offDutyStaff": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
        "fullName": "Trần Thị B",
        "username": "tranthib",
        "isActive": true,
        "onDuty": false,
        "counterId": null
      }
    ],
    "staffList": [ /* toàn bộ danh sách, gồm cả onDuty và offDuty */ ]
  }
}
```

> **Lưu ý:** `counterId` là object được populate gồm `_id`, `name`, `number`. Giá trị `null` nếu nhân viên chưa được gán phòng.

### Socket Event

**Event:** `dashboard:staffList`  
Emit khi API được gọi.

### Ví dụ fetch

```js
const fetchStaffList = async () => {
  const res = await api.get('/dashboard/staff');
  return res.data; // { totalStaff, onDutyStaff, offDutyStaff, staffList }
};
```

---

## 7. API 4 — Vé hôm nay

### Endpoint

```
GET /api/dashboard/tickets/today
```

### Mô tả

Thống kê vé trong ngày hiện tại (so sánh theo field `date` dạng `YYYY-MM-DD`). Trả về số lượng và phần trăm từng trạng thái.

### Response

```json
{
  "success": true,
  "message": "Lấy thống kê vé hôm nay thành công",
  "data": {
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
}
```

> **Lưu ý:** Phần trăm được làm tròn bằng `Math.round`. Tổng % có thể không bằng đúng 100 do làm tròn.

### Socket Event

**Event:** `dashboard:ticketsToday`  
Emit khi API được gọi.

### Ví dụ fetch

```js
const fetchTicketsToday = async () => {
  const res = await api.get('/dashboard/tickets/today');
  return res.data; // { totalToday, statusCounts, percentages }
};
```

---

## 8. API 5 — 5 vé gần nhất

### Endpoint

```
GET /api/dashboard/tickets/recent
```

### Mô tả

Lấy 5 vé mới nhất (sắp xếp theo `createdAt` giảm dần) cho từng phòng/quầy đang hoạt động và từng dịch vụ đang hoạt động.

### Response

```json
{
  "success": true,
  "message": "Lấy vé gần nhất thành công",
  "data": {
    "recentByCounter": [
      {
        "counterId": "64f1a2b3c4d5e6f7a8b9c0d1",
        "tickets": [
          {
            "_id": "64f1a2b3c4d5e6f7a8b9c0e1",
            "number": 125,
            "ticketNumber": "ND00125",
            "status": "waiting",
            "createdAt": "2024-05-01T10:00:00.000Z",
            "serviceId": {
              "_id": "64f1a2b3c4d5e6f7a8b9c0d3",
              "name": "Nộp đơn",
              "code": "ND"
            },
            "staffId": {
              "_id": "64f1a2b3c4d5e6f7a8b9c0d4",
              "fullName": "Nguyễn Văn A",
              "username": "nguyenvana"
            }
          }
        ]
      }
    ],
    "recentByService": [
      {
        "serviceId": "64f1a2b3c4d5e6f7a8b9c0d3",
        "tickets": [
          {
            "_id": "64f1a2b3c4d5e6f7a8b9c0e2",
            "number": 130,
            "ticketNumber": "ND00130",
            "status": "completed",
            "createdAt": "2024-05-01T10:30:00.000Z",
            "counterId": {
              "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
              "name": "Phòng số 1",
              "number": 1
            },
            "staffId": {
              "_id": "64f1a2b3c4d5e6f7a8b9c0d4",
              "fullName": "Nguyễn Văn A",
              "username": "nguyenvana"
            }
          }
        ]
      }
    ]
  }
}
```

> **Lưu ý:**  
> - `recentByCounter`: chỉ lấy các phòng/quầy có `isActive: true`  
> - `recentByService`: chỉ lấy các dịch vụ có `isActive: true`  
> - `staffId` có thể là `null` nếu vé chưa được gán nhân viên

### Socket Event

**Event:** `dashboard:recentTickets`  
Emit khi API được gọi.

### Ví dụ fetch

```js
const fetchRecentTickets = async () => {
  const res = await api.get('/dashboard/tickets/recent');
  return res.data; // { recentByCounter, recentByService }
};
```

---

## 9. API 6 — Tỷ lệ vé theo phòng/quầy

### Endpoint

```
GET /api/dashboard/tickets/ratio
```

### Mô tả

Thống kê tổng hợp vé từ trước đến nay theo từng phòng/quầy. Bao gồm số lượng và % từng trạng thái.

### Response

```json
{
  "success": true,
  "message": "Lấy tỷ lệ vé theo phòng/quầy thành công",
  "data": [
    {
      "counterId": "64f1a2b3c4d5e6f7a8b9c0d1",
      "counterName": "Phòng số 1",
      "total": 450,
      "completed": 400,
      "skipped": 30,
      "waiting": 20,
      "percentages": {
        "completed": 89,
        "skipped": 7,
        "waiting": 4
      }
    },
    {
      "counterId": "64f1a2b3c4d5e6f7a8b9c0d2",
      "counterName": "Phòng số 2",
      "total": 0,
      "completed": 0,
      "skipped": 0,
      "waiting": 0,
      "percentages": {
        "completed": 0,
        "skipped": 0,
        "waiting": 0
      }
    }
  ]
}
```

> **Lưu ý:**  
> - Trả về **tất cả** phòng/quầy, kể cả phòng chưa có vé nào (`total: 0`)  
> - Field `processing` không có trong ratio vì vé đang xử lý (`processing`) không được đếm theo `counterId` trong aggregation này  
> - % làm tròn bằng `Math.round`

### Socket Event

**Event:** `dashboard:ticketRatio`  
Emit khi API được gọi.

### Ví dụ fetch

```js
const fetchTicketRatio = async () => {
  const res = await api.get('/dashboard/tickets/ratio');
  return res.data; // Array of { counterId, counterName, total, completed, skipped, waiting, percentages }
};
```

---

## 10. API 7 — Xu hướng vé theo thời gian

### Endpoint

```
GET /api/dashboard/tickets/trend?groupBy=day|month|year
```

### Mô tả

Thống kê số lượng vé theo nhóm thời gian. Dữ liệu trả về từ cũ → mới.

### Query Parameters

| Param | Bắt buộc | Mặc định | Giá trị hợp lệ | Ý nghĩa |
|-------|----------|----------|----------------|---------|
| `groupBy` | Không | `day` | `day`, `month`, `year` | Nhóm theo ngày / tháng / năm |

### Phạm vi dữ liệu

| groupBy | Số lượng điểm dữ liệu |
|---------|----------------------|
| `day` | 30 ngày gần nhất |
| `month` | 12 tháng gần nhất |
| `year` | 5 năm gần nhất |

### Response

```json
{
  "success": true,
  "message": "Lấy xu hướng vé theo thời gian thành công",
  "data": [
    {
      "label": "2024-04-01",
      "completed": 80,
      "skipped": 5,
      "waiting": 3,
      "total": 88
    },
    {
      "label": "2024-04-02",
      "completed": 95,
      "skipped": 8,
      "waiting": 7,
      "total": 110
    }
  ]
}
```

**Format của `label` theo từng groupBy:**

| groupBy | Format label | Ví dụ |
|---------|-------------|-------|
| `day` | `YYYY-MM-DD` | `2024-05-01` |
| `month` | `YYYY-MM` | `2024-05` |
| `year` | `YYYY` | `2024` |

> **Lưu ý:** `waiting` trong trend là số vé có status `waiting` tại thời điểm tạo vé (không phải waiting hiện tại).

### Socket Event

**Event:** `dashboard:ticketTrend`  
Emit khi API được gọi.

### Ví dụ fetch

```js
// Mặc định: 30 ngày gần nhất
const fetchTrendDay = async () => {
  const res = await api.get('/dashboard/tickets/trend');
  return res.data;
};

// 12 tháng gần nhất
const fetchTrendMonth = async () => {
  const res = await api.get('/dashboard/tickets/trend?groupBy=month');
  return res.data;
};

// 5 năm gần nhất
const fetchTrendYear = async () => {
  const res = await api.get('/dashboard/tickets/trend?groupBy=year');
  return res.data;
};
```

### Vẽ chart với Recharts

```jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TicketTrendChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={data}>
      <XAxis dataKey="label" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Line type="monotone" dataKey="completed" stroke="#22c55e" name="Hoàn thành" />
      <Line type="monotone" dataKey="skipped"   stroke="#f59e0b" name="Bỏ qua" />
      <Line type="monotone" dataKey="waiting"   stroke="#3b82f6" name="Chờ" />
    </LineChart>
  </ResponsiveContainer>
);
```

---

## 11. API 8 — Cảnh báo quầy quá tải

### Endpoint

```
GET /api/dashboard/counters/alert
```

### Mô tả

Trả về danh sách **chỉ các phòng/quầy đang bị cảnh báo** (số vé waiting ≥ 50). Phòng/quầy bình thường không xuất hiện trong response.

> Ngưỡng cảnh báo cố định: **50 vé waiting**. Số vé `waiting` được tính dựa trên `serviceId` thuộc phòng/quầy đó (qua bảng `ServiceCounter`).

### Response

```json
{
  "success": true,
  "message": "Lấy cảnh báo quầy quá tải thành công",
  "data": [
    {
      "counterId": "64f1a2b3c4d5e6f7a8b9c0d1",
      "counterName": "Phòng số 1",
      "waitingCount": 55,
      "isAlert": true
    }
  ]
}
```

> Nếu không có phòng/quầy nào quá tải, `data` trả về mảng rỗng `[]`.

### Socket Event

**Event:** `dashboard:counterAlert`

Event này được emit theo **2 cách**:
1. Khi API `GET /counters/alert` được gọi
2. **Tự động emit** mỗi khi có vé mới được tạo (backend trigger từ ticket controller)

### Hiển thị notification khi có cảnh báo

```js
// Dùng với react-hot-toast hoặc antd notification
import toast from 'react-hot-toast';

const handleCounterAlert = (alerts) => {
  if (!alerts || alerts.length === 0) return;

  alerts.forEach((alert) => {
    toast.error(
      `Cảnh báo: ${alert.counterName} đang có ${alert.waitingCount} vé chờ!`,
      {
        duration: 6000,
        icon: '⚠️',
        id: `alert-${alert.counterId}`, // tránh toast trùng lặp
      }
    );
  });
};

// Trong socket listener
socket.on('dashboard:counterAlert', handleCounterAlert);
```

### Ví dụ fetch

```js
const fetchCounterAlerts = async () => {
  const res = await api.get('/dashboard/counters/alert');
  return res.data; // Array of { counterId, counterName, waitingCount, isAlert }
};
```

---

## 12. Tổng hợp socket events

Tất cả events đều được emit vào **room `admin-dashboard`**. FE phải join room này sau khi kết nối.

```js
socket.emit('join-room', 'admin-dashboard');
```

| Socket Event | API liên quan | Trigger |
|-------------|--------------|---------|
| `dashboard:ticketOverview` | GET /tickets/overview | Khi API được gọi |
| `dashboard:counterStatus` | GET /counters/status | Khi API được gọi |
| `dashboard:staffList` | GET /staff | Khi API được gọi |
| `dashboard:ticketsToday` | GET /tickets/today | Khi API được gọi |
| `dashboard:recentTickets` | GET /tickets/recent | Khi API được gọi |
| `dashboard:ticketRatio` | GET /tickets/ratio | Khi API được gọi |
| `dashboard:ticketTrend` | GET /tickets/trend | Khi API được gọi |
| `dashboard:counterAlert` | GET /counters/alert | Khi API được gọi **+ tự động khi có vé mới** |

---

## 13. Load toàn bộ dashboard

### React — `useDashboard` hook

```js
// src/hooks/useDashboard.js
import { useState, useEffect } from 'react';
import api from '@/api/axiosInstance';
import { connectSocket, disconnectSocket } from '@/api/socket';

const initialState = {
  overview: null,
  countersStatus: null,
  staff: null,
  today: null,
  recent: null,
  ratio: null,
  trend: null,
  alerts: [],
  loading: true,
  error: null,
};

export const useDashboard = () => {
  const [state, setState] = useState(initialState);

  const update = (key, value) =>
    setState((prev) => ({ ...prev, [key]: value }));

  // Fetch initial data
  const loadAll = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const [overview, countersStatus, staff, today, recent, ratio, trend, alerts] =
        await Promise.all([
          api.get('/dashboard/tickets/overview'),
          api.get('/dashboard/counters/status'),
          api.get('/dashboard/staff'),
          api.get('/dashboard/tickets/today'),
          api.get('/dashboard/tickets/recent'),
          api.get('/dashboard/tickets/ratio'),
          api.get('/dashboard/tickets/trend'),
          api.get('/dashboard/counters/alert'),
        ]);

      setState({
        overview: overview.data,
        countersStatus: countersStatus.data,
        staff: staff.data,
        today: today.data,
        recent: recent.data,
        ratio: ratio.data,
        trend: trend.data,
        alerts: alerts.data,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Không thể tải dữ liệu dashboard',
      }));
    }
  };

  // Socket realtime
  useEffect(() => {
    loadAll();

    const socket = connectSocket();

    socket.on('dashboard:ticketOverview', (data) => update('overview', data));
    socket.on('dashboard:counterStatus',  (data) => update('countersStatus', data));
    socket.on('dashboard:staffList',      (data) => update('staff', data));
    socket.on('dashboard:ticketsToday',   (data) => update('today', data));
    socket.on('dashboard:recentTickets',  (data) => update('recent', data));
    socket.on('dashboard:ticketRatio',    (data) => update('ratio', data));
    socket.on('dashboard:ticketTrend',    (data) => update('trend', data));
    socket.on('dashboard:counterAlert',   (data) => {
      update('alerts', data);
      if (data.length > 0) {
        data.forEach((alert) => {
          console.warn(`[Alert] ${alert.counterName}: ${alert.waitingCount} vé chờ`);
          // Gọi toast notification ở đây nếu cần
        });
      }
    });

    return () => disconnectSocket();
  }, []);

  return { ...state, reload: loadAll };
};
```

### Sử dụng trong component

```jsx
import { useDashboard } from '@/hooks/useDashboard';

const DashboardPage = () => {
  const { overview, today, countersStatus, staff, trend, alerts, loading, error, reload } = useDashboard();

  if (loading) return <div>Đang tải...</div>;
  if (error)   return <div>Lỗi: {error} <button onClick={reload}>Thử lại</button></div>;

  return (
    <div>
      <h1>Dashboard</h1>

      {alerts.length > 0 && (
        <div className="alert-banner">
          {alerts.map((a) => (
            <p key={a.counterId}>⚠️ {a.counterName}: {a.waitingCount} vé chờ</p>
          ))}
        </div>
      )}

      <p>Tổng vé: {overview?.totalTickets}</p>
      <p>Vé hôm nay: {today?.totalToday}</p>
      <p>Phòng hoạt động: {countersStatus?.activeCounters}/{countersStatus?.totalCounters}</p>
      <p>Nhân viên đang trực: {staff?.onDutyStaff?.length}</p>
    </div>
  );
};
```

---

## 14. Xử lý lỗi & reconnect

### Xử lý lỗi API

```js
const safeFetch = async (endpoint) => {
  try {
    const res = await api.get(endpoint);
    return { data: res.data, error: null };
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    return { data: null, error: err.message || 'Lỗi không xác định' };
  }
};
```

### Xử lý Socket mất kết nối

Socket.IO client đã được cấu hình `reconnection: true` và sẽ tự reconnect. Tuy nhiên sau khi reconnect cần join lại room:

```js
socket.on('reconnect', () => {
  socket.emit('join-room', 'admin-dashboard');
  // Refetch data vì có thể đã miss updates
  loadAll();
});
```

### Hiển thị trạng thái kết nối

```jsx
const [socketStatus, setSocketStatus] = useState('connecting');

socket.on('connect',    () => setSocketStatus('connected'));
socket.on('disconnect', () => setSocketStatus('disconnected'));
socket.on('reconnect',  () => setSocketStatus('connected'));

// Render
const statusColor = {
  connected:    'green',
  disconnected: 'red',
  connecting:   'orange',
}[socketStatus];

<span style={{ color: statusColor }}>● Realtime: {socketStatus}</span>
```

### Checklist debug

| Triệu chứng | Nguyên nhân thường gặp | Cách kiểm tra |
|-------------|----------------------|---------------|
| API trả 401 | Token hết hạn hoặc sai | Kiểm tra `localStorage.getItem('token')` |
| Không nhận socket events | Chưa join room `admin-dashboard` | Log `socket.on('connect', ...)` và emit `join-room` |
| `counterAlert` không tự emit | Backend chưa gọi `emitDashboardUpdateSafe` khi tạo vé | Kiểm tra ticket controller |
| `staffId` là `null` trong vé | Vé chưa được nhân viên nhận | Bình thường, FE cần check `null` trước khi render |
| `data` trả về mảng rỗng (API 8) | Không có phòng nào quá tải | Bình thường khi hệ thống không tải |