# Staff Socket Guide

Tai lieu nay huong dan frontend ket noi socket de cap nhat realtime cho man hinh staff.

## 1. Muc dich

Khi co thay doi lien quan den quay cua staff, backend se day du lieu moi nhat cho frontend ma khong can refresh trang.

Cac truong hop se duoc cap nhat realtime:

- Tao ticket moi
- Goi so tiep theo
- Hoan thanh ticket
- Skip ticket
- Reset ticket theo ngay
- Reset toan bo ticket

## 2. Dieu kien de su dung

Frontend staff can co:

- `staff_token`
- `counterId` cua quay duoc gan cho staff

## 3. API lay du lieu ban dau

Truoc khi nghe socket, frontend nen goi API:

```http
GET /api/tickets/staff/display
Authorization: Bearer <staff_token>
```

Response API nay duoc dung de render giao dien lan dau.

## 4. Ket noi socket

### Ket noi toi server

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket']
});
```

### Join room cua quay

Sau khi co `counterId`, frontend can join room:

```js
socket.emit('join-counter', counterId);
```

Vi du:

```js
socket.emit('join-counter', '67fa8c9f4d2a9e0012345672');
```

Backend se dua socket vao room:

```text
counter-67fa8c9f4d2a9e0012345672
```

## 5. Event can nghe

Frontend staff can nghe event:

```text
staff-display-updated
```

Vi du:

```js
socket.on('staff-display-updated', (payload) => {
  console.log(payload);
  setStaffDisplay(payload.data);
});
```

## 6. Cau truc payload

Payload tong quat:

```json
{
  "reason": "ticket-created",
  "counterId": "67fa8c9f4d2a9e0012345672",
  "updatedAt": "2026-04-13T08:30:00.000Z",
  "data": {
    "counter": {
      "id": "67fa8c9f4d2a9e0012345672",
      "name": "QUAY 1",
      "number": 1,
      "isActive": true,
      "processedCount": 12
    },
    "services": [
      {
        "id": "67fa8c1a4d2a9e0012345671",
        "name": "NOP DON",
        "code": "ND"
      }
    ],
    "currentTicket": {
      "id": "67fa8d2c4d2a9e0012345673",
      "number": 23,
      "formattedNumber": "023",
      "customerName": "Nguyen Van A",
      "phone": "0912345678",
      "status": "processing",
      "serviceName": "NOP DON",
      "createdAt": "2026-04-13T08:29:00.000Z"
    },
    "waitingTickets": [
      {
        "id": "67fa8d2c4d2a9e0012345674",
        "number": 24,
        "formattedNumber": "024",
        "customerName": "Tran Van B",
        "phone": "0987654321",
        "status": "waiting",
        "serviceName": "NOP DON",
        "createdAt": "2026-04-13T08:31:00.000Z"
      }
    ],
    "totalWaiting": 1
  },
  "ticketId": "67fa8d2c4d2a9e0012345674",
  "serviceId": "67fa8c1a4d2a9e0012345671"
}
```

## 7. Y nghia tung field

### Root level

- `reason`: ly do backend phat event
- `counterId`: quay dang duoc cap nhat
- `updatedAt`: thoi gian backend tao snapshot moi
- `data`: snapshot moi nhat cua staff display
- `ticketId`: co trong mot so event lien quan den ticket
- `serviceId`: co trong event tao ticket moi

### `data.counter`

Thong tin quay hien tai:

- `id`
- `name`
- `number`
- `isActive`
- `processedCount`

### `data.services`

Danh sach dich vu ma quay nay dang phuc vu.

### `data.currentTicket`

Ticket dang duoc xu ly tai quay.

Neu chua co ticket dang xu ly thi gia tri se la:

```json
null
```

### `data.waitingTickets`

Danh sach ticket dang cho lien quan den cac dich vu ma quay co the xu ly.

### `data.totalWaiting`

Tong so ticket dang cho trong `waitingTickets`.

## 8. Cac gia tri `reason`

Frontend co the gap cac gia tri sau:

- `ticket-created`
- `ticket-called`
- `ticket-completed`
- `ticket-skipped`
- `tickets-reset-day`
- `tickets-reset-all`

Frontend co the dung `reason` de hien toast hoac ghi log, nhung nen update giao dien bang `payload.data`.

## 9. Flow frontend de xuat

### Buoc 1

Dang nhap staff va lay `token`.

### Buoc 2

Lay `counterId` cua staff.

Co the lay tu:

- response login
- API thong tin user
- API `GET /api/tickets/my-counter`

### Buoc 3

Goi API ban dau:

```http
GET /api/tickets/staff/display
Authorization: Bearer <staff_token>
```

### Buoc 4

Render giao dien bang response tu API.

### Buoc 5

Mo socket va join room:

```js
socket.emit('join-counter', counterId);
```

### Buoc 6

Lang nghe event:

```js
socket.on('staff-display-updated', (payload) => {
  setStaffDisplay(payload.data);
});
```

## 10. Mau React de dung ngay

```js
import { useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket']
});

function useStaffDisplay({ token, counterId, setStaffDisplay }) {
  useEffect(() => {
    if (!token || !counterId) return;

    fetch('http://localhost:3000/api/tickets/staff/display', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setStaffDisplay(json.data);
        }
      });

    socket.emit('join-counter', counterId);

    const handleUpdate = (payload) => {
      setStaffDisplay(payload.data);
    };

    socket.on('staff-display-updated', handleUpdate);

    return () => {
      socket.off('staff-display-updated', handleUpdate);
    };
  }, [token, counterId, setStaffDisplay]);
}
```

## 11. Nguyen tac quan trong

Frontend khong nen tu cong tru local state.

Nen lam dung nhu sau:

- Lan dau lay state tu API
- Moi lan co event realtime, ghi de state bang `payload.data`

Ly do:

- Backend da gui snapshot moi nhat
- Frontend khong bi lech state
- De debug hon

## 12. Loi thuong gap

### Khong nhan duoc event

Kiem tra:

- Da `join-counter(counterId)` chua
- `counterId` co dung khong
- Socket co dang ket noi toi dung server khong
- Backend da restart sau khi update code chua

### Nhan event nhung UI khong doi

Kiem tra:

- Co dang dung `payload.data` de update state khong
- Co bi ghi de boi request khac khong

### Join sai quay

Neu FE join sai `counterId`, socket van ket noi duoc nhung se khong nhan dung du lieu cua staff hien tai.

## 13. Event khac staff co the gap

Ngoai `staff-display-updated`, room `counter-<counterId>` hien tai van co the nhan:

- `new-current-ticket`
- `ticket-finished`
- `ticket-skipped`
- `counter-reset`

Tuy nhien, de don gian frontend staff nen uu tien dung:

```text
staff-display-updated
```

vi event nay da chua snapshot day du va san sang de render.
