export interface SSEEvent {
  event: string;
  data: string;
}

export async function* parseSSEStream(
  response: Response
): AsyncGenerator<SSEEvent> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      if (!part.trim()) continue;
      let event = "message";
      const dataLines: string[] = [];
      for (const line of part.split("\n")) {
        if (line.startsWith("event: ")) {
          event = line.slice(7);
        } else if (line.startsWith("event:")) {
          event = line.slice(6);
        } else if (line.startsWith("data: ")) {
          dataLines.push(line.slice(6));
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5));
        }
      }
      const data = dataLines.join("\n");
      if (data !== "") yield { event, data };
    }
  }
}
