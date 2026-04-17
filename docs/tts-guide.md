# 🔊 Hệ thống đọc số tiếng Việt (TTS) — Hướng dẫn Frontend

> **Ngày cập nhật:** 17/04/2026  
> **Phiên bản:** Google TTS + Native OS fallback

---

## 1. TTS hoạt động như thế nào?

### Luồng hoạt động

```
Staff bấm "Gọi số"
        │
        ▼
   FE gọi API ────────────────────────────────────────────┐
   POST /api/tickets/call-next                             │
        │                                                  │
        ▼                                                  ▼
   BE xử lý ticket                              BE phát TTS trên SERVER
   trả response về FE                           "Vui lòng mời ông bà số
        │                                        ND010 đến Quầy 1"
        ▼                                                  │
   FE nhận response                                        ▼
        │                                         Loa kết nối với SERVER
        ▼                                         sẽ phát âm thanh
   Socket.IO emit ──► Màn hình TV nhận
   event 'ticket-called'   event và hiển thị
```

> [!IMPORTANT]
> ### TTS phát ở đâu?
> TTS hiện tại phát **trên máy chạy Backend** (server). Nghĩa là:
> - ✅ Nếu server có loa → phát ra loa server
> - ❌ Nếu server là VPS/cloud → **không có loa** → không nghe được
> - ❌ FE (trình duyệt) **không tự phát âm thanh** từ API này
>
> **Nếu muốn FE tự phát âm thanh**, xem [Phần 5: TTS trên Frontend](#5-tts-trên-frontend-browser-speech-api).

---

## 2. Các API trigger TTS

TTS tự động phát khi gọi các API sau (FE không cần gửi gì thêm):

| API | Khi nào phát | Nội dung phát |
|-----|-------------|---------------|
| `POST /api/tickets/call-next` | Gọi số tiếp theo | "Vui lòng mời ông bà số `{displayNumber}` đến `{counterName}`" |
| `POST /api/tickets/call-by-id` | Gọi ticket cụ thể | "Vui lòng mời ông bà số `{displayNumber}` đến `{counterName}`" |
| `POST /api/tickets/:id/recall` | Gọi lại ticket | "Vui lòng mời ông bà số `{displayNumber}` đến `{counterName}`" |

### Response mẫu (call-next)

```json
{
  "success": true,
  "data": {
    "_id": "69e1e4e5...",
    "number": 10,
    "ticketNumber": "010",
    "formattedNumber": "1010",
    "displayNumber": "1010",
    "customerName": "Nguyễn Văn A",
    "status": "processing",
    "serviceId": { "code": "ND", "name": "NỘP ĐƠN" }
  },
  "message": "Vui lòng số 1010 đến Quầy 1"
}
```

> [!NOTE]
> `displayNumber` trong response chính là số được đọc qua TTS.
> `message` là text hiển thị cho FE.

---

## 3. Socket.IO Events liên quan đến TTS

Khi ticket được gọi, ngoài TTS trên server, BE cũng emit socket events. **FE nên dùng các events này để tự phát âm thanh trên trình duyệt.**

### Event: `ticket-called`

**Room:** `waiting-room`  
**Khi nào:** Mỗi khi có ticket được gọi (call-next, call-by-id, recall)

```javascript
socket.on('ticket-called', (data) => {
  console.log(data);
  // {
  //   ticket: {
  //     id: "69e1e4e5...",
  //     number: 10,
  //     formattedNumber: "1010",
  //     customerName: "Nguyễn Văn A",
  //     serviceName: "NỘP ĐƠN",
  //     isRecall: false
  //   },
  //   counterName: "Quầy 1",
  //   counterId: "69e05daf...",
  //   calledAt: "2026-04-17T07:47:05.242Z",
  //   reason: "call-next"   // hoặc "call-by-id", "recall-ticket"
  // }
});
```

### Event: `new-current-ticket`

**Room:** `counter-{counterId}`  
**Khi nào:** Cùng lúc với `ticket-called`

```javascript
socket.on('new-current-ticket', (data) => {
  console.log(data);
  // {
  //   currentTicket: {
  //     id: "69e1e4e5...",
  //     number: 10,
  //     formattedNumber: "1010",
  //     customerName: "Nguyễn Văn A",
  //     phone: "0912345678",
  //     serviceName: "NỘP ĐƠN",
  //     status: "processing"
  //   }
  // }
});
```

---

## 4. Cấu hình Backend TTS

Cấu hình qua file `.env`:

```env
TTS_ENABLED=true        # true/false — bật/tắt TTS
TTS_LANG=vi             # Ngôn ngữ (vi = tiếng Việt)
TTS_TIMEOUT_MS=15000    # Timeout tải + phát (ms)
```

### Cơ chế hoạt động

```
1. Ưu tiên: Google Translate TTS
   └── Tải file MP3 tiếng Việt từ Google
   └── Phát bằng: afplay (macOS) | PowerShell (Windows) | aplay (Linux)

2. Fallback: Native OS TTS
   └── macOS: say (tiếng Anh)
   └── Windows: System.Speech (tiếng Anh)
   └── Linux: espeak

3. Nếu cả 2 đều lỗi → log warning, không crash server
```

---

## 5. TTS trên Frontend (Browser Speech API)

> [!IMPORTANT]
> **Đây là phần QUAN TRỌNG NHẤT cho FE.** Nếu server chạy trên cloud/VPS không có loa, FE cần tự phát âm thanh trên trình duyệt.

### Cách 1: Dùng Web Speech API (Đơn giản, miễn phí)

```javascript
/**
 * Đọc text tiếng Việt trên trình duyệt
 * Hỗ trợ: Chrome, Edge, Safari, Firefox
 */
const speakVietnamese = (text) => {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Trình duyệt không hỗ trợ Speech API');
      reject(new Error('Speech API not supported'));
      return;
    }

    // Hủy bỏ nếu đang đọc
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';       // Tiếng Việt
    utterance.rate = 0.9;           // Tốc độ (0.1 - 10)
    utterance.pitch = 1;            // Cao độ (0 - 2)
    utterance.volume = 1;           // Âm lượng (0 - 1)

    // Tìm voice tiếng Việt (nếu có)
    const voices = window.speechSynthesis.getVoices();
    const vietnameseVoice = voices.find(v =>
      v.lang.includes('vi') || v.name.toLowerCase().includes('vietnam')
    );
    if (vietnameseVoice) {
      utterance.voice = vietnameseVoice;
    }

    utterance.onend = resolve;
    utterance.onerror = reject;

    window.speechSynthesis.speak(utterance);
  });
};
```

### Cách 2: Dùng Google Translate Audio (Chất lượng tốt hơn)

```javascript
/**
 * Phát TTS bằng Google Translate (chất lượng tốt, giọng tự nhiên)
 */
const speakGoogleTTS = (text, lang = 'vi') => {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${lang}&client=tw-ob`;

    const audio = new Audio(url);
    audio.onended = resolve;
    audio.onerror = reject;
    audio.play().catch(reject);
  });
};
```

> [!WARNING]
> Google TTS API có thể bị rate-limit nếu gọi quá nhiều. Nên dùng Web Speech API làm chính, Google TTS làm backup.

### Tích hợp với Socket.IO

```javascript
// ===== Bước 1: Kết nối socket =====
import { io } from 'socket.io-client';

