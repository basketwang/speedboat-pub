"use client";

import { useEffect, useState } from "react";

export type ObservabilityEventName =
  | "app.opened"
  | "api.request.completed"
  | "deployment.create.started"
  | "deployment.create.succeeded"
  | "deployment.create.failed"
  | "deployment.config_update.started"
  | "deployment.config_update.succeeded"
  | "deployment.config_update.failed"
  | "deployment.poll.started"
  | "deployment.poll.failed"
  | "deployment.logs.connected"
  | "deployment.logs.disconnected"
  | "deployment.retry.scheduled";

export type ObservabilityEvent = {
  id: string;
  name: ObservabilityEventName;
  timestamp: string;
  correlationId: string;
  fields: Record<string, unknown>;
};

export type ObservabilityMetrics = {
  system: {
    requestCount: number;
    requestErrorCount: number;
    requestErrorRate: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    retryCount: number;
    logDisconnectCount: number;
    activeTraceCount: number;
  };
  product: {
    deploymentStartedCount: number;
    deploymentSucceededCount: number;
    deploymentFailedCount: number;
    revisionStartedCount: number;
    revisionSucceededCount: number;
    revisionFailedCount: number;
    deploymentSuccessRate: number;
    averageDeploymentDurationMs: number;
    p95DeploymentDurationMs: number;
  };
};

type Listener = (event: ObservabilityEvent) => void;

const listeners = new Set<Listener>();
let recentEvents: ObservabilityEvent[] = [];

export function createCorrelationId(prefix = "corr") {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function recordEvent(
  name: ObservabilityEventName,
  fields: Record<string, unknown> = {},
  correlationId = createCorrelationId()
) {
  const event: ObservabilityEvent = {
    id: crypto.randomUUID(),
    name,
    timestamp: new Date().toISOString(),
    correlationId,
    fields
  };

  recentEvents = [event, ...recentEvents].slice(0, 20);
  console.info("[speedboat:event]", event);
  listeners.forEach((listener) => listener(event));
  return event;
}

export function useObservabilityEvents() {
  const [events, setEvents] = useState<ObservabilityEvent[]>(recentEvents);

  useEffect(() => {
    const listener: Listener = () => setEvents([...recentEvents]);
    listeners.add(listener);
    setEvents([...recentEvents]);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return events;
}

export function buildObservabilityMetrics(events: ObservabilityEvent[]): ObservabilityMetrics {
  const requestEvents = events.filter((event) => event.name === "api.request.completed");
  const requestErrorCount = requestEvents.filter((event) => event.fields.ok === false).length;
  const latencies = requestEvents
    .map((event) => numberField(event.fields.durationMs))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  const traceIds = new Set(events.map((event) => event.correlationId));
  const deploymentStartedCount = events.filter((event) => event.name === "deployment.create.started").length;
  const deploymentSucceededCount = events.filter((event) => event.name === "deployment.create.succeeded").length;
  const deploymentFailedCount = events.filter((event) => event.name === "deployment.create.failed").length;
  const revisionStartedCount = events.filter((event) => event.name === "deployment.config_update.started").length;
  const revisionSucceededCount = events.filter((event) => event.name === "deployment.config_update.succeeded").length;
  const revisionFailedCount = events.filter((event) => event.name === "deployment.config_update.failed").length;
  const deploymentDurations = events
    .filter(
      (event) =>
        event.name === "deployment.create.succeeded" ||
        event.name === "deployment.create.failed"
    )
    .map((event) => numberField(event.fields.elapsedMs))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  const completedDeploymentCount = deploymentSucceededCount + deploymentFailedCount;

  return {
    system: {
      requestCount: requestEvents.length,
      requestErrorCount,
      requestErrorRate:
        requestEvents.length === 0
          ? 0
          : Math.round((requestErrorCount / requestEvents.length) * 1000) / 10,
      averageLatencyMs: average(latencies),
      p95LatencyMs: percentile(latencies, 0.95),
      retryCount: events.filter((event) => event.name === "deployment.retry.scheduled").length,
      logDisconnectCount: events.filter((event) => event.name === "deployment.logs.disconnected").length,
      activeTraceCount: traceIds.size
    },
    product: {
      deploymentStartedCount,
      deploymentSucceededCount,
      deploymentFailedCount,
      revisionStartedCount,
      revisionSucceededCount,
      revisionFailedCount,
      deploymentSuccessRate:
        completedDeploymentCount === 0
          ? 0
          : Math.round((deploymentSucceededCount / completedDeploymentCount) * 1000) / 10,
      averageDeploymentDurationMs: average(deploymentDurations),
      p95DeploymentDurationMs: percentile(deploymentDurations, 0.95)
    }
  };
}

function numberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function percentile(values: number[], rank: number) {
  if (values.length === 0) {
    return 0;
  }
  const index = Math.min(values.length - 1, Math.ceil(values.length * rank) - 1);
  return values[index];
}
