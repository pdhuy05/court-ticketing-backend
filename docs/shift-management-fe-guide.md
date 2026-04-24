# Shift Management and Service Schedule FE Guide

Tai lieu nay huong dan frontend tich hop phien ban moi cua tinh nang shift management.

Ban nay KHONG con cho staff tu mo ca / dong ca.

Frontend can hieu dung 2 nhom chuc nang:

- Admin quan ly trang thai ca cua staff
- Admin quan ly lich mo / dong cua service theo gio

Muc tieu cua tai lieu:

- FE biet ro API nao con dung, API nao da bo
- FE co the lam man hinh admin nhanh, dung nghiep vu
- FE xu ly dung cac trang thai `onDuty` cua staff va `isOpen` cua service
- FE tranh nham voi ban cu co route `/api/shift/*` cho staff

## 1. Thay doi lon trong nghiep vu

So voi ban cu:

- da xoa toan bo staff APIs:
  - `GET /api/shift/status`
  - `GET /api/shift/history`
  - `POST /api/shift/start`
  - `POST /api/shift/end`
- da xoa route mount `/api/shift`
- staff khong tu thao tac ca nua
- chi admin moi co quyen:
  - xem trang thai ca
  - xem lich su ca
  - force mo ca / dong ca cho staff
  - cau hinh gio auto start shift
  - cau hinh schedule mo / dong service

Ngoai ra backend da them:

- model `ServiceSchedule`
- field `isOpen` trong service
- scheduler tu dong mo / dong service theo `openTime` va `closeTime`

## 2. Field FE can biet

### 2.1 Tren User

Staff van co cac field:

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

### 2.2 Tren Service

Service da co them:

- `isOpen: boolean`

Y nghia:

- `true`: service dang mo, co the cap so neu cac dieu kien khac hop le
- `false`: service dang tam dong, backend se chan tao ticket moi

### 2.3 Tren ServiceSchedule

Kieu du lieu frontend can dung:

```ts
type ServiceSchedule = {
  _id: string;
  serviceId:
    | 'ALL'
    | {
        _id: string;
        code: string;
        name: string;
        isActive: boolean;
        isOpen: boolean;
      };
  openTime: string;
  closeTime: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};
```

Luu y:

- neu `serviceId = 'ALL'` thi rule ap dung cho tat ca service
- neu `serviceId` la object thi rule ap dung cho mot service cu the
- moi service chi co toi da 1 schedule

## 3. API con dung cho Admin

Tat ca API trong tai lieu nay deu can:

```text
Authorization: Bearer <admin_token>
```

Base path chinh:

```text
/api/admin/shift
```

## 4. Nhom API quan ly shift staff

### 4.1 Lay settings shift

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

Luu y cho FE:

- hien tai backend van tra `selfManageEnabled`
- nhung staff khong con route self-manage
- FE admin van co the hien field nay neu team muon giu trang settings hien tai
- neu muon UI gon, co the xem no la setting du phong

### 4.2 Cap nhat gio auto mo ca staff

`PATCH /api/admin/shift/settings/auto-start-time`

Body:

```json
{
  "time": "07:30"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "autoStartTime": "07:30"
  },
  "message": "Đã cập nhật thời gian tự động mở ca thành 07:30"
}
```

Validation:

- phai theo dinh dang `HH:MM`

### 4.3 Cap nhat reminder minutes

`PATCH /api/admin/shift/settings/reminder-minutes`

Body:

```json
{
  "minutes": 15
}
```

Response:

```json
{
  "success": true,
  "data": {
    "reminderMinutes": 15
  },
  "message": "Đã cập nhật thời gian nhắc nhở thành 15 phút"
}
```

Validation:

- la so nguyen
- trong khoang `0 - 120`

### 4.4 Danh sach staff theo trang thai ca

Co 3 API:

- `GET /api/admin/shift/staff`
- `GET /api/admin/shift/staff/on-duty`
- `GET /api/admin/shift/staff/off-duty`

Response item:

```json
{
  "_id": "662f0c...",
  "fullName": "Nguyen Van A",
  "username": "staff01",
  "counterId": {
    "_id": "6611ab...",
    "name": "Quay tiep nhan 1",
    "number": 1
  },
  "onDuty": true,
  "lastShiftStart": "2026-04-24T00:35:00.000Z",
  "lastShiftEnd": "2026-04-23T10:10:00.000Z"
}
```

FE nen render:

- table staff
- filter `Tat ca`, `Dang trong ca`, `Ngoai ca`
- search theo `fullName`, `username`, `counter`
- badge:
  - `onDuty = true` -> `Dang trong ca`
  - `onDuty = false` -> `Ngoai ca`

