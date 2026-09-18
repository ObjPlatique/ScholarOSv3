import { NextResponse } from "next/server";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

const SYSTEM_INSTRUCTION = `Bạn là Study Assistant của ScholarOS.
- Trả lời bằng tiếng Việt nếu người dùng viết tiếng Việt; giữ nguyên ngôn ngữ nếu dùng ngôn ngữ khác.
- Giải thích đúng bản chất, rõ ràng và ngắn gọn.
- Với bài tập, trình bày các bước cần thiết và kiểm tra kết quả khi có thể.
- Không bịa dữ kiện; nếu thiếu thông tin thì nói rõ.
- Dùng Markdown ngắn gọn, dễ đọc trên điện thoại.`;

type HistoryItem = { role: "user" | "model"; text: string };
type InteractionResponse = {
  status?: string;
  steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY trên môi trường server." }, { status: 503 });

  try {
    const body = (await request.json()) as { message?: unknown; history?: unknown };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "Vui lòng nhập câu hỏi." }, { status: 400 });

    const history: HistoryItem[] = Array.isArray(body.history)
      ? body.history
          .filter((item): item is HistoryItem =>
            !!item &&
            typeof item === "object" &&
            (((item as { role?: unknown }).role === "user") || (item as { role?: unknown }).role === "model") &&
            typeof (item as { text?: unknown }).text === "string",
          )
          .slice(-4)
      : [];

    const conversation = history
      .map((item) => `${item.role === "user" ? "Người dùng" : "Study Assistant"}: ${item.text}`)
      .join("\n\n");
    const input = conversation ? `${conversation}\n\nNgười dùng: ${message}` : message;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        input,
        system_instruction: SYSTEM_INSTRUCTION,
        generation_config: { max_output_tokens: 700, thinking_level: "low" },
        stream: true,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const data = (await response.json()) as InteractionResponse;
      return NextResponse.json({ error: data.error?.message || "Gemini không thể xử lý yêu cầu." }, { status: response.status >= 500 ? 502 : response.status });
    }
    if (!response.body) return NextResponse.json({ error: "Gemini không trả về stream." }, { status: 502 });
    return new Response(response.body, { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no" } });

    const text = data.steps
      ?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text || "")
      .join("")
      .trim();

    if (!text) {
      return NextResponse.json(
        { error: data.status && data.status !== "completed" ? `Gemini chưa hoàn tất phản hồi (trạng thái: ${data.status}).` : "AI không trả về nội dung." },
        { status: 502 },
      );
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "Không thể kết nối tới Study Assistant. Vui lòng thử lại." }, { status: 500 });
  }
}
