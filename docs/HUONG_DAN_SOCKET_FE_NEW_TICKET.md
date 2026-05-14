# Hướng dẫn Frontend — Socket.IO event `new_ticket`

Tài liệu này mô tả cách **frontend (staff / dashboard)** kết nối Socket.IO tới backend và xử lý thông báo khi có vé mới.

## URL kết nối

- Dùng **cùng origin** với API backend (cùng host + port).
- Ví dụ dev: `http://localhost:5000` (hoặc đúng `APP_PORT` trong `.env` của backend).
- Client Socket.IO kết nối tới root đó: `io("http://localhost:5000")` — không cần path `/api`.

## Cài đặt package

```bash
npm install socket.io-client
```

## Kết nối cơ bản

```javascript
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"],
});

socket.on("connect", () => {
  console.log("Đã kết nối Socket.IO:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.warn("Mất kết nối:", reason);
});

socket.on("connect_error", (err) => {
  console.error("Lỗi kết nối Socket:", err.message);
});
```

**Lưu ý CORS:** Backend đã cấu hình `origin: "*"`. Production nên thu hẹp domain trong `server.js` nếu cần.

## Event cần lắng nghe: `new_ticket`

Mỗi khi đương sự **lấy số thành công** (ticket đã lưu DB), server **broadcast** event này tới **tất cả** client đang kết nối.

```javascript
socket.on("new_ticket", (payload) => {
  const { ticket, service } = payload;

  // ticket: _id, ticketNumber, displayNumber, name, phone, createdAt
  // service: _id, name, code

  showBrowserNotification(ticket, service);
  playBeep();
  updateTabBadge();
});
```

### Cấu trúc payload (TypeScript)

```typescript
interface NewTicketPayload {
  ticket: {
    _id: string;
    ticketNumber: string;
    displayNumber: string | null;
    name: string;
    phone: string;
    createdAt: string; // ISO date từ server
  };
  service: {
    _id: string;
    name: string;
    code: string;
  };
}
```

`createdAt` qua JSON thường là **chuỗi ISO**; có thể `new Date(ticket.createdAt)` khi hiển thị.

## Gợi ý tích hợp UI

### 1. Thông báo trình duyệt (Notification API)

Chỉ hoạt động sau khi user đã **granted** permission (thường gọi sau một gesture: click nút “Bật thông báo”).

```javascript
async function ensureNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const p = await Notification.requestPermission();
    return p === "granted";
  }
  return false;
}

function showBrowserNotification(ticket, service) {
  if (Notification.permission !== "granted") return;

  new Notification(`Vé mới — ${service.name}`, {
    body: `Số ${ticket.displayNumber ?? ticket.ticketNumber} — ${ticket.name}`,
    tag: String(ticket._id),
    requireInteraction: false,
  });
}
```

### 2. Âm thanh báo

Chuẩn bị file âm thanh ngắn trong `public/` (ví dụ `beep.mp3`), phát khi nhận `new_ticket`:

```javascript
const audio = new Audio("/beep.mp3");

function playBeep() {
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
```

### 3. Badge / title tab

```javascript
let unseen = 0;

socket.on("new_ticket", () => {
  unseen += 1;
  document.title = `(${unseen}) Hệ thống xếp hàng`;
});

window.addEventListener("focus", () => {
  unseen = 0;
  document.title = "Hệ thống xếp hàng";
});
```

### 4. React (ví dụ hook)

```tsx
import { useEffect } from "react";
import { io, Socket } from "socket.io-client";

export function useNewTicketSocket(onNew: (payload: NewTicketPayload) => void) {
  useEffect(() => {
    const url = import.meta.env.VITE_API_URL!;
    const socket: Socket = io(url, { transports: ["websocket", "polling"] });

    socket.on("new_ticket", onNew);

    return () => {
      socket.off("new_ticket", onNew);
      socket.disconnect();
    };
  }, [onNew]);
}
```

## Các event Socket khác (đã có sẵn backend)

Staff có thể đã dùng các room/event sau — **không** nhầm với `new_ticket`:

| Mục đích | Gửi từ client | Event / room phía server |
|----------|----------------|---------------------------|
| Màn hình chờ | `socket.emit("join-waiting-room")` | Snapshot `waiting-room-snapshot`, `new-ticket` (room waiting), … |
| Theo phòng quầy | `socket.emit("join-counter", counterId)` | `staff-display-updated`, … |

Event **`new_ticket`** là **broadcast global** — không cần join room để nhận; chỉ cần socket đã `connect`.

## Kiểm tra nhanh

1. Chạy backend, mở DevTools console trên trang staff:

```javascript
const { io } = await import("https://cdn.socket.io/4.8.3/socket.io.esm.min.js");
const s = io("http://localhost:5000");
s.on("connect", () => console.log("OK", s.id));
s.on("new_ticket", console.log);
```

2. Tạo vé mới từ kiosk/API → console phải in payload.

3. Kiểm tra polling endpoint (Engine.IO):

```bash
curl -i "http://localhost:5000/socket.io/?EIO=4&transport=polling"
```

Kỳ vọng: HTTP 200, body dạng số + JSON Engine.IO.

---

**Tóm tắt:** Cài `socket.io-client`, `io(BACKEND_URL)`, `socket.on("new_ticket", handler)` — trong handler gọi notification, âm thanh, và cập nhật UI/badge theo nhu cầu.
