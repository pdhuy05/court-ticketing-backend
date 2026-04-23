# Huong Dan FE: Tra Ticket Dang Xu Ly Ve Hang Cho

Tai lieu nay huong dan FE tich hop tinh nang:

- staff dang xu ly 1 ticket
- staff bam nham hoac muon dua lai ticket vao hang cho
- ticket duoc tra tu `processing` ve `waiting`

Tinh nang nay khac voi:

- `skip`: dua ve vao recall list
- `recall-processing`: chi phat lai ticket dang xu ly

## 1) Muc tieu nghiep vu

Dung khi staff muon:

- tra ticket dang xu ly ve hang cho
- giai phong quay hien tai
- dua ticket len dau hoac xuong cuoi hang cho

Sau khi backend xu ly:

- ticket doi `status` tu `processing` -> `waiting`
- ticket khong con gan voi quay/staff dang xu ly
- quay duoc giai phong
- man hinh waiting room va man hinh staff nhan realtime update

## 2) API FE can goi

```http
PATCH /api/tickets/:id/back
Authorization: Bearer <staff_token>
Content-Type: application/json
```

Body la optional:

```json
{
  "position": "front"
}
```

Gia tri hop le:

- `front`: dua ticket len dau hang cho
- `back`: dua ticket xuong cuoi hang cho

Neu khong gui body hoac khong gui `position`:

- backend mac dinh `position = "front"`

## 3) Response thanh cong

Response format giong cac API ticket khac:

```json
{
  "success": true,
  "data": {
    "_id": "6808d0f5d8a8f2c412340001",
    "number": 12,
    "ticketNumber": "012",
    "formattedNumber": "1012",
    "displayNumber": "1012",
    "status": "waiting",
    "counterId": null,
    "staffId": null,
    "serviceCounterId": null,
    "processingAt": null,
    "isRecall": false,
    "recalledAt": null,
    "recallCounterId": null
  },
  "message": "Đã trả số 1012 về hàng chờ"
}
```

FE can quan tam:

- `data.status = waiting`
- `data.counterId = null`
- `data.staffId = null`
- `data.formattedNumber`
- `message`

## 4) Giai thich `position`

### 4.1 Dua len dau hang cho

Request:

```http
PATCH /api/tickets/6808d0f5d8a8f2c412340001/back
```

Body:

```json
{
  "position": "front"
}
```

Tac dung:

- ticket duoc uu tien xu ly lai som nhat
- khi staff bam `call-next`, ticket nay se co co hoi duoc lay truoc

### 4.2 Dua xuong cuoi hang cho

Request:

```http
PATCH /api/tickets/6808d0f5d8a8f2c412340001/back
```

Body:

```json
{
  "position": "back"
}
```

Tac dung:

- ticket duoc dua ve cuoi danh sach cho
- phu hop khi staff muon moi khach quay lai sau

## 5) Dieu kien de backend chap nhan

Backend chi cho phep khi:

- ticket ton tai
- ticket dang o `processing`
- ticket thuoc chinh quay cua staff dang dang nhap
- staff co quyen xu ly dich vu cua ticket
- quay dang hoat dong

Neu khong dung dieu kien, backend tra loi nhu cac API ticket khac:

```json
{
  "success": false,
  "message": "..."
}
```

## 6) Loi FE co the gap

Mot so message loi thuong gap:

- `Không tìm thấy ticket`
- `Ticket đang ở trạng thái completed, không thể trả về hàng chờ. Chỉ áp dụng với ticket đang xử lý`
- `Bạn chỉ được phép trả ticket của quầy được gán về hàng chờ`
- `Nhân viên không có quyền xử lý dịch vụ ...`
- `Dịch vụ ... đã bị vô hiệu hóa`
- `Quầy không tồn tại hoặc không hoạt động`

Khuyen nghi FE:

- hien thi truc tiep `message` tu backend
- disable nut neu current ticket khong phai `processing`

## 7) Realtime socket FE can nghe

Khi tra ticket ve hang cho, backend emit 2 event moi:

### 7.1 Waiting room

Event:

```text
ticket-back-to-waiting
```

Payload:

```json
{
  "ticketId": "6808d0f5d8a8f2c412340001",
  "number": 12,
  "formattedNumber": "1012",
  "displayNumber": "1012",
  "customerName": "Nguyen Van A",
  "serviceName": "Nop don",
  "counterId": "6808d0f5d8a8f2c412349999",
  "counterName": "Quay so 1",
  "position": "front",
  "returnedAt": "2026-04-23T08:30:00.000Z"
}
```

Y nghia:

- waiting room co 1 ticket duoc dua lai vao danh sach cho

### 7.2 Counter room

Event:

```text
ticket-finished
```

Payload:

```json
{
  "ticketId": "6808d0f5d8a8f2c412340001",
  "formattedNumber": "1012",
  "reason": "back-to-waiting"
}
```

Y nghia:

- quay hien tai vua giai phong xong current ticket

### 7.3 Event da co san van nen nghe

Ngoai 2 event tren, backend van tiep tuc emit:

- `staff-display-updated`
- dashboard realtime update noi bo

Khuyen nghi FE:

- dung `staff-display-updated` lam nguon cap nhat man hinh staff chinh
- dung `ticket-back-to-waiting` de hien thi toast/notification neu can

## 8) Luong UI de xuat cho FE

### Cach don gian nhat

1. Staff dang co `currentTicket`
2. Bam nut `Tra ve hang cho`
3. Mo popup hoac action sheet cho chon:
   - `Tra len dau hang`
   - `Tra xuong cuoi hang`
4. Goi API `PATCH /api/tickets/:id/back`
5. Thanh cong:
   - dong popup
   - clear `currentTicket`
   - refresh waiting list neu FE dang giu local state rieng
   - hoac chi can cho `staff-display-updated`

### UX goi y

- Button label:
  - `Tra ve hang cho`
- Option:
  - `Len dau hang`
  - `Xuong cuoi hang`
- Confirm text:
  - `Ban co chac muon tra so 1012 ve hang cho khong?`

## 9) Vi du goi API

### Dua len dau hang

```js
await api.patch(`/api/tickets/${ticketId}/back`, {
  position: 'front'
});
```

### Dua xuong cuoi hang

```js
await api.patch(`/api/tickets/${ticketId}/back`, {
  position: 'back'
});
```

## 10) Phan biet voi cac tinh nang khac

### `PATCH /api/tickets/:id/back`

- Ap dung cho ticket dang `processing`
- Dua ticket ve `waiting`
- Khong vao recall list
- Co chon vi tri `front/back`

### `PATCH /api/tickets/:id/skip`

- Ap dung cho ticket dang `processing`
- Dua ticket ve `waiting`
- Co danh dau `isRecall = true`
- Vao recall list

### `POST /api/tickets/:id/recall-processing`

- Ticket van giu `processing`
- Chi phat lai thong bao/man hinh
- Khong doi vi tri ticket

## 11) Checklist FE test nhanh

- Ticket dang `processing` -> back `front` thanh cong
- Ticket dang `processing` -> back `back` thanh cong
- Sau khi back, quay khong con current ticket
- Waiting room nhan event `ticket-back-to-waiting`
- Counter room nhan event `ticket-finished` voi `reason = back-to-waiting`
- Staff display duoc cap nhat qua `staff-display-updated`
- Ticket khong vao recall list sau khi back
- Goi back voi ticket khong phai `processing` -> hien thi loi backend
