# 🔀 Multi-Processing Per Counter — Hướng dẫn tích hợp Frontend

> **Ngày cập nhật:** 17/04/2026  
> **Backend version:** court-ticket-backend (latest)  
> **Tác động:** Nhiều nhân viên cùng quầy có thể xử lý ticket song song

---

## 1. Tổng quan thay đổi

### Trước đây (Single Processing)

```
Quầy 1 ──► chỉ 1 ticket PROCESSING tại 1 thời điểm
         ──► Staff B muốn gọi số ──► bị chặn "Quầy đang xử lý ticket khác"
```

### Bây giờ (Multi Processing)

```
Quầy 1 ──► Staff A đang xử lý ND-2031
         ──► Staff B gọi thêm RT-2032 ──► ✅ OK, cả 2 cùng processing
         ──► Mỗi staff chỉ thấy ticket của mình
```

> [!IMPORTANT]
> **Quy tắc cốt lõi:** Mỗi staff chỉ thấy và quản lý ticket mà chính mình đang xử lý. Không còn khái niệm "ticket duy nhất của quầy".

---

## 2. Những gì KHÔNG đổi (backward compatible)

| Mục | Chi tiết |
|-----|---------|
| **API endpoints** | Tất cả URL, method, request body giữ nguyên 100% |
| **Authentication** | Không đổi — vẫn dùng JWT + middleware `staffOnly`, `counterStaff` |
| **Ticket status flow** | `waiting` → `processing` → `completed` / `skipped` |
| **`currentTicket`** | Vẫn trả về trong response — **nhưng ý nghĩa thay đổi** (xem bên dưới) |
| **Socket event names** | Tất cả event name giữ nguyên |

---

## 3. Những gì THAY ĐỔI — Chi tiết theo API

### 3.1. `GET /api/tickets/staff/display` — Staff Display

> **Đây là API chính mà FE staff dùng để render màn hình làm việc.**

#### Response shape (không đổi cấu trúc, đổi logic)

```json
{
  "success": true,
  "data": {
    "counter": {
      "id": "...",
      "name": "Quầy 1",
      "number": 1,
      "isActive": true,
      "processedCount": 15
    },
    "services": [...],
    "availableServices": [...],
    "assignedServices": [...],
    "serviceRestrictionConfigured": true,

    "currentTicket": { ... } | null,

    "waitingTickets": [...],
    "recallTickets": [...],
    "totalWaiting": 5,

    "staffName": "Nguyễn Văn A",
    "staffId": "664abc..."
  }
}
```

> [!WARNING]
> ### ⚠️ `currentTicket` giờ là ticket của CHÍNH staff đang đăng nhập
> 
> **Trước:** `currentTicket` = ticket duy nhất đang processing của cả quầy  
> **Sau:** `currentTicket` = ticket mà **staff hiện tại** (theo JWT) đang xử lý
> 
> - Staff A gọi `GET /staff/display` → thấy ticket của Staff A
> - Staff B gọi `GET /staff/display` → thấy ticket của Staff B
> - Nếu staff chưa gọi ticket nào → `currentTicket = null`

**FE không cần sửa gì** nếu đã dùng `currentTicket` để render. Logic tự đúng vì BE đã filter theo `staffId`.

---

### 3.2. `GET /api/tickets/my-counter` — My Counter Info

#### Response shape (không đổi)

```json
{
  "success": true,
  "data": {
    "counter": { "id": "...", "name": "Quầy 1", ... },
    "services": [...],
    "currentTicket": { ... } | null,
    "staffName": "...",
    "staffId": "..."
  }
}
```

> [!NOTE]
> `currentTicket` ở đây cũng đã được filter theo `staffId` — mỗi staff chỉ thấy ticket của mình.

---

### 3.3. `GET /api/tickets/counters/:counterId/display` — Counter Display (Public/TV)

> **Dùng cho màn hình TV hiển thị công khai / waiting room display**

#### 🆕 Response có thêm field `processingTickets`

```json
{
  "success": true,
  "data": {
    "counter": { ... },
    "services": [...],

    "currentTicket": { ... } | null,
    "processingTickets": [
      {
        "id": "ticket_id_1",
        "_id": "ticket_id_1",
        "number": 31,
        "ticketNumber": "031",
        "formattedNumber": "ND031",
        "displayNumber": "ND031",
        "customerName": "Nguyễn Văn A",
        "phone": "0912345678",
        "status": "processing",
        "serviceName": "Nộp đơn",
        "createdAt": "2026-04-17T03:00:00Z"
      },
      {
        "id": "ticket_id_2",
        "_id": "ticket_id_2",
        "number": 32,
        "ticketNumber": "032",
        "formattedNumber": "RT032",
        "displayNumber": "RT032",
        "customerName": "Trần Thị B",
        "phone": "0987654321",
        "status": "processing",
        "serviceName": "Nhận kết quả",
        "createdAt": "2026-04-17T03:05:00Z"
      }
    ],

    "waitingTickets": [...],
    "recallTickets": [],
    "totalWaiting": 8
  }
}
```

