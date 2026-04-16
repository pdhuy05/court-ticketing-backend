# Staff Service Assignment Guide

Tai lieu nay huong dan admin, frontend va QA test tinh nang gan dich vu cho staff trong pham vi quay.

## 1. Muc tieu

Truoc day:

- quay duoc gan nhieu dich vu
- staff chi duoc gan quay
- staff co the xu ly tat ca dich vu cua quay

Hien tai:

- quay van duoc gan dich vu nhu cu
- staff van duoc gan quay nhu cu
- admin co the gan truc tiep dich vu cho staff
- staff chi duoc xem va xu ly cac dich vu da duoc phep tai quay cua minh

## 2. Mo hinh quan he

Quan he moi cua he thong:

```text
service <-> counter
staff -> counter
staff <-> service
```

Nhung rang buoc can nho:

- staff chi duoc gan dich vu nam trong danh sach dich vu cua quay ma staff dang thuoc ve
- neu staff chua duoc cau hinh dich vu rieng, he thong fallback ve hanh vi cu: staff duoc xu ly toan bo dich vu cua quay
- neu admin da luu cau hinh dich vu cho staff va danh sach do rong, staff se khong duoc xu ly dich vu nao

## 3. Bang moi

Model moi:

- [src/models/staffService.model.js](/Users/dinhhungpham/Documents/BE-NODEJS-TICKET/court-ticket-backend/src/models/staffService.model.js)

Field:

```js
{
  staffId: ObjectId,
  serviceId: ObjectId,
  isActive: Boolean,
  note: String
}
```

Unique index:

```text
staffId + serviceId
```

## 4. API admin moi

Tat ca API ben duoi deu can:

```http
Authorization: Bearer <admin_token>
Content-Type: application/json
```

### `GET /api/admin/users/staff/:id/services`

Muc dich:

- xem staff dang thuoc quay nao
- xem cac dich vu quay do dang phuc vu
- xem staff dang duoc gan nhung dich vu nao
- xem danh sach dich vu co hieu luc thuc te cua staff

Response mau:

```json
{
  "success": true,
  "data": {
    "staffId": "staff_id",
    "counterId": "counter_id",
    "serviceRestrictionConfigured": true,
    "availableServices": [
      {
        "id": "service_1_id",
        "_id": "service_1_id",
        "code": "ND",
        "name": "NOP DON",
        "icon": "file-text",
        "displayOrder": 1,
        "isActive": true
      },
      {
        "id": "service_2_id",
        "_id": "service_2_id",
        "code": "RT",
        "name": "RUT TIEN",
        "icon": "wallet",
        "displayOrder": 2,
        "isActive": true
      }
    ],
    "assignedServices": [
      {
        "id": "service_1_id",
        "_id": "service_1_id",
        "code": "ND",
        "name": "NOP DON",
        "icon": "file-text",
        "displayOrder": 1,
        "isActive": true
      }
    ],
    "effectiveServices": [
      {
        "id": "service_1_id",
        "_id": "service_1_id",
        "code": "ND",
        "name": "NOP DON",
        "icon": "file-text",
        "displayOrder": 1,
        "isActive": true
      }
    ]
  }
}
```

Y nghia:

- `availableServices`: tat ca dich vu cua quay
- `assignedServices`: dich vu admin da gan truc tiep cho staff
- `effectiveServices`: dich vu staff duoc su dung thuc te
- `serviceRestrictionConfigured`:
  - `false`: chua co cau hinh rieng, fallback theo toan bo dich vu cua quay
  - `true`: dang ap dung cau hinh rieng cho staff

### `PUT /api/admin/users/staff/:id/services`

Muc dich:

- thay the toan bo danh sach dich vu staff duoc phep xu ly

Request body:

```json
{
  "serviceIds": [
    "service_1_id",
    "service_2_id"
  ]
}
```

Quy tac:

- chi duoc truyen cac `serviceIds` ma quay cua staff dang phuc vu
- neu staff chua duoc gan quay, khong duoc gan service
- neu gui mang rong `[]`, staff se bi khoa quyen xu ly tat ca dich vu tai quay

Response mau:

