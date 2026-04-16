# Counter Sequence Guide

Tai lieu nay mo ta thay doi moi nhat cua backend: moi quay dung chung mot day so rieng, khong con tach day so theo tung dich vu.

## 1. Muc tieu

Truoc day:

- Dich vu A co day so rieng: `001`, `002`, `003`
- Dich vu B co day so rieng: `001`, `002`, `003`

Hien tai:

- Moi quay co mot day so rieng
- Tat ca dich vu cua cung quay dung chung day so do
- So hien thi co dang: `<so_quay><so_thu_tu_pad_3>`

Vi du:

- Quay 1: `1001`, `1002`, `1003`
- Quay 2: `2001`, `2002`, `2003`

## 2. Thay doi trong database

### Model moi: `CounterSequence`

File:

- [src/models/counterSequence.model.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/models/counterSequence.model.js)

Field:

```js
{
  counterId: ObjectId,
  lastNumber: Number
}
```

Y nghia:

- Moi quay co 1 dong sequence rieng
- `lastNumber` la so cuoi cung da cap cho quay do

### Ticket co them `queueCounterId`

File:

- [src/models/ticket.model.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/models/ticket.model.js)

Field moi:

```js
queueCounterId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Counter',
  default: null
}
```

Y nghia:

- Luu quay da phat day so cho ticket
- Dung de format `displayNumber`
- Dung de loc waiting list theo quay

## 3. Logic tao ticket moi

File:

- [src/services/ticket.service.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/services/ticket.service.js)

Khi goi:

```http
POST /api/tickets
```

backend se:

1. Kiem tra `serviceId` hop le va dich vu ton tai
2. Tim quay phuc vu dich vu do
3. Neu request co `counterId`, se dung quay do
4. Neu khong co `counterId`, se chon quay active co `number` nho nhat
5. Tang sequence cua quay len 1
6. Tao ticket voi:
   - `number = nextNumber`
   - `ticketNumber = padStart(3)`
   - `queueCounterId = issueCounter._id`
7. Tra ve so hien thi:

```text
displayNumber = <counter.number><pad3(number)>
```

Vi du:

- quay so `1`
- so tiep theo `7`

thi:

```text
displayNumber = 1007
```

## 4. Validation tao ticket

File:

- [src/validations/ticket.validation.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/validations/ticket.validation.js)

Body hop le:

```json
{
  "serviceId": "680000000000000000000301",
  "name": "Nguyen Van A",
  "phone": "0912345678",
  "counterId": "680000000000000000000201",
  "autoPrint": false
}
```

Trong do:

- `serviceId`: bat buoc
- `name`: bat buoc, 2-100 ky tu
- `phone`: bat buoc, dung 10 chu so
- `counterId`: khong bat buoc
- `autoPrint`: khong bat buoc

## 5. Response tao ticket

Controller:

- [src/controllers/ticket.controller.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/controllers/ticket.controller.js)

Response mau:

```json
{
  "success": true,
  "data": {
    "_id": "ticket_id",
    "number": 7,
    "ticketNumber": "007",
    "formattedNumber": "1007",
    "displayNumber": "1007",
    "name": "Nguyen Van A",
    "phone": "0912345678",
    "status": "waiting",
    "qrCode": "data:image/png;base64,...",
    "createdAt": "2026-04-15T10:00:00.000Z"
  },
  "service": {
    "_id": "service_id",
    "code": "ND",
    "name": "NOP DON"
  },
  "availableCounters": [
    {
      "_id": "counter_id",
      "code": "Q1",
      "name": "QUAY 1",
      "number": 1
    }
  ],
  "printed": false,
  "printMessage": "Khong co may in de in",
  "message": "Da cap so 1007 cho dich vu NOP DON"
}
```

## 6. API da duoc cap nhat

### `POST /api/tickets`

- Tao ticket theo day so cua quay

### `GET /api/tickets/waiting`

- Danh sach cho cong khai
- Moi ticket co:
  - `formattedNumber`
  - `displayNumber`

