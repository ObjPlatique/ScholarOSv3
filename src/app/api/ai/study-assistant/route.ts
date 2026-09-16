import { NextResponse } from "next/server";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

const SYSTEM_INSTRUCTION = `Bạn là Study Assistant của ScholarOS, một trợ lý học tập thân thiện và chính xác.
- Trả lời bằng tiếng Việt nếu người dùng viết tiếng Việt; giữ nguyên ngôn ngữ nếu người dùng dùng ngôn ngữ khác.
- Ưu tiên giải thích để người học hiểu bản chất, không chỉ đưa đáp án.
- Với bài tập, trình bày các bước rõ ràng và kiểm tra kết quả khi có thể.
- Không bịa dữ kiện. Nếu đề bài thiếu thông tin, nói rõ phần còn thiếu.
- Dùng Markdown ngắn gọn, dễ đọc trên điện thoại.
- Không tự nhận mình là giáo viên hay con người.`;

type HistoryItem = { role: "user" | "model"; text: string };

type InteractionResponse = {
  status?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: { message?: string };
};

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
    };

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "Vui lòng nhập câu hỏi." }, { status: 400 });
    }

    const history: HistoryItem[] = Array.isArray(body.history)
      ? body.history
          .filter(
            (item): item is HistoryItem =>
              !!item &&
              typeof item === "object" &&
              (((item as { role?: unknown }).role === "user") ||
                (item as { role?: unknown }).role === "model") &&
              typeof (item as { text?: unknown }).text === "string",
          )
          .slice(-12)
      : [];

    const conversation = history
      .map((item) => `${item.role === "user" ? "Người dùng" : "Study Assistant"}: ${item.text}`)
      .join("\n\n");

    const input = conversation
      ? `${conversation}\n\nNgười dùng: ${message}`
      : message;

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
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as InteractionResponse;

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Gemini không thể xử lý yêu cầu." },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    // Interactions API returns model text under steps[].content[].text.
    const text = data.steps
      ?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text || "")
      .join("")
      .trim();

    if (!text) {
      return NextResponse.json(
        {
          error:
            data.status && data.status !== "completed"
              ? `Gemini chưa hoàn tất phản hồi (trạng thái: ${data.status}).`
              : "AI không trả về nội dung.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "Không thể kết nối tới Study Assistant. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
