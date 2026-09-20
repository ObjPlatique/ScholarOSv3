import { NextResponse } from "next/server";

const MODEL = process.env.GEMINI_GRADER_MODEL || "gemini-3.5-flash-lite";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

type GradingResult = {
  score: number;
  verdict: string;
  feedback: string;
  strengths: string[];
  mistakes: string[];
  suggestions: string[];
  referenceAnswer: string;
};

type ResponseData = {
  status?: string;
  steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

function extractText(data: ResponseData) {
  return data.steps?.filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text || "").join("").trim() || "";
}

function validate(value: unknown): GradingResult {
  if (!value || typeof value !== "object") throw new Error("AI trả về kết quả chấm không hợp lệ.");
  const x = value as Record<string, unknown>;
  if (!Number.isFinite(x.score) || typeof x.verdict !== "string" || typeof x.feedback !== "string" ||
      !Array.isArray(x.strengths) || !Array.isArray(x.mistakes) || !Array.isArray(x.suggestions) ||
      typeof x.referenceAnswer !== "string") {
    throw new Error("AI trả về sai cấu trúc kết quả chấm.");
  }
  return {
    score: Math.max(0, Math.min(10, Number(x.score))),
    verdict: x.verdict,
    feedback: x.feedback,
    strengths: x.strengths.filter((v): v is string => typeof v === "string").slice(0, 6),
    mistakes: x.mistakes.filter((v): v is string => typeof v === "string").slice(0, 8),
    suggestions: x.suggestions.filter((v): v is string => typeof v === "string").slice(0, 6),
    referenceAnswer: x.referenceAnswer,
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY trên môi trường server." }, { status: 503 });

  try {
    const body = await request.json() as {
      subject?: unknown; question?: unknown; expectedAnswer?: unknown; studentAnswer?: unknown; rubric?: unknown;
    };
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const expectedAnswer = typeof body.expectedAnswer === "string" ? body.expectedAnswer.trim() : "";
    const studentAnswer = typeof body.studentAnswer === "string" ? body.studentAnswer.trim() : "";
    const rubric = typeof body.rubric === "string" ? body.rubric.trim() : "";

    if (!question || !studentAnswer) {
      return NextResponse.json({ error: "Cần có câu hỏi và câu trả lời của học sinh." }, { status: 400 });
    }

    const prompt = `Bạn là AI chấm bài học tập bằng tiếng Việt.
Môn: ${subject || "chưa xác định"}
Câu hỏi:
${question}

Đáp án tham khảo (nếu có):
${expectedAnswer || "Không có; hãy tự xác định đáp án hợp lý."}

Tiêu chí chấm (nếu có):
${rubric || "Đánh giá độ chính xác, lập luận, mức độ đầy đủ và cách trình bày."}

Câu trả lời của học sinh:
${studentAnswer}

Chấm trên thang 10. Không chỉ so khớp từ khóa; hãy xét ý nghĩa, lập luận và mức độ đúng.
Trả JSON đúng schema. feedback ngắn gọn nhưng cụ thể. strengths/mistakes/suggestions là các gạch đầu dòng ngắn.
referenceAnswer là đáp án/cách giải mẫu ngắn gọn để học sinh đối chiếu.`;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        input: prompt,
        generation_config: { max_output_tokens: 1400, thinking_level: "minimal" },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              score: { type: "number", minimum: 0, maximum: 10 },
              verdict: { type: "string" },
              feedback: { type: "string" },
              strengths: { type: "array", items: { type: "string" } },
              mistakes: { type: "array", items: { type: "string" } },
              suggestions: { type: "array", items: { type: "string" } },
              referenceAnswer: { type: "string" },
            },
            required: ["score", "verdict", "feedback", "strengths", "mistakes", "suggestions", "referenceAnswer"],
          },
        },
      }),
      cache: "no-store",
    });

    const data = await response.json() as ResponseData;
    if (!response.ok) return NextResponse.json({ error: data.error?.message || "Gemini không thể chấm bài." }, { status: 502 });
    if (data.status === "incomplete") return NextResponse.json({ error: "AI chưa hoàn tất việc chấm bài. Vui lòng thử lại." }, { status: 502 });

    const text = extractText(data);
    if (!text) return NextResponse.json({ error: "AI không trả về kết quả chấm." }, { status: 502 });
    return NextResponse.json({ result: validate(JSON.parse(text)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể chấm bài." }, { status: 502 });
  }
}
