import { buildObservabilityMetrics, type ObservabilityEvent } from "@/lib/observability";
import { formatDateTime } from "@/lib/format";

export function DiagnosticsPanel({ events }: { events: ObservabilityEvent[] }) {
  const metrics = buildObservabilityMetrics(events);
  const recentTraceIds = [...new Set(events.map((event) => event.correlationId))].slice(0, 4);

  return (
    <details className="diagnostics-drawer">
      <summary>
        <span>Dev observability</span>
        <small>Console + metrics stub</small>
      </summary>
      <div className="diagnostics-body">
        <section>
          <div className="diagnostics-section-title">
            <span>System metrics</span>
            <small>Last {events.length} structured events</small>
          </div>
          <div className="metrics-grid">
            <Metric label="Requests" value={metrics.system.requestCount} />
            <Metric
              label="Request errors"
              value={metrics.system.requestErrorCount}
              tone={metrics.system.requestErrorCount > 0 ? "bad" : "good"}
            />
            <Metric
              label="Error rate"
              value={`${metrics.system.requestErrorRate}%`}
              tone={metrics.system.requestErrorCount > 0 ? "bad" : "good"}
            />
            <Metric label="Avg latency" value={`${metrics.system.averageLatencyMs}ms`} />
            <Metric label="P95 latency" value={`${metrics.system.p95LatencyMs}ms`} />
            <Metric
              label="Retries"
              value={metrics.system.retryCount}
              tone={metrics.system.retryCount > 0 ? "warn" : "neutral"}
            />
            <Metric
              label="Log disconnects"
              value={metrics.system.logDisconnectCount}
              tone={metrics.system.logDisconnectCount > 0 ? "warn" : "neutral"}
            />
            <Metric label="Trace IDs" value={metrics.system.activeTraceCount} />
          </div>
        </section>

        <section>
          <div className="diagnostics-section-title">
            <span>Product metrics</span>
            <small>Deployment funnel</small>
          </div>
          <div className="metrics-grid">
            <Metric label="Deploy started" value={metrics.product.deploymentStartedCount} />
            <Metric
              label="Deploy success"
              value={metrics.product.deploymentSucceededCount}
              tone="good"
            />
            <Metric
              label="Deploy failed"
              value={metrics.product.deploymentFailedCount}
              tone={metrics.product.deploymentFailedCount > 0 ? "bad" : "neutral"}
            />
            <Metric label="Deploy success rate" value={`${metrics.product.deploymentSuccessRate}%`} />
            <Metric
              label="Avg deploy duration"
              value={`${metrics.product.averageDeploymentDurationMs}ms`}
            />
            <Metric
              label="P95 deploy duration"
              value={`${metrics.product.p95DeploymentDurationMs}ms`}
            />
            <Metric label="Revision started" value={metrics.product.revisionStartedCount} />
            <Metric
              label="Revision failed"
              value={metrics.product.revisionFailedCount}
              tone={metrics.product.revisionFailedCount > 0 ? "bad" : "neutral"}
            />
          </div>
        </section>

        <section>
          <div className="diagnostics-section-title">
            <span>Trace IDs</span>
            <small>
              {metrics.system.activeTraceCount} correlation id
              {metrics.system.activeTraceCount === 1 ? "" : "s"}
            </small>
          </div>
          {recentTraceIds.length === 0 ? (
            <p className="muted">No traces emitted yet.</p>
          ) : (
            <ol className="trace-list">
              {recentTraceIds.map((traceId) => (
                <li key={traceId}>
                  <code>{traceId}</code>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <div className="diagnostics-section-title">
            <span>Structured logs</span>
            <small>Also emitted to console.info</small>
          </div>
          {events.length === 0 ? (
            <p className="muted">No client events emitted yet.</p>
          ) : (
            <ol className="event-list">
              {events.slice(0, 8).map((event) => (
                <li key={event.id}>
                  <span>{event.name}</span>
                  <small>{formatDateTime(event.timestamp)}</small>
                  <code>{event.correlationId}</code>
                  <pre>{JSON.stringify(event.fields, null, 2)}</pre>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </details>
  );
}

function Metric({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