### 4.5 Lay lich su ca cua 1 staff

`GET /api/admin/shift/staff/:staffId/history?limit=50`

Response:

```json
{
  "success": true,
  "data": {
    "staffId": "662f0c...",
    "fullName": "Nguyen Van A",
    "username": "staff01",
    "onDuty": false,
    "lastShiftStart": "2026-04-24T00:35:00.000Z",
    "lastShiftEnd": "2026-04-24T04:50:00.000Z",
    "history": [
      {
        "action": "end",
        "timestamp": "2026-04-24T04:50:00.000Z",
        "reason": "Admin ket thuc ca thu cong",
        "waitingTicketsCount": 2
      },
      {
        "action": "start",
        "timestamp": "2026-04-24T00:35:00.000Z",
        "reason": "Admin mo ca thu cong",
        "waitingTicketsCount": 0
      }
    ]
  }
}
```

FE nen dung:

- drawer hoac modal chi tiet staff
- timeline hoac table lich su
- hien ro:
  - hanh dong
  - thoi gian
  - ly do
  - so ticket con lai khi dong ca

### 4.6 Admin force mo ca cho staff

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

Loi co the gap:

- `404`: `Không tìm thấy nhân viên`
- `400`: `Nhân viên đang trong ca làm việc`

### 4.7 Admin force dong ca cho staff

`POST /api/admin/shift/staff/:staffId/end`

Body:

