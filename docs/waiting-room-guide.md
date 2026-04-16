# Waiting Room Guide

Tai lieu nay huong dan frontend tich hop du lieu cho man hinh cho cong cong sau cap nhat moi nhat cua backend.

## 1. Muc tieu

Backend waiting room hien tai tra du lieu cho 2 nhu cau cung luc:

- danh sach ticket dang cho
- so cuoi cung da cap cua tung quay

Frontend TV co the:

- goi API de lay snapshot ban dau
- hoac join socket room de nhan snapshot ngay lap tuc
- tiep tuc nghe realtime khi co ticket moi hoac khi reset

## 2. API can dung

Endpoint:

```http
GET /api/tickets/waiting
```

Response:

```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "ticket_id",
      "number": 7,
      "ticketNumber": "007",
      "formattedNumber": "1007",
      "displayNumber": "1007",
      "customerName": "Nguyen Van A",
      "phone": "0912345678",
      "status": "waiting",
      "serviceName": "NOP DON",
      "createdAt": "2026-04-16T08:00:00.000Z"
    }
  ],
  "lastIssuedByCounter": [
    {
      "counterId": "counter_1_id",
      "counterCode": "Q1",
      "counterName": "QUAY 1",
      "counterNumber": 1,
      "lastNumber": 7,
      "lastDisplayNumber": "1007"
    },
    {
      "counterId": "counter_2_id",
      "counterCode": "Q2",
      "counterName": "QUAY 2",
      "counterNumber": 2,
      "lastNumber": 0,
      "lastDisplayNumber": null
    }
  ]
}
```

Y nghia:

- `data`: danh sach ticket dang o trang thai `waiting` va khong phai recall
- `lastIssuedByCounter`: snapshot so cuoi cung da cap theo tung quay active
- `lastNumber`: so thu tu thuan cua quay
- `lastDisplayNumber`: so hien thi dung cho UI, co dang `<so_quay><pad_3>`

Vi du:

- quay 1, `lastNumber = 7` thi `lastDisplayNumber = 1007`
- quay chua cap so nao thi `lastNumber = 0` va `lastDisplayNumber = null`

## 3. Socket event cho waiting room

Frontend TV join room:

```js
socket.emit('join-waiting-room');
```

Sau khi join, backend se tu dong gui ngay 1 snapshot.

### `waiting-room-snapshot`

Day la event FE nen dung de render lan dau.

Payload:

```json
{
  "updatedAt": "2026-04-16T08:00:00.000Z",
  "totalWaiting": 3,
  "tickets": [],
  "lastIssuedByCounter": [
    {
      "counterId": "counter_1_id",
      "counterCode": "Q1",
      "counterName": "QUAY 1",
      "counterNumber": 1,
      "lastNumber": 7,
      "lastDisplayNumber": "1007"
    }
  ]
}
```

Y nghia:

- `tickets`: danh sach waiting hien tai
- `totalWaiting`: tong so ticket dang cho
- `lastIssuedByCounter`: so cuoi cung da cap theo quay tai thoi diem join room

### `new-ticket`

Event nay duoc gui moi khi co ticket moi duoc tao.

Payload:

```json
{
  "ticket": {
    "id": "ticket_id",
    "number": 8,
    "formattedNumber": "1008",
    "displayNumber": "1008",
    "customerName": "Nguyen Van B",
    "phone": "0912345678",
    "serviceName": "NOP DON",
    "status": "waiting",
    "qrCode": "data:image/png;base64,..."
  },
  "totalWaiting": 4,
  "lastIssuedByCounter": [
    {
      "counterId": "counter_1_id",
      "counterCode": "Q1",
      "counterName": "QUAY 1",
      "counterNumber": 1,
      "lastNumber": 8,
      "lastDisplayNumber": "1008"
    }
  ]
}
```

FE nen:

- them `payload.ticket` vao danh sach waiting
- cap nhat `totalWaiting`
- ghi de `lastIssuedByCounter` bang mang moi tu backend

### `tickets-reset-day`

Event nay duoc gui khi reset ticket theo ngay.

Payload:

```json
{
  "date": "2026-04-16",
  "deletedCount": 12,
  "lastIssuedByCounter": [
    {
      "counterId": "counter_1_id",
      "counterCode": "Q1",
      "counterName": "QUAY 1",
      "counterNumber": 1,
      "lastNumber": 0,
      "lastDisplayNumber": null
    }
  ]
}
```

FE nen:

- xoa hoac refresh lai danh sach waiting
- cap nhat lai bang so cuoi cung theo payload moi

### `tickets-reset-all`

Event nay duoc gui khi reset toan bo ticket.

Payload:

```json
{
  "deletedCount": 20,
  "lastIssuedByCounter": [
    {
      "counterId": "counter_1_id",
      "counterCode": "Q1",
      "counterName": "QUAY 1",
      "counterNumber": 1,
      "lastNumber": 0,
      "lastDisplayNumber": null
    }
  ]
}
```

FE nen xu ly giong `tickets-reset-day`.

### `socket-error`

Neu backend khong tai duoc du lieu waiting room, socket se tra:

```json
{
  "message": "Khong the tai du lieu man hinh cho"
}
```

## 4. Luong tich hop khuyen nghi cho FE

### Cach don gian nhat

1. Ket noi socket.
2. Emit `join-waiting-room`.
3. Dung `waiting-room-snapshot` de render lan dau.
4. Nghe `new-ticket` de cong realtime.
5. Nghe `tickets-reset-day` va `tickets-reset-all` de reset UI dung du lieu moi.

### Neu van muon goi API ban dau

Co the goi:

```js
const response = await fetch('/api/tickets/waiting');
const payload = await response.json();
```

Sau do van nen join socket de nhan realtime.

Trong truong hop da dung `waiting-room-snapshot` ngay sau khi join room, FE khong bat buoc phai goi API truoc.

## 5. Mau code FE

```js
socket.emit('join-waiting-room');

socket.on('waiting-room-snapshot', (payload) => {
  setWaitingTickets(payload.tickets);
  setLastIssuedByCounter(payload.lastIssuedByCounter);
  setTotalWaiting(payload.totalWaiting);
});

socket.on('new-ticket', (payload) => {
  setWaitingTickets((prev) => [...prev, payload.ticket]);
  setLastIssuedByCounter(payload.lastIssuedByCounter);
  setTotalWaiting(payload.totalWaiting);
});

socket.on('tickets-reset-day', (payload) => {
  setWaitingTickets([]);
  setLastIssuedByCounter(payload.lastIssuedByCounter);
  setTotalWaiting(0);
});

socket.on('tickets-reset-all', (payload) => {
  setWaitingTickets([]);
  setLastIssuedByCounter(payload.lastIssuedByCounter);
  setTotalWaiting(0);
});

socket.on('socket-error', (payload) => {
  console.error(payload.message);
});
```

## 6. Ghi chu cho UI

- Nen render `lastIssuedByCounter` theo thu tu `counterNumber` tang dan
- Neu `lastDisplayNumber = null`, UI nen hien thi trang thai nhu `---` hoac `Chua cap so`
- Danh sach `lastIssuedByCounter` chi gom cac quay dang `isActive = true`
- Khi co reset, FE nen xem payload reset la nguon su that moi nhat thay vi tu giu so cu

