export type RelayXClientOptions = {
  apiKey: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  name?: string;
  tool_call_id?: string;
};

export type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  user?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CompletionRequest = {
  model: string;
  prompt: string | string[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
};

export type EmbeddingRequest = {
  model: string;
  input: string | string[];
  encoding_format?: "float" | "base64";
  user?: string;
};

export type ResponsesRequest = {
  model: string;
  input: string | ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_output_tokens?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type ChatChoice = {
  index: number;
  message: ChatMessage;
  finish_reason: string;
};

export type RelayXMeta = {
  provider: string;
  provider_model: string;
  route: string;
  cache: string;
  failover: Array<{ provider: string; provider_model: string }>;
};

export type ChatCompletionResponse = {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: TokenUsage;
  relayx?: RelayXMeta;
  relayx_cache?: string;
};

export type CompletionChoice = {
  index: number;
  text: string;
  finish_reason: string;
};

export type CompletionResponse = {
  id: string;
  object: "text_completion";
  created: number;
  model: string;
  choices: CompletionChoice[];
  usage: TokenUsage;
};

export type EmbeddingData = {
  object: "embedding";
  embedding: number[];
  index: number;
};

export type EmbeddingResponse = {
  object: "list";
  data: EmbeddingData[];
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
};

export type ModelObject = {
  id: string;
  object: "model";
};

export type ModelListResponse = {
  object: "list";
  data: ModelObject[];
};

export type ResponsesResponse = {
  id: string;
  object: "response";
  created_at: number;
  model: string;
  output_text: string;
  usage: TokenUsage;
};

export class RelayXError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`RelayX request failed with status ${status}`);
    this.name = "RelayXError";
    this.status = status;
    this.body = body;
  }
}

export class RelayXClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: RelayXClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://gateway.relayx.vexarr.com").replace(/\/+$/, "");
    this.headers = options.headers ?? {};
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  chatCompletions<T = ChatCompletionResponse>(request: ChatCompletionRequest): Promise<T> {
    return this.postJson<T>("/v1/chat/completions", request);
  }

  completions<T = CompletionResponse>(request: CompletionRequest): Promise<T> {
    return this.postJson<T>("/v1/completions", request);
  }

  embeddings<T = EmbeddingResponse>(request: EmbeddingRequest): Promise<T> {
    return this.postJson<T>("/v1/embeddings", request);
  }

  responses<T = ResponsesResponse>(request: ResponsesRequest): Promise<T> {
    return this.postJson<T>("/v1/responses", request);
  }

  models<T = ModelListResponse>(): Promise<T> {
    return this.getJson<T>("/v1/models");
  }

  streamChatCompletions(request: ChatCompletionRequest): Promise<ReadableStream<Uint8Array>> {
    return this.postStream("/v1/chat/completions", { ...request, stream: true });
  }

  streamResponses(request: ResponsesRequest): Promise<ReadableStream<Uint8Array>> {
    return this.postStream("/v1/responses", { ...request, stream: true });
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await this.request(path, { method: "GET" });
    return this.parseJson<T>(response);
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await this.request(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return this.parseJson<T>(response);
  }

  private async postStream(path: string, body: unknown): Promise<ReadableStream<Uint8Array>> {
    const response = await this.request(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!response.body) {
      throw new RelayXError(response.status, { error: "RelayX stream response had no body" });
    }
    return response.body;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
          "x-relayx-sdk": "typescript",
          ...this.headers,
          ...init.headers,
        },
      });

      if (!response.ok) {
        throw new RelayXError(response.status, await parseBody(response));
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseJson<T>(response: Response): Promise<T> {
    return response.json() as Promise<T>;
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
