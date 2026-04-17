# FE Voice Integration Guide

Tai lieu nay huong dan frontend tich hop voi tinh nang doc so bang giong noi da duoc xu ly o backend.

## 1. Ket luan nhanh

Frontend khong can tu phat giong noi.

Chi can:

- goi API `call-next` nhu hien tai
- tiep tuc nghe socket de cap nhat UI nhu binh thuong

Backend se tu dong:

- goi so
- phat socket
- doc loa tren may dang chay backend

## 2. Luong hoat dong

Flow dung hien tai:

```text
FE bam Next
-> FE goi POST /api/tickets/call-next
-> Backend chuyen ticket sang processing
-> Backend phat socket cap nhat UI
-> Backend tu doc: "Da goi so 1001 den QUAY 1"
-> FE nhan response va render giao dien
```

## 3. Frontend can lam gi

Frontend van giu nguyen luong hien tai:

### Goi API next

```http
POST /api/tickets/call-next
Authorization: Bearer <staff_token>
Content-Type: application/json
```

Body:

```json
{
  "counterId": "counter_id"
}
```

Response mau:

```json
{
  "success": true,
  "data": {
    "_id": "ticket_id",
    "number": 1,
    "formattedNumber": "1001",
    "displayNumber": "1001",
    "customerName": "Nguyen Van A",
    "phone": "0912345678",
    "status": "processing",
    "serviceName": "NOP DON"
  },
  "message": "Đã gọi số 1001 đến QUAY 1"
}
```

### Nghe socket nhu cu

Frontend van tiep tuc nghe cac event nhu:

- `ticket-called`
- `new-current-ticket`
- `staff-display-updated`
- `waiting-room-snapshot`
- `new-ticket`

TTS backend khong thay the phan socket/UI.

## 4. Frontend khong can lam gi

Frontend khong can:

- goi API rieng de bat voice
- emit socket rieng de yeu cau doc so
- tu dung Web Speech API de doc so
- tu generate audio file de phat
- connect them vao "voice service"

Noi cach khac:

- FE khong phai quan ly loa
- FE khong phai trigger TTS
- FE chi trigger `call-next`

## 5. Dieu can tranh

Neu frontend da tung co logic doc so bang browser, can tat logic do di de tranh doc trung.

Khong nen:

- vua de backend doc
- vua de frontend doc bang browser

Vi nhu vay se co 2 giong doc cung luc.

## 6. Loa phat o dau

Am thanh duoc phat o:

- may dang chay backend Node.js

Khong phai:

- may cua Postman
- trinh duyet FE
- TV display frontend

Vi vay neu frontend bam next ma khong nghe tieng, can kiem tra may dang chay backend co:

- loa hoac thiet bi audio
- Python va `pyttsx3`
- backend da bat `TTS_ENABLED=true`

## 7. Khi nao FE moi can lam them

Frontend chi can lam them neu muon co giao dien quan tri cho voice, vi du:

- nut `Test loa`
- bat/tat voice
- chon giong doc
- chon toc do doc
- hien thi trang thai TTS dang san sang hay khong

Nhung hien tai cac chuc nang do khong bat buoc de he thong doc so hoat dong.

## 8. Checklist cho FE

- tiep tuc goi `POST /api/tickets/call-next` nhu cu
- tiep tuc render UI theo response va socket nhu cu
- khong tu doc so bang browser nua
- hieu rang voice duoc phat o may backend, khong phai may FE

## 9. Tom tat

Frontend chi can bam `next`.

Neu `call-next` thanh cong:

- backend tu goi so
- backend tu phat loa
- frontend chi can cap nhat giao dien

