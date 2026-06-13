import { describe, expect, it } from "vitest";
import { createSseParser, type SseMessage } from "./sse-stream";

const collect = () => {
  const messages: SseMessage[] = [];
  const parser = createSseParser((message) => messages.push(message));
  return { messages, parser };
};

describe("createSseParser", () => {
  it("parses a complete event frame", () => {
    const { messages, parser } = collect();
    parser.feed('event: progress\ndata: {"objective": 120}\n\n');
    expect(messages).toEqual([{ event: "progress", data: '{"objective": 120}' }]);
  });

  it("reassembles frames split across chunks mid-line", () => {
    const { messages, parser } = collect();
    parser.feed("event: prog");
    parser.feed("ress\ndata: 1");
    parser.feed("23\n\n");
    expect(messages).toEqual([{ event: "progress", data: "123" }]);
  });

  it("emits multiple frames from one chunk in order", () => {
    const { messages, parser } = collect();
    parser.feed("event: a\ndata: 1\n\nevent: b\ndata: 2\n\n");
    expect(messages.map((m) => m.event)).toEqual(["a", "b"]);
  });

  it("joins multi-line data with newlines and defaults the event name", () => {
    const { messages, parser } = collect();
    parser.feed("data: line1\ndata: line2\n\n");
    expect(messages).toEqual([{ event: "message", data: "line1\nline2" }]);
  });

  it("ignores comment keep-alives and dataless frames", () => {
    const { messages, parser } = collect();
    parser.feed(": ping - 2026-06-12\n\nevent: noop\n\ndata: real\n\n");
    expect(messages).toEqual([{ event: "message", data: "real" }]);
  });

  it("handles CRLF line endings", () => {
    const { messages, parser } = collect();
    parser.feed("event: result\r\ndata: done\r\n\r\n");
    expect(messages).toEqual([{ event: "result", data: "done" }]);
  });

  it("flush dispatches a trailing frame the server never terminated", () => {
    const { messages, parser } = collect();
    parser.feed("event: result\ndata: tail");
    expect(messages).toEqual([]);
    parser.flush();
    expect(messages).toEqual([{ event: "result", data: "tail" }]);
  });
});