> [!IMPORTANT]
> ### Quy tắc sử dụng `processingTickets` vs `currentTicket`
> 
> | Field | Ý nghĩa | Khi nào dùng |
> |-------|---------|-------------|
> | `currentTicket` | Phần tử đầu tiên của `processingTickets` (hoặc `null`) | **Backward compatible** — FE cũ vẫn chạy đúng |
> | `processingTickets` | **Mảng đầy đủ** tất cả ticket đang processing tại quầy | **FE mới** nên dùng field này để hiển thị trên TV |
> 
> **Khuyến nghị:** Dùng `processingTickets` thay vì `currentTicket` cho counter display.

---

### 3.4. `POST /api/tickets/call-next` — Gọi số tiếp theo

#### Request (không đổi)
```json
{
  "counterId": "counter_object_id"
}
```

#### Thay đổi hành vi

| Trước | Sau |
|-------|-----|
| Nếu quầy đang có ticket processing → **trả lỗi 400** | Chỉ kiểm tra quầy `isActive` → **cho phép gọi thêm** |
| Staff bị chặn cho đến khi complete/skip ticket hiện tại | Staff gọi thoải mái, ticket mới gán `staffId` của staff gọi |

> [!NOTE]
> FE không cần sửa request. Chỉ cần **bỏ logic disable nút "Gọi số"** khi đang có `currentTicket` (nếu có).

---

### 3.5. `POST /api/tickets/call-by-id` — Gọi ticket cụ thể

#### Request (không đổi)
```json
{
  "ticketId": "ticket_object_id"
}
```

Hành vi tương tự `call-next` — không còn chặn khi quầy đang xử lý ticket khác.

---

### 3.6. `PATCH /api/tickets/:id/complete` — Hoàn thành ticket

#### Thay đổi hành vi

| Trước | Sau |
|-------|-----|
| Xoá cứng `counter.currentTicketId = null` | Backend **refresh** `currentTicketId` từ các ticket processing còn lại |

**Ý nghĩa:** Staff A complete ticket → ticket của Staff B vẫn hiển thị bình thường, không bị mất.

> [!TIP]
> FE không cần lo xử lý gì thêm. Sau khi complete, gọi lại `GET /staff/display` hoặc lắng nghe socket `staff-display-updated` để refresh UI.

---

### 3.7. `PATCH /api/tickets/:id/skip` — Bỏ qua ticket

Hành vi tương tự `complete` — backend refresh `currentTicketId` thay vì xoá cứng.

---

## 4. Socket.IO Events — Không đổi tên, đổi data context

### 4.1. Room & Channel

| Room/Channel | Mô tả |
|-------------|--------|
| `waiting-room` | Màn hình chờ công khai |
| `counter-{counterId}` | Tất cả staff trong quầy |
| `staff-display-{staffId}` | **Riêng từng staff** — data đã filter theo staffId |

### 4.2. Event: `staff-display-updated`

```javascript
// Lắng nghe trên room `staff-display-{staffId}`
socket.on('staff-display-updated', (payload) => {
  // payload.data = kết quả getStaffDisplay(counterId, staffId)
  // → currentTicket đã filter theo staffId
  // → Chỉ cần setState lại là đúng

  const { currentTicket, waitingTickets, recallTickets } = payload.data;
  setCurrentTicket(currentTicket);       // ticket CỦA MÌNH
  setWaitingTickets(waitingTickets);
  setRecallTickets(recallTickets);
});
```

> [!IMPORTANT]
> **FE PHẢI join đúng room `staff-display-{staffId}`** (không chỉ `counter-{counterId}`) để nhận data đã filter theo staff.

### 4.3. Event: `ticket-called` / `new-current-ticket`

```javascript
// Trên room counter-{counterId} — tất cả staff đều nhận
socket.on('ticket-called', (data) => {
  // data.ticket = ticket vừa được gọi
  // data.counterName = tên quầy
  // → Dùng để phát âm thanh, hiển thị thông báo
});

socket.on('new-current-ticket', (data) => {
  // data.currentTicket = ticket mới
  // ⚠️ Event này broadcast cho cả quầy
  // → Nên dùng staff-display-updated thay vì event này để render
});
```

### 4.4. Event: `ticket-completed` / `ticket-skipped`

```javascript
socket.on('ticket-completed', (data) => {
  // data.ticketId — ticket vừa hoàn thành
  // Sau event này, staff-display-updated sẽ fire ngay
  // → FE chỉ cần listen staff-display-updated để refresh
});
```

---

## 5. Migration Guide — FE cần làm gì?

### ✅ Bắt buộc (Breaking nếu không làm)

```diff
  Không có breaking change bắt buộc!
  BE đã giữ backward compatible 100%.
  FE cũ vẫn chạy đúng — chỉ hiển thị 1 ticket thay vì nhiều.
```

### 🔧 Khuyến nghị (Nâng cấp trải nghiệm)

#### 1. Bỏ disable nút "Gọi số" khi đang xử lý ticket

```diff
- // Cũ: disable khi có currentTicket
- <button disabled={!!currentTicket} onClick={callNext}>
-   Gọi số tiếp theo
- </button>

+ // Mới: luôn enable (BE tự quản lý)
+ <button onClick={callNext}>
+   Gọi số tiếp theo
+ </button>
```

