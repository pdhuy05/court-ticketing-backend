# FE Guide: Reset Ticket va Auto Reset

Tai lieu nay mo ta cach FE tich hop voi tinh nang reset ticket moi.

## 1. Tong quan thay doi

Truoc day:
- reset theo ngay hoac reset all se xoa ticket khoi database
- co backup file

Hien tai:
- reset **khong xoa ticket**
- reset **khong tao backup**
- reset chi:
  - chot thong ke ngay bang `calculateDailyStatistics(...)`
  - clear `currentTicketId` cua quay
  - reset `CounterSequence.lastNumber` ve `0`
  - phat realtime de waiting room, counter display, staff display cap nhat

He qua quan trong cho FE:
- ticket cu van con trong DB
- so thu tu moi sau reset se quay lai tu `001` theo quy tac hien tai cua quay
- man hinh dang cho va man hinh quay can phan ung theo event realtime, khong duoc gia dinh la ticket bi xoa

## 2. Hanh vi nghiep vu

### Reset theo ngay

Backend se:
1. Chot thong ke cho ngay duoc chon
2. Clear ticket hien tai khoi tat ca quay
3. Reset sequence cua cac quay active ve `0`
4. Emit realtime

Response moi:

```json
{
  "success": true,
  "data": {
    "date": "2026-04-22",
    "resetCount": 4,
    "counterCount": 4
  },
  "message": "Đã reset dữ liệu ngày 2026-04-22 cho 4 quầy"
}
```

### Reset all

Backend se:
1. Clear ticket hien tai khoi tat ca quay
2. Reset sequence cua cac quay active ve `0`
3. Emit realtime

Response moi:

```json
{
  "success": true,
  "data": {
    "resetCount": 4
  },
  "message": "Đã reset bộ đếm của 4 quầy trong hệ thống"
}
```

## 3. API settings moi cho auto reset

Tat ca deu yeu cau:
- `Authorization: Bearer <admin_token>`

### GET `/api/admin/settings/auto-reset`

Lay cau hinh auto reset hien tai.

Response:

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "time": "00:00"
  }
}
```

### PATCH `/api/admin/settings/auto-reset/enabled`

Body:

```json
{
  "enabled": true
}
```

Response:

```json
{
  "success": true,
  "data": {
    "auto_reset_enabled": true
  },
  "message": "Đã bật tự động reset ticket"
}
```

### PATCH `/api/admin/settings/auto-reset/time`

Body:

```json
{
  "time": "00:00"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "auto_reset_time": "00:00"
  },
  "message": "Đã cập nhật thời gian tự động reset ticket thành 00:00"
}
```

Validation:
- format bat buoc `HH:MM`
- gia tri hop le: `00:00` den `23:59`

## 4. Auto reset chay nhu the nao

Scheduler duoc khoi dong khi server start.

Moi 60 giay, backend se kiem tra:
- `auto_reset_enabled`
- `auto_reset_time`

Neu:
- `enabled = true`
- gio hien tai dung bang `time`
- hom nay chua reset lan nao

thi backend se tu dong:
- lay `yesterday`
- goi `resetTicketsByDate(yesterday, null)`

Vi du:
- hom nay la `2026-04-23`
- `time = "00:00"`

Dung `00:00`, backend se reset du lieu cho ngay `2026-04-22`.

## 5. Socket.IO: event FE can nghe

### Waiting room

Client:

```js
socket.emit('join-waiting-room');
```

Can lang nghe:

#### `waiting-room-snapshot`

Backend gui snapshot ban dau khi client vua join room.

Payload:

```json
{
  "updatedAt": "2026-04-23T00:00:01.000Z",
  "totalWaiting": 0,
  "tickets": [],
  "lastIssuedByCounter": [
    {
      "counterId": "counter_1_id",
      "counterCode": "Q1",
      "counterName": "QUAY 1",
      "counterNumber": 1,
      "lastNumber": 0,
      "lastDisplayNumber": "1000"
    }
  ]
}
```

#### `tickets-reset-day`

Payload thuc te hien tai:

```json
{
  "date": "2026-04-22",
  "deletedCount": 4,
  "lastIssuedByCounter": [
    {
      "counterId": "counter_1_id",
      "counterCode": "Q1",
      "counterName": "QUAY 1",
      "counterNumber": 1,
      "lastNumber": 0,
      "lastDisplayNumber": "1000"
    }
  ]
}
```

Luu y:
- ten field van la `deletedCount` de giu tuong thich FE cu
- nhung trong logic moi, field nay dang mang nghia gan voi `resetCount`, khong con la so ticket bi xoa

#### `tickets-reset-all`

Payload:

```json
{
  "deletedCount": 4,
  "lastIssuedByCounter": [
    {
      "counterId": "counter_1_id",
      "counterCode": "Q1",
      "counterName": "QUAY 1",
      "counterNumber": 1,
      "lastNumber": 0,
      "lastDisplayNumber": "1000"
    }
  ]
}
```

Luu y giong ben tren:
- `deletedCount` khong con la so ticket da xoa

### Counter display / Staff display

Client counter:

```js
socket.emit('join-counter', counterId);
```

Client staff display:

```js
socket.emit('join-staff-display', { counterId, staffId });
```

Can lang nghe:

#### `counter-reset`

Duoc gui vao room `counter-<counterId>` khi reset theo ngay.

Payload:

```json
{
  "counterId": "counter_1_id",
  "date": "2026-04-22"
}
```

#### `staff-display-updated`

Duoc gui khi reset-day va reset-all thong qua `emitStaffDisplayUpdateForCounters(...)`.

Payload:

```json
{
  "reason": "tickets-reset-day",
  "counterId": "counter_1_id",
  "updatedAt": "2026-04-23T00:00:01.000Z",
  "data": {
    "counter": {
      "id": "counter_1_id",
      "name": "QUAY 1",
      "number": 1
    },
    "currentTicket": null,
    "waitingTickets": [],
    "recallTickets": [],
    "totalWaiting": 0
  },
  "date": "2026-04-22",
  "resetCount": 4
}
```

Voi reset all, `reason` se la:

```text
tickets-reset-all
```

## 6. FE nen xu ly UI nhu the nao

### Waiting room (TV)

Khi nhan:
- `waiting-room-snapshot`
- `tickets-reset-day`
- `tickets-reset-all`

FE nen:
1. update lai `lastIssuedByCounter`
2. goi lai `GET /api/tickets/waiting` neu can snapshot day du
3. reset giao dien hien thi ticket dang cho neu logic UI cua ban dang cache local state

Khuyen nghi an toan:

```js
socket.on('tickets-reset-day', async () => {
  const res = await fetchWaitingTickets();
  setWaitingData(res);
});