```json
{
  "success": true,
  "data": {
    "staffId": "staff_id",
    "serviceRestrictionConfigured": true,
    "availableServices": [
      {
        "id": "service_1_id",
        "_id": "service_1_id",
        "code": "ND",
        "name": "NOP DON",
        "icon": "file-text",
        "displayOrder": 1,
        "isActive": true
      },
      {
        "id": "service_2_id",
        "_id": "service_2_id",
        "code": "RT",
        "name": "RUT TIEN",
        "icon": "wallet",
        "displayOrder": 2,
        "isActive": true
      }
    ],
    "assignedServices": [
      {
        "id": "service_1_id",
        "_id": "service_1_id",
        "code": "ND",
        "name": "NOP DON",
        "icon": "file-text",
        "displayOrder": 1,
        "isActive": true
      }
    ],
    "effectiveServices": [
      {
        "id": "service_1_id",
        "_id": "service_1_id",
        "code": "ND",
        "name": "NOP DON",
        "icon": "file-text",
        "displayOrder": 1,
        "isActive": true
      }
    ]
  },
  "message": "Đã cập nhật dịch vụ cho nhân viên thành công"
}
```

## 5. Du lieu staff tra ve da duoc mo rong

Khi goi:

- `GET /api/admin/users/staff`
- `GET /api/admin/users/staff/:id`
- `POST /api/admin/users/staff`
- `PUT /api/admin/users/staff/:id`
- `PATCH /api/admin/users/staff/:id/assign-counter`
- `PATCH /api/admin/users/staff/:id/remove-counter`

backend se tra them:

- `serviceRestrictionConfigured`
- `availableServices`
- `assignedServices`
- `effectiveServices`

De FE admin co the hien thi trang thai phan quyen staff ma khong can goi API phu neu khong muon.

## 6. Staff bi anh huong o dau

Sau khi staff duoc cau hinh dich vu, backend se gioi han quyen tai cac luong sau:

- `GET /api/tickets/my-counter`
- `GET /api/tickets/staff/display`
- `GET /api/tickets/recall-list`
- `POST /api/tickets/call-next`
- `POST /api/tickets/:id/recall`
- `PATCH /api/tickets/:id/cancel-recall`
- `PATCH /api/tickets/:id/complete`
- `PATCH /api/tickets/:id/skip`

Y nghia:

- staff chi thay waiting list cua cac dich vu duoc phep
- staff chi thay recall list cua cac dich vu duoc phep
- staff chi goi so, hoan thanh, bo qua, recall duoc ticket thuoc dich vu duoc phep

## 7. Response staff display moi

Khi goi:

```http
GET /api/tickets/staff/display
Authorization: Bearer <staff_token>
```

Response se co them:

```json
{
  "success": true,
  "data": {
    "counter": {
      "id": "counter_id",
      "name": "QUAY 1",
      "number": 1,
      "isActive": true,
      "processedCount": 12
    },
    "services": [
      {
        "id": "service_1_id",
        "_id": "service_1_id",
        "code": "ND",
        "name": "NOP DON",
        "icon": "file-text",
        "displayOrder": 1,
        "isActive": true
      }
    ],
    "availableServices": [
      {
        "id": "service_1_id",
        "_id": "service_1_id",
        "code": "ND",
        "name": "NOP DON",
        "icon": "file-text",
        "displayOrder": 1,
        "isActive": true
      },
      {
        "id": "service_2_id",
        "_id": "service_2_id",
        "code": "RT",
        "name": "RUT TIEN",
        "icon": "wallet",
        "displayOrder": 2,
        "isActive": true
      }
    ],
    "assignedServices": [
      {
        "id": "service_1_id",
        "_id": "service_1_id",
        "code": "ND",
        "name": "NOP DON",
        "icon": "file-text",
        "displayOrder": 1,
        "isActive": true
      }
    ],
    "serviceRestrictionConfigured": true,
    "currentTicket": null,
    "waitingTickets": [],
    "recallTickets": [],
    "totalWaiting": 0,
    "staffName": "Nhan Vien Quay 1",
    "staffId": "staff_id"
  }
}
```

Y nghia:

- `services`: danh sach dich vu staff duoc phep xu ly thuc te
- `availableServices`: toan bo dich vu cua quay
- `assignedServices`: danh sach admin da gan cho staff

## 8. Socket staff display moi

### Cach cu van hoat dong

Frontend cu van co the gui:

```js
socket.emit('join-staff-display', {
  counterId: 'counter_id'
});
```

Luc nay backend van tra snapshot theo toan bo dich vu cua quay.

### Cach moi khuyen nghi

De staff nhan du lieu dung theo quyen dich vu cua minh, frontend nen gui:

```js
socket.emit('join-staff-display', {
  staffId: 'staff_id'
});
```

Hoac:

