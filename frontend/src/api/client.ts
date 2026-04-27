const API_BASE_URL = "/api/v1";

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
};

export class ApiError extends Error {
  status?: number;
  code?: string;
  fields?: Record<string, string>;
  details?: unknown;
  url?: string;

  constructor(args: {
    message: string;
    status?: number;
    code?: string;
    fields?: Record<string, string>;
    details?: unknown;
    url?: string;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.status = args.status;
    this.code = args.code;
    this.fields = args.fields;
    this.details = args.details;
    this.url = args.url;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
  } catch (error) {
    throw new ApiError({
      message: error instanceof Error ? error.message : "Network request failed",
      url,
      details: error,
    });
  }

  const text = await response.text();

  let json: ApiEnvelope<T> | T | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const envelope = json as ApiEnvelope<T> | null;

    throw new ApiError({
      status: response.status,
      code: envelope?.error?.code,
      message:
        envelope?.error?.message ||
        text ||
        `API request failed with status ${response.status}`,
      fields: envelope?.error?.fields,
      details: json ?? text,
      url,
    });
  }

  if (json && typeof json === "object" && "data" in json) {
    return (json as ApiEnvelope<T>).data as T;
  }

  return json as T;
}