socket.on('tickets-reset-all', async () => {
  const res = await fetchWaitingTickets();
  setWaitingData(res);
});
```

### Staff display

Khi nhan `staff-display-updated` voi:
- `reason = "tickets-reset-day"`
- `reason = "tickets-reset-all"`

FE nen:
- set lai state bang `payload.data`
- khong tu cong/tru local state

Vi du:

```js
socket.on('staff-display-updated', (payload) => {
  if (
    payload.reason === 'tickets-reset-day' ||
    payload.reason === 'tickets-reset-all'
  ) {
    setStaffDisplay(payload.data);
  }
});
```

### Counter display

Khi nhan `counter-reset`, FE nen:
- clear ticket dang hien thi tai quay
- neu can thi goi lai API display cua quay de dong bo

## 7. Flow de FE test

### Test reset tay

1. Tao mot vai ticket
2. Mo:
   - waiting room
   - staff display
   - counter display
3. Goi API reset-day hoac reset-all
4. Kiem tra:
   - waiting room nhan event
   - counter display nhan `counter-reset` neu la reset-day
   - staff display nhan `staff-display-updated`
   - ticket moi tao sau do quay lai tu `001`

### Test auto reset

1. `PATCH /api/admin/settings/auto-reset/enabled`

```json
{
  "enabled": true
}
```

2. Dat gio gan hien tai, vi du hien tai la `10:25` thi dat:

```json
{
  "time": "10:26"
}
```

3. Cho toi phut tiep theo
4. Kiem tra:
   - scheduler chay
   - waiting room / staff display nhan event reset
   - so thu tu moi quay lai tu `001`

## 8. Luu y quan trong cho FE

- Khong duoc gia dinh reset dong nghia voi xoa ticket
- Neu UI co man thong ke ticket da phat trong ngay, can lay tu API thong ke, khong duoc suy ra tu viec ticket bien mat
- `deletedCount` trong event reset hien tai la ten cu de giu tuong thich, khong nen dung ten nay de suy luan nghiep vu "da xoa"
- Cac man hinh realtime nen uu tien overwrite bang snapshot/API moi thay vi tu tinh toan local

## 9. De xuat tich hop nhanh

Neu FE muon it rui ro nhat:

- Waiting room:
  - nghe `tickets-reset-day`, `tickets-reset-all`
  - refetch `GET /api/tickets/waiting`

- Staff display:
  - nghe `staff-display-updated`
  - set state bang `payload.data`

- Counter display:
  - nghe `counter-reset`
  - clear state va refetch display neu can

## 10. File backend lien quan

- [src/services/ticket/ticket.reset.service.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/services/ticket/ticket.reset.service.js)
- [src/services/setting.service.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/services/setting.service.js)
- [src/services/autoReset.service.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/services/autoReset.service.js)
- [src/services/ticket/ticket.socket.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/services/ticket/ticket.socket.js)
- [src/controllers/admin/settings.controller.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/controllers/admin/settings.controller.js)
- [src/routers/admin/settings.route.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/routers/admin/settings.route.js)
