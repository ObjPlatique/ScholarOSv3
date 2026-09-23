import { NextResponse } from "next/server";

const PRIMARY_MODEL = process.env.GEMINI_STUDY_MODEL || "gemini-3.5-flash-lite";
const FALLBACK_MODEL = process.env.GEMINI_STUDY_FALLBACK_MODEL || "";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MAX_IMAGE_BASE64_LENGTH = 10 * 1024 * 1024;

const SYSTEM_INSTRUCTION = `Bạn là Study Assistant của ScholarOS.
Trả lời bằng tiếng Việt nếu người dùng dùng tiếng Việt.
Giải thích đúng bản chất, từng bước khi cần; không bịa dữ kiện.
Có thể phân tích ảnh đề bài, bài làm, biểu đồ, bảng và ghi chép.
Nếu ảnh không rõ hoặc thiếu thông tin, nói rõ thay vì đoán.
Ưu tiên câu trả lời ngắn gọn, trực tiếp, dễ đọc bằng Markdown.`;

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
        .slice(-4)
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

  const geminiHeaders = new Headers();
  geminiHeaders.set("Content-Type", "application/json");
  geminiHeaders.set("x-goog-api-key", apiKey);

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

    async function callModel(model: string) {
      return fetch(API_URL, {
        method: "POST",
        headers: geminiHeaders,
        body: JSON.stringify({
          model,
          input,
          system_instruction: SYSTEM_INSTRUCTION,
          stream: true,
          generation_config: {
            max_output_tokens: 1200,
            thinking_level: "minimal",
          },
        }),
        cache: "no-store",
      });
    }

    let response = await callModel(PRIMARY_MODEL);

    let fallbackUsed = false;
    if (
      !response.ok &&
      [429, 500, 502, 503, 504].includes(response.status) &&
      FALLBACK_MODEL &&
      FALLBACK_MODEL !== PRIMARY_MODEL
    ) {
      fallbackUsed = true;
      response = await callModel(FALLBACK_MODEL);
    }

    if (!response.ok || !response.body) {
      let errorMessage = "Gemini không thể xử lý yêu cầu.";
      try {
        const data = (await response.json()) as { error?: { message?: string } };
        errorMessage = data.error?.message || errorMessage;
      } catch {}

      if (fallbackUsed) {
        errorMessage = "Model Gemini đang quá tải. Vui lòng thử lại sau ít phút.";
      }

      return NextResponse.json(
        { error: errorMessage },
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
