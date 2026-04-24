# Shift Management FE Guide

Tai lieu nay huong dan frontend tich hop tinh nang quan ly ca lam viec cho staff va admin.

Muc tieu:

- FE co the lam du man hinh staff shift va admin shift settings
- FE biet ro endpoint nao dung cho ai
- FE xu ly dung cac trang thai `onDuty` va `offDuty`
- FE tranh bi sai flow khi staff chua mo ca nhung van bam thao tac ticket

## 1. Tong quan nghiep vu

Backend da them tinh nang shift management voi 2 nhom chuc nang:

- Staff tu mo ca va dong ca
- Admin xem trang thai ca, xem lich su ca, force mo/dong ca, cau hinh auto start

Rule quan trong:

1. Staff co the co 2 trang thai:
   - `onDuty = true`: dang trong ca
   - `onDuty = false`: da ket thuc ca
2. Neu staff `offDuty`, backend se chan cac API thao tac ticket nhu:
   - `call-next`
   - `call-by-id`
   - `recall`
   - `complete`
   - `skip`
   - `back-to-waiting`
3. Khi tao ticket moi cho mot service, backend chi phan bo vao quay co staff dang `onDuty` cho service do
4. Neu khong co staff nao dang `onDuty` cho service, backend se bao service tam ngung

## 2. Field moi FE se gap

Backend da bo sung tren user cac field:

- `onDuty: boolean`
- `lastShiftStart: string | null`
- `lastShiftEnd: string | null`
- `shiftHistory: ShiftLog[]`

Kieu `ShiftLog`:

```ts
type ShiftLog = {
  action: 'start' | 'end';
  timestamp: string;
  reason: string;
  waitingTicketsCount: number;
};
```

## 3. Staff APIs

Tat ca API staff deu can:

```text
Authorization: Bearer <staff_token>
```

### 3.1 Xem trang thai ca hien tai

`GET /api/shift/status`

Response:

```json
{
  "success": true,
  "data": {
    "staffId": "662f...",
    "fullName": "Nguyen Van A",
    "username": "staff01",
    "onDuty": true,
    "lastShiftStart": "2026-04-24T00:35:00.000Z",
    "lastShiftEnd": "2026-04-23T10:10:00.000Z"
  }
}
```

FE dung API nay de:

- render nut `Bat dau ca` hoac `Ket thuc ca`
- hien badge `Dang trong ca` / `Ngoai ca`
- hien thong tin lan mo ca gan nhat va lan dong ca gan nhat

### 3.2 Bat dau ca

`POST /api/shift/start`

Body:

```json
{}
```

Response thanh cong:

```json
{
  "success": true,
  "data": {
    "onDuty": true,
    "lastShiftStart": "2026-04-24T00:35:00.000Z",
    "message": "Bắt đầu ca làm việc thành công"
  },
  "message": "Bắt đầu ca làm việc thành công"
}
```

Loi co the gap:

- `403`: `Tính năng tự quản lý ca đang bị tắt bởi admin`
- `400`: `Bạn đang trong ca làm việc, không thể bắt đầu ca mới`
- `404`: `Không tìm thấy nhân viên`

FE nen:

- disable nut khi request dang pending
- sau khi thanh cong, refetch `GET /api/shift/status`
- sau khi thanh cong, refetch man hinh staff ticket neu dang mo

### 3.3 Ket thuc ca

`POST /api/shift/end`

Body:

```json
{
  "reason": "Ra ngoai trong 30 phut"
}
```

`reason` la optional, toi da 500 ky tu.

Response thanh cong:

```json
{
  "success": true,
  "data": {
    "onDuty": false,
    "lastShiftEnd": "2026-04-24T04:50:00.000Z",
    "waitingTicketsCount": 3,
    "message": "Kết thúc ca làm việc thành công"
  },
  "message": "Kết thúc ca làm việc thành công"
}
```

Y nghia `waitingTicketsCount`:

- so ticket con lien quan den quay cua staff tai thoi diem dong ca
- FE co the dung de hien modal xac nhan sau khi dong ca thanh cong

Loi co the gap:

