const Service = require("../models/service.model");
const Setting = require("../models/setting.model");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/Logger");
const config = require("../config/env");

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const AI_KNOWLEDGE_SETTING_KEY = "ai_assistant_knowledge";

// Nội dung huấn luyện mặc định — dùng khi admin chính chưa lưu huấn luyện riêng
// nào trong DB. Admin chính nên vào trang "Trợ lý AI" > "Huấn luyện AI" để điền
// các phần [...] theo dữ liệu thực tế rồi lưu lại, thay cho bản mặc định này.
const DEFAULT_KNOWLEDGE = `Bạn tên là "Hệ thống AI Toàn án" — trợ lý AI nội bộ của hệ thống lấy số Tòa án Nhân dân Khu Vực 1.

VỀ HỆ THỐNG:
- Đây là hệ thống lấy số thứ tự tại tòa án. "Quầy" = loại hồ sơ/dịch vụ cần xử lý (ví dụ: Nộp đơn, Nhận kết quả, Tư vấn, Khiếu nại, Hành chính). "Phòng" = nơi nhân viên trực xử lý. Người dân chỉ cần biết chọn đúng Quầy theo nhu cầu, hệ thống tự xếp vào Phòng phù hợp.
- Khi người dân hỏi "lấy số ở đâu/làm gì", luôn trả lời theo TÊN QUẦY, không cần nói số phòng.

GIỜ LÀM VIỆC:
- Sáng: 8h00 - 11h30
- Nghỉ trưa: 11h30 - 13h30
- Chiều: 13h30 - 17h00
- Ngoài giờ này hệ thống không cho lấy số.

DANH SÁCH QUẦY VÀ HỒ SƠ XỬ LÝ (admin điền/sửa theo thực tế):
- Nộp đơn: [điền loại đơn nhận tại đây, ví dụ: đơn ly hôn, đơn khởi kiện dân sự...]. Cần mang: [điền giấy tờ cần mang]
- Nhận kết quả: [điền điều kiện nhận, ví dụ: cần giấy hẹn]
- Tư vấn: [điền nội dung được tư vấn]
- Khiếu nại: [điền loại khiếu nại nhận tại đây]
- Hành chính: [điền các việc xử lý tại quầy này]

LIÊN HỆ HỖ TRỢ HỆ THỐNG: 0338047406 / b2bhuy@gmail.com

CẤU HÌNH HỆ THỐNG (admin có thể chỉnh tại trang Cài đặt):
- Thời gian hoạt động: giờ mở cửa, đóng cửa của tòa án để hệ thống cấp số phù hợp.
- Thông báo: các tin nhắn thông báo tự động cho người dân, ví dụ thông báo khi đến lượt, thông báo thay đổi lịch.
- Số lượng số tối đa: giới hạn số lượt lấy số cho mỗi dịch vụ hoặc tổng thể trong một ngày.
- Cài đặt hiển thị: tùy chỉnh giao diện hiển thị trên màn hình chờ, màn hình cấp số.
- Quản lý tài khoản: thêm, sửa, xóa tài khoản nhân viên và phân quyền truy cập.

QUY TẮC TRẢ LỜI:
- Chỉ trả lời theo thông tin có ở trên và danh sách dịch vụ thực tế trong hệ thống. Không có thông tin thì nói rõ "chưa có thông tin, vui lòng hỏi trực tiếp nhân viên".
- Không tư vấn pháp lý cụ thể cho vụ việc cụ thể của người dân (ví dụ khả năng thắng/thua kiện).
- Trả lời ngắn gọn, đi thẳng vào việc cần làm.`;

// Giới hạn lịch sử hội thoại gửi lên API để tránh tốn token và tránh prompt injection dài
const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 1000;

/**
 * Lấy nội dung "huấn luyện" do admin tự nhập (hướng dẫn nghiệp vụ, quy định riêng
 * của tòa án...) được lưu trong collection Setting. Đây là cách admin tùy biến
 * AI mà không cần fine-tune mô hình.
 */
const getKnowledge = async () => {
  const doc = await Setting.findOne({ key: AI_KNOWLEDGE_SETTING_KEY }).lean();
  return doc?.value || "";
};

const setKnowledge = async (knowledge) => {
  await Setting.findOneAndUpdate(
    { key: AI_KNOWLEDGE_SETTING_KEY },
    {
      $set: {
        key: AI_KNOWLEDGE_SETTING_KEY,
        value: knowledge,
        description: "Nội dung hướng dẫn/kiến thức riêng do admin nhập cho trợ lý AI",
      },
    },
    { upsert: true },
  );
  return knowledge;
};

