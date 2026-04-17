# Staff Service Strict Mode Guide

Tai lieu nay mo ta thay doi moi nhat cua backend: staff chi duoc thao tac voi cac service da duoc admin gan truc tiep. Backend khong con fallback sang toan bo service cua quay nua.

## 1. Thay doi backend

Truoc day:

- neu staff da duoc gan quay
- nhung chua duoc gan service rieng
- backend se cho staff thay va xu ly toan bo service cua quay

Hien tai:

- neu staff da duoc gan quay
- nhung chua duoc gan service rieng
- staff se khong thay du lieu thao tac
- staff se khong `call-next`
- staff se khong `call-by-id`
- staff se khong thay `recall-list`
- staff se khong vao duoc `staff/display`

Muc tieu:

- tranh truong hop admin quen gan service cho staff ma staff van goi duoc tat ca service cua quay

## 2. Rule moi

Mot staff chi duoc thao tac khi dong thoi dung ca 2 dieu kien:

1. staff da duoc gan `counterId`
2. staff da duoc gan it nhat 1 `serviceId` active trong pham vi quay do

Neu thieu 1 trong 2 dieu kien tren:

- backend se tu choi cac API staff lien quan

## 3. API nao bi anh huong

Nhung API nay se chay theo quyen service cua staff:

- `GET /api/tickets/my-counter`
- `GET /api/tickets/staff/display`
- `GET /api/tickets/recall-list`
- `POST /api/tickets/call-next`
- `POST /api/tickets/call-by-id`
- `POST /api/tickets/:id/recall`
- `PATCH /api/tickets/:id/cancel-recall`
- `PATCH /api/tickets/:id/complete`
- `PATCH /api/tickets/:id/skip`

## 4. Loi moi co the gap

Neu staff chua duoc gan service rieng, backend co the tra:

```json
{
  "success": false,
  "message": "Nhân viên chưa được gán dịch vụ nào tại quầy hiện tại"
}
```

Status:

```text
403
```

FE can xem day la loi phan quyen / cau hinh, khong phai loi he thong.

## 5. Dinh nghia ro tung ID de FE khong bi nham

### `staffId`

Y nghia:

- ID cua user co role `staff`

Nguon lay:

- `data.user.id` sau khi login staff
- `GET /api/admin/users/staff`
- `GET /api/admin/users/staff/:id`

Day la ID FE phai dung khi join socket staff display.

### `counterId`

Y nghia:

- ID cua quay

Nguon lay:

- `data.user.counterId` sau khi login staff
- API admin / counter APIs

Day la ID FE phai gui trong body `call-next`.

### `serviceId`

Y nghia:

- ID cua dich vu

Nguon lay:

- `GET /api/admin/users/staff/:id/services`
- `GET /api/tickets/staff/display`
- API services

### `ticketId`

Y nghia:

- ID cua ticket

Nguon lay:

- `waitingTickets`
- `recallTickets`
- response tao ticket

Day la ID FE phai gui trong body `call-by-id`.

## 6. FE can ket noi nhu the nao cho dung

### A. HTTP cho staff

Khi FE da co token staff:

- `GET /api/tickets/staff/display`
- `GET /api/tickets/recall-list`
- `GET /api/tickets/my-counter`

Frontend khong can gui `staffId` trong cac API nay.

Backend se tu lay staff tu token:

```text
Authorization: Bearer <staff_token>
```

### B. Socket cho staff display

Day la cho de nham nhat.

Neu muon nhan du lieu dung theo phan quyen service cua staff, FE phai join bang `staffId`.

Cach dung:

```js
socket.emit('join-staff-display', {
  staffId: 'STAFF_USER_ID'
});
```

Hoac:

```js
socket.emit('join-staff-display', {
  staffId: 'STAFF_USER_ID',
  counterId: 'COUNTER_ID'
});
```

### Khong nen dung cach cu neu can phan quyen staff-service

Khong nen dung:

```js
socket.emit('join-staff-display', {
  counterId: 'COUNTER_ID'
});
```

Hoac:

```js
socket.emit('join-counter', 'COUNTER_ID');
```

Vi 2 cach tren la room theo quay, co the dan den snapshot theo toan bo du lieu cua quay, khong phai snapshot rieng cua staff.

## 7. FE goi API nao thi gui ID gi

### `POST /api/tickets/call-next`

Body:

```json
{
  "counterId": "COUNTER_ID"
}
```

Khong gui `staffId`.

Backend tu xac dinh staff qua token.

### `POST /api/tickets/call-by-id`

Body:

```json
{
  "ticketId": "TICKET_ID"
}
```

Khong gui `staffId`.

Backend tu xac dinh staff qua token.

### `GET /api/tickets/staff/display`

Khong gui body.

Chi can:

```text
Authorization: Bearer <staff_token>
```

## 8. Flow dung cho frontend

Frontend staff nen lam theo thu tu nay:

1. Staff login
2. Lay:
   - `staffId = data.user.id`
   - `counterId = data.user.counterId`
   - `token`
3. Goi `GET /api/tickets/staff/display`
4. Join socket:

```js
socket.emit('join-staff-display', {
  staffId,
  counterId
});
```

5. Khi bam next:

```js
await api.post('/api/tickets/call-next', {
  counterId
});
```

6. Khi bam goi 1 ticket cu the:

```js
await api.post('/api/tickets/call-by-id', {
  ticketId
});
```

## 9. Cach FE xu ly loi

Neu backend tra:

```text
403 - Nhân viên chưa được gán dịch vụ nào tại quầy hiện tại
```

Frontend nen hien thi thong diep ro rang:

```text
Tai khoan chua duoc admin gan dich vu xu ly. Vui long lien he quan tri vien.
```

Neu backend tra:

```text
403 - Nhân viên không được phép gọi ticket thuộc dịch vụ này
```

Frontend nen hien thi:

```text
Ban khong co quyen xu ly ticket nay.
```

## 10. Checklist cho FE

- dung `staffId` de join socket staff display
- dung `counterId` cho `call-next`
- dung `ticketId` cho `call-by-id`
- khong join room staff chi bang `counterId` neu muon phan quyen dung theo staff
- xu ly `403` nhu mot loi phan quyen / cau hinh

## 11. Tom tat

Sau thay doi nay:

- staff chua duoc gan service rieng se khong thay gi va khong goi duoc so
- FE phai dung `staffId` khi join socket staff display
- `counterId` va `staffId` la 2 ID khac nhau, khong duoc dung thay nhau
- backend la noi quyet dinh quyen staff-service, FE chi can gui dung token va dung ID

