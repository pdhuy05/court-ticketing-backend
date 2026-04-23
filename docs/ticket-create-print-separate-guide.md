# FE Guide: Tach Tao Ve va In Ve

Tai lieu nay mo ta flow moi sau khi backend tach:

1. `POST /api/tickets` -> chi tao ve
2. `POST /api/tickets/:id/print` -> in ve theo id

## 1. Muc tieu thay doi

Truoc day:
- FE goi `POST /api/tickets`
- backend vua tao ve vua tu dong queue lenh in trong cung request
- FE co the truyen `autoPrint`

Hien tai:
- FE goi `POST /api/tickets` de tao ve
- backend **khong in nua**
- neu nguoi dung xac nhan in, FE moi goi `POST /api/tickets/:id/print`

Loi ich:
- UI de kiem soat hon
- nguoi dung co the xac nhan thong tin truoc khi in
- retry in doc lap voi tao ve

## 2. Endpoint tao ve

### API

```http
POST /api/tickets
```

### Authentication

- Public
- Khong can token

### Body

```json
{
  "serviceId": "680000000000000000000301",
  "name": "Nguyen Van A",
  "phone": "0912345678",
  "counterId": "680000000000000000000201"
}
```

### Luu y

- Khong con field `autoPrint`
- `counterId` la optional neu backend co the tu chon quay theo logic san co

### Response

```json
{
  "success": true,
  "data": {
    "_id": "680000000000000000000601",
    "number": 1,
    "ticketNumber": "001",
    "formattedNumber": "1001",
    "displayNumber": "1001",
    "name": "Nguyen Van A",
    "phone": "0912345678",
    "status": "waiting",
    "createdAt": "2026-04-23T08:00:00.000Z",
    "qrData": "some_qr_data_here"
  },
  "service": {
    "_id": "680000000000000000000301",
    "code": "ND",
    "name": "NOP DON"
  },
  "availableCounters": [
    {
      "_id": "680000000000000000000201",
      "code": "Q1",
      "name": "QUAY 1",
      "number": 1
    }
  ],
  "message": "Đã cấp số 1001 cho dịch vụ NOP DON"
}
```

### FE can luu lai gi

Sau khi tao ve thanh cong, FE nen luu:
- `data._id`
- `data.ticketNumber`
- `data.displayNumber`
- `service`
- `availableCounters`

Quan trong nhat:

```js
const ticketId = response.data._id;
```

Vi endpoint in se dung `ticketId` nay.

## 3. Endpoint in ve theo id

### API

```http
POST /api/tickets/:id/print
```

### Authentication

- Public
- Khong can token

### Params

`id` phai la ObjectId hop le cua ticket.

Vi du:

```http
POST /api/tickets/680000000000000000000601/print
```

### Body

Khong can body.

Co the gui:

```json
{}
```

hoac khong gui gi ca.

### Response thanh cong

```json
{
  "success": true,
  "message": "Đã gửi lệnh in vé 001",
  "printStatus": "queued"
}
```

### Response loi

Khi khong tim thay ticket:

```json
{
  "success": false,
  "message": "Không tìm thấy vé"
}
```

Khi `id` sai format:

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "id",
      "message": "ID không hợp lệ"
    }
  ]
}
```

## 4. Flow FE de xuat

### Flow co hop thoai xac nhan

1. Goi `POST /api/tickets`
2. Hien thi popup hoac man hinh xac nhan
3. Neu nguoi dung bam "In ve" -> goi `POST /api/tickets/:id/print`
4. Neu nguoi dung bam "Bo qua" -> khong can goi endpoint in

### Pseudo-code

```js
const createTicket = async (payload) => {
  const res = await fetch('/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return res.json();
};

const printTicket = async (ticketId) => {
  const res = await fetch(`/api/tickets/${ticketId}/print`, {
    method: 'POST'
  });

  return res.json();
};

const handleSubmit = async (payload) => {
  const created = await createTicket(payload);

  if (!created.success) {
    showError(created.message);
    return;
  }

  showTicketPreview(created.data);

  const confirmed = await openPrintConfirmModal();

  if (!confirmed) {
    return;
  }

  const printed = await printTicket(created.data._id);

  if (!printed.success) {
    showError(printed.message);
    return;
  }

  showSuccess(printed.message);
};
```

## 5. Nhung gi FE khong can lam nua

FE khong can:
- gui `autoPrint`
- doc `printRequested`
- doc `printStatus` trong response tao ve
- doc `printMessage` trong response tao ve

Vi nhung field nay da bi bo khoi `POST /api/tickets`.

## 6. Realtime co bi anh huong khong

Khong.

Khi tao ticket:
- backend van emit socket `new-ticket` nhu cu

Vi vay:
- waiting room
- staff display
- counter display

van cap nhat binh thuong ngay sau khi tao ve.

Endpoint in la luong rieng:
- chi queue lenh in
- khong thay doi status ticket
- khong thay doi queue

## 7. Luu y ve printer

Endpoint `/api/tickets/:id/print` se:
- tim may in mac dinh dang `isDefault = true` va `isActive = true`
- chi ho tro in `network printer`
- tu add printer vao `printer.service` neu chua duoc cache

Neu khong co may in mac dinh hoac may in loi:
- request van co the da duoc queue xu ly
- loi thuc te se duoc log trong backend

Neu FE can biet trang thai in chi tiet hon, can lam them 1 co che tracking rieng. Hien tai backend chi tra:

```json
{
  "printStatus": "queued"
}
```

## 8. Test Postman

### Tao ve

```http
POST /api/tickets
Content-Type: application/json
```

Body:

```json
{
  "serviceId": "680000000000000000000301",
  "name": "Nguyen Van A",
  "phone": "0912345678",
  "counterId": "680000000000000000000201"
}
```

### In ve

```http
POST /api/tickets/680000000000000000000601/print
```

Body:

```json
{}
```

## 9. Checklist FE

- Bo `autoPrint` khoi form submit
- Sau khi tao ve, luu `ticketId`
- Khi nguoi dung xac nhan in, goi `POST /api/tickets/:id/print`
- Xu ly loi rieng cho tao ve va in ve
- Khong duoc gia dinh tao ve thanh cong nghia la da in thanh cong

## 10. File backend lien quan

- [src/controllers/ticket.controller.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/controllers/ticket.controller.js)
- [src/routers/ticket.route.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/routers/ticket.route.js)
- [src/validations/ticket.validation.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/validations/ticket.validation.js)
- [src/services/printer.service.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/services/printer.service.js)
