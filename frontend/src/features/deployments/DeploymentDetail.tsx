import type { KeyboardEvent, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getDeployment,
  listDeploymentRevisions,
  listGpuTypes,
  streamDeploymentLogs,
  updateDeploymentConfig
} from "./api";
import type {
  Deployment,
  DeploymentRevision,
  DeploymentStatus,
  GpuType,
  LogLine,
  UpdateDeploymentConfigRequest,
  WizardErrors,
  WizardValues
} from "./types";
import { formatCurrency, formatDateTime, humanizeStatus } from "@/lib/format";
import { createCorrelationId, recordEvent } from "@/lib/observability";
import { validateWizard } from "@/lib/validation";
import { ConfigurationStep } from "./wizard/ConfigurationStep";
import { HardwareStep } from "./wizard/HardwareStep";

type Props = {
  deploymentId: string;
  initialDeployment: Deployment | null;
  onBack: () => void;
  onDeploymentChange: (deployment: Deployment) => void;
  onOpenRevision: (deploymentId: string, revisionId: string) => void;
};

const statusSteps: DeploymentStatus[] = [
  "pending",
  "queued",
  "pulling_image",
  "loading_weights",
  "warming_up",
  "running"
];

export function DeploymentDetail({
  deploymentId,
  initialDeployment,
  onBack,
  onDeploymentChange,
  onOpenRevision
}: Props) {
  const [deployment, setDeployment] = useState<Deployment | null>(initialDeployment);
  const [revisions, setRevisions] = useState<DeploymentRevision[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revisionsError, setRevisionsError] = useState<string | null>(null);
  const [, setLogStatus] = useState<"connecting" | "open" | "closed" | "failed">(
    "connecting"
  );
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [configValues, setConfigValues] = useState<WizardValues | null>(null);
  const [gpuTypes, setGpuTypes] = useState<GpuType[]>([]);
  const [gpuError, setGpuError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [hasTriedConfigSave, setHasTriedConfigSave] = useState(false);
  const [pollGeneration, setPollGeneration] = useState(0);
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null);

  const correlationId = useMemo(() => createCorrelationId("detail"), [deploymentId]);
  const hasDeployment = Boolean(deployment);
  const currentStepIndex = deployment ? statusSteps.indexOf(deployment.status) : -1;
  const activeRevision = deployment?.revision ?? revisions.find((revision) => revision.id === deployment?.active_revision_id) ?? null;
  const activeRevisionId = deployment?.active_revision_id ?? deployment?.revision?.id ?? activeRevision?.id ?? null;
  const sortedRevisions = useMemo(
    () => [...revisions].sort((left, right) => right.version - left.version),
    [revisions]
  );
  const configValidationErrors = useMemo(
    () => (configValues ? validateWizard(configValues) : {}),
    [configValues]
  );
  const configRequiredErrors = useMemo(
    () => (hasTriedConfigSave && configValues ? getConfigRequiredErrors(configValues) : {}),
    [configValues, hasTriedConfigSave]
  );
  const configDisplayErrors = useMemo(
    () => ({ ...configValidationErrors, ...configRequiredErrors }),
    [configRequiredErrors, configValidationErrors]
  );
  const selectedConfigGpu =
    configValues && configValues.gpu_type
      ? gpuTypes.find((gpu) => gpu.id === configValues.gpu_type) ?? null
      : null;
  const configMonthlyCost =
    selectedConfigGpu && configValues && configValues.replicas !== ""
      ? selectedConfigGpu.hourly_cost_usd * configValues.replicas * 24 * 30
      : 0;
  const hasConfigChanged =
    Boolean(deployment && configValues && !isSameConfig(deployment, configValues));
  const canSaveConfig =
    hasConfigChanged &&
    Boolean(configValues?.gpu_type) &&
    configValues?.replicas !== "" &&
    configValues?.autoscaling.min !== "" &&
    configValues?.autoscaling.max !== "" &&
    configValues?.autoscaling.target_concurrency !== "" &&
    Object.keys(configValidationErrors).length === 0 &&
    !isSavingConfig;

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;
    recordEvent("deployment.poll.started", { deploymentId }, correlationId);

    async function poll() {
      try {
        const next = await getDeployment(deploymentId);
        if (cancelled) {
          return;
        }
        setDeployment(next);
        if (next.revision) {
          setRevisions((current) => mergeRevision(current, next.revision as DeploymentRevision));
        }
        onDeploymentChange(next);
        if (next.status !== "running" && next.status !== "deleted" && next.status !== "failed") {
          timeoutId = window.setTimeout(poll, 1500);
        }
      } catch (pollError) {
        const message = pollError instanceof Error ? pollError.message : "Polling failed.";
        setError(message);
        recordEvent("deployment.poll.failed", { deploymentId, error: message }, correlationId);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [correlationId, deploymentId, onDeploymentChange, pollGeneration]);

  useEffect(() => {
    let cancelled = false;
    setRevisionsError(null);

    async function loadRevisions() {
      try {
        const next = await listDeploymentRevisions(deploymentId);
        if (!cancelled) {
          setRevisions(next);
        }
      } catch (revisionError) {
        if (!cancelled) {
          setRevisionsError(
            revisionError instanceof Error
              ? revisionError.message
              : "Unable to load deployment revisions."
          );
        }
      }
    }

    void loadRevisions();

    return () => {
      cancelled = true;
    };
  }, [deploymentId]);

  useEffect(() => {
    if (!hasDeployment || !activeRevisionId) {
      return;
    }
    const controller = new AbortController();
    const cachedLogs = readCachedLogs(deploymentId, activeRevisionId);
    const afterSequence = getLastLogSequence(cachedLogs);
    setLogs(cachedLogs);
    setLogStatus("connecting");
    recordEvent("deployment.logs.connected", { deploymentId, revisionId: activeRevisionId }, correlationId);

    void streamDeploymentLogs(deploymentId, {
      afterSequence,
      correlationId,
      signal: controller.signal,
      onLog: (line) => {
        setLogStatus("open");
        setLogs((current) => {
          const nextLogs = mergeLogLine(current, line);
          writeCachedLogs(deploymentId, activeRevisionId, nextLogs);
          return nextLogs;
        });
      },
      onEnd: () => {
        setLogStatus("closed");
        recordEvent(
          "deployment.logs.disconnected",
          { deploymentId, revisionId: activeRevisionId, reason: "end" },
          correlationId
        );
      },
      onError: (streamError) => {
        setLogStatus("failed");
        recordEvent(
          "deployment.logs.disconnected",
          {
            deploymentId,
            revisionId: activeRevisionId,
            reason: "error",
            error: streamError.message
          },
          correlationId
        );
      }
    });

    return () => {
      controller.abort();
    };
  }, [activeRevisionId, correlationId, deploymentId, hasDeployment]);

  useEffect(() => {
    if (!isEditingConfig || gpuTypes.length > 0) {
      return;
    }

    let cancelled = false;
    setGpuError(null);

    async function loadConfigGpuTypes() {
      try {
        const nextGpuTypes = await listGpuTypes();
        if (!cancelled) {
          setGpuTypes(nextGpuTypes);
        }
      } catch (loadError) {
        if (!cancelled) {
          setGpuError(loadError instanceof Error ? loadError.message : "Unable to load GPU types.");
        }
      }
    }

    void loadConfigGpuTypes();

    return () => {
      cancelled = true;
    };
  }, [gpuTypes.length, isEditingConfig]);

  function startConfigEdit() {
    if (!deployment) {
      return;
    }
    setConfigValues(toConfigValues(deployment));
    setConfigError(null);
    setHasTriedConfigSave(false);
    setIsEditingConfig(true);
  }

  function cancelConfigEdit() {
    setIsEditingConfig(false);
    setConfigValues(null);
    setConfigError(null);
    setHasTriedConfigSave(false);
  }

  function updateConfigValues(patch: Partial<WizardValues>) {
    setConfigValues((current) => (current ? { ...current, ...patch } : current));
  }

  async function saveConfig() {
    if (!deployment || !configValues) {
      return;
    }

    setHasTriedConfigSave(true);
    const payload = toConfigPayload(configValues);
    if (!canSaveConfig || !payload) {
      return;
    }

    setConfigError(null);
    setIsSavingConfig(true);
    recordEvent("deployment.config_update.started", { deploymentId }, correlationId);
    try {
      const updated = await updateDeploymentConfig(
        deployment.id,
        payload,
        { correlationId }
      );
      const nextRevisions = await listDeploymentRevisions(deployment.id);
      setDeployment(updated);
      setRevisions(nextRevisions);
      setPollGeneration((current) => current + 1);
      onDeploymentChange(updated);
      setIsEditingConfig(false);
      setConfigValues(null);
      recordEvent(
        "deployment.config_update.succeeded",
        { deploymentId, revision: updated.revision?.version },
        correlationId
      );
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Unable to update configuration.";
      setConfigError(message);
      recordEvent(
        "deployment.config_update.failed",
        { deploymentId, error: message },
        correlationId
      );
    } finally {
      setIsSavingConfig(false);
    }
  }

  async function copyIdentifier(event: MouseEvent<HTMLButtonElement>, value: string) {
    event.stopPropagation();
    try {
      await copyTextToClipboard(value);
      setCopiedRunId(value);
      window.setTimeout(() => {
        setCopiedRunId((current) => (current === value ? null : current));
      }, 1600);
    } catch {
      setCopiedRunId(null);
    }
  }

  function openRevisionFromKeyboard(
    event: KeyboardEvent<HTMLDivElement>,
    revisionId: string
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    onOpenRevision(deploymentId, revisionId);
  }

  return (
    <div className="screen">
      <div className="screen-header screen-header-with-back">
        <Button
          aria-label="Back to deployments"
          className="button-icon"
          title="Back to deployments"
          variant="ghost"
          onClick={onBack}
        >
          <span aria-hidden>←</span>
        </Button>
        <div className="screen-title">
          <p className="eyebrow">Deployment detail</p>
          <div className="title-row">
            <h2>{deployment?.name ?? "Loading deployment"}</h2>
            {deployment ? (
              <Button
                className="revision-action"
                variant="secondary"
                onClick={startConfigEdit}
                disabled={deployment.status === "deleted"}
              >
                <span className="revision-action-icon" aria-hidden>
                  +
                </span>
                <span>New revision</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="notice error-notice">
          <strong>Unable to refresh deployment.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {!deployment ? (
        <div className="table-shell skeleton">
          <div />
          <div />
          <div />
        </div>
      ) : (
        <div className="detail-grid">
          <section className="panel">
            <div className="current-summary">
              <div>
                <span>Current state</span>
                <StatusBadge status={deployment.status} />
              </div>
              <div>
                <span>Current revision</span>
                <strong>{activeRevision ? activeRevision.version : "Not available"}</strong>
              </div>
              <div>
                <span>Deployment ID</span>
                <button
                  aria-label={`Copy deployment id ${deployment.id}`}
                  className={`deployment-id-copy${copiedRunId === deployment.id ? " copied" : ""}`}
                  data-tooltip={copiedRunId === deployment.id ? "Copied" : deployment.id}
                  onClick={(event) => copyIdentifier(event, deployment.id)}
                  type="button"
                >
                  <span>{formatShortRunId(deployment.id)}</span>
                  <i aria-hidden="true" />
                </button>
              </div>
            </div>

            <ol className="status-timeline">
              {statusSteps.map((status, index) => (
                <li
                  className={
                    index <= currentStepIndex ? "complete" : index === currentStepIndex + 1 ? "next" : ""
                  }
                  key={status}
                >
                  <span />
                  {humanizeStatus(status)}
                </li>
              ))}
            </ol>

            {deployment.endpoint_url ? (
              <div className="endpoint-box">
                <span>Endpoint URL</span>
                <code>{deployment.endpoint_url}</code>
              </div>
            ) : (
              <div className="endpoint-box pending">
                <span>Endpoint URL</span>
                <p>Available once the deployment reaches running.</p>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Configuration</span>
                <h3>{deployment.model_source}</h3>
              </div>
            </div>
            <dl className="definition-grid">
              <div>
                <dt>GPU</dt>
                <dd>{deployment.gpu_type}</dd>
              </div>
              <div>
                <dt>Replicas</dt>
                <dd>{deployment.replicas}</dd>
              </div>
              <div>
                <dt>Autoscaling</dt>
                <dd>
                  {deployment.autoscaling.min}-{deployment.autoscaling.max}, target{" "}
                  {deployment.autoscaling.target_concurrency}
                </dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatDateTime(deployment.updated_at)}</dd>
              </div>
            </dl>
          </section>

          <section className="panel logs-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Live logs</span>
              </div>
            </div>
            <div className="logs">
              {logs.length === 0 ? (
                <p className="muted">No logs yet.</p>
              ) : (
                logs.map((line, index) => (
                  <div className={`log-line ${line.level}`} key={`${line.ts}-${index}`}>
                    <time>{formatDateTime(line.ts)}</time>
                    <span>{line.level}</span>
                    <p>{line.message}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="panel logs-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Deployment execution history</span>
              </div>
            </div>
            {revisionsError ? (
              <div className="notice error-notice">
                <strong>Unable to load revisions.</strong>
                <p>{revisionsError}</p>
              </div>
            ) : null}
            <div className="revision-list">
              {sortedRevisions.length === 0 && !revisionsError ? (
                <p className="muted">No deployment executions yet.</p>
              ) : null}
              {sortedRevisions.length > 0 ? (
                <div className="revision-row revision-row-header">
                  <span>Execution ID</span>
                  <span>Revision</span>
                  <span>Created at</span>
                  <span>Started at</span>
                  <span>Finished at</span>
                  <span>Duration</span>
                  <span>Status</span>
                </div>
              ) : null}
              {sortedRevisions.map((revision) => {
                const runId = revision.deployment_run_id ?? revision.id;
                const isCopied = copiedRunId === runId;
                return (
                  <div
                    aria-label={`Open execution details for revision ${revision.version}`}
                    className="revision-row"
                    key={revision.id}
                    onClick={() => onOpenRevision(deploymentId, revision.id)}
                    onKeyDown={(event) => openRevisionFromKeyboard(event, revision.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="revision-id-cell">
                      <button
                        aria-label={`Copy execution id ${runId}`}
                        className={`deployment-id-copy${isCopied ? " copied" : ""}`}
                        data-tooltip={isCopied ? "Copied" : runId}
                        onClick={(event) => copyIdentifier(event, runId)}
                        type="button"
                      >
                        <span>{formatShortRunId(runId)}</span>
                        <i aria-hidden="true" />
                      </button>
                    </span>
                    <span>{revision.version}</span>
                    <time>{formatDateTime(revision.created_at)}</time>
                    <time>
                      {revision.started_at ? formatDateTime(revision.started_at) : "Not started"}
                    </time>
                    <time>
                      {revision.finished_at
                        ? formatDateTime(revision.finished_at)
                        : "In progress"}
                    </time>
                    <span>{formatRevisionDuration(revision)}</span>
                    <span>{formatDeploymentRunStatus(revision)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
      {isEditingConfig && deployment && configValues ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="new-revision-title"
            aria-modal="true"
            className="modal-panel"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">New revision</p>
                <h2 id="new-revision-title">Modify configuration</h2>
              </div>
              <Button
                aria-label="Close new revision dialog"
                className="button-icon"
                disabled={isSavingConfig}
                title="Close"
                variant="ghost"
                onClick={cancelConfigEdit}
              >
                <span aria-hidden>x</span>
              </Button>
            </div>

            <div className="config-edit-stack">
              <div className="locked-field">
                <span>Model</span>
                <strong>{deployment.model_source}</strong>
                <p>Model changes require a new deployment.</p>
              </div>
              {configError ? (
                <div className="notice error-notice">
                  <strong>Configuration update failed.</strong>
                  <p>{configError}</p>
                </div>
              ) : null}
              <HardwareStep
                error={gpuError}
                errors={configDisplayErrors}
                gpuTypes={gpuTypes}
                monthlyCost={configMonthlyCost}
                selectedGpu={selectedConfigGpu}
                values={configValues}
                onChange={updateConfigValues}
              />
              <ConfigurationStep
                errors={configDisplayErrors}
                values={configValues}
                onChange={updateConfigValues}
              />
              <p className="summary-hint">
                {hasConfigChanged
                  ? `Deploying creates Revision ${
                      activeRevision ? activeRevision.version + 1 : revisions.length + 1
                    } while keeping the endpoint URL unchanged.`
                  : "Change a value to create a new revision."}
              </p>
            </div>

            <div className="modal-actions">
              <Button variant="ghost" onClick={cancelConfigEdit} disabled={isSavingConfig}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveConfig} disabled={!canSaveConfig}>
                {isSavingConfig ? "Deploying..." : "Deploy revision"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function formatRevisionDuration(revision: DeploymentRevision) {
  if (!revision.finished_at) {
    return "In progress";
  }
  const startedAt = Date.parse(revision.started_at ?? revision.created_at);
  const finishedAt = Date.parse(revision.finished_at);
  if (Number.isNaN(startedAt) || Number.isNaN(finishedAt) || finishedAt < startedAt) {
    return "Not available";
  }
  const totalSeconds = Math.max(1, Math.round((finishedAt - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function formatShortRunId(runId: string) {
  if (runId.length <= 18) {
    return runId;
  }
  return `${runId.slice(0, 10)}...${runId.slice(-6)}`;
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back for embedded browser contexts that expose Clipboard but deny writes.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error("Copy failed.");
  }
}

function formatDeploymentRunStatus(revision: DeploymentRevision) {
  if (revision.status === "failed") {
    return "Failed";
  }
  if (revision.status === "stopped" || revision.status === "deleted") {
    return "Stopped";
  }
  if (revision.finished_at || revision.status === "running") {
    return "Success";
  }
  return "In progress";
}

function toConfigValues(deployment: Deployment): WizardValues {
  return {
    name: deployment.name,
    model_source: deployment.model_source,
    gpu_type: deployment.gpu_type,
    replicas: deployment.replicas,
    autoscaling: {
      min: deployment.autoscaling.min,
      max: deployment.autoscaling.max,
      target_concurrency: deployment.autoscaling.target_concurrency
    },
    env: deployment.env
  };
}

function getConfigRequiredErrors(values: WizardValues) {
  const errors: WizardErrors = {};
  if (!values.gpu_type) {
    errors.gpu_type = "Choose a GPU type.";
  }
  if (values.replicas === "") {
    errors.replicas = "Enter the replica count.";
  }
  if (values.autoscaling.min === "") {
    errors.autoscalingMin = "Enter the autoscaling minimum.";
  }
  if (values.autoscaling.max === "") {
    errors.autoscalingMax = "Enter the autoscaling maximum.";
  }
  if (values.autoscaling.target_concurrency === "") {
    errors.autoscalingTarget = "Enter the target concurrency.";
  }
  return errors;
}

function toConfigPayload(values: WizardValues): UpdateDeploymentConfigRequest | null {
  if (
    !values.gpu_type ||
    values.replicas === "" ||
    values.autoscaling.min === "" ||
    values.autoscaling.max === "" ||
    values.autoscaling.target_concurrency === ""
  ) {
    return null;
  }

  return {
    gpu_type: values.gpu_type,
    replicas: values.replicas,
    autoscaling: {
      min: values.autoscaling.min,
      max: values.autoscaling.max,
      target_concurrency: values.autoscaling.target_concurrency
    },
    env: values.env
  };
}

function isSameConfig(deployment: Deployment, values: WizardValues) {
  return (
    deployment.gpu_type === values.gpu_type &&
    deployment.replicas === values.replicas &&
    deployment.autoscaling.min === values.autoscaling.min &&
    deployment.autoscaling.max === values.autoscaling.max &&
    deployment.autoscaling.target_concurrency === values.autoscaling.target_concurrency &&
    stringifyEnvObject(deployment.env) === stringifyEnvObject(values.env)
  );
}

function stringifyEnvObject(env: Record<string, string>) {
  return Object.entries(env)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function readCachedLogs(deploymentId: string, revisionId: string) {
  const storage = getLogStorage();
  if (!storage) {
    return [];
  }
  try {
    const raw = storage.getItem(logCacheKey(deploymentId, revisionId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isLogLine);
  } catch {
    return [];
  }
}

function writeCachedLogs(deploymentId: string, revisionId: string, logs: LogLine[]) {
  const storage = getLogStorage();
  if (!storage) {
    return;
  }
  storage.setItem(logCacheKey(deploymentId, revisionId), JSON.stringify(logs.slice(-200)));
}

function logCacheKey(deploymentId: string, revisionId: string) {
  return `speedboat:deployment-logs:${deploymentId}:${revisionId}`;
}

function getLogStorage() {
  if (typeof window === "undefined" || !("sessionStorage" in window)) {
    return null;
  }
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function mergeLogLine(logs: LogLine[], line: LogLine) {
  const bySequence = new Map(logs.map((log) => [log.sequence, log]));
  bySequence.set(line.sequence, line);
  return [...bySequence.values()].sort((left, right) => left.sequence - right.sequence);
}

function mergeRevision(revisions: DeploymentRevision[], revision: DeploymentRevision) {
  const byId = new Map(revisions.map((item) => [item.id, item]));
  byId.set(revision.id, { ...byId.get(revision.id), ...revision });
  return [...byId.values()].sort((left, right) => right.version - left.version);
}

function getLastLogSequence(logs: LogLine[]) {
  return logs.reduce((last, log) => Math.max(last, log.sequence), 0);
}

function isLogLine(value: unknown): value is LogLine {
  if (!value || typeof value !== "object") {
    return false;
  }
  return (
    "id" in value &&
    "sequence" in value &&
    "ts" in value &&
    "level" in value &&
    "deployment_id" in value &&
    "message" in value &&
    typeof value.id === "string" &&
    typeof value.sequence === "number" &&
    typeof value.ts === "string" &&
    typeof value.deployment_id === "string" &&
    typeof value.message === "string"
  );
}