```js
socket.emit('join-staff-display', {
  staffId: 'staff_id',
  counterId: 'counter_id'
});
```

Payload snapshot mau:

```json
{
  "reason": "joined-counter-room",
  "counterId": "counter_id",
  "staffId": "staff_id",
  "updatedAt": "2026-04-16T10:00:00.000Z",
  "data": {
    "counter": {},
    "services": [],
    "availableServices": [],
    "assignedServices": [],
    "serviceRestrictionConfigured": true,
    "currentTicket": null,
    "waitingTickets": [],
    "recallTickets": [],
    "totalWaiting": 0
  }
}
```

## 9. Luong test Postman tu dau den cuoi

### Buoc 1. Admin login

```http
POST /api/auth/login
```

```json
{
  "username": "admin",
  "password": "Admin@123"
}
```

### Buoc 2. Tao service 1

```http
POST /api/services
```

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

### Buoc 3. Tao service 2

```http
POST /api/services
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

### Buoc 4. Tao quay va gan 2 dich vu

```http
POST /api/counters
```

```json
{
  "code": "Q1",
  "name": "QUAY 1",
  "number": 1,
  "serviceIds": [
    "service_1_id",
    "service_2_id"
  ],
  "note": "Quay giao dich so 1",
  "isActive": true
}
```

### Buoc 5. Tao staff

```http
POST /api/admin/users/staff
```

```json
{
  "username": "staff.q1",
  "password": "StaffQ1@123",
  "fullName": "Nhan Vien Quay 1"
}
```

### Buoc 6. Gan quay cho staff

```http
PATCH /api/admin/users/staff/:staffId/assign-counter
```

```json
{
  "counterId": "counter_id"
}
```

### Buoc 7. Gan staff chi 1 dich vu

```http
PUT /api/admin/users/staff/:staffId/services
```

```json
{
  "serviceIds": [
    "service_1_id"
  ]
}
```

### Buoc 8. Login staff

```http
POST /api/auth/login
```

```json
{
  "username": "staff.q1",
  "password": "StaffQ1@123"
}
```

### Buoc 9. Tao 2 ticket cho 2 dich vu khac nhau

```http
POST /api/tickets
```

```json
{
  "serviceId": "service_1_id",
  "name": "Nguyen Van A",
  "phone": "0912345678",
  "counterId": "counter_id",
  "autoPrint": false
}
```

```json
{
  "serviceId": "service_2_id",
  "name": "Tran Van B",
  "phone": "0987654321",
  "counterId": "counter_id",
  "autoPrint": false
}
```

### Buoc 10. Staff goi so

```http
POST /api/tickets/call-next
Authorization: Bearer <staff_token>
```

```json
{
  "counterId": "counter_id"
}
```

Kiem tra:

- staff chi duoc goi ticket cua `service_1_id`
- ticket cua `service_2_id` se khong duoc lay

## 10. Cac case can test

### Case 1. Staff chua duoc cau hinh service rieng

Kiem tra:

- `serviceRestrictionConfigured = false`
- staff thay tat ca dich vu cua quay
- staff goi duoc tat ca ticket cua quay

### Case 2. Staff duoc gan mot phan dich vu

Kiem tra:

- `serviceRestrictionConfigured = true`
- `services` chi con cac dich vu da gan
- `call-next` chi lay ticket thuoc service duoc phep

### Case 3. Staff duoc gan mang rong

Request:

```json
{
  "serviceIds": []
}
```

Kiem tra:

- staff khong con dich vu nao de xu ly
- `GET /api/tickets/staff/display` co the tra loi loi quyen truy cap
- `POST /api/tickets/call-next` khong duoc xu ly

### Case 4. Gan sai service khong thuoc quay

Kiem tra:

- backend tra loi:

```text
Chỉ được gán các dịch vụ mà quầy của nhân viên đang phục vụ
```

### Case 5. Staff chua duoc gan quay ma da gan service

Kiem tra:

- backend tra loi:

```text
Nhân viên chưa được gán quầy nên chưa thể gán dịch vụ
```

## 11. Ghi chu cho frontend

- FE admin nen dung `availableServices` de render danh sach checkbox co the chon
- FE admin nen dung `assignedServices` de set trang thai checked hien tai
- FE staff nen uu tien dung `services` de render danh sach dich vu duoc phep xu ly
- Neu dung socket staff display, nen gui `staffId` thay vi chi gui `counterId`
- Khi `serviceRestrictionConfigured = false`, FE co the hien thi staff dang su dung quyen mac dinh theo quay
