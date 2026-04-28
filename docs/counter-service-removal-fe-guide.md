# Hướng Dẫn FE: Gỡ Dịch Vụ Khỏi Quầy và Xóa Quầy An Toàn

Tài liệu này hướng dẫn frontend xử lý đúng tính năng:

- gỡ một dịch vụ khỏi quầy
- cập nhật danh sách dịch vụ của quầy
- xóa cả quầy

Sau thay đổi mới của backend, các thao tác này sẽ bị chặn nếu còn vé tồn đọng.

Mục tiêu:

- FE hiểu khi nào thao tác bị chặn
- FE biết cách hiển thị lỗi rõ ràng cho admin
- FE thiết kế flow confirm / warning hợp lý
- FE tránh làm người dùng hiểu nhầm là lỗi hệ thống

## 1. Vì sao backend chặn các thao tác này

Mỗi ticket khi tạo sẽ được gán:

- `queueCounterId`: quầy xếp hàng ban đầu
- `serviceId`: dịch vụ của vé

Nếu admin:

- gỡ dịch vụ khỏi quầy
- hoặc xóa quầy

trong khi vẫn còn vé `WAITING` hoặc `PROCESSING`, thì các vé đó có thể bị “mồ côi” và không còn đường xử lý.

Vì vậy backend bây giờ sẽ chặn các thao tác nguy hiểm này.

## 2. Những thao tác FE bị ảnh hưởng

Có 3 case chính:

### 2.1 Gỡ một dịch vụ khỏi quầy

API liên quan:

- `DELETE /api/counters/:id/services/:serviceId`

Backend sẽ chặn nếu còn:

- vé `WAITING` của dịch vụ đó trong queue của quầy
- vé `PROCESSING` của dịch vụ đó đang được xử lý tại quầy

### 2.2 Cập nhật lại danh sách dịch vụ của quầy

API liên quan:

- `PUT /api/counters/:id`
- hoặc `PATCH /api/counters/:id`

Tùy theo FE đang gọi route cập nhật quầy nào trong project.

Backend sẽ chặn nếu:

- trong danh sách service bị loại bỏ có service vẫn còn vé tồn đọng

### 2.3 Xóa cả quầy

API liên quan:

- `DELETE /api/counters/:id`

Backend sẽ chặn nếu còn:

- vé `WAITING` trong queue của quầy
- vé `PROCESSING` đang được xử lý tại quầy

## 3. Quy tắc mới FE cần nhớ

### 3.1 Với thao tác gỡ một service khỏi quầy

Không được phép gỡ nếu còn:

- `queueCounterId = counterId`
- `serviceId = serviceId`
- `status = WAITING`

hoặc:

- `counterId = counterId`
- `serviceId = serviceId`
- `status = PROCESSING`

### 3.2 Với thao tác xóa quầy

Không được phép xóa nếu còn:

- `queueCounterId = counterId` và `status = WAITING`

hoặc:

- `counterId = counterId` và `status = PROCESSING`

### 3.3 Với thao tác cập nhật service list của quầy

FE có thể gửi:

- danh sách service mới ít hơn danh sách cũ
- thậm chí `serviceIds = []`

Nhưng nếu các service bị remove vẫn còn vé tồn đọng thì backend sẽ chặn.

## 4. API response FE sẽ gặp

### 4.1 Khi gỡ service khỏi quầy nhưng còn vé tồn

Ví dụ response:

```json
{
  "success": false,
  "message": "Không thể gỡ dịch vụ khỏi quầy vì còn 3 vé đang chờ và 1 vé đang xử lý cho dịch vụ này."
}
```

Ý nghĩa:

- `3 vé đang chờ`: đang nằm trong queue của quầy
- `1 vé đang xử lý`: đang được staff xử lý tại quầy

### 4.2 Khi cập nhật serviceIds của quầy nhưng remove nhầm service còn vé

Ví dụ response:

```json
{
  "success": false,
  "message": "Không thể gỡ dịch vụ khỏi quầy vì vẫn còn vé tồn đọng của các dịch vụ bị loại bỏ. Hiện còn 5 vé đang chờ và 2 vé đang xử lý."
}
```