const socket = io('http://localhost:5001');

// Join room màn hình chờ
socket.emit('join', 'waiting-room');


// ===== Bước 2: Lắng nghe event ticket-called =====
socket.on('ticket-called', async (data) => {
  const { ticket, counterName } = data;

  // Tạo text đọc
  const text = `Vui lòng mời ông bà số ${ticket.formattedNumber} đến ${counterName}`;

  // Phát âm thanh
  try {
    await speakVietnamese(text);
    console.log('✅ Đã đọc:', text);
  } catch (error) {
    console.warn('Web Speech API lỗi, thử Google TTS...');
    try {
      await speakGoogleTTS(text);
    } catch (e) {
      console.error('Không thể phát âm thanh:', e);
    }
  }

  // Cập nhật UI hiển thị trên màn hình TV
  updateDisplay(data);
});


// ===== Bước 3: Hiển thị trên màn hình TV =====
const updateDisplay = (data) => {
  // Hiển thị số được gọi
  document.getElementById('called-number').textContent = data.ticket.formattedNumber;
  document.getElementById('counter-name').textContent = data.counterName;
  document.getElementById('customer-name').textContent = data.ticket.customerName;
  document.getElementById('service-name').textContent = data.ticket.serviceName;
};
```

---

## 6. Ví dụ React Component hoàn chỉnh

```jsx
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API_URL = 'http://localhost:5001';