/**
 * Lấy danh sách dịch vụ đang hoạt động từ DB để làm "ngữ cảnh" (RAG đơn giản)
 * cho AI trả lời đúng theo dữ liệu thật của tòa án, tránh AI tự bịa thông tin.
 */
const buildServiceContext = async () => {
  const services = await Service.find({ isActive: true })
    .select("name code description isOpen")
    .sort({ displayOrder: 1 })
    .lean();

  if (services.length === 0) {
    return "Hiện chưa có dữ liệu dịch vụ nào trong hệ thống.";
  }

  return services
    .map((service, index) => {
      const status = service.isOpen ? "đang mở" : "tạm đóng";
      const description = service.description?.trim()
        ? service.description.trim()
        : "Chưa có mô tả chi tiết.";
      return `${index + 1}. ${service.name} (mã: ${service.code}) - Trạng thái: ${status}. Mô tả: ${description}`;
    })
    .join("\n");
};

const buildSystemPrompt = (serviceContext, adminKnowledge) => `Bạn là trợ lý AI nội bộ hỗ trợ ADMIN của hệ thống lấy số tòa án. Người hỏi là quản trị viên/nhân viên quản lý hệ thống, không phải người dân.

NHIỆM VỤ:
- Trả lời ngắn gọn, rõ ràng, đúng trọng tâm bằng tiếng Việt.
- Nếu câu trả lời cần dài (ví dụ hướng dẫn nhiều bước), hãy chia theo từng mục/số thứ tự ngắn gọn, tránh viết quá dài dòng không cần thiết.
- Hỗ trợ admin tra cứu, giải thích về dịch vụ, quy trình lấy số, vận hành quầy.
- Ưu tiên tuyệt đối nội dung "HƯỚNG DẪN RIÊNG TỪ ADMIN" ở dưới nếu có — đây là kiến thức do admin tự nhập để huấn luyện bạn theo đúng quy định nội bộ.
- Chỉ sử dụng thông tin về dịch vụ và hướng dẫn được cung cấp dưới đây. Nếu không có thông tin phù hợp, hãy nói rõ là không chắc, không tự bịa thêm.
- Không đưa ra tư vấn pháp lý cụ thể cho vụ việc cá nhân của người dân; chỉ hỗ trợ về thủ tục/vận hành hệ thống.

ĐỊNH DẠNG TRẢ LỜI (bắt buộc tuân thủ, vì khung chat chỉ hiển thị văn bản thuần, không hiển thị markdown):
- KHÔNG dùng ký hiệu markdown: không dùng **chữ đậm**, không dùng dấu #, không dùng dấu *, không dùng bảng markdown, không dùng \`code\`.
- Khi liệt kê nhiều ý, dùng gạch đầu dòng "- " ở đầu mỗi dòng, mỗi ý xuống một dòng riêng.
- Khi liệt kê các bước theo thứ tự, dùng số "1. ", "2. ", "3. " ở đầu mỗi dòng, mỗi bước một dòng riêng, không gộp nhiều bước vào một dòng.
- Muốn nhấn mạnh thì viết hoa từ khóa hoặc đặt dấu hai chấm rõ ràng, không dùng ký hiệu in đậm.
- Giữa các đoạn/nhóm ý khác nhau, để một dòng trống để dễ đọc.
- Câu trả lời ngắn (1-2 ý) thì viết liền mạch như hội thoại bình thường, không cần xuống dòng/gạch đầu dòng.

HƯỚNG DẪN RIÊNG TỪ ADMIN (ưu tiên cao nhất):
${adminKnowledge?.trim() ? adminKnowledge.trim() : DEFAULT_KNOWLEDGE}

DANH SÁCH DỊCH VỤ ĐANG HOẠT ĐỘNG TẠI TÒA:
${serviceContext}`;

/**
 * Dọn các ký hiệu markdown phổ biến mà model có thể lỡ dùng (in đậm, tiêu đề,
 * code inline...) — phòng trường hợp model không tuân thủ tuyệt đối hướng dẫn
 * định dạng trong system prompt, tránh hiển thị "**" "##" trần trụi trên UI
 * vì khung chat chỉ render văn bản thuần.
 */
