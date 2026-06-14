import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { getDeployment, listDeploymentRevisions } from "./api";
import type { Deployment, DeploymentRevision } from "./types";
import { formatDateTime, humanizeStatus } from "@/lib/format";

type Props = {
  deploymentId: string;
  revisionId: string;
  onBack: () => void;
};

export function DeploymentRevisionDetail({ deploymentId, revisionId, onBack }: Props) {
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [revisions, setRevisions] = useState<DeploymentRevision[]>([]);
  const [error, setError] = useState<string | null>(null);

  const revision = useMemo(
    () => revisions.find((item) => item.id === revisionId) ?? null,
    [revisionId, revisions]
  );
  const envEntries = revision ? Object.entries(revision.env) : [];

  useEffect(() => {
    let cancelled = false;

    async function loadRevision() {
      setError(null);
      try {
        const [nextDeployment, nextRevisions] = await Promise.all([
          getDeployment(deploymentId),
          listDeploymentRevisions(deploymentId)
        ]);
        if (!cancelled) {
          setDeployment(nextDeployment);
          setRevisions(nextRevisions);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load revision.");
        }
      }
    }

    void loadRevision();

    return () => {
      cancelled = true;
    };
  }, [deploymentId]);

  return (
    <div className="screen">
      <div className="screen-header screen-header-with-back">
        <Button
          aria-label="Back to deployment"
          className="button-icon"
          title="Back to deployment"
          variant="ghost"
          onClick={onBack}
        >
          <span aria-hidden>←</span>
        </Button>
        <div className="screen-title">
          <p className="eyebrow">Execution detail</p>
          <h2>
            {deployment?.name ?? "Deployment"} ·{" "}
            {revision ? `Revision ${revision.version}` : "Loading execution"}
          </h2>
        </div>
      </div>

      {error ? (
        <div className="notice error-notice">
          <strong>Unable to load revision.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {!revision ? (
        <div className="table-shell skeleton">
          <div />
          <div />
          <div />
        </div>
      ) : (
        <div className="detail-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Execution timeline</span>
                <h3>Revision {revision.version}</h3>
              </div>
            </div>
            <dl className="definition-grid">
              <div>
                <dt>Execution created</dt>
                <dd>{formatDateTime(revision.created_at)}</dd>
              </div>
              <div>
                <dt>Execution ID</dt>
                <dd>{revision.deployment_run_id ?? revision.id}</dd>
              </div>
              <div>
                <dt>Revision</dt>
                <dd>{revision.version}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>
                  {revision.started_at ? formatDateTime(revision.started_at) : "Not started"}
                </dd>
              </div>
              <div>
                <dt>Finished</dt>
                <dd>
                  {revision.finished_at ? formatDateTime(revision.finished_at) : "In progress"}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{humanizeStatus(revision.status)}</dd>
              </div>
              <div>
                <dt>Deactivated</dt>
                <dd>
                  {revision.deactivated_at
                    ? formatDateTime(revision.deactivated_at)
                    : "Not deactivated"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Revision configuration</span>
                <h3>{revision.model_source}</h3>
              </div>
            </div>
            <dl className="definition-grid">
              <div>
                <dt>Endpoint</dt>
                <dd>{revision.endpoint_url ?? "Not available"}</dd>
              </div>
              <div>
                <dt>GPU</dt>
                <dd>{revision.gpu_type}</dd>
              </div>
              <div>
                <dt>Replicas</dt>
                <dd>{revision.replicas}</dd>
              </div>
              <div>
                <dt>Autoscaling</dt>
                <dd>
                  {revision.autoscaling.min}-{revision.autoscaling.max}, target{" "}
                  {revision.autoscaling.target_concurrency}
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel logs-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Environment</span>
                <h3>{envEntries.length} variable{envEntries.length === 1 ? "" : "s"}</h3>
              </div>
            </div>
            {envEntries.length === 0 ? (
              <p className="muted">No environment variables set.</p>
            ) : (
              <pre className="env-code">
                {envEntries.map(([key, value]) => `${key}=${value}`).join("\n")}
              </pre>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
