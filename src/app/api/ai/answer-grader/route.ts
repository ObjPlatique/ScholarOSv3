import { NextResponse } from "next/server";

const MODEL = process.env.GEMINI_GRADER_MODEL || "gemini-3.5-flash-lite";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MAX_IMAGE_BASE64_LENGTH = 10 * 1024 * 1024;

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

type ImageInput = { data: string; mimeType: string };
const MAX_IMAGES_PER_GROUP = 8;

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
  if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY trên môi trường server." }, { status: 503 });

  try {
    const body = await request.json() as {
      subject?: unknown;
      question?: unknown;
      expectedAnswer?: unknown;
      studentAnswer?: unknown;
      rubric?: unknown;
      questionImage?: unknown;
      answerImage?: unknown;
      questionImages?: unknown;
      answerImages?: unknown;
    };

    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const expectedAnswer = typeof body.expectedAnswer === "string" ? body.expectedAnswer.trim() : "";
    const studentAnswer = typeof body.studentAnswer === "string" ? body.studentAnswer.trim() : "";
    const rubric = typeof body.rubric === "string" ? body.rubric.trim() : "";
    const questionImages = Array.isArray(body.questionImages)
      ? body.questionImages.map(validImage).filter((image): image is ImageInput => !!image)
      : body.questionImage
        ? [validImage(body.questionImage)].filter((image): image is ImageInput => !!image)
        : [];
    const answerImages = Array.isArray(body.answerImages)
      ? body.answerImages.map(validImage).filter((image): image is ImageInput => !!image)
      : body.answerImage
        ? [validImage(body.answerImage)].filter((image): image is ImageInput => !!image)
        : [];

    if (!question && questionImages.length === 0) {
      return NextResponse.json({ error: "Cần có câu hỏi bằng văn bản hoặc ít nhất một ảnh chứa câu hỏi." }, { status: 400 });
    }
    if (!studentAnswer && answerImages.length === 0) {
      return NextResponse.json({ error: "Cần có câu trả lời bằng văn bản hoặc ít nhất một ảnh chứa câu trả lời." }, { status: 400 });
    }
    if (questionImages.length > MAX_IMAGES_PER_GROUP || answerImages.length > MAX_IMAGES_PER_GROUP) {
      return NextResponse.json({ error: `Mỗi phần chỉ được gửi tối đa ${MAX_IMAGES_PER_GROUP} ảnh.` }, { status: 400 });
    }
    const questionImageCount = Array.isArray(body.questionImages) ? body.questionImages.length : body.questionImage ? 1 : 0;
    const answerImageCount = Array.isArray(body.answerImages) ? body.answerImages.length : body.answerImage ? 1 : 0;
    if (questionImages.length !== questionImageCount || answerImages.length !== answerImageCount) {
      return NextResponse.json(
        { error: "Ảnh không hợp lệ. Chỉ hỗ trợ JPG, PNG hoặc WebP và mỗi ảnh phải nhỏ hơn 6 MB." },
        { status: 400 },
      );
    }

    const prompt = `Bạn là AI chấm bài học tập bằng tiếng Việt.
Môn: ${subject || "chưa xác định"}

Câu hỏi:
${question || "Hãy đọc đề bài từ ảnh đính kèm."}

Đáp án tham khảo (nếu có):
${expectedAnswer || "Không có; hãy tự xác định đáp án hợp lý."}

Tiêu chí chấm (nếu có):
${rubric || "Đánh giá độ chính xác, lập luận, mức độ đầy đủ và cách trình bày."}

Câu trả lời của học sinh:
${studentAnswer || "Hãy đọc bài làm từ ảnh đính kèm."}

Nếu có ảnh, các ảnh thuộc nhóm câu hỏi (nếu có) chứa đề bài, sau đó các ảnh thuộc nhóm câu trả lời (nếu có) chứa bài làm của học sinh. Hãy đọc chính xác từng ảnh và kết hợp với phần văn bản tương ứng.
Nếu ảnh mờ hoặc không đủ thông tin, nêu rõ phần không chắc chắn và không tự bịa nội dung.

Chấm trên thang 10. Không chỉ so khớp từ khóa; hãy xét ý nghĩa, lập luận và mức độ đúng.
Trả JSON đúng schema. feedback ngắn gọn nhưng cụ thể. strengths/mistakes/suggestions là các gạch đầu dòng ngắn.
referenceAnswer là đáp án/cách giải mẫu ngắn gọn để học sinh đối chiếu.`;

    const input: Array<Record<string, string>> = [];
    questionImages.forEach((image) => {
      input.push({ type: "image", data: image.data, mime_type: image.mimeType });
    });
    answerImages.forEach((image) => {
      input.push({ type: "image", data: image.data, mime_type: image.mimeType });
    });
    input.push({ type: "text", text: prompt });

    // Interactions API accepts multiple image content blocks in one input array.
    // Keep text last so the model sees the complete visual context before the instruction.
    if (input.filter((item) => item.type === "image").length > 1) {
      console.info("[AI] multi-image request", { imageCount: input.filter((item) => item.type === "image").length });
    }

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        input,
        generation_config: { max_output_tokens: 1800, thinking_level: "minimal" },
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
    if (!response.ok) {
      console.error("[AI] Gemini request failed", { status: response.status, error: data.error?.message });
      return NextResponse.json(
        { error: data.error?.message || `Gemini từ chối yêu cầu (HTTP ${response.status}).` },
        { status: 502 },
      );
    }
    if (data.status === "incomplete") return NextResponse.json({ error: "AI chưa hoàn tất việc chấm bài. Vui lòng thử lại." }, { status: 502 });

    const text = extractText(data);
    if (!text) return NextResponse.json({ error: "AI không trả về kết quả chấm." }, { status: 502 });
    return NextResponse.json({ result: validate(JSON.parse(text)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể chấm bài." }, { status: 502 });
  }
}