Ý nghĩa:

- FE đang submit danh sách service mới
- một hoặc nhiều service bị remove vẫn còn vé tồn

### 4.3 Khi xóa quầy nhưng còn vé tồn

Ví dụ response:

```json
{
  "success": false,
  "message": "Không thể xóa quầy vì còn 4 vé đang chờ và 1 vé đang xử lý."
}
```

### 4.4 Khi xóa quầy nhưng vẫn còn service được gán

Ví dụ response:

```json
{
  "success": false,
  "message": "Không thể xóa quầy đang có 3 dịch vụ được gán. Vui lòng gỡ hết dịch vụ trước khi xóa."
}
```

## 5. FE nên hiểu các lỗi này như thế nào

Đây là:

- business validation error
- không phải lỗi server
- không phải lỗi mạng

FE nên hiển thị dưới dạng:

- toast warning
- inline alert
- modal warning

Không nên hiển thị chung chung kiểu:

- `Đã có lỗi xảy ra`
- `Server error`

## 6. Gợi ý UX cho từng màn hình

## 6.1 Màn hình chi tiết quầy

Nếu FE có màn hình chi tiết 1 quầy với danh sách dịch vụ:

Mỗi dòng service nên có:

- tên dịch vụ
- mã dịch vụ
- nút `Gỡ`

Khi admin bấm `Gỡ`:

1. mở confirm modal
2. nội dung nên ghi rõ:
   - thao tác này sẽ làm quầy ngừng phục vụ dịch vụ
   - nếu còn vé tồn đọng thì backend sẽ chặn
3. nếu API fail -> hiển thị chính xác message backend trả về

### Gợi ý text confirm

```text
Bạn có chắc muốn gỡ dịch vụ này khỏi quầy không?
Nếu vẫn còn vé đang chờ hoặc đang xử lý cho dịch vụ này tại quầy, hệ thống sẽ không cho phép gỡ.
```

## 6.2 Màn hình sửa quầy

Nếu FE có form sửa quầy cho phép chọn nhiều service:

Admin có thể:

- bỏ chọn một số service cũ
- hoặc bỏ chọn hết toàn bộ service

Khi submit:

- FE cứ gửi danh sách `serviceIds` mới như bình thường
- backend sẽ tự check các service bị remove

FE không cần tự tính vé tồn trước ở client.

Nếu bị chặn:

- giữ nguyên form
- hiển thị message backend
- không reset lựa chọn admin vừa chỉnh

### Lưu ý quan trọng

`serviceIds = []` là hợp lệ theo backend mới.

Nghĩa là:

- quầy được phép không còn dịch vụ nào
- nhưng chỉ khi không có vé tồn đọng của các service bị remove

## 6.3 Màn hình danh sách quầy

Nếu FE có nút `Xóa quầy`:

Khi bấm xóa:

1. mở confirm modal
2. warning rõ:
   - nếu quầy còn service đang gán -> bị chặn
   - nếu quầy còn vé đang chờ / đang xử lý -> bị chặn

### Gợi ý text confirm

```text
Bạn có chắc muốn xóa quầy này không?
Chỉ có thể xóa khi quầy không còn dịch vụ được gán và không còn vé đang chờ hoặc đang xử lý.
```

## 7. FE không cần làm gì thêm ở client

Frontend KHÔNG cần:

- tự query số vé tồn trước khi gọi API
- tự suy luận xem thao tác có hợp lệ không

FE chỉ cần:

1. gọi API
2. nếu thành công -> cập nhật UI
3. nếu fail -> hiển thị message backend

Lý do:

- check ở backend mới là source of truth
- nếu FE tự check trước vẫn có thể sai do race condition

## 8. Cách cập nhật UI sau khi thao tác thành công

### 8.1 Sau khi gỡ service thành công

Response thường trả về object counter đã cập nhật:

```json
{
  "success": true,
  "data": {
    "_id": "counter-id",
    "name": "Quầy 1",
    "services": [
      {
        "_id": "service-a",
        "name": "Dịch vụ A",
        "code": "A01"
      }
    ]
  }
}
```

