# Hướng dẫn FE sửa lỗi gỡ quầy khỏi phòng

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
      "message": "Phải chọn ít nhất một quầy"
    }
  ]
}
```

## Nguyên nhân

API `POST /api/counters/:id/services` là API để **thêm quầy vào phòng**.

Nó không phải API để:

- xóa hết quầy khỏi phòng
- thay toàn bộ danh sách quầy của phòng
- cập nhật lại state cuối cùng của phòng

Vì vậy backend bắt buộc `serviceIds` phải có ít nhất 1 phần tử ở endpoint này là đúng nghiệp vụ.

## FE cần sửa gì

Khi muốn **thay đổi toàn bộ danh sách quầy của phòng**, FE phải dùng:

```http
PUT /api/counters/:id
```

Không dùng:

```http
POST /api/counters/:id/services
```

## Quy ước đúng cho FE

### 1. Thêm một hoặc nhiều quầy vào phòng

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

### 2. Gỡ hết quầy khỏi phòng

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

- cập nhật toàn bộ danh sách quầy của phòng
- danh sách mới là rỗng
- backend cho phép phòng không có quầy nào

### 3. Thay danh sách quầy cũ bằng danh sách mới

Dùng:

```http
PUT /api/counters/:id
```

Payload ví dụ:

```json
{
  "name": "phòng số 1",
  "number": 1,
  "serviceIds": [
    "680f11111111111111111111",
    "680f33333333333333333333"
  ]
}
```

Ý nghĩa:

- backend sẽ lấy danh sách mới FE gửi lên làm source of truth
- quầy nào không còn trong danh sách mới sẽ bị gỡ khỏi phòng
- quầy nào còn trong danh sách thì được giữ lại

### 4. Chỉ sửa thông tin phòng, không muốn đụng đến quầy

Dùng:

```http
PUT /api/counters/:id
```

Payload ví dụ:

```json
{
  "name": "phòng tiếp nhận",
  "number": 2
}
```

Lưu ý:

- nếu không muốn đổi danh sách quầy, đừng gửi `serviceIds`
- backend sẽ giữ nguyên các quầy đang gán

## Rule FE nên áp dụng

FE nên xử lý theo rule đơn giản sau:

### Case A: Người dùng bấm "Thêm quầy"

Gọi:

```http
POST /api/counters/:id/services
```

Điều kiện:

- phải có ít nhất 1 service được chọn

### Case B: Người dùng bấm "Lưu cấu hình phòng"

Gọi:

```http
PUT /api/counters/:id
```

Điều kiện:

- có thể gửi `serviceIds: []`
- có thể gửi danh sách service mới
- có thể không gửi `serviceIds` nếu chỉ sửa tên/số phòng

## Mapping hành vi UI -> API

| Hành vi trên FE | API đúng |
|---|---|
| Thêm vài quầy mới vào phòng | `POST /api/counters/:id/services` |
| Gỡ toàn bộ quầy khỏi phòng | `PUT /api/counters/:id` |
| Thay danh sách quầy hiện tại bằng danh sách mới | `PUT /api/counters/:id` |
| Chỉ sửa tên / số / ghi chú phòng | `PUT /api/counters/:id` |

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
      "message": "Phải chọn ít nhất một quầy"
    }
  ]
}
```

## Trường hợp đặc biệt khi gỡ quầy mà vẫn còn vé

Nếu FE dùng đúng API `PUT /api/counters/:id`, nhưng đang cố gỡ một quầy khỏi phòng trong khi quầy đó vẫn còn vé chờ hoặc vé đang xử lý, backend sẽ chặn.

Message backend hiện tại:

```json
{
  "success": false,
  "message": "Không thể xóa quầy ra khỏi phòng vì còn X vé."
}
```

FE nên hiển thị nguyên message này cho người dùng.

## Gợi ý xử lý FE

### Khi người dùng bỏ chọn toàn bộ quầy

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

Nếu form đang quản lý toàn bộ state của phòng, FE nên luôn ưu tiên dùng:

```http
PUT /api/counters/:id
```

thay vì trộn cả `PUT` và `POST /services` cho cùng một thao tác lưu form.

## Checklist cho FE

- Nếu muốn xóa hết quầy, dùng `PUT /api/counters/:id`
- Không dùng `POST /api/counters/:id/services` với mảng rỗng
- Nếu chỉ thêm quầy, mới dùng `POST /api/counters/:id/services`
- Nếu chỉ sửa thông tin phòng, có thể không gửi `serviceIds`
- Khi backend trả lỗi còn vé, hiển thị nguyên message cho người dùng

## Kết luận

Lỗi `400 Validation error` trong case vừa rồi không phải do backend bị sai.

Nguyên nhân là FE đang gọi nhầm endpoint:

- đang dùng API thêm quầy
- nhưng lại muốn thực hiện nghiệp vụ cập nhật/xóa danh sách quầy

FE chỉ cần đổi sang:

```http
PUT /api/counters/:id
```

khi muốn thay đổi toàn bộ danh sách quầy của phòng.