#### 2. Counter Display (TV) — Hiển thị nhiều ticket processing

```diff
  // Cũ: chỉ hiển thị 1 ticket
- {data.currentTicket && (
-   <CurrentTicketCard ticket={data.currentTicket} />
- )}

  // Mới: hiển thị tất cả ticket đang xử lý
+ {data.processingTickets?.length > 0 ? (
+   data.processingTickets.map(ticket => (
+     <CurrentTicketCard key={ticket.id} ticket={ticket} />
+   ))
+ ) : (
+   <EmptyState message="Chưa có ticket đang xử lý" />
+ )}
```

#### 3. Join đúng socket room cho staff

```javascript
// Đảm bảo join cả 2 room
socket.emit('join', `counter-${counterId}`);
socket.emit('join', `staff-display-${staffId}`);  // ← quan trọng!
```

---

## 6. Ticket Object Shape (Reference)

Tất cả ticket trong response đều có cùng shape:

```typescript
interface TicketPresentation {
  id: string;           // ObjectId
  _id: string;          // ObjectId (duplicate cho tiện)
  number: number;       // Số thứ tự raw (VD: 31)
  ticketNumber: string; // Số đã format (VD: "031")
  formattedNumber: string; // Số hiển thị đầy đủ (VD: "ND031")
  displayNumber: string;   // Alias của formattedNumber
  customerName: string;
  phone: string;
  status: 'waiting' | 'processing' | 'completed' | 'skipped';
  serviceName: string;
  createdAt: string;    // ISO 8601
}
```

---

## 7. Test Scenarios cho FE

### Scenario 1: Hai staff cùng quầy gọi số song song

```
1. Staff A đăng nhập → GET /staff/display → currentTicket = null
2. Staff A gọi POST /call-next → nhận ticket ND-031
3. Staff A gọi GET /staff/display → currentTicket = ND-031 ✅
4. Staff B đăng nhập (cùng quầy) → GET /staff/display → currentTicket = null ✅
5. Staff B gọi POST /call-next → nhận ticket RT-032 (KHÔNG bị chặn)
6. Staff B gọi GET /staff/display → currentTicket = RT-032 ✅
7. Staff A gọi GET /staff/display → currentTicket = ND-031 ✅ (không bị ảnh hưởng)
```

### Scenario 2: Staff A complete, Staff B không ảnh hưởng

```
1. Staff A: PATCH /:id/complete → ND-031 hoàn thành
2. Staff A: GET /staff/display → currentTicket = null ✅
3. Staff B: GET /staff/display → currentTicket = RT-032 ✅ (vẫn còn)
```

### Scenario 3: Counter Display (TV) hiển thị tất cả

```
1. GET /counters/:id/display
2. Response:
   - currentTicket = ND-031 (phần tử đầu, backward compat)
   - processingTickets = [ND-031, RT-032] (đầy đủ)
```

### Scenario 4: Socket realtime

```
1. Staff A gọi số → Staff B nhận event staff-display-updated
   → B check currentTicket → vẫn là ticket của B (không bị đè)
2. Staff A complete → Staff B nhận event staff-display-updated
   → B check currentTicket → vẫn là ticket của B ✅
```

---

## 8. FAQ

### Q: FE cũ có bị vỡ không?
**A:** Không. `currentTicket` vẫn trả về, chỉ là giờ nó filter theo staff thay vì lấy từ counter. Nếu FE cũ chỉ hiển thị `currentTicket`, nó vẫn đúng cho staff đang đăng nhập.

### Q: Nếu staff chưa gọi ticket nào thì `currentTicket` là gì?
**A:** `null` — giống như trước.

### Q: `processingTickets` có thể rỗng không?
**A:** Có. Khi không có ticket nào đang processing tại quầy → `processingTickets = []` và `currentTicket = null`.

### Q: Nút "Gọi số" có cần gửi `staffId` không?
**A:** Không. Backend tự lấy `staffId` từ JWT token (`req.user._id`). FE chỉ cần gửi `counterId`.

### Q: Một staff có thể xử lý nhiều ticket cùng lúc không?
**A:** Về mặt BE thì có thể (không chặn). Tuy nhiên `getStaffDisplay` chỉ trả `currentTicket` là ticket processing **mới nhất** (sort `processingAt: -1`). Nếu muốn chặn 1 staff chỉ xử lý 1 ticket, FE có thể tự disable nút khi `currentTicket !== null`.

---

## 9. Tóm tắt thay đổi cần làm ở FE

| Ưu tiên | Việc cần làm | Độ phức tạp |
|---------|-------------|-------------|
| ⭐ Cao | Join room `staff-display-{staffId}` trên socket | Thấp |
| ⭐ Cao | Bỏ disable nút "Gọi số" khi đang có `currentTicket` | Thấp |
| 🔶 Trung bình | Counter Display (TV): render `processingTickets` thay vì chỉ `currentTicket` | Trung bình |
| 🔷 Thấp | Thêm UI badge/count hiển thị "đang xử lý X ticket" trên counter display | Thấp |
