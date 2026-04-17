# Call By ID Guide

Tai lieu nay huong dan tinh nang goi so theo ID (`call-by-id`) trong he thong lay so tu dong.

## 1. Muc tieu

Tinh nang nay cho phep staff:

- chu dong chon mot ticket cu the trong danh sach
- goi ticket do vao quay cua minh
- van dam bao dung phan quyen staff-service

Tinh nang nay phu hop voi:

- goi lai ticket trong recall list
- uu tien mot ticket dang cho cu the
- staff tu chon ticket can xu ly thay vi chi dung `call-next`

## 2. Endpoint moi

```http
POST /api/tickets/call-by-id
Authorization: Bearer <staff_token>
Content-Type: application/json
```

Request body:

```json
{
  "ticketId": "69e08b16595407db6356d001"
}
```

## 3. Luong xu ly

Khi staff goi API `call-by-id`, backend se kiem tra:

1. staff da duoc gan quay hay chua
2. quay co dang xu ly ticket khac hay khong
3. ticket co ton tai hay khong
4. ticket co dang o trang thai `waiting` hay khong
5. ticket co thuoc dich vu ma staff duoc phep xu ly hay khong
6. ticket co thuoc pham vi quay cua staff hay khong

Neu hop le, backend se:

- chuyen ticket sang `processing`
- gan `counterId`
- gan `staffId`
- gan `processingAt`
- cap nhat `currentTicketId` cua quay
- phat realtime socket
- doc loa neu TTS dang bat

## 4. Quy tac quyen

### Ticket waiting thong thuong

Ticket chi duoc goi theo ID neu:

- `ticket.queueCounterId === counterId` cua staff

### Ticket recall

Ticket recall chi duoc goi theo ID neu:

- `ticket.recallCounterId === counterId` cua staff

### Quyen staff-service

Staff chi duoc goi ticket neu:

- `ticket.serviceId` nam trong `allowedServiceIds` cua staff tai quay hien tai

Neu khong dung quyen:

- backend tra `403`

## 5. Response thanh cong

Response mau:

```json
{
  "success": true,
  "data": {
    "_id": "ticket_id",
    "number": 1,
    "ticketNumber": "001",
    "serviceId": {
      "_id": "service_id",
      "code": "ND",
      "name": "NOP DON"
    },
    "counterId": "counter_id",
    "staffId": "staff_id",
    "queueCounterId": {
      "_id": "counter_id",
      "number": 1
    },
    "serviceCounterId": "service_counter_id",
    "name": "Nguyen Van A",
    "phone": "0912345678",
    "status": "processing",
    "processingAt": "2026-04-17T09:00:00.000Z",
    "formattedNumber": "1001",
    "displayNumber": "1001"
  },
  "message": "Vui lòng số 1001 đến QUAY 1"
}
```

## 6. Loi co the gap

### Ticket khong ton tai

```json
{
  "success": false,
  "message": "Không tìm thấy ticket"
}
```

Status:

```text
404
```

### Ticket khong o trang thai waiting

```json
{
  "success": false,
  "message": "Chỉ có thể gọi ticket đang ở trạng thái chờ"
}
```

Status:

```text
400
```

### Staff khong co quyen voi dich vu nay

```json
{
  "success": false,
  "message": "Nhân viên không được phép gọi ticket thuộc dịch vụ này"
}
```

Status:

```text
403
```

### Ticket khong thuoc quay cua staff

```json
{
  "success": false,
  "message": "Ticket không thuộc danh sách xử lý của quầy này"
}
```

Status:

```text
403
```

### Quay dang ban

```json
{
  "success": false,
  "message": "Quầy đang xử lý ticket ..."
}
```

Status:

```text
400
```

## 7. Khac nhau giua `call-next` va `call-by-id`

### `call-next`

- backend tu tim ticket tiep theo hop le
- chi lay ticket theo thu tu uu tien / thu tu cho
- staff khong chon duoc ticket cu the

### `call-by-id`

- staff tu chon ticket cu the
- backend van kiem tra dung quyen nhu `call-next`
- huu ich cho recall list hoac chon dung mot ticket dac biet

## 8. Realtime va TTS

Sau khi `call-by-id` thanh cong, backend se:

- phat event `ticket-called` cho waiting room
- phat `new-current-ticket` cho room cua quay
- phat `staff-display-updated`
- phat am thanh neu TTS backend dang bat

Frontend khong can lam gi them ngoai:

- goi API `call-by-id`
- nghe socket va render UI nhu binh thuong

## 9. Huong dan test Postman

Gia su:

- Quay 1 co 3 dich vu: `ND`, `RT`, `CT`
- Staff A chi co `ND`
- Staff B chi co `RT`, `CT`

Bien Postman:

