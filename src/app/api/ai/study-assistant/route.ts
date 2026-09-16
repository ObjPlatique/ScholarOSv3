import { NextResponse } from "next/server";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = `Bạn là Study Assistant của ScholarOS, một trợ lý học tập thân thiện và chính xác.
- Trả lời bằng tiếng Việt nếu người dùng viết tiếng Việt; giữ nguyên ngôn ngữ nếu người dùng dùng ngôn ngữ khác.
- Ưu tiên giải thích để người học hiểu bản chất, không chỉ đưa đáp án.
- Với bài tập, trình bày các bước rõ ràng và kiểm tra kết quả khi có thể.
- Không bịa dữ kiện. Nếu đề bài thiếu thông tin, nói rõ phần còn thiếu.
- Dùng Markdown ngắn gọn, dễ đọc trên điện thoại.
- Không tự nhận mình là giáo viên hay con người.`;

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

    const history = Array.isArray(body.history)
      ? body.history
          .filter(
            (item): item is { role: "user" | "model"; text: string } =>
              !!item &&
              typeof item === "object" &&
              ((item as { role?: unknown }).role === "user" ||
                (item as { role?: unknown }).role === "model") &&
              typeof (item as { text?: unknown }).text === "string",
          )
          .slice(-12)
      : [];

    const contents = [
      ...history.map((item) => ({
        role: item.role,
        parts: [{ text: item.text }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const response = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents,
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 2048,
        },
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Gemini không thể xử lý yêu cầu." },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "AI không trả về nội dung." }, { status: 502 });
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "Không thể kết nối tới Study Assistant. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