// ===== Hook TTS =====
const useTTS = () => {
  const speak = async (text) => {
    // Cách 1: Web Speech API
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 0.9;

      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find(v => v.lang.includes('vi'));
      if (viVoice) utterance.voice = viVoice;

      window.speechSynthesis.speak(utterance);
      return;
    }

    // Cách 2: Google TTS fallback
    try {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=vi&client=tw-ob`;
      const audio = new Audio(url);
      await audio.play();
    } catch (e) {
      console.error('TTS failed:', e);
    }
  };

  return { speak };
};


// ===== Component Màn hình TV =====
const WaitingRoomDisplay = () => {
  const [calledTicket, setCalledTicket] = useState(null);
  const [waitingTickets, setWaitingTickets] = useState([]);
  const socketRef = useRef(null);
  const { speak } = useTTS();

  useEffect(() => {
    const socket = io(API_URL);
    socketRef.current = socket;

    socket.emit('join', 'waiting-room');

    // Khi có ticket được gọi
    socket.on('ticket-called', (data) => {
      setCalledTicket(data);

      // Phát âm thanh tiếng Việt
      const text = `Mời số ${data.ticket.formattedNumber} đến ${data.counterName}`;
      speak(text);
    });

    // Khi có ticket mới vào hàng chờ
    socket.on('new-ticket', (data) => {
      setWaitingTickets(prev => [...prev, data.ticket]);
    });

    // Khi ticket hoàn thành
    socket.on('ticket-completed', (data) => {
      setWaitingTickets(prev =>
        prev.filter(t => t.id !== data.ticketId)
      );
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div>
      {/* Ticket đang được gọi */}
      {calledTicket && (
        <div className="called-ticket">
          <h1>SỐ: {calledTicket.ticket.formattedNumber}</h1>
          <h2>{calledTicket.counterName}</h2>
          <p>{calledTicket.ticket.customerName}</p>
          <p>{calledTicket.ticket.serviceName}</p>
        </div>
      )}

      {/* Danh sách chờ */}
      <div className="waiting-list">
        <h3>Đang chờ ({waitingTickets.length})</h3>
        {waitingTickets.map(ticket => (
          <div key={ticket.id}>
            {ticket.formattedNumber} - {ticket.customerName}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WaitingRoomDisplay;
```

---

## 7. Lưu ý quan trọng

### Trình duyệt chặn autoplay

> [!WARNING]
> Trình duyệt hiện đại **chặn phát âm thanh tự động** nếu người dùng chưa tương tác với trang (click, scroll, v.v.)

**Giải pháp:** Thêm nút "Bật âm thanh" khi mở trang:

```jsx
const [audioEnabled, setAudioEnabled] = useState(false);

const enableAudio = () => {
  // Phát 1 âm thanh rỗng để "mở khóa" audio context
  const audio = new Audio();
  audio.play().catch(() => {});

  // Hoặc dùng Speech API
  const u = new SpeechSynthesisUtterance('');
  window.speechSynthesis.speak(u);

  setAudioEnabled(true);
};

// Hiển thị khi chưa bật
if (!audioEnabled) {
  return (
    <button onClick={enableAudio} style={{ fontSize: '24px', padding: '20px' }}>
      🔊 Bật âm thanh
    </button>
  );
}
```

### Voices cần thời gian load

```javascript
// Voices có thể chưa sẵn sàng ngay khi page load
// Dùng event để đợi
window.speechSynthesis.onvoiceschanged = () => {
  const voices = window.speechSynthesis.getVoices();
  console.log('Voices đã sẵn sàng:', voices.length);
};
```

---

## 8. Tóm tắt FE cần làm

| Bước | Việc cần làm | Ghi chú |
|------|-------------|---------|
| 1 | Kết nối Socket.IO, join room `waiting-room` | Để nhận event `ticket-called` |
| 2 | Lắng nghe event `ticket-called` | Chứa `formattedNumber` + `counterName` |
| 3 | Dùng `SpeechSynthesisUtterance` với `lang='vi-VN'` | Web Speech API miễn phí |
| 4 | Fallback sang Google TTS nếu Speech API lỗi | Chất lượng tốt hơn |
| 5 | Thêm nút "Bật âm thanh" cho màn hình TV | Vượt qua autoplay policy |
| 6 | **Không cần gọi thêm API nào** | BE tự phát TTS trên server |

### Flow tóm gọn

```
socket.on('ticket-called') → lấy formattedNumber + counterName
                            → tạo text tiếng Việt
                            → speechSynthesis.speak(text)
                            → cập nhật UI màn hình
```
