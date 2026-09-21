import { NextResponse } from "next/server";

const MODEL = process.env.GEMINI_STUDY_MODEL || "gemini-3.5-flash-lite";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

const SYSTEM_INSTRUCTION = `Bạn là Study Assistant của ScholarOS.
- Trả lời bằng tiếng Việt nếu người dùng dùng tiếng Việt.
- Giải thích bản chất, các bước và ví dụ khi cần.
- Không bịa dữ kiện; nếu thiếu thông tin, nói rõ.
- Dùng Markdown ngắn gọn, dễ đọc.
- Không tự nhận mình là con người.`;

type HistoryItem = { role: "user" | "model"; text: string };

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

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chưa cấu hình GEMINI_API_KEY trên môi trường server." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { message?: unknown; history?: unknown };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "Vui lòng nhập câu hỏi." }, { status: 400 });

    const history = validHistory(body.history);
    const conversation = history
      .map((item) => `${item.role === "user" ? "Người dùng" : "Study Assistant"}: ${item.text}`)
      .join("\n\n");
    const input = conversation ? `${conversation}\n\nNgười dùng: ${message}` : message;

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