```json
{
  "reason": "Het gio lam viec"
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

Y nghia `waitingTicketsCount`:

- so ticket con lai tai quay cua staff vao luc dong ca
- FE co the hien them canh bao trong toast hoac modal neu > 0

Loi co the gap:

- `404`: `Không tìm thấy nhân viên`
- `400`: `Nhân viên không đang trong ca làm việc`

## 5. Nhom API quan ly service schedule

Day la nhom API moi quan trong nhat cho FE admin.

### 5.1 Lay danh sach service schedules

`GET /api/admin/shift/service-schedules`

Response:

```json
{
  "success": true,
  "data": [
    {
      "_id": "6630...",
      "serviceId": "ALL",
      "openTime": "07:30",
      "closeTime": "17:00",
      "isEnabled": true,
      "createdAt": "2026-04-24T01:00:00.000Z",
      "updatedAt": "2026-04-24T01:00:00.000Z"
    },
    {
      "_id": "6631...",
      "serviceId": {
        "_id": "6615...",
        "code": "TV",
        "name": "TU VAN",
        "isActive": true,
        "isOpen": true
      },
      "openTime": "08:00",
      "closeTime": "16:30",
      "isEnabled": true,
      "createdAt": "2026-04-24T01:05:00.000Z",
      "updatedAt": "2026-04-24T01:05:00.000Z"
    }
  ]
}
```

FE can xu ly 2 truong hop:

- `serviceId === 'ALL'`
- `serviceId` la object service

Goi y hien thi:

- neu `serviceId === 'ALL'` -> hien label `Tat ca dich vu`
- nguoc lai -> hien `serviceId.name`

### 5.2 Tao hoac cap nhat 1 service schedule

`POST /api/admin/shift/service-schedules`

Body cho rule ALL:

```json
{
  "serviceId": "ALL",
  "openTime": "07:30",
  "closeTime": "17:00",
  "isEnabled": true
}
```

Body cho rule 1 service:

```json
{
  "serviceId": "6615b0d4f4e7b7e0b1234567",
  "openTime": "08:00",
  "closeTime": "16:30",
  "isEnabled": true
}
```

Response:

```json
{
  "success": true,
  "data": {
    "_id": "6631...",
    "serviceId": {
      "_id": "6615...",
      "code": "TV",
      "name": "TU VAN",
      "isActive": true,
      "isOpen": true
    },
    "openTime": "08:00",
    "closeTime": "16:30",
    "isEnabled": true,
    "createdAt": "2026-04-24T01:05:00.000Z",
    "updatedAt": "2026-04-24T01:05:00.000Z"
  },
  "message": "Đã lưu lịch dịch vụ thành công"
}
```

Rule nghiep vu:

- 1 service chi co toi da 1 schedule
- goi lai API voi cung `serviceId` se la update, khong tao ban ghi moi
- `serviceId` co the la:
  - `'ALL'`
  - ObjectId string cua service

Validation:

- `serviceId` bat buoc
- `openTime` bat buoc dung `HH:MM`
- `closeTime` bat buoc dung `HH:MM`
- `isEnabled` mac dinh `true`

### 5.3 Xoa service schedule

`DELETE /api/admin/shift/service-schedules/:serviceId`

Vi du:

```text
DELETE /api/admin/shift/service-schedules/ALL
DELETE /api/admin/shift/service-schedules/6615b0d4f4e7b7e0b1234567
```

Response:

```json
{
  "success": true,
  "data": {
    "serviceId": "ALL",
    "deletedCount": 1
  },
  "message": "Đã xóa lịch dịch vụ thành công"
}
```

FE nen:

- confirm truoc khi xoa
- refetch danh sach sau khi xoa

### 5.4 Bat / tat service schedule

`PATCH /api/admin/shift/service-schedules/:serviceId/toggle`

Body:

```json
{
  "isEnabled": false
}
```

Response:

```json
{
  "success": true,
  "data": {
    "_id": "6631...",
    "serviceId": {
      "_id": "6615...",
      "code": "TV",
      "name": "TU VAN",
      "isActive": true,
      "isOpen": true
    },
    "openTime": "08:00",
    "closeTime": "16:30",
    "isEnabled": false,
    "createdAt": "2026-04-24T01:05:00.000Z",
    "updatedAt": "2026-04-24T02:00:00.000Z"
  },
  "message": "Đã tắt lịch dịch vụ"
}
```

Y nghia:

- rule van ton tai
- scheduler se bo qua rule neu `isEnabled = false`
- day KHONG phai xoa rule

## 6. Hieu dung scheduler de FE thiet ke UI dung

Backend co 2 scheduler chay song song:

### 6.1 Auto mo ca staff

- moi 60 giay backend check `autoStartTime`
- neu dung gio thi bat `onDuty = true` cho tat ca staff dang `offDuty`

### 6.2 Auto mo / dong service

- moi 60 giay backend check tat ca `service schedules` dang `isEnabled = true`
- neu gio hien tai = `openTime` -> set `isOpen = true`
- neu gio hien tai = `closeTime` -> set `isOpen = false`

Luu y quan trong cho FE:

- backend chua co websocket event rieng cho schedule
- FE nen refetch data bang HTTP sau khi user save / toggle / delete schedule
- neu can realtime dashboard, FE co the poll nhe theo chu ky phu hop

## 7. Public flow bi anh huong nhu the nao

Khi nguoi dung lay so ticket:

- backend se check `service.isActive`
- backend se check `service.isOpen`
- backend se check con staff `onDuty` cho service do hay khong

Neu service dang dong, backend co the tra:

```json
{
  "success": false,
  "message": "Dịch vụ TU VAN hiện đang tạm đóng. Vui lòng quay lại sau."
}
```

Status:

```text
400
```

Neu service khong co staff dang trong ca, backend co the tra:

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

FE public nen:

- hien day la business error
- thong bao than thien cho nguoi dung
- neu man hinh co danh sach service, nen disable hoac danh dau service dang dong neu co du lieu `isOpen`

## 8. Goi y UI cho FE admin

Nen tach thanh 3 khu ro rang.

### 8.1 Khu Shift Settings

Truong goi y:

- `Auto open shift time`
- `Reminder minutes`
- co the giu them `Self manage enabled` neu can tuong thich UI cu

Goi y UX:

- form rieng cho settings
- save tung field hoac save theo block deu duoc

### 8.2 Khu Staff Shift Monitor

Bang staff nen co:

- Ho ten
- Username
- Quay dang gan
- Trang thai ca
- Last shift start
- Last shift end
- Action:
  - `Mo ca`
  - `Dong ca`
  - `Xem lich su`

Khi bam `Dong ca`:

- mo modal nhap `reason` optional
- submit xong refetch list va history neu dang mo

### 8.3 Khu Service Schedule Manager

Bang schedule nen co:

- Service
- Open time
- Close time
- Enabled / Disabled
- Service current state neu co:
  - voi rule service cu the co the hien them `serviceId.isOpen`
- Action:
  - `Sua`
  - `Bat/Tat`
  - `Xoa`

Form tao/sua nen co:

- select service:
  - option `Tat ca dich vu`
  - option tung service
- time picker `openTime`
- time picker `closeTime`
- switch `isEnabled`

## 9. Goi y state cho frontend

### 9.1 Shift settings

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

### 9.2 Staff shift list

```ts
type StaffShiftItem = {
  _id: string;
  fullName: string;
  username: string;
  counterId: null | {
    _id: string;
    name: string;
    number: number;
  };
  onDuty: boolean;
  lastShiftStart: string | null;
  lastShiftEnd: string | null;
};
```

### 9.3 Shift history

```ts
type StaffShiftHistory = {
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
};
```

### 9.4 Service schedules

```ts
type ServiceScheduleItem = {
  _id: string;
  serviceId:
    | 'ALL'
    | {
        _id: string;
        code: string;
        name: string;
        isActive: boolean;
        isOpen: boolean;
      };
  openTime: string;
  closeTime: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};
