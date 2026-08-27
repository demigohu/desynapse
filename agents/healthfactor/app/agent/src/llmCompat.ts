/**
 * 9router (and similar proxies) often ignore stream:false and return SSE
 * `chat.completion.chunk` lines. The AI SDK OpenAI JSON handler then throws
 * "Invalid JSON response". Fold the stream into one Chat Completions object.
 */

type Json = Record<string, unknown>;

function sseToChatCompletion(raw: string): string {
  const pieces: string[] = [];
  let model = "";
  let id = "chatcmpl-sse";
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    let chunk: Json;
    try {
      chunk = JSON.parse(payload) as Json;
    } catch {
      continue;
    }
    if (typeof chunk.model === "string") model = chunk.model;
    if (typeof chunk.id === "string") id = chunk.id;
    const choice = (chunk.choices as Json[] | undefined)?.[0];
    const delta = choice?.delta as Json | undefined;
    const message = choice?.message as Json | undefined;
    if (typeof delta?.content === "string") pieces.push(delta.content);
    if (typeof message?.content === "string") pieces.push(message.content);
  }
  return JSON.stringify({
    id,
    object: "chat.completion",
    model: model || "unknown",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: pieces.join("") },
        finish_reason: "stop",
      },
    ],
  });
}

function looksLikeSse(text: string, contentType: string): boolean {
  return (
    contentType.includes("text/event-stream") ||
    text.startsWith("data:") ||
    /\ndata:/.test(text)
  );
}

export async function llmFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let nextInit = init;
  if (typeof init?.body === "string") {
    try {
      const parsed = JSON.parse(init.body) as Json;
      parsed.stream = false;
      console.log(`[llm] request model=${String(parsed.model ?? "")}`);
      nextInit = { ...init, body: JSON.stringify(parsed) };
    } catch {
      // leave body as-is
    }
  }

  const res = await fetch(input, nextInit);
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (looksLikeSse(text, contentType)) {
    const assembled = sseToChatCompletion(text);
    const reported = (JSON.parse(assembled) as Json).model;
    console.log(
      `[llm] 9router SSE assembled; upstream model=${String(reported ?? "")}`,
    );
    return new Response(assembled, {
      status: res.status,
      statusText: res.statusText,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(text, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}
