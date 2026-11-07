const POE_CHAT_URL = "https://api.poe.com/v1/chat/completions";
const POE_RESPONSES_URL = "https://api.poe.com/v1/responses";

export const DEFAULT_MODEL = "Claude-Haiku-5.5";
export const DEFAULT_WEB_SEARCH_MODEL = "Web-Search";

export class PoeError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PoeError";
    this.status = status;
  }
}

export function publicPoeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const redacted = raw
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .slice(0, 300);
  if (/invalid api key|authentication|unauthorized|401/i.test(redacted)) {
    return "Poe API 金鑰無效或尚未設定。請在 Cloudflare Worker 秘密中設定 POE_API_KEY。";
  }
  if (/insufficient|402|credit/i.test(redacted)) {
    return "Poe 點數不足，請稍後再試或檢查帳戶點數。";
  }
  return redacted || "Poe API 呼叫失敗。";
}

function requireKey(apiKey: string | undefined): string {
  const key = apiKey?.trim();
  if (!key) {
    throw new PoeError("POE_API_KEY 尚未設定。請在 Cloudflare Worker 秘密中加入 POE_API_KEY。", 503);
  }
  return key;
}

async function poeFetch(url: string, apiKey: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    redirect: "manual",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status >= 300 && response.status < 400) {
    throw new PoeError("Poe API 回傳重新導向，已中止以避免金鑰外洩。", 502);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data as { error?: { message?: string } })?.error?.message || `Poe API 錯誤 (${response.status})`;
    throw new PoeError(message, response.status);
  }
  return data;
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof PoeError)) return false;
  return error.status === 408 || error.status === 429 || error.status === 500 || error.status === 503;
}

async function withRetry(run: () => Promise<unknown>, attempts = 2): Promise<unknown> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      last = error;
      if (!isRetryable(error) || attempt + 1 >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw last;
}

export async function poeChat(
  apiKey: string | undefined,
  body: Record<string, unknown>,
): Promise<unknown> {
  const key = requireKey(apiKey);
  return withRetry(() =>
    poeFetch(POE_CHAT_URL, key, {
      stream: false,
      n: 1,
      ...body,
    }),
  );
}

export async function poeWebSearchResponse(
  apiKey: string | undefined,
  model: string,
  instructions: string,
  input: string,
): Promise<unknown> {
  const key = requireKey(apiKey);
  const base = {
    model,
    instructions,
    input,
    tools: [{ type: "web_search_preview" }],
    include: ["web_search_call.action.sources"],
    temperature: 0.2,
  };
  try {
    return await poeFetch(POE_RESPONSES_URL, key, { ...base, tool_choice: "required" });
  } catch (error) {
    if (error instanceof PoeError && error.status === 400) {
      return poeFetch(POE_RESPONSES_URL, key, { ...base, tool_choice: "auto" });
    }
    throw error;
  }
}
