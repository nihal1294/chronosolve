/** Minimal incremental Server-Sent-Events parser.

    EventSource cannot POST, so the solve stream reads the response body via
    fetch and feeds decoded chunks here. Handles frames split anywhere across
    chunks, CRLF endings, multi-line data, and comment keep-alives. */

export interface SseMessage {
  event: string;
  data: string;
}

interface SseParser {
  /** Feed a decoded text chunk; complete frames dispatch synchronously. */
  feed(chunk: string): void;
  /** Dispatch a trailing frame when the stream ends without a blank line. */
  flush(): void;
}

export function createSseParser(onMessage: (message: SseMessage) => void): SseParser {
  let buffer = "";
  let event = "";
  let data: string[] = [];

  const dispatch = () => {
    if (data.length > 0) onMessage({ event: event || "message", data: data.join("\n") });
    event = "";
    data = [];
  };

  const consumeLine = (line: string) => {
    if (line === "") return dispatch(); // blank line terminates the frame
    if (line.startsWith(":")) return; // comment / keep-alive ping
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    // id / retry fields are irrelevant to the solve stream
  };

  return {
    feed(chunk: string) {
      buffer += chunk;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        consumeLine(line);
      }
    },
    flush() {
      if (buffer !== "") consumeLine(buffer.replace(/\r$/, ""));
      buffer = "";
      dispatch();
    },
  };
}
