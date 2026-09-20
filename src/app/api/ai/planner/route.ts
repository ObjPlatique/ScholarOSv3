import { NextResponse } from "next/server";

const MODEL = process.env.GEMINI_PLANNER_MODEL || "gemini-3.5-flash-lite";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

type ResponseData = {
  status?: string;
  steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

function extractText(data: ResponseData) {
  return data.steps?.filter((step) => step.type === "model_output").flatMap((step) => step.content ?? [])
    .filter((item) => item.type === "text" && typeof item.text === "string").map((item) => item.text || "").join("").trim() || "";
}

function validatePlan(value: unknown): Plan {
  if (!value || typeof value !== "object") throw new Error("AI trả về kế hoạch không hợp lệ.");
  const raw = value as { title?: unknown; summary?: unknown; dailyFocus?: unknown; items?: unknown; tips?: unknown };
  if (typeof raw.title !== "string" || typeof raw.summary !== "string" || typeof raw.dailyFocus !== "string" || !Array.isArray(raw.items) || !Array.isArray(raw.tips)) throw new Error("AI trả về sai cấu trúc kế hoạch.");
  const items = raw.items.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Một ngày trong kế hoạch không hợp lệ.");
    const x = item as { date?: unknown; subject?: unknown; tasks?: unknown; minutes?: unknown; priority?: unknown };
    if (typeof x.date !== "string" || typeof x.subject !== "string" || !Array.isArray(x.tasks) || !x.tasks.every((t) => typeof t === "string") || !Number.isInteger(x.minutes) || (x.minutes as number) < 15 || typeof x.priority !== "string") {
      throw new Error("AI tạo lịch học không đúng cấu trúc.");
    }
    return { date: x.date, subject: x.subject, tasks: x.tasks as string[], minutes: x.minutes as number, priority: x.priority };
  });
  const tips = raw.tips.filter((x): x is string => typeof x === "string").slice(0, 6);
  return { title: raw.title, summary: raw.summary, dailyFocus: raw.dailyFocus, items, tips };
}

type Plan = {
  title: string;
  summary: string;
  dailyFocus: string;
  items: Array<{ date: string; subject: string; tasks: string[]; minutes: number; priority: string }>;
  tips: string[];
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY trên môi trường server." }, { status: 503 });

  try {
    const body = await request.json() as { goal?: unknown; subjects?: unknown; examDate?: unknown; hours?: unknown; level?: unknown; constraints?: unknown; context?: unknown };
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    const subjects = typeof body.subjects === "string" ? body.subjects.trim() : "";
    const examDate = typeof body.examDate === "string" ? body.examDate : "";
    const hours = typeof body.hours === "number" ? Math.min(12, Math.max(1, body.hours)) : 3;
    const level = typeof body.level === "string" ? body.level : "Trung bình";
    const constraints = typeof body.constraints === "string" ? body.constraints.trim() : "";
    const context = body.context && typeof body.context === "object" ? body.context : {};
    if (!goal) return NextResponse.json({ error: "Vui lòng nhập mục tiêu." }, { status: 400 });

    const prompt = `Lập kế hoạch học tập bằng tiếng Việt.
Mục tiêu: ${goal}
Môn học: ${subjects || "chọn môn phù hợp với mục tiêu"}
Ngày thi/deadline: ${examDate || "chưa xác định"}
Thời gian: ${hours} giờ/ngày
Mức hiện tại: ${level}
Ràng buộc: ${constraints || "không có"}

Tạo kế hoạch cho 7 ngày tiếp theo. Ưu tiên tính khả thi, xen kẽ môn và có thời gian ôn lại.
- items: tối đa 2 phiên/ngày, tổng phút mỗi ngày không vượt quá ${hours * 60}.
- date dùng YYYY-MM-DD.
- tasks ngắn, cụ thể, có thể thực hiện ngay.
- dailyFocus là một câu mô tả trọng tâm tuần.
- tips tối đa 6 mục.
Chỉ trả JSON đúng schema.`;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        input: prompt,
        generation_config: { max_output_tokens: 2800, thinking_level: "minimal" },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              dailyFocus: { type: "string" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    date: { type: "string" },
                    subject: { type: "string" },
                    tasks: { type: "array", items: { type: "string" } },
                    minutes: { type: "integer", minimum: 15 },
                    priority: { type: "string" },
                  },
                  required: ["date", "subject", "tasks", "minutes", "priority"],
                },
              },
              tips: { type: "array", items: { type: "string" } },
            },
            required: ["title", "summary", "dailyFocus", "items", "tips"],
          },
        },
      }),
      cache: "no-store",
    });

    const data = await response.json() as ResponseData;
    if (!response.ok) return NextResponse.json({ error: data.error?.message || "Gemini không thể lập kế hoạch." }, { status: response.status >= 500 ? 502 : response.status });
    if (data.status === "incomplete") return NextResponse.json({ error: "Gemini chưa hoàn tất kế hoạch. Vui lòng thử lại." }, { status: 502 });

    const text = extractText(data);
    if (!text) return NextResponse.json({ error: "AI không trả về kế hoạch." }, { status: 502 });
    return NextResponse.json({ plan: validatePlan(JSON.parse(text)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể lập kế hoạch." }, { status: 502 });
  }
}
