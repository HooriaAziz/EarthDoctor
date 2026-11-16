// Minimal client for NVIDIA's OpenAI-compatible chat completions endpoint.
import { config } from "./config.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function chat(messages, { maxTokens = config.nvidia.maxTokens, temperature = 0.6, attempts = 4 } = {}) {
  if (!config.nvidia.apiKey) throw new Error("NVIDIA_API_KEY is not set in .env");

  const body = {
    model: config.nvidia.model,
    messages,
    temperature,
    top_p: 0.95,
    max_tokens: maxTokens,
    stream: false,
    // Thinking off: reasoning traces would consume tokens without improving
    // a structured-list task like this one.
    chat_template_kwargs: { enable_thinking: false },
  };

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${config.nvidia.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.nvidia.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      });

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** (attempt - 1);
        lastError = new Error(`NVIDIA API HTTP ${response.status}`);
        await sleep(Math.min(wait, 60_000));
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw Object.assign(new Error(`NVIDIA API HTTP ${response.status}: ${text.slice(0, 300)}`), { fatal: true });
      }

      const json = await response.json();
      const message = json.choices?.[0]?.message ?? {};
      return {
        content: typeof message.content === "string" ? message.content : "",
        finishReason: json.choices?.[0]?.finish_reason ?? null,
        usage: json.usage ?? null,
        model: json.model || config.nvidia.model,
      };
    } catch (error) {
      if (error.fatal) throw error;
      lastError = error;
      await sleep(2000 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
