# Ticket Recall Guide

Tai lieu nay huong dan 2 chuc nang lien quan den `recall` trong he thong lay so:

- recall ticket trong danh sach skip
- recall lai ticket dang xu ly (`processing`)

Muc tieu la de FE va QA khong bi nham giua 2 API.

## 1. Tong quan

Hien tai backend co 2 kieu recall:

### Recall 1: Ticket trong danh sach can goi lai

Dung khi:

- ticket da duoc `skip`
- ticket da quay ve trang thai:
  - `status = waiting`
  - `isRecall = true`

API:

```http
POST /api/tickets/:id/recall
```

Ket qua:

- ticket duoc dua lai vao `processing`
- ticket roi khoi recall list

### Recall 2: Ticket dang xu ly

Dung khi:

- ticket dang o trang thai `processing`
- staff muon bam "goi lai" de phat lai man hinh / am thanh
- khong doi trang thai ticket

API:

```http
POST /api/tickets/:id/recall-processing
```

Ket qua:

- ticket van giu `processing`
- backend phat lai realtime cho man hinh

## 2. Flow recall ticket trong recall list

### Buoc 1: Goi so

```http
POST /api/tickets/call-next
```

Ticket chuyen:

```text
waiting -> processing
```

### Buoc 2: Staff bam skip

```http
PATCH /api/tickets/:id/skip
```

Ticket chuyen:

```text
processing -> waiting + isRecall = true
```

Sau buoc nay:

- ticket khong con trong waiting list thuong
- ticket xuat hien trong recall list

### Buoc 3: Xem recall list

```http
GET /api/tickets/recall-list
```

Response mau:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "ticket_id",
      "number": 1,
      "formattedNumber": "1001",
      "displayNumber": "1001",
      "customerName": "Nguyen Van A",
      "phone": "0912345678",
      "serviceName": "NOP DON",
      "recalledAt": "2026-04-17T08:05:00.000Z",
      "waitingMinutes": 2
    }
  ]
}
```

### Buoc 4: Goi lai ticket trong recall list

```http
POST /api/tickets/:id/recall
```

Body:

```json
{}
```

Response mau:

```json
{
  "success": true,
  "data": {
    "_id": "ticket_id",
    "number": 1,
    "ticketNumber": "001",
    "formattedNumber": "1001",
    "displayNumber": "1001",
    "status": "processing",
    "isRecall": false,
    "counterId": "counter_id"
  },
  "message": "Đã gọi lại số 1001"
}
```

Sau buoc nay:

- ticket roi khoi recall list
- ticket quay lai `processing`

## 3. Flow recall ticket dang processing

### Tinh huong

Staff vua goi ticket len, ticket dang xu ly:

```text
status = processing
```

Khi do neu staff bam "goi lai", ticket khong can quay ve waiting.

Backend chi can:

- giu nguyen trang thai `processing`
- phat lai event realtime
- cap nhat man hinh quay / man hinh staff / man hinh cho

### API

```http
POST /api/tickets/:id/recall-processing
```

Body:

```json
{}
```

Response mau:

```json
{
  "success": true,
  "data": {
    "_id": "ticket_id",
    "number": 31,
    "ticketNumber": "031",
    "formattedNumber": "1031",
    "displayNumber": "1031",
    "status": "processing"
  },
  "message": "Đã gọi lại vé đang xử lý 1031"
}
```

### Khi nao dung API nay

Dung khi:

- khach dang duoc goi
- staff muon phat lai man hinh / thong bao
- ticket van dang `processing`

Khong dung API nay cho ticket da skip.

## 4. So sanh 2 API recall

### `POST /api/tickets/:id/recall`

- Chi dung cho ticket trong recall list
- Ticket phai:
  - `status = waiting`
  - `isRecall = true`
- Sau khi goi:
  - ticket chuyen sang `processing`

### `POST /api/tickets/:id/recall-processing`

- Chi dung cho ticket dang xu ly
- Ticket phai:
  - `status = processing`
- Sau khi goi:
  - ticket van la `processing`
  - backend chi phat lai thong bao

## 5. Realtime event

### Recall list

Khi goi:

```http
POST /api/tickets/:id/recall
```

Backend se phat:

- `ticket-called`
  - `reason = "recall-ticket"`
- `ticket-recalled`
- `staff-display-updated`
  - `reason = "ticket-recalled"`

### Recall processing

Khi goi:

```http
POST /api/tickets/:id/recall-processing
```

Backend se phat:

- `ticket-called`
  - `reason = "recall-processing"`
- `ticket-processing-recalled`
- `staff-display-updated`
  - `reason = "ticket-processing-recalled"`

## 6. Validation va phan quyen

Ca 2 API deu:

- can `Authorization: Bearer <staff_token>`
- yeu cau staff da duoc gan quay

Them nua:

### `recall`

- chi recall duoc ticket thuoc recall list cua quay hien tai
- chi recall duoc service staff co quyen xu ly

### `recall-processing`

- chi recall duoc ticket dang `processing`
- ticket phai thuoc quay hien tai
- chi recall duoc service staff co quyen xu ly
- neu ticket da gan `staffId`, chi staff do moi duoc goi lai ticket cua minh

## 7. JSON test Postman

### Header chung

```http
Authorization: Bearer <staff_token>
Content-Type: application/json
```

### Recall ticket trong skip list

Request:

```http
POST /api/tickets/ticket_id/recall
```

Body:

```json
{}
```

### Recall ticket dang processing

Request:

```http
POST /api/tickets/ticket_id/recall-processing
```

Body:

```json
{}
```

## 8. Loi thuong gap

### Goi `/recall` cho ticket dang processing

Response:

```json
{
  "success": false,
  "message": "Không tìm thấy ticket trong danh sách cần gọi lại"
}
```

### Goi `/recall-processing` cho ticket waiting

Response:

```json
{
  "success": false,
  "message": "Không tìm thấy ticket đang xử lý để gọi lại"
}
```

### Staff goi ticket cua nguoi khac

Response:

```json
{
  "success": false,
  "message": "Bạn chỉ được phép gọi lại ticket đang xử lý của chính mình"
}
```

## 9. File chinh lien quan

- [src/services/ticket.service.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/services/ticket.service.js)
- [src/controllers/ticket.controller.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/controllers/ticket.controller.js)
- [src/routers/ticket.route.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/routers/ticket.route.js)
- [src/validations/ticket.validation.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/validations/ticket.validation.js)

