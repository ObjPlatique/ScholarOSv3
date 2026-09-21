import { NextResponse } from "next/server";

const MODEL = process.env.GEMINI_STUDY_MODEL || "gemini-3.5-flash-lite";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MAX_IMAGE_BASE64_LENGTH = 10 * 1024 * 1024;

const SYSTEM_INSTRUCTION = `Bạn là Study Assistant của ScholarOS.
- Trả lời bằng tiếng Việt nếu người dùng dùng tiếng Việt.
- Bạn có thể phân tích hình ảnh người dùng gửi, đặc biệt là đề bài, bài làm, biểu đồ, bảng biểu, ghi chép và tài liệu học tập.
- Khi có ảnh, hãy đọc các thông tin nhìn thấy trong ảnh và kết hợp với câu hỏi của người dùng.
- Nếu ảnh mờ, thiếu góc, hoặc không đọc được nội dung, nói rõ phần nào không chắc chắn thay vì đoán.
- Giải thích bản chất, các bước và ví dụ khi cần.
- Không bịa dữ kiện; nếu thiếu thông tin, nói rõ.
- Dùng Markdown ngắn gọn, dễ đọc.
- Không tự nhận mình là con người.`;

type HistoryItem = { role: "user" | "model"; text: string };
type ImageInput = { data: string; mimeType: string };

function validHistory(value: unknown): HistoryItem[] {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is HistoryItem =>
            !!item &&
            typeof item === "object" &&
            (((item as { role?: unknown }).role === "user") ||
              (item as { role?: unknown }).role === "model") &&
            typeof (item as { text?: unknown }).text === "string",
        )
        .slice(-6)
    : [];
}

function validImage(value: unknown): ImageInput | null {
  if (!value || typeof value !== "object") return null;
  const image = value as { data?: unknown; mimeType?: unknown };
  if (typeof image.data !== "string" || typeof image.mimeType !== "string") return null;
  if (!/^image\/(jpeg|png|webp)$/i.test(image.mimeType)) return null;
  if (image.data.length > MAX_IMAGE_BASE64_LENGTH) return null;
  return { data: image.data, mimeType: image.mimeType };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chưa cấu hình GEMINI_API_KEY trên môi trường server." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      message?: unknown;
      history?: unknown;
      image?: unknown;
    };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const image = validImage(body.image);

    if (!message && !image) {
      return NextResponse.json({ error: "Vui lòng nhập câu hỏi hoặc chọn một ảnh." }, { status: 400 });
    }

    if (body.image && !image) {
      return NextResponse.json(
        { error: "Ảnh không hợp lệ. Hãy dùng JPG, PNG hoặc WebP và chọn ảnh nhỏ hơn giới hạn cho phép." },
        { status: 400 },
      );
    }

    const history = validHistory(body.history);
    const conversation = history
      .map((item) => `${item.role === "user" ? "Người dùng" : "Study Assistant"}: ${item.text}`)
      .join("\n\n");

    const textInput = conversation
      ? `${conversation}\n\nNgười dùng: ${message || "Hãy phân tích ảnh này và giúp mình."}`
      : message || "Hãy phân tích ảnh này và giúp mình.";

    const input: Array<Record<string, string>> = [];
    if (image) {
      input.push({
        type: "image",
        data: image.data,
        mime_type: image.mimeType,
      });
    }
    input.push({ type: "text", text: textInput });

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: MODEL,
        input,
        system_instruction: SYSTEM_INSTRUCTION,
        stream: true,
        generation_config: {
          max_output_tokens: 4000,
          thinking_level: "minimal",
        },
      }),
      cache: "no-store",
    });

    if (!response.ok || !response.body) {
      let message = "Gemini không thể xử lý yêu cầu.";
      try {
        const data = (await response.json()) as { error?: { message?: string } };
        message = data.error?.message || message;
      } catch {}
      return NextResponse.json(
        { error: message },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Không thể kết nối tới Study Assistant. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