- `{{baseUrl}}`
- `{{adminToken}}`
- `{{staffAToken}}`
- `{{staffBToken}}`
- `{{counterId}}`
- `{{serviceND}}`
- `{{serviceRT}}`
- `{{serviceCT}}`
- `{{staffAId}}`
- `{{staffBId}}`
- `{{ticketND}}`
- `{{ticketRT}}`

### Buoc 1. Admin login

```http
POST {{baseUrl}}/api/auth/login
```

```json
{
  "username": "admin",
  "password": "Admin@123"
}
```

### Buoc 2. Tao 3 service

```json
{
  "code": "ND",
  "name": "NOP DON",
  "icon": "file-text",
  "description": "Dich vu nop don",
  "displayOrder": 1,
  "isActive": true
}
```

```json
{
  "code": "RT",
  "name": "RUT TIEN",
  "icon": "wallet",
  "description": "Dich vu rut tien",
  "displayOrder": 2,
  "isActive": true
}
```

```json
{
  "code": "CT",
  "name": "CHUYEN TIEN",
  "icon": "send",
  "description": "Dich vu chuyen tien",
  "displayOrder": 3,
  "isActive": true
}
```

### Buoc 3. Tao quay va gan service

```http
POST {{baseUrl}}/api/counters
```

```json
{
  "code": "Q1",
  "name": "QUAY 1",
  "number": 1,
  "serviceIds": [
    "{{serviceND}}",
    "{{serviceRT}}",
    "{{serviceCT}}"
  ],
  "note": "Quay tong hop",
  "isActive": true
}
```

### Buoc 4. Tao va gan staff

Tao staff A:

```json
{
  "username": "staff.a",
  "password": "StaffA@123",
  "fullName": "Staff A"
}
```

Tao staff B:

```json
{
  "username": "staff.b",
  "password": "StaffB@123",
  "fullName": "Staff B"
}
```

Gan quay:

```json
{
  "counterId": "{{counterId}}"
}
```

Gan service cho staff A:

```json
{
  "serviceIds": [
    "{{serviceND}}"
  ]
}
```

Gan service cho staff B:

```json
{
  "serviceIds": [
    "{{serviceRT}}",
    "{{serviceCT}}"
  ]
}
```

### Buoc 5. Login staff

Staff A:

```json
{
  "username": "staff.a",
  "password": "StaffA@123"
}
```

Staff B:

```json
{
  "username": "staff.b",
  "password": "StaffB@123"
}
```

### Buoc 6. Tao ticket test

Ticket ND:

```json
{
  "serviceId": "{{serviceND}}",
  "name": "Nguyen Van A",
  "phone": "0912345678",
  "counterId": "{{counterId}}",
  "autoPrint": false
}
```

Ticket RT:

```json
{
  "serviceId": "{{serviceRT}}",
  "name": "Tran Van B",
  "phone": "0987654321",
  "counterId": "{{counterId}}",
  "autoPrint": false
}
```

### Buoc 7. Staff A goi ticket ND theo ID

```http
POST {{baseUrl}}/api/tickets/call-by-id
Authorization: Bearer {{staffAToken}}
```

```json
{
  "ticketId": "{{ticketND}}"
}
```

Kiem tra:

- thanh cong
- ticket chuyen sang `processing`
- `staffId` la staff A

### Buoc 8. Staff B goi ticket ND theo ID

Neu can, tao lai mot ticket ND moi dang `waiting`.

```http
POST {{baseUrl}}/api/tickets/call-by-id
Authorization: Bearer {{staffBToken}}
```

```json
{
  "ticketId": "{{ticketND}}"
}
```

Kiem tra:

- tra `403`

### Buoc 9. Staff B goi ticket RT theo ID

```http
POST {{baseUrl}}/api/tickets/call-by-id
Authorization: Bearer {{staffBToken}}
```

```json
{
  "ticketId": "{{ticketRT}}"
}
```

Kiem tra:

- thanh cong

### Buoc 10. Staff A goi ticket RT theo ID

Neu can, tao lai mot ticket RT moi dang `waiting`.

```http
POST {{baseUrl}}/api/tickets/call-by-id
Authorization: Bearer {{staffAToken}}
```

```json
{
  "ticketId": "{{ticketRT}}"
}
```

Kiem tra:

- tra `403`

## 10. Luu y khi test

- Moi quay chi xu ly 1 ticket tai 1 thoi diem
- Truoc khi goi ticket khac, can:
  - `complete`
  - hoac `skip`
- Neu khong, backend se bao quay dang ban

## 11. FE can lam gi

Frontend staff co the:

- lay danh sach ticket tu `staff/display` hoac `recall-list`
- cho staff bam nut `Goi so nay`
- gui `ticketId` len API `call-by-id`
- render response va socket nhu binh thuong

Frontend khong can tu kiem tra quyen staff-service, vi backend da kiem tra.

