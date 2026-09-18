import { NextResponse } from "next/server";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

type InteractionResponse = {
  status?: string;
  steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

type QuizQuestion = { question: string; options: string[]; answer: number; explanation: string };
type Quiz = { title: string; questions: QuizQuestion[] };

function extractText(data: InteractionResponse) {
  return data.steps
    ?.filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text || "")
    .join("")
    .trim() || "";
}

function parseJson(text: string): unknown {
  const cleaned = text.replace(/^\s*\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`\s*$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error("AI trả về dữ liệu không đúng định dạng.");
}

function validateQuiz(value: unknown, expectedCount: number): Quiz {
  if (!value || typeof value !== "object") throw new Error("Quiz không hợp lệ.");
  const raw = value as { title?: unknown; questions?: unknown };
  if (typeof raw.title !== "string" || !Array.isArray(raw.questions) || raw.questions.length !== expectedCount) throw new Error("AI không tạo đủ số câu yêu cầu.");
  const questions = raw.questions.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Một câu hỏi không hợp lệ.");
    const q = item as { question?: unknown; options?: unknown; answer?: unknown; explanation?: unknown };
    if (typeof q.question !== "string" || !Array.isArray(q.options) || q.options.length !== 4 || !q.options.every((x) => typeof x === "string") || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3 || typeof q.explanation !== "string") throw new Error("AI tạo câu hỏi không đúng cấu trúc.");
    return { question: q.question, options: q.options as string[], answer: q.answer, explanation: q.explanation };
  });
  return { title: raw.title, questions };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY trên môi trường server." }, { status: 503 });

  try {
    const body = (await request.json()) as { subject?: unknown; topic?: unknown; count?: unknown; difficulty?: unknown };
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const count = Number.isInteger(body.count) ? Math.min(15, Math.max(5, body.count as number)) : 5;
    const difficulty = typeof body.difficulty === "string" ? body.difficulty : "Trung bình";
    if (!subject) return NextResponse.json({ error: "Vui lòng nhập môn học." }, { status: 400 });

    const prompt = `Tạo một bộ trắc nghiệm học tập bằng tiếng Việt.
Môn: ${subject}
Chủ đề: ${topic || "Tự chọn kiến thức cốt lõi của môn"}
Số câu: ${count}
Độ khó: ${difficulty}

Yêu cầu:
- Đúng chính xác ${count} câu.
- Mỗi câu có đúng 4 phương án.
- answer là chỉ số 0-3 của phương án đúng.
- explanation giải thích ngắn gọn vì sao đáp án đúng.
- Câu hỏi phải có một đáp án đúng rõ ràng, không mơ hồ.
- Tránh lặp lại nội dung.
- Chỉ trả về JSON hợp lệ, không Markdown, không code fence.
- Cấu trúc:
{"title":"...","questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}`;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ model: MODEL, input: prompt }),
      cache: "no-store",
    });
    const data = (await response.json()) as InteractionResponse;
    if (!response.ok) return NextResponse.json({ error: data.error?.message || "Gemini không thể tạo quiz." }, { status: response.status >= 500 ? 502 : response.status });

    const text = extractText(data);
    if (!text) return NextResponse.json({ error: data.status && data.status !== "completed" ? `Gemini chưa hoàn tất phản hồi (trạng thái: ${data.status}).` : "AI không trả về nội dung." }, { status: 502 });

    const quiz = validateQuiz(parseJson(text), count);
    return NextResponse.json({ quiz });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể tạo quiz. Vui lòng thử lại." }, { status: 502 });
  }
}