- `403`: `Tính năng tự quản lý ca đang bị tắt bởi admin`
- `400`: `Bạn không đang trong ca làm việc`

FE goi y UX:

1. Bam nut `Ket thuc ca`
2. Mo modal nhap ly do optional
3. Goi API
4. Neu thanh cong:
   - hien toast thanh cong
   - cap nhat trang thai thanh `offDuty`
   - khoa cac nut thao tac ticket

### 3.4 Xem lich su ca cua chinh minh

`GET /api/shift/history?limit=50`

Response:

```json
{
  "success": true,
  "data": {
    "staffId": "662f...",
    "fullName": "Nguyen Van A",
    "username": "staff01",
    "onDuty": false,
    "lastShiftStart": "2026-04-24T00:35:00.000Z",
    "lastShiftEnd": "2026-04-24T04:50:00.000Z",
    "history": [
      {
        "action": "end",
        "timestamp": "2026-04-24T04:50:00.000Z",
        "reason": "Ra ngoai trong 30 phut",
        "waitingTicketsCount": 3
      },
      {
        "action": "start",
        "timestamp": "2026-04-24T00:35:00.000Z",
        "reason": "",
        "waitingTicketsCount": 0
      }
    ]
  }
}
```

FE nen render:

- timeline hoac table lich su
- cot `Hanh dong`
- cot `Thoi gian`
- cot `Ly do`
- cot `So ticket con lai`

## 4. Admin APIs

Tat ca API admin deu can:

```text
Authorization: Bearer <admin_token>
```

### 4.1 Lay cau hinh shift

`GET /api/admin/shift/settings`

Response:

```json
{
  "success": true,
  "data": {
    "selfManageEnabled": true,
    "autoStartTime": "07:30",
    "reminderMinutes": 15
  }
}
```

FE nen dung de render form setting:

- switch `Cho phep staff tu quan ly ca`
- input time `Tu dong mo ca`
- input number `Nhac nho truoc khi ket thuc ca`

### 4.2 Bat/tat staff tu quan ly ca

`PATCH /api/admin/shift/settings/self-manage`

Body:

```json
{
  "enabled": true
}
```

Response:

```json
{
  "success": true,
  "data": {
    "selfManageEnabled": true
  },
  "message": "Đã bật tính năng tự quản lý ca"
}
```

### 4.3 Cap nhat gio tu dong mo ca

`PATCH /api/admin/shift/settings/auto-start-time`

Body:

```json
{
  "time": "07:30"
}
```

Rule:

- dung dinh dang `HH:MM`
- vi du hop le: `07:30`, `16:45`