### `GET /api/tickets/staff/display`

- Man hinh staff
- `currentTicket`, `waitingTickets`, `recallTickets` deu hien thi theo so moi

### `GET /api/tickets/counters/:counterId/display`

- Man hinh quay / TV cua quay
- `currentTicket` va `waitingTickets` hien thi theo so moi

### Cac API xu ly ticket khac

- `POST /api/tickets/call-next`
- `PATCH /api/tickets/:id/skip`
- `POST /api/tickets/:id/recall`
- `PATCH /api/tickets/:id/cancel-recall`
- `PATCH /api/tickets/:id/complete`

Tat ca deu da tra ve:

- `formattedNumber`
- `displayNumber`

theo `queueCounterId`

## 7. Socket.IO thay doi gi

Khi tao ticket moi, event:

```text
new-ticket
```

se gui:

```json
{
  "ticket": {
    "id": "ticket_id",
    "number": 7,
    "formattedNumber": "1007",
    "displayNumber": "1007",
    "customerName": "Nguyen Van A",
    "phone": "0912345678",
    "serviceName": "NOP DON",
    "status": "waiting",
    "qrCode": "data:image/png;base64,..."
  },
  "totalWaiting": 12
}
```

Frontend nen uu tien dung:

- `displayNumber`

## 8. Xu ly ticket cu

Khong can migrate ticket cu.

Ticket cu:

- co the van co `queueCounterId = null`
- van doc duoc binh thuong
- khong bi anh huong boi logic moi

Ticket moi:

- se duoc gan `queueCounterId`
- se theo dung day so cua quay

## 9. Index va ly do tung bi loi

Backend da them `syncIndexes()` o:

- [src/config/database.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/config/database.js)

de cap nhat index theo model moi.

Index unique hien tai o ticket:

- unique theo `queueCounterId + number`
- unique theo `queueCounterId + ticketNumber`

Nhung chi ap dung cho document co `queueCounterId != null`.

Ly do:

- tranh loi duplicate voi ticket cu chua co `queueCounterId`

## 10. Cach test nhanh bang Postman

### Tao ticket cho quay 1

```http
POST /api/tickets
Content-Type: application/json
```

Body:

```json
{
  "serviceId": "service_id",
  "name": "Nguyen Van A",
  "phone": "0912345678",
  "counterId": "counter_1_id",
  "autoPrint": false
}
```

Ky vong:

- ticket dau tien cua quay 1 -> `1001`
- ticket thu hai cua quay 1 -> `1002`

### Tao ticket cho quay 2

```json
{
  "serviceId": "service_id",
  "name": "Tran Van B",
  "phone": "0987654321",
  "counterId": "counter_2_id",
  "autoPrint": false
}
```

Ky vong:

- ticket dau tien cua quay 2 -> `2001`
- ticket tiep theo cua quay 2 -> `2002`

### Kiem tra waiting list

```http
GET /api/tickets/waiting
```

Ky vong moi item co:

```json
{
  "_id": "ticket_id",
  "number": 1,
  "formattedNumber": "1001",
  "displayNumber": "1001"
}
```

## 11. Ghi chu nghiep vu

- Day so hien tai la theo quay, khong theo dich vu
- Neu mot dich vu duoc nhieu quay phuc vu, FE nen truyen `counterId` ngay tu luc tao ve neu muon chac chan cap dung day so cua quay cu the
- Neu FE khong truyen `counterId`, backend se tu chon quay active co so nho nhat dang phuc vu dich vu do

## 12. File chinh da sua

- [src/models/counterSequence.model.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/models/counterSequence.model.js)
- [src/models/ticket.model.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/models/ticket.model.js)
- [src/services/ticket.service.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/services/ticket.service.js)
- [src/controllers/ticket.controller.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/controllers/ticket.controller.js)
- [src/validations/ticket.validation.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/validations/ticket.validation.js)
- [src/config/database.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/config/database.js)

