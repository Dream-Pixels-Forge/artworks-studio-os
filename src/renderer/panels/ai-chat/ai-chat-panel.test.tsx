// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { AIChatPanel } from "./ai-chat-panel.js";

/* ------------------------------------------------------------------ */
/*  Mock window.artworks (preload bridge)                             */
/*                                                                    */
/*  The real bridge shape lives in src/types/global.d.ts (ArtworksApi).*/
/*  We do NOT redeclare Window here — that would narrow the global    */
/*  type for every renderer file and mask real type errors. Instead   */
/*  we install a partial mock via a cast at the assignment site.      */
/* ------------------------------------------------------------------ */

type StreamChunk =
  | { type: "text"; text: string }
  | { type: "done"; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }
  | { type: "error"; error?: string };

let subscribeCallback: ((chunk: StreamChunk) => void) | null = null;

const mockStream = vi.fn(() => ({
  subscribe: vi.fn((cb: (chunk: StreamChunk) => void) => {
    subscribeCallback = cb;
    return vi.fn(); // unsubscribe
  }),
}));

const mockComplete = vi.fn();
const mockConversationList = vi.fn();
const mockConversationCreate = vi.fn();
const mockConversationGet = vi.fn();
const mockConversationAddMessage = vi.fn();
const mockConversationDelete = vi.fn();
const mockListModels = vi.fn();
const mockOnAction = vi.fn(() => vi.fn());