Loi validation:

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "time",
      "message": "Thời gian phải theo định dạng HH:MM"
    }
  ]
}
```

### 4.4 Cap nhat so phut nhac nho

`PATCH /api/admin/shift/settings/reminder-minutes`

Body:

```json
{
  "minutes": 15
}
```

Rule:

- la so nguyen
- tu `0` den `120`

### 4.5 Lay danh sach staff va trang thai ca

Co 3 API:

- `GET /api/admin/shift/staff`
- `GET /api/admin/shift/staff/on-duty`
- `GET /api/admin/shift/staff/off-duty`

Response item:

```json
{
  "_id": "662f...",
  "fullName": "Nguyen Van A",
  "username": "staff01",
  "counterId": {
    "_id": "6611...",
    "name": "Quay tiep nhan 1",
    "number": 1
  },
  "onDuty": true,
  "lastShiftStart": "2026-04-24T00:35:00.000Z",
  "lastShiftEnd": "2026-04-23T10:10:00.000Z"
}
```

FE goi y:

- Tab `Tat ca`
- Tab `Dang trong ca`
- Tab `Ngoai ca`
- Co search theo `fullName`, `username`, `counter`

### 4.6 Lay lich su ca cua staff

`GET /api/admin/shift/staff/:staffId/history?limit=50`

Response cung format voi API staff history.

FE nen mo drawer / modal chi tiet staff:

- thong tin staff
- counter hien tai
- trang thai hien tai
- lich su start/end gan nhat

### 4.7 Admin force mo ca

`POST /api/admin/shift/staff/:staffId/start`

Body:

```json
{}
```

Response:

```json
{
  "success": true,
  "data": {
    "onDuty": true,
    "lastShiftStart": "2026-04-24T00:35:00.000Z"
  },
  "message": "Đã mở ca cho nhân viên"
}
```

### 4.8 Admin force dong ca

`POST /api/admin/shift/staff/:staffId/end`

Body:

```json
{
  "reason": "Admin ket thuc ca do het gio"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "onDuty": false,
    "lastShiftEnd": "2026-04-24T04:50:00.000Z",
    "waitingTicketsCount": 2
  },
  "message": "Đã kết thúc ca cho nhân viên"
}
```

## 5. Staff ticket screen can doi gi

Do backend da them guard `staffOnDuty`, FE staff man hinh xu ly ticket can doi nhu sau:

### 5.1 Neu staff dang `onDuty`

Cho phep dung binh thuong:

- `Call next`
- `Call by id`
- `Recall`
- `Complete`
- `Skip`
- `Back to waiting`

### 5.2 Neu staff dang `offDuty`

Nen:

- disable tat ca action button cua ticket
- hien banner canh bao o dau man hinh
- hien CTA `Bat dau ca`

Text goi y:

```text
Ban chua bat dau ca lam viec. Vui long mo ca truoc khi thao tac ticket.
```

### 5.3 Neu FE van goi API ticket khi `offDuty`

Backend se tra:

```json
{
  "success": false,
  "message": "Bạn chưa bắt đầu ca làm việc. Vui lòng mở ca trước khi tiếp tục"
}
```

Status:

```text
403
```

FE can:

- khong hien generic error nhu loi server
- chuyen thanh warning/business error
- neu hop ly thi mo modal shift hoac redirect ve man hinh shift

## 6. Man hinh tao ticket cong khai can doi gi

Khi nguoi dan tao ticket moi, backend se kiem tra service do co staff dang `onDuty` hay khong.

Neu khong co staff dang trong ca, backend co the tra:

```json
{
  "success": false,
  "message": "Dịch vụ này hiện không có nhân viên đang làm ca. Vui lòng quay lại sau."
}
```

Status:

```text
400
```

FE public can:

- hien thong bao ro rang la service tam thoi khong phuc vu
- khong bao loi ky thuat
- goi y nguoi dung chon dich vu khac neu co

## 7. Goi y state cho frontend

### 7.1 State staff shift

```ts
type StaffShiftState = {
  loading: boolean;
  submitting: boolean;
  data: {
    staffId: string;
    fullName: string;
    username: string;
    onDuty: boolean;
    lastShiftStart: string | null;
    lastShiftEnd: string | null;
  } | null;
};
```

### 7.2 State admin shift settings

```ts
type ShiftSettingsState = {
  loading: boolean;
  saving: boolean;
  data: {
    selfManageEnabled: boolean;
    autoStartTime: string;
    reminderMinutes: number;
  } | null;
};
```

### 7.3 State history

```ts
type ShiftHistoryState = {
  loading: boolean;
  data: {
    staffId: string;
    fullName: string;
    username: string;
    onDuty: boolean;
    lastShiftStart: string | null;
    lastShiftEnd: string | null;
    history: Array<{
      action: 'start' | 'end';
      timestamp: string;
      reason: string;
      waitingTicketsCount: number;
    }>;
  } | null;
};
```

## 8. Goi y UI cho FE

### 8.1 Staff page

Nen co:

- 1 card tong quan ca hien tai
- 1 badge trang thai
- 1 nut chinh:
  - neu `onDuty = false`: `Bat dau ca`
  - neu `onDuty = true`: `Ket thuc ca`
- 1 block thong tin:
  - lan mo ca gan nhat
  - lan dong ca gan nhat
- 1 tab hoac section `Lich su ca`

### 8.2 Admin page

Nen tach thanh 2 khu:

#### A. Shift settings

- switch `Cho phep staff tu quan ly ca`
- time picker `Gio tu dong mo ca`
- number input `So phut nhac nho`
- nut save tung dong hoac save all

#### B. Staff shift monitor

- table staff
- filter theo:
  - tat ca
  - dang trong ca
  - ngoai ca
- action:
  - `Mo ca`
  - `Dong ca`
  - `Xem lich su`

## 9. Flow de FE implement

### 9.1 Flow staff login vao man hinh ticket

1. Login thanh cong
2. Goi `GET /api/shift/status`
3. Neu `onDuty = false`:
   - khoa cac nut ticket action
   - hien CTA `Bat dau ca`
4. Neu `onDuty = true`:
   - load ticket display binh thuong

### 9.2 Flow staff bam `Bat dau ca`

1. Goi `POST /api/shift/start`
2. Neu thanh cong:
   - update local state `onDuty = true`
   - refetch `GET /api/shift/status`
   - refetch staff display / recall list neu dang o man hinh ticket

### 9.3 Flow staff bam `Ket thuc ca`

1. Mo modal nhap ly do
2. Goi `POST /api/shift/end`
3. Neu thanh cong:
   - update `onDuty = false`
   - disable ticket actions
   - hien toast co `waitingTicketsCount` neu > 0

### 9.4 Flow admin force control

1. Admin vao trang shift monitor
2. Goi `GET /api/admin/shift/staff`
3. Chon 1 staff
4. Bam `Mo ca` hoac `Dong ca`
5. Sau khi thanh cong:
   - refetch list
   - refetch history neu drawer dang mo

## 10. Mapping text hien thi

FE co the map:

- `action = start` -> `Bat dau ca`
- `action = end` -> `Ket thuc ca`

Badge:

- `onDuty = true` -> `Dang trong ca`
- `onDuty = false` -> `Ngoai ca`

## 11. Validation va loi FE can xu ly

### 11.1 Validation form admin

- `time` phai theo `HH:MM`
- `minutes` phai la so nguyen trong khoang `0-120`
- `reason` toi da `500` ky tu

### 11.2 Cac loi business quan trong

- `Tính năng tự quản lý ca đang bị tắt bởi admin`
- `Bạn đang trong ca làm việc, không thể bắt đầu ca mới`
- `Bạn không đang trong ca làm việc`
- `Bạn chưa bắt đầu ca làm việc. Vui lòng mở ca trước khi tiếp tục`
- `Dịch vụ này hiện không có nhân viên đang làm ca. Vui lòng quay lại sau.`

FE nen map cac loi nay thanh toast/business alert than thien, khong coi la loi he thong.

## 12. Goi y hook/service cho FE

Neu FE dung React, co the tach:

- `useMyShiftStatus()`
- `useMyShiftHistory(limit)`
- `useStartShift()`
- `useEndShift()`
- `useAdminShiftSettings()`
- `useAdminShiftStaffList(filter)`
- `useAdminShiftHistory(staffId, limit)`
- `useAdminStartShift()`
- `useAdminEndShift()`

## 13. Checklist tich hop cho FE

- Co man hinh staff shift status
- Co nut start shift
- Co modal end shift
- Co lich su ca cua staff
- Ticket action bi disable khi staff `offDuty`
- Co man hinh admin shift settings
- Co table monitor staff on duty / off duty
- Co action force start / force end cho admin
- Co xu ly loi business dung thong diep
- Co format thoi gian local time o FE

## 14. Luu y quan trong

1. `GET /api/shift/status` hien tai lay du lieu tu `req.user` trong token-auth request context. Sau khi start/end shift thanh cong, FE nen refetch thay vi chi tin vao state cu.
2. Backend chua co socket event rieng cho shift, nen FE hien tai nen refetch bang HTTP sau moi thao tac start/end.
3. Khi staff `offDuty`, public ticket create co the bi anh huong vi service khong con staff dang ca. FE public nen hien thong bao than thien cho nguoi dung cuoi.
4. `reminderMinutes` hien da co setting API, nhung backend chua phat event nhac nho rieng. FE co the chi can render va luu setting truoc.

## 15. De xuat thu tu lam FE

Neu muon implement nhanh va an toan, nen lam theo thu tu:

1. Staff shift status + start/end shift
2. Disable ticket actions khi `offDuty`
3. Admin settings shift
4. Admin staff monitor + force start/end
5. Staff/admin shift history

