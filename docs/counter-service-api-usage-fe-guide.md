# Hướng dẫn FE sửa lỗi gỡ dịch vụ khỏi quầy

## Vấn đề đang gặp

FE đang gọi API:

```http
POST /api/counters/:id/services
```

với payload:

```json
{
  "serviceIds": []
}
```

Backend trả về:

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "serviceIds",
      "message": "Phải chọn ít nhất một dịch vụ"
    }
  ]
}
```

## Nguyên nhân

API `POST /api/counters/:id/services` là API để **thêm dịch vụ vào quầy**.

Nó không phải API để:

- xóa hết dịch vụ khỏi quầy
- thay toàn bộ danh sách dịch vụ của quầy
- cập nhật lại state cuối cùng của quầy

Vì vậy backend bắt buộc `serviceIds` phải có ít nhất 1 phần tử ở endpoint này là đúng nghiệp vụ.

## FE cần sửa gì

Khi muốn **thay đổi toàn bộ danh sách dịch vụ của quầy**, FE phải dùng:

```http
PUT /api/counters/:id
```

Không dùng:

```http
POST /api/counters/:id/services
```

## Quy ước đúng cho FE

### 1. Thêm một hoặc nhiều dịch vụ vào quầy

Dùng:

```http
POST /api/counters/:id/services
```

Payload ví dụ:

```json
{
  "serviceIds": [
    "680f11111111111111111111",
    "680f22222222222222222222"
  ]
}
```

Lưu ý:

- endpoint này chỉ có ý nghĩa là thêm
- `serviceIds` phải có ít nhất 1 phần tử
- không dùng endpoint này để xóa

### 2. Gỡ hết dịch vụ khỏi quầy

Dùng:

```http
PUT /api/counters/:id
```

Payload ví dụ:

```json
{
  "serviceIds": []
}
```

Ý nghĩa:

- cập nhật toàn bộ danh sách dịch vụ của quầy
- danh sách mới là rỗng
- backend cho phép quầy không có dịch vụ nào

### 3. Thay danh sách dịch vụ cũ bằng danh sách mới

Dùng:

```http
PUT /api/counters/:id
```

Payload ví dụ:

```json
{
  "name": "Quầy số 1",
  "number": 1,
  "serviceIds": [
    "680f11111111111111111111",
    "680f33333333333333333333"
  ]
}
```

Ý nghĩa:

- backend sẽ lấy danh sách mới FE gửi lên làm source of truth
- dịch vụ nào không còn trong danh sách mới sẽ bị gỡ khỏi quầy
- dịch vụ nào còn trong danh sách thì được giữ lại

### 4. Chỉ sửa thông tin quầy, không muốn đụng đến dịch vụ

Dùng:

```http
PUT /api/counters/:id
```

Payload ví dụ:

```json
{
  "name": "Quầy tiếp nhận",
  "number": 2
}
```

Lưu ý:

- nếu không muốn đổi danh sách dịch vụ, đừng gửi `serviceIds`
- backend sẽ giữ nguyên các dịch vụ đang gán

## Rule FE nên áp dụng

FE nên xử lý theo rule đơn giản sau:

### Case A: Người dùng bấm "Thêm dịch vụ"

Gọi:

```http
POST /api/counters/:id/services
```

Điều kiện:

- phải có ít nhất 1 service được chọn

### Case B: Người dùng bấm "Lưu cấu hình quầy"

Gọi:

```http
PUT /api/counters/:id
```

Điều kiện:

- có thể gửi `serviceIds: []`
- có thể gửi danh sách service mới
- có thể không gửi `serviceIds` nếu chỉ sửa tên/số quầy

## Mapping hành vi UI -> API

| Hành vi trên FE | API đúng |
|---|---|
| Thêm vài dịch vụ mới vào quầy | `POST /api/counters/:id/services` |
| Gỡ toàn bộ dịch vụ khỏi quầy | `PUT /api/counters/:id` |
| Thay danh sách dịch vụ hiện tại bằng danh sách mới | `PUT /api/counters/:id` |
| Chỉ sửa tên / số / ghi chú quầy | `PUT /api/counters/:id` |

## Vì sao FE đang bị lỗi 400

FE hiện đang làm:

```http
POST /api/counters/:id/services
```

với:

```json
{
  "serviceIds": []
}
```

Đây là request sai mục đích, nên backend trả:

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "serviceIds",
      "message": "Phải chọn ít nhất một dịch vụ"
    }
  ]
}
```

## Trường hợp đặc biệt khi gỡ dịch vụ mà vẫn còn vé

Nếu FE dùng đúng API `PUT /api/counters/:id`, nhưng đang cố gỡ một dịch vụ khỏi quầy trong khi dịch vụ đó vẫn còn vé chờ hoặc vé đang xử lý, backend sẽ chặn.

Message backend hiện tại:

```json
{
  "success": false,
  "message": "Không thể xóa dịch vụ ra khỏi quầy vì còn X vé."
}
```

FE nên hiển thị nguyên message này cho người dùng.

## Gợi ý xử lý FE

### Khi người dùng bỏ chọn toàn bộ dịch vụ

FE nên gọi:

```ts
await api.put(`/api/counters/${counterId}`, {
  serviceIds: []
});
```

### Khi người dùng chỉ thêm service mới

FE nên gọi:

```ts
await api.post(`/api/counters/${counterId}/services`, {
  serviceIds: selectedServiceIds
});
```

và chỉ gọi khi:

```ts
selectedServiceIds.length > 0
```

### Khi người dùng đang ở màn hình edit counter

Nếu form đang quản lý toàn bộ state của quầy, FE nên luôn ưu tiên dùng:

```http
PUT /api/counters/:id
```

thay vì trộn cả `PUT` và `POST /services` cho cùng một thao tác lưu form.

## Checklist cho FE

- Nếu muốn xóa hết dịch vụ, dùng `PUT /api/counters/:id`
- Không dùng `POST /api/counters/:id/services` với mảng rỗng
- Nếu chỉ thêm dịch vụ, mới dùng `POST /api/counters/:id/services`
- Nếu chỉ sửa thông tin quầy, có thể không gửi `serviceIds`
- Khi backend trả lỗi còn vé, hiển thị nguyên message cho người dùng

## Kết luận

Lỗi `400 Validation error` trong case vừa rồi không phải do backend bị sai.

Nguyên nhân là FE đang gọi nhầm endpoint:

- đang dùng API thêm dịch vụ
- nhưng lại muốn thực hiện nghiệp vụ cập nhật/xóa danh sách dịch vụ

FE chỉ cần đổi sang:

```http
PUT /api/counters/:id
```

khi muốn thay đổi toàn bộ danh sách dịch vụ của quầy.