FE có thể:

- update local state trực tiếp từ `data.services`
- hoặc refetch lại chi tiết quầy

### 8.2 Sau khi update quầy thành công

FE nên:

- đóng modal / form edit nếu UX phù hợp
- refresh danh sách service mới của quầy

### 8.3 Sau khi xóa quầy thành công

FE nên:

- remove quầy khỏi list
- hoặc refetch lại list quầy
- redirect khỏi trang chi tiết quầy nếu đang đứng trong đó

## 9. Gợi ý state cho frontend

### 9.1 State khi gỡ service

```ts
type RemoveServiceState = {
  loading: boolean;
  error: string | null;
};
```

### 9.2 State khi update counter

```ts
type UpdateCounterState = {
  loading: boolean;
  error: string | null;
};
```

### 9.3 State khi delete counter

```ts
type DeleteCounterState = {
  loading: boolean;
  error: string | null;
};
```

## 10. Gợi ý API service cho FE

Nếu FE dùng React / Next.js, có thể tách:

- `removeCounterService(counterId, serviceId)`
- `updateCounter(counterId, payload)`
- `deleteCounter(counterId)`

Ví dụ pseudo-code:

```ts
async function removeCounterService(counterId: string, serviceId: string) {
  return api.delete(`/api/counters/${counterId}/services/${serviceId}`);
}

async function updateCounter(counterId: string, payload: {
  name?: string;
  number?: number;
  note?: string;
  isActive?: boolean;
  serviceIds?: string[];
}) {
  return api.put(`/api/counters/${counterId}`, payload);
}

async function deleteCounter(counterId: string) {
  return api.delete(`/api/counters/${counterId}`);
}
```

## 11. Flow FE nên triển khai

### 11.1 Flow gỡ 1 service khỏi quầy

1. admin bấm `Gỡ`
2. mở confirm modal
3. submit API
4. nếu success:
   - cập nhật list service
   - toast thành công
5. nếu fail:
   - giữ nguyên UI
   - hiện đúng message backend

### 11.2 Flow sửa danh sách service của quầy

1. admin mở form edit
2. thay đổi danh sách service
3. submit API update
4. nếu success:
   - cập nhật lại counter
5. nếu fail:
   - giữ nguyên form
   - hiện đúng message backend

### 11.3 Flow xóa quầy

1. admin bấm `Xóa quầy`
2. confirm
3. gọi API delete
4. nếu success:
   - remove khỏi list / redirect
5. nếu fail:
   - hiển thị đúng message backend

## 12. Các message FE cần ưu tiên hiển thị nguyên văn

- `Không thể gỡ dịch vụ khỏi quầy vì còn X vé đang chờ và Y vé đang xử lý cho dịch vụ này.`
- `Không thể gỡ dịch vụ khỏi quầy vì vẫn còn vé tồn đọng của các dịch vụ bị loại bỏ. Hiện còn X vé đang chờ và Y vé đang xử lý.`
- `Không thể xóa quầy vì còn X vé đang chờ và Y vé đang xử lý.`
- `Không thể xóa quầy đang có N dịch vụ được gán. Vui lòng gỡ hết dịch vụ trước khi xóa.`

## 13. Checklist tích hợp cho FE

- Có confirm modal khi gỡ service
- Có confirm modal khi xóa quầy
- Không reset form khi update counter bị backend chặn
- Hiển thị message backend nguyên văn cho các lỗi business
- Refetch hoặc update local state sau khi thao tác thành công
- Không coi các lỗi này là lỗi hệ thống

## 14. Tóm tắt ngắn gọn

- Gỡ service khỏi quầy sẽ bị chặn nếu còn vé `WAITING` hoặc `PROCESSING` của service đó
- Xóa quầy sẽ bị chặn nếu còn vé `WAITING` hoặc `PROCESSING` trong quầy
- Update danh sách service của quầy sẽ bị chặn nếu các service bị remove còn vé tồn
- FE chỉ cần gọi API và hiển thị message backend rõ ràng

