# Huong Dan FE: Goi Lai Cua Staff Va Danh Sach Ve Bo Qua

Tai lieu nay tong hop dung contract backend hien tai de FE trien khai:

- nut `Goi lai` cho staff
- man hinh list cac ve da `bo qua` (dua vao recall list)

## 1) Tong quan nghiep vu

Trong he thong nay, "bo qua" khong co nghia la ket thuc ticket ngay.

Khi staff bam bo qua:

- ticket tu `processing` ve `waiting`
- danh dau `isRecall = true`
- gan `recallCounterId = quay hien tai`
- luu thoi diem `recalledAt`

=> Ticket se vao "danh sach can goi lai" cua chinh quay do.

Khi staff bam goi lai:

- FE goi API theo `ticketId`
- BE chuyen ticket lai sang `processing`
- xoa trang thai recall (`isRecall = false`, `recalledAt = null`, `recallCounterId = null`)
- BE phat socket update va TTS nhu luong goi binh thuong

## 2) Endpoint FE can dung

Tat ca endpoint duoi day deu yeu cau:

- `Authorization: Bearer <staff_token>`
- user role staff
- staff da duoc gan quay (`counterId`)

### 2.1 Lay danh sach ve bo qua (recall list)

```http
GET /api/tickets/recall-list
```

Muc dich:

- Render list ticket bo qua de staff chon goi lai

Response:

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "6800f94f6a3b0b7f6a1f0001",
      "number": 1,
      "formattedNumber": "1001",
      "displayNumber": "1001",
      "customerName": "Nguyen Van A",
      "phone": "0912345678",
      "serviceName": "Nop don",
      "recalledAt": "2026-04-17T09:00:00.000Z",
      "waitingMinutes": 12
    }
  ]
}
```

### 2.2 Bo qua ticket dang xu ly (dua vao recall list)

```http
PATCH /api/tickets/:id/skip
Content-Type: application/json
```

Body:

```json
{
  "reason": "Khach tam thoi vang mat"
}
```

`reason` la optional, toi da 500 ky tu.

Response:

```json
{
  "success": true,
  "data": {
    "_id": "6800f94f6a3b0b7f6a1f0001",
    "status": "waiting",
    "isRecall": true,
    "recalledAt": "2026-04-17T09:00:00.000Z",
    "recallCounterId": "6800f8ec6a3b0b7f6a1e9999",
    "skipCount": 1,
    "formattedNumber": "1001",
    "displayNumber": "1001"
  },
  "message": "Da chuyen so 1001 vao danh sach can goi lai"
}
```

### 2.3 Goi lai ticket trong recall list

```http
POST /api/tickets/:id/recall
```

Response:

```json
{
  "success": true,
  "data": {
    "_id": "6800f94f6a3b0b7f6a1f0001",
    "status": "processing",
    "isRecall": false,
    "recalledAt": null,
    "recallCounterId": null,
    "counterId": "6800f8ec6a3b0b7f6a1e9999",
    "formattedNumber": "1001",
    "displayNumber": "1001"
  },
  "message": "Da goi lai so 1001"
}
```

### 2.4 Lua chon khac de FE bam "Goi": call-by-id

Neu FE muon dung 1 API duy nhat cho nut "Goi" (ca waiting list va recall list), co the dung:

```http
POST /api/tickets/call-by-id
Content-Type: application/json
```

Body:

```json
{
  "ticketId": "6800f94f6a3b0b7f6a1f0001"
}
```

API nay chap nhan:

- ticket waiting binh thuong cua quay
- ticket dang o recall list cua quay

Va BE tu dong chuyen sang `processing` neu hop le.

## 3) Cac field FE can biet cho man hinh danh sach bo qua

Du lieu danh sach bo qua (`GET /api/tickets/recall-list`) la mang object voi cac field:

- `_id` (string): ticket id, dung de goi lai
- `number` (number): so thu tu thuang trong quay
- `formattedNumber` (string): so hien thi da format, VD `1001`
- `displayNumber` (string): hien tai trung voi `formattedNumber`, FE co the hien thi field nay
- `customerName` (string): ten khach
- `phone` (string): so dien thoai
- `serviceName` (string): ten dich vu
- `recalledAt` (ISO string): thoi diem bi bo qua/chuyen vao recall list
- `waitingMinutes` (number): so phut da cho tu luc vao recall list

Khuyen nghi FE:

- dung `_id` lam key row
- hien thi `displayNumber` lam ma ve
- sort UI theo thu tu BE tra ve (BE da sort theo `recalledAt`, `createdAt`, `number`)

## 4) Cac field status FE nen map

Gia tri trang thai ticket trong he thong:

- `waiting`
- `processing`
- `completed`
- `skipped`

Luu y quan trong:

- Ve "bo qua de goi lai" van co `status = waiting` + `isRecall = true`
- `status = skipped` duoc dung cho truong hop huy recall (`cancel-recall`), khong nam trong recall list nua

## 5) Luong UI de xay man hinh staff

Luong de xuat:

1. Mo man hinh staff:
   - goi `GET /api/tickets/staff/display`
   - hoac goi rieng `GET /api/tickets/recall-list` de lay danh sach bo qua
2. Khi dang xu ly ticket ma bam "Bo qua":
   - goi `PATCH /api/tickets/:id/skip`
   - refresh recall list
3. Khi staff bam "Goi" tren item recall:
   - uu tien goi `POST /api/tickets/:id/recall`
   - hoac dung `POST /api/tickets/call-by-id` voi `ticketId`
4. Sau khi goi thanh cong:
   - update current ticket
   - remove item khoi recall list

## 6) Socket events FE can nghe (de realtime)

Trong luong recall/skip, BE co phat cac event:

- `staff-display-updated` (quan trong nhat cho man staff)
- `ticket-skipped`
- `ticket-recalled`
- `ticket-called`
- `new-current-ticket`

Khuyen nghi FE:

- xem `staff-display-updated` la nguon du lieu uu tien de re-fetch/re-render
- cac event con lai dung de animate/noti neu can

## 7) Loi thuong gap FE se nhan

### 400 - Tai khoan chua duoc gan quay

```json
{
  "success": false,
  "message": "Tai khoan chua duoc gan quay"
}
```

### 403 - Ticket khong thuoc quay hoac khong dung quyen dich vu

```json
{
  "success": false,
  "message": "Ticket khong thuoc danh sach xu ly cua quay nay"
}
```

hoac

```json
{
  "success": false,
  "message": "Nhan vien khong duoc phep goi ticket thuoc dich vu nay"
}
```

### 404 - Khong tim thay ticket trong recall list

```json
{
  "success": false,
  "message": "Khong tim thay ticket trong danh sach can goi lai"
}
```

## 8) De xuat contract FE cho item recall

FE co the dung type sau:

```ts
type RecallTicketItem = {
  _id: string;
  number: number;
  formattedNumber: string;
  displayNumber: string;
  customerName: string;
  phone: string;
  serviceName: string;
  recalledAt: string;
  waitingMinutes: number;
};
```

## 9) Checklist implement nhanh cho FE

- [ ] Tao tab/list "Ve bo qua" tu `GET /api/tickets/recall-list`
- [ ] Button "Goi" tren moi row gui `POST /api/tickets/:id/recall` (hoac `call-by-id`)
- [ ] Button "Bo qua" tren current ticket gui `PATCH /api/tickets/:id/skip`
- [ ] Hien thi `displayNumber`, `customerName`, `serviceName`, `waitingMinutes`
- [ ] Bat socket `staff-display-updated` de dong bo realtime
- [ ] Hien thi toast theo `message` tu backend khi API thanh cong/that bai