```

## 10. Goi y hook / service cho FE

Neu FE dung React, co the tach:

- `useShiftSettings()`
- `useUpdateAutoStartTime()`
- `useUpdateReminderMinutes()`
- `useStaffShiftList(filter)`
- `useStaffShiftHistory(staffId, limit)`
- `useAdminStartShift()`
- `useAdminEndShift()`
- `useServiceSchedules()`
- `useUpsertServiceSchedule()`
- `useDeleteServiceSchedule()`
- `useToggleServiceSchedule()`

## 11. Mapping text hien thi

### 11.1 Staff shift status

- `onDuty = true` -> `Dang trong ca`
- `onDuty = false` -> `Ngoai ca`

### 11.2 Shift action history

- `action = start` -> `Mo ca`
- `action = end` -> `Dong ca`

### 11.3 Schedule state

- `isEnabled = true` -> `Dang ap dung`
- `isEnabled = false` -> `Da tat`

### 11.4 Service current open state

- `isOpen = true` -> `Dang mo`
- `isOpen = false` -> `Tam dong`

## 12. Validation va loi FE can xu ly

### 12.1 Validation

- `time`, `openTime`, `closeTime` phai dung dinh dang `HH:MM`
- `minutes` phai trong khoang `0 - 120`
- `reason` toi da `500` ky tu
- `serviceId` phai la:
  - `'ALL'`
  - hoac ObjectId hop le

### 12.2 Business errors quan trong

- `Không tìm thấy nhân viên`
- `Nhân viên đang trong ca làm việc`
- `Nhân viên không đang trong ca làm việc`
- `Không tìm thấy dịch vụ`
- `Không tìm thấy lịch dịch vụ`
- `Dịch vụ ... hiện đang tạm đóng. Vui lòng quay lại sau.`
- `Dịch vụ này hiện không có nhân viên đang làm ca. Vui lòng quay lại sau.`

FE nen hien nhung loi nay duoi dang toast / alert nghiep vu, khong bao chung la `Server error`.

## 13. Flow FE nen implement

### 13.1 Flow admin vao trang shift

1. Goi `GET /api/admin/shift/settings`
2. Goi `GET /api/admin/shift/staff`
3. Goi `GET /api/admin/shift/service-schedules`
4. Render 3 khu:
   - settings
   - staff shift monitor
   - service schedule manager

### 13.2 Flow admin force mo / dong ca

1. Chon 1 staff trong table
2. Bam `Mo ca` hoac `Dong ca`
3. Neu dong ca, mo modal nhap ly do optional
4. Goi API
5. Sau khi thanh cong:
   - refetch list staff
   - refetch history neu drawer dang mo

### 13.3 Flow admin tao / sua schedule

1. Bam `Them lich` hoac `Sua`
2. Chon:
   - `Tat ca dich vu`
   - hoac 1 service cu the
3. Nhap `openTime`
4. Nhap `closeTime`
5. Chon `isEnabled`
6. Submit `POST /api/admin/shift/service-schedules`
7. Refetch schedule list

### 13.4 Flow toggle schedule

1. Bat / tat switch tren row
2. Goi `PATCH /api/admin/shift/service-schedules/:serviceId/toggle`
3. Refetch row hoac refetch ca list

### 13.5 Flow xoa schedule

1. Bam `Xoa`
2. Confirm
3. Goi `DELETE /api/admin/shift/service-schedules/:serviceId`
4. Refetch list

## 14. Checklist tich hop

- Da xoa toan bo man hinh staff self shift neu FE tung co
- Da bo cac call toi `/api/shift/*`
- Da co man hinh admin shift settings
- Da co list staff on-duty / off-duty
- Da co action force start / force end cho staff
- Da co drawer / modal xem shift history
- Da co CRUD service schedule
- Da xu ly rule `serviceId = 'ALL'`
- Da xu ly state `isEnabled`
- Da xu ly state `service.isOpen`
- Da hien thong bao business error dung cho public create ticket

## 15. Luu y de tranh nham

1. Ban nay chi admin thao tac shift, staff khong co route rieng nua.
2. `service schedule` va `staff shift` la 2 khai niem khac nhau:
   - `staff shift` -> quan ly `onDuty`
   - `service schedule` -> quan ly `isOpen`
3. Service chi cap so duoc khi ca 2 dieu kien deu hop le:
   - service dang `isOpen = true`
   - co staff dang `onDuty` cho service do
4. Scheduler chay theo phut, khong phai realtime tung giay.
5. Sau moi thao tac admin, FE nen refetch thay vi chi patch local state, de tranh lech voi scheduler backend.