beforeEach(() => {
  subscribeCallback = null;

  // jsdom doesn't implement scrollIntoView — mock it on HTMLElement.prototype
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }

  // Install a partial mock of the preload bridge. Only the slices the
  // AIChatPanel touches are exercised; the cast keeps this test-only
  // shape from leaking onto the global Window type.
  (window as unknown as { artworks: Record<string, unknown> }).artworks = {
    ai: {
      stream: mockStream,
      complete: mockComplete,
      listModels: mockListModels,
    },
    production: {
      conversation: {
        list: mockConversationList,
        create: mockConversationCreate,
        get: mockConversationGet,
        addMessage: mockConversationAddMessage,
        delete: mockConversationDelete,
      },
    },
    menu: { onAction: mockOnAction },
  };

  // Default: no conversations, no models
  mockConversationList.mockResolvedValue([]);
  mockConversationCreate.mockResolvedValue({
    uuid: "conv-1",
    id: "conv-1",
    name: "Test",
    messages: [],
  });
  mockConversationGet.mockResolvedValue({
    uuid: "conv-1",
    id: "conv-1",
    name: "Test",
    messages: [],
  });
  mockConversationAddMessage.mockResolvedValue(undefined);
  mockConversationDelete.mockResolvedValue(undefined);
  mockListModels.mockResolvedValue([
    {
      id: "gpt-4o",
      provider: "openai",
      displayName: "GPT-4o",
      maxTokens: 128000,
      supportsStreaming: true,
      supportsImages: false,
      costPer1kInput: 0.005,
      costPer1kOutput: 0.015,
    },
  ]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Helper: render and wait for initial load effects                   */
/* ------------------------------------------------------------------ */

async function renderPanel() {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<AIChatPanel />);
  });
  return result!;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("AIChatPanel", () => {
  /* ---- 1. renders with empty state ---- */

  it("renders with empty state", async () => {
    await renderPanel();
    expect(screen.getByText("Conversations")).toBeDefined();
    expect(screen.getByText("Select or create a conversation.")).toBeDefined();
    expect(screen.getByPlaceholderText("New conversation...")).toBeDefined();
  });

  /* ---- 2. can type in conversation name input ---- */

  it("can type in conversation name input", async () => {
    await renderPanel();
    const nameInput = screen.getByPlaceholderText("New conversation...");
    fireEvent.change(nameInput, { target: { value: "My Chat" } });
    expect((nameInput as HTMLInputElement).value).toBe("My Chat");
  });

  /* ---- 3. can create and select a conversation ---- */

  it("creates a conversation and shows the chat UI", async () => {
    await renderPanel();

    // Type a name and click +
    const nameInput = screen.getByPlaceholderText("New conversation...");
    fireEvent.change(nameInput, { target: { value: "Test Chat" } });
    fireEvent.click(screen.getByText("+"));

    await act(async () => {
      // Wait for async create + load cycle
    });

    // Now the active conversation UI should appear
    expect(screen.getByPlaceholderText("Type a message...")).toBeDefined();
    expect(screen.getByText("Stream: On")).toBeDefined();
  });

  /* ---- 4. send button is disabled when input is empty ---- */

  it("send button is disabled when input is empty", async () => {
    await renderPanel();

    // Create conversation first
    fireEvent.change(screen.getByPlaceholderText("New conversation..."), { target: { value: "Chat" } });
    fireEvent.click(screen.getByText("+"));
    await act(async () => {});

    const sendBtn = screen.getByText("Send");
    expect(sendBtn).toBeDefined();
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true);
  });

  /* ---- 5. send button is enabled when input has text ---- */

  it("send button is enabled when input has text", async () => {
    await renderPanel();

    fireEvent.change(screen.getByPlaceholderText("New conversation..."), { target: { value: "Chat" } });
    fireEvent.click(screen.getByText("+"));
    await act(async () => {});

    const msgInput = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(msgInput, { target: { value: "Hello AI" } });

    const sendBtn = screen.getByText("Send");
    expect((sendBtn as HTMLButtonElement).disabled).toBe(false);
  });

  /* ---- 6. calls ai.stream on send with messages ---- */

  it("calls ai.stream on send with messages array", async () => {
    await renderPanel();

    fireEvent.change(screen.getByPlaceholderText("New conversation..."), { target: { value: "Chat" } });
    fireEvent.click(screen.getByText("+"));
    await act(async () => {});

    // After creation, get returns conversation with user message already added
    // We need get to return the conversation with the user message after addMessage
    mockConversationGet.mockResolvedValueOnce({
      uuid: "conv-1",
      id: "conv-1",
      name: "Chat",
      messages: [{ role: "user", content: "Hello AI" }],
    });

    const msgInput = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(msgInput, { target: { value: "Hello AI" } });
    fireEvent.click(screen.getByText("Send"));

    await act(async () => {
      // Let the send flow resolve
      await new Promise((r) => setTimeout(r, 10));
    });

    // Stream should have been called
    expect(mockStream).toHaveBeenCalled();
    expect(mockConversationAddMessage).toHaveBeenCalled();
  });

  /* ---- 7. appends user message after sending ---- */

  it("appends user message to the thread after sending", async () => {
    await renderPanel();

    fireEvent.change(screen.getByPlaceholderText("New conversation..."), { target: { value: "Chat" } });
    fireEvent.click(screen.getByText("+"));
    await act(async () => {});

    // Prepare: after addMessage, get returns conversation with user message
    mockConversationGet.mockResolvedValueOnce({
      uuid: "conv-1",
      id: "conv-1",
      name: "Chat",
      messages: [{ role: "user", content: "Hello AI" }],
    });

    const msgInput = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(msgInput, { target: { value: "Hello AI" } });
    fireEvent.click(screen.getByText("Send"));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // User message should now appear in the thread
    expect(screen.getByText("Hello AI")).toBeDefined();
    // The role label should also be present
    const roleLabels = screen.getAllByText("user");
    expect(roleLabels.length).toBeGreaterThanOrEqual(1);
  });

  /* ---- 8. streaming text chunks appear in the assistant bubble ---- */

  it("streaming text chunks appear in the assistant bubble", async () => {
    await renderPanel();

    fireEvent.change(screen.getByPlaceholderText("New conversation..."), { target: { value: "Chat" } });
    fireEvent.click(screen.getByText("+"));
    await act(async () => {});

    mockConversationGet.mockResolvedValueOnce({
      uuid: "conv-1",
      id: "conv-1",
      name: "Chat",
      messages: [{ role: "user", content: "Hi" }],
    });

    const msgInput = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(msgInput, { target: { value: "Hi" } });
    fireEvent.click(screen.getByText("Send"));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Now simulate streaming chunks
    await act(async () => {
      subscribeCallback?.({ type: "text", text: "Hello" });
    });
    await act(async () => {
      subscribeCallback?.({ type: "text", text: " there" });
    });
    await act(async () => {
      subscribeCallback?.({ type: "text", text: "!" });
    });

    // The accumulated text should appear in the loading assistant message
    expect(screen.getByText("Hello there!")).toBeDefined();
  });

  /* ---- 9. done chunk ends the streaming (assistant message persisted) ---- */

  it("done chunk ends streaming and persists the assistant message", async () => {
    await renderPanel();

    fireEvent.change(screen.getByPlaceholderText("New conversation..."), { target: { value: "Chat" } });
    fireEvent.click(screen.getByText("+"));
    await act(async () => {});

    // For the send flow
    mockConversationGet
      .mockResolvedValueOnce({
        uuid: "conv-1",
        id: "conv-1",
        name: "Chat",
        messages: [{ role: "user", content: "Hi" }],
      })
      // After done, conversation is fetched again with the assistant message
      .mockResolvedValueOnce({
        uuid: "conv-1",
        id: "conv-1",
        name: "Chat",
        messages: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "Hi there!" },
        ],
      });

    const msgInput = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(msgInput, { target: { value: "Hi" } });
    fireEvent.click(screen.getByText("Send"));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Stream some text then done
    await act(async () => {
      subscribeCallback?.({ type: "text", text: "Hi there!" });
    });
    await act(async () => {
      subscribeCallback?.({ type: "done", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // The assistant message should now be in the conversation messages (not just streamText)
    const assistantMessages = screen.getAllByText("Hi there!");
    expect(assistantMessages.length).toBeGreaterThanOrEqual(1);

    // The "Thinking..." or loading indicator should no longer be shown
    expect(screen.queryByText("Thinking...")).toBeNull();
  });

  /* ---- 10. error chunk displays an error message ---- */

  it("error chunk displays an error message", async () => {
    await renderPanel();

    fireEvent.change(screen.getByPlaceholderText("New conversation..."), { target: { value: "Chat" } });
    fireEvent.click(screen.getByText("+"));
    await act(async () => {});

    mockConversationGet.mockResolvedValueOnce({
      uuid: "conv-1",
      id: "conv-1",
      name: "Chat",
      messages: [{ role: "user", content: "Hi" }],
    });

    const msgInput = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(msgInput, { target: { value: "Hi" } });
    fireEvent.click(screen.getByText("Send"));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Simulate error chunk
    await act(async () => {
      subscribeCallback?.({ type: "error", error: "Rate limit exceeded" });
    });

    expect(screen.getByText("Rate limit exceeded")).toBeDefined();
  });

  /* ---- 11. streaming toggle switches on/off ---- */

  it("streaming toggle switches between on and off", async () => {
    await renderPanel();

    fireEvent.change(screen.getByPlaceholderText("New conversation..."), { target: { value: "Chat" } });
    fireEvent.click(screen.getByText("+"));
    await act(async () => {});

    // Default is streaming on
    const toggleBtn = screen.getByText("Stream: On");
    expect(toggleBtn).toBeDefined();

    // Click to turn off
    fireEvent.click(toggleBtn);
    expect(screen.getByText("Stream: Off")).toBeDefined();

    // Click to turn back on
    fireEvent.click(screen.getByText("Stream: Off"));
    expect(screen.getByText("Stream: On")).toBeDefined();
  });

  /* ---- 12. empty input doesn't trigger send ---- */

  it("empty input does not trigger ai.stream", async () => {
    await renderPanel();

    fireEvent.change(screen.getByPlaceholderText("New conversation..."), { target: { value: "Chat" } });
    fireEvent.click(screen.getByText("+"));
    await act(async () => {});

    // Button is disabled, but let's also verify the guard
    const sendBtn = screen.getByText("Send");
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true);

    // Try clicking anyway (it's disabled, so nothing should fire)
    fireEvent.click(sendBtn);
    expect(mockStream).not.toHaveBeenCalled();
    expect(mockConversationAddMessage).not.toHaveBeenCalled();
  });

  /* ---- 13. loading state shows "Thinking..." before chunks arrive ---- */

  it("shows Thinking... while waiting for first chunk", async () => {
    await renderPanel();

    fireEvent.change(screen.getByPlaceholderText("New conversation..."), { target: { value: "Chat" } });
    fireEvent.click(screen.getByText("+"));
    await act(async () => {});

    mockConversationGet.mockResolvedValueOnce({
      uuid: "conv-1",
      id: "conv-1",
      name: "Chat",
      messages: [{ role: "user", content: "Hello" }],
    });

    const msgInput = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(msgInput, { target: { value: "Hello" } });
    fireEvent.click(screen.getByText("Send"));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Before any chunks, should show "Thinking..."
    expect(screen.getByText("Thinking...")).toBeDefined();

    // Input should be disabled during loading
    expect((msgInput as HTMLInputElement).disabled).toBe(true);
  });

  /* ---- 14. streaming toggle class updates ---- */

  it("streaming toggle has active class when enabled", async () => {
    await renderPanel();

    fireEvent.change(screen.getByPlaceholderText("New conversation..."), { target: { value: "Chat" } });
    fireEvent.click(screen.getByText("+"));
    await act(async () => {});

    const toggleBtn = screen.getByText("Stream: On");
    expect(toggleBtn.className).toContain("ai-chat__stream-toggle--active");

    fireEvent.click(toggleBtn);
    const offBtn = screen.getByText("Stream: Off");
    expect(offBtn.className).not.toContain("ai-chat__stream-toggle--active");
  });

  /* ---- 15. Enter key sends message ---- */

  it("Enter key sends message", async () => {
    await renderPanel();

    fireEvent.change(screen.getByPlaceholderText("New conversation..."), { target: { value: "Chat" } });
    fireEvent.click(screen.getByText("+"));
    await act(async () => {});

    mockConversationGet.mockResolvedValueOnce({
      uuid: "conv-1",
      id: "conv-1",
      name: "Chat",
      messages: [{ role: "user", content: "Keyboard send" }],
    });

    const msgInput = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(msgInput, { target: { value: "Keyboard send" } });
    fireEvent.keyDown(msgInput, { key: "Enter" });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockStream).toHaveBeenCalled();
  });
});
