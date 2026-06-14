import { parasailConfig } from "@/lib/config";
import { createCorrelationId, recordEvent } from "@/lib/observability";
import type {
  CreateDeploymentRequest,
  Deployment,
  DeploymentRevision,
  GpuType,
  LogLine,
  ParasailModel,
  UpdateDeploymentConfigRequest
} from "./types";

type ListResponse<T> = {
  object: "list";
  data: T[];
};

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function isRetriableApiError(error: unknown) {
  return error instanceof ApiError && [429, 500, 502, 503, 504].includes(error.status);
}

export async function listDeployments() {
  return request<ListResponse<Deployment>>("/v1/deployments").then((response) => response.data);
}

export async function getDeployment(id: string) {
  return request<Deployment>(`/v1/deployments/${id}`);
}

export async function listDeploymentRevisions(deploymentId: string) {
  return request<ListResponse<DeploymentRevision>>(`/v1/deployments/${deploymentId}/revisions`).then(
    (response) => response.data
  );
}

export async function createDeployment(
  payload: CreateDeploymentRequest,
  options?: { simulateStatus?: number; correlationId?: string }
) {
  const query = options?.simulateStatus ? `?_simulate=${options.simulateStatus}` : "";
  return request<Deployment>(`/v1/deployments${query}`, {
    method: "POST",
    body: JSON.stringify(payload),
    correlationId: options?.correlationId
  });
}

export async function updateDeploymentConfig(
  deploymentId: string,
  payload: UpdateDeploymentConfigRequest,
  options?: { correlationId?: string }
) {
  return request<Deployment>(`/v1/deployments/${deploymentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    correlationId: options?.correlationId
  });
}

export async function listGpuTypes() {
  return request<ListResponse<GpuType>>("/v1/gpu-types").then((response) => response.data);
}

export async function listModels() {
  return request<ListResponse<ParasailModel>>("/v1/models").then((response) => response.data);
}

export async function streamDeploymentLogs(
  deploymentId: string,
  handlers: {
    onLog: (line: LogLine) => void;
    onEnd: () => void;
    onError: (error: Error) => void;
    signal?: AbortSignal;
    correlationId?: string;
    afterSequence?: number;
  }
) {
  try {
    const params = new URLSearchParams();
    if (handlers.afterSequence && handlers.afterSequence > 0) {
      params.set("after", String(handlers.afterSequence));
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await fetch(
      `${parasailConfig.baseUrl}/v1/deployments/${deploymentId}/logs${query}`,
      {
        headers: {
          ...buildHeaders(handlers.correlationId),
          ...(handlers.afterSequence && handlers.afterSequence > 0
            ? { "Last-Event-ID": String(handlers.afterSequence) }
            : {})
        },
        signal: handlers.signal
      }
    );

    if (!response.ok || !response.body) {
      handlers.onError(await toApiError(response));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const parsed = parseSseEvent(event);
        if (parsed.event === "log" && parsed.data) {
          const line = JSON.parse(parsed.data) as LogLine;
          handlers.onLog({
            ...line,
            sequence: line.sequence ?? Number(parsed.id ?? 0)
          });
        }
        if (parsed.event === "end") {
          handlers.onEnd();
          return;
        }
      }
    }
    handlers.onEnd();
  } catch (error) {
    if (handlers.signal?.aborted) {
      return;
    }
    handlers.onError(error instanceof Error ? error : new Error("Log stream failed."));
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { correlationId?: string } = {}
): Promise<T> {
  const startedAt = performance.now();
  const method = options.method ?? "GET";
  const correlationId = options.correlationId ?? createCorrelationId("api");

  try {
    const response = await fetch(`${parasailConfig.baseUrl}${path}`, {
      ...options,
      headers: {
        ...buildHeaders(correlationId),
        ...options.headers
      }
    });

    recordEvent(
      "api.request.completed",
      {
        method,
        path,
        status: response.status,
        ok: response.ok,
        durationMs: Math.round(performance.now() - startedAt)
      },
      correlationId
    );

    if (!response.ok) {
      throw await toApiError(response);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (!(error instanceof ApiError)) {
      recordEvent(
        "api.request.completed",
        {
          method,
          path,
          status: 0,
          ok: false,
          durationMs: Math.round(performance.now() - startedAt),
          error: error instanceof Error ? error.message : String(error)
        },
        correlationId
      );
    }
    throw error;
  }
}

function buildHeaders(correlationId?: string) {
  return {
    "Content-Type": "application/json",
    ...(parasailConfig.apiKey ? { Authorization: `Bearer ${parasailConfig.apiKey}` } : {}),
    ...(correlationId ? { "X-Correlation-Id": correlationId } : {})
  };
}

async function toApiError(response: Response) {
  let detail: unknown = null;
  try {
    detail = await response.json();
  } catch {
    detail = await response.text();
  }

  const message =
    getErrorMessage(detail) || `Request failed with status ${response.status}.`;
  return new ApiError(message, response.status, detail);
}

function getErrorMessage(detail: unknown) {
  if (
    detail &&
    typeof detail === "object" &&
    "error" in detail &&
    detail.error &&
    typeof detail.error === "object" &&
    "message" in detail.error &&
    typeof detail.error.message === "string"
  ) {
    return detail.error.message;
  }
  return null;
}

function parseSseEvent(raw: string) {
  const lines = raw.split("\n");
  const event = lines
    .find((line) => line.startsWith("event:"))
    ?.replace("event:", "")
    .trim();
  const id = lines
    .find((line) => line.startsWith("id:"))
    ?.replace("id:", "")
    .trim();
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace("data:", "").trim())
    .join("\n");

  return { event, id, data };
}