const sanitizeMarkdown = (text) => {
  if (!text) return text;
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // **bold** -> bold
    .replace(/__(.*?)__/g, "$1") // __bold__ -> bold
    .replace(/^#{1,6}\s+/gm, "") // # Heading -> Heading
    .replace(/`([^`]*)`/g, "$1") // `code` -> code
    .replace(/^\s*[-*]\s+/gm, "- "); // chuẩn hóa bullet về "- "
};

const sanitizeHistory = (history = []) => {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (item) =>
        item &&
        typeof item.content === "string" &&
        ["user", "assistant"].includes(item.role),
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role,
      content: item.content.slice(0, MAX_MESSAGE_LENGTH),
    }));
};

const askAssistant = async ({ message, history = [] }) => {
  if (!config.openrouterApiKey) {
    throw new ApiError(
      500,
      "Chưa cấu hình OPENROUTER_API_KEY trên server. Vui lòng liên hệ quản trị viên.",
    );
  }

  const trimmedMessage = message?.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmedMessage) {
    throw new ApiError(400, "Vui lòng nhập câu hỏi");
  }

  const serviceContext = await buildServiceContext();
  const adminKnowledge = await getKnowledge();
  const systemPrompt = buildSystemPrompt(serviceContext, adminKnowledge);

  const messages = [
    { role: "system", content: systemPrompt },
    ...sanitizeHistory(history),
    { role: "user", content: trimmedMessage },
  ];

  let response;
  try {
    response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.openrouterApiKey}`,
        // 2 header dưới là khuyến nghị của OpenRouter để hiển thị trên dashboard
        // của họ, không bắt buộc nhưng nên có để dễ theo dõi usage.
        ...(config.openrouterSiteUrl ? { "HTTP-Referer": config.openrouterSiteUrl } : {}),
        ...(config.openrouterSiteName ? { "X-Title": config.openrouterSiteName } : {}),
      },
      body: JSON.stringify({
        model: config.openrouterModel,
        messages,
        max_tokens: 2048,
        temperature: 0.4,
      }),
    });
  } catch (error) {
    logger.error(`Lỗi kết nối tới OpenRouter API: ${error.message}`);
    throw new ApiError(502, "Không thể kết nối tới dịch vụ AI, vui lòng thử lại sau");
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errMessage = errorBody?.error?.message || "unknown";
    logger.error(`OpenRouter API lỗi (${response.status}): ${errMessage}`);

    if (response.status === 401) {
      throw new ApiError(500, "API key OpenRouter không hợp lệ. Vui lòng kiểm tra lại OPENROUTER_API_KEY.");
    }
    if (response.status === 402) {
      throw new ApiError(500, "Tài khoản OpenRouter không đủ credit. Vui lòng nạp thêm hoặc đổi model miễn phí.");
    }
    if (response.status === 403) {
      throw new ApiError(500, "API key OpenRouter không có quyền truy cập model này.");
    }
    if (response.status === 429) {
      throw new ApiError(
        429,
        "Đã vượt giới hạn tốc độ của OpenRouter, vui lòng thử lại sau ít phút.",
      );
    }
    throw new ApiError(502, "Dịch vụ AI hiện không phản hồi được, vui lòng thử lại sau");
  }

  const data = await response.json();

  const choice = data?.choices?.[0];
  let reply = (choice?.message?.content || "").trim();
  reply = sanitizeMarkdown(reply);
  const finishReason = choice?.finish_reason;

  if (!reply && finishReason === "content_filter") {
    logger.error("OpenRouter API: phản hồi bị chặn bởi content filter");
  }

  // Câu trả lời bị cắt giữa câu do chạm giới hạn token — báo rõ cho admin
  // thay vì im lặng để họ biết cần hỏi gọn hơn hoặc bấm "tiếp tục".
  if (reply && finishReason === "length") {
    logger.error("OpenRouter API: phản hồi bị cắt do chạm giới hạn max_tokens");
    reply += '\n\n*(Câu trả lời còn dài và đã bị cắt ngắn vì quá giới hạn. Bạn có thể nhắn "tiếp tục" hoặc hỏi cụ thể hơn để AI trả lời gọn hơn.)*';
  }

  return {
    reply: reply || "Xin lỗi, tôi chưa thể trả lời câu hỏi này. Vui lòng thử diễn đạt lại câu hỏi.",
    usage: data?.usage || null,
  };
};

module.exports = {
  askAssistant,
  getKnowledge,
  setKnowledge,
  DEFAULT_KNOWLEDGE,
};