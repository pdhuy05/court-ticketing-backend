# Staff Socket Guide

Tai lieu nay huong dan frontend ket noi socket de hien thi man hinh staff theo thoi gian thuc.

## 1. Muc dich

Khi frontend staff ket noi dung room cua quay, backend se:

- tra ngay snapshot staff display moi nhat
- tiep tuc day realtime moi khi co thay doi

Frontend khong can refresh tay de cap nhat danh sach cho.

## 2. Backend da ho tro nhung gi

Backend hien tai da co:

- room socket theo quay
- event xac nhan join room thanh cong
- event loi socket neu join sai du lieu
- event snapshot tong cho man hinh staff

## 3. Event socket staff can biet

### Event frontend gui len

#### Cach khuyen nghi

```text
join-staff-display
```

Payload:

```json
{
  "counterId": "67fa8c9f4d2a9e0012345672"
}
```

#### Cach cu van dung duoc

```text
join-counter
```

Payload:

```json
"67fa8c9f4d2a9e0012345672"
```

hoac:

```json
{
  "counterId": "67fa8c9f4d2a9e0012345672"
}
```

## 4. Event backend gui xuong

### `joined-counter-room`

Backend gui event nay ngay sau khi join room thanh cong.

Payload:

```json
{
  "counterId": "67fa8c9f4d2a9e0012345672",
  "room": "counter-67fa8c9f4d2a9e0012345672"
}
```

### `staff-display-updated`

Day la event chinh de frontend render giao dien.

Backend se gui:

- ngay sau khi join room thanh cong
- khi ticket moi duoc tao
- khi goi so
- khi hoan thanh ticket
- khi skip ticket
- khi reset theo ngay
- khi reset toan bo

### `socket-error`

Event nay duoc gui neu thieu `counterId` hoac khong tai duoc du lieu staff display.

Payload mau:

```json
{
  "message": "Thiếu counterId để join room staff"
}
```

## 5. Luong ket noi chuan cho FE

### Buoc 1

Login staff va lay:

- `token`
- `counterId`

### Buoc 2

Ket noi socket:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket']
});
```

### Buoc 3

Join room staff:

```js
socket.emit('join-staff-display', {
  counterId: '67fa8c9f4d2a9e0012345672'
});
```

### Buoc 4

Nghe event:

```js
socket.on('joined-counter-room', (payload) => {
  console.log('Joined:', payload);
});

socket.on('staff-display-updated', (payload) => {
  console.log('Reason:', payload.reason);
  setStaffDisplay(payload.data);
});

socket.on('socket-error', (payload) => {
  console.error(payload);
});
```

## 6. Co can goi API ban dau khong

Khong bat buoc.

Vi hien tai backend se gui ngay 1 snapshot `staff-display-updated` sau khi frontend join room thanh cong.

Tuy nhien, neu frontend muon an toan hon, van co the goi:

```http
GET /api/tickets/staff/display
Authorization: Bearer <staff_token>
```

Nhung voi flow moi, chi can socket cung da du dung.

## 7. Payload cua `staff-display-updated`

Payload tong quat:

```json
{
  "reason": "joined-counter-room",
  "counterId": "67fa8c9f4d2a9e0012345672",
  "updatedAt": "2026-04-14T08:30:00.000Z",
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
      "createdAt": "2026-04-14T08:29:00.000Z"
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
        "createdAt": "2026-04-14T08:31:00.000Z"
      }
    ],
    "totalWaiting": 1
  },
  "ticketId": "67fa8d2c4d2a9e0012345674",
  "serviceId": "67fa8c1a4d2a9e0012345671"
}
```

## 8. Y nghia tung field

### Root level

- `reason`: ly do backend phat event
- `counterId`: quay dang nhan du lieu
- `updatedAt`: thoi diem tao snapshot moi
- `data`: du lieu moi nhat de render
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

Danh sach dich vu ma quay dang phuc vu.

### `data.currentTicket`

Ticket dang duoc xu ly tai quay.

Neu chua co ticket dang xu ly thi:

```json
null
```

### `data.waitingTickets`

Danh sach ticket dang cho ma quay co the xu ly.

### `data.totalWaiting`

Tong so ticket dang cho cua quay.

## 9. Cac gia tri `reason`

Frontend co the nhan duoc cac gia tri:

- `joined-counter-room`
- `ticket-created`
- `ticket-called`
- `ticket-completed`
- `ticket-skipped`
- `tickets-reset-day`
- `tickets-reset-all`

## 10. Quy tac render cho FE

Frontend nen lam dung quy tac sau:

- moi lan nhan `staff-display-updated`
- dung thang `payload.data`
- ghi de state hien tai

Khong nen:

- tu cong tru local state
- tu chen ticket vao danh sach
- tu bo ticket ra khoi danh sach

Ly do:

- backend da gui snapshot moi nhat
- frontend se khong bi lech state

## 11. Mau code FE dung ngay

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket']
});

function connectStaffDisplay(counterId, setStaffDisplay) {
  socket.on('connect', () => {
    socket.emit('join-staff-display', { counterId });
  });

  socket.on('joined-counter-room', (payload) => {
    console.log('Joined room:', payload);
  });

  socket.on('staff-display-updated', (payload) => {
    console.log('Realtime reason:', payload.reason);
    setStaffDisplay(payload.data);
  });

  socket.on('socket-error', (payload) => {
    console.error('Socket error:', payload);
  });
}
```

## 12. Neu frontend van muon goi API ban dau

Frontend van co the goi:

```http
GET /api/tickets/staff/display
Authorization: Bearer <staff_token>
```

Sau do moi ket noi socket.

Nhung cach khuyen nghi hien tai van la:

- connect socket
- join room
- nhan snapshot tu `staff-display-updated`

## 13. Cac tinh huong backend se phat event

### Khi tao ticket moi

Neu ticket thuoc dich vu ma quay staff co the xu ly, room cua quay do se nhan:

```text
staff-display-updated
```

voi `reason = "ticket-created"`

### Khi goi so

Quay dang goi se nhan:

- `new-current-ticket`
- `staff-display-updated`

### Khi hoan thanh ticket

Quay dang xu ly se nhan:

- `ticket-finished`
- `staff-display-updated`

### Khi skip ticket

Quay hien tai va cac quay lien quan den dich vu do se nhan:

```text
staff-display-updated
```

### Khi reset ticket

Cac quay bi anh huong se nhan:

```text
staff-display-updated
```

## 14. Checklist debug nhanh

Neu FE bao khong nhan duoc realtime, check theo thu tu nay:

1. Backend da restart chua
2. Socket co connect thanh cong chua
3. Co emit `join-staff-display` chua
4. Co nhan `joined-counter-room` khong
5. `counterId` co dung voi quay staff khong
6. Co nhan `socket-error` khong
7. Sau khi tao ticket moi, co nhan `staff-display-updated` khong

## 15. Ket luan

Frontend staff hien tai co the chi can:

1. connect socket
2. `emit('join-staff-display', { counterId })`
3. nghe `staff-display-updated`
4. render bang `payload.data`

Day la cach don gian nhat va dung voi backend hien tai.
