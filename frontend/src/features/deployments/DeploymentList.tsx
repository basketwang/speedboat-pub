import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import type { Deployment } from "./types";
import { formatDateTime } from "@/lib/format";

type Props = {
  deployments: Deployment[];
  error: string | null;
  isLoading: boolean;
  onCreate: () => void;
  onOpen: (deployment: Deployment) => void;
  onRefresh: () => void;
};

export function DeploymentList({
  deployments,
  error,
  isLoading,
  onCreate,
  onOpen,
  onRefresh
}: Props) {
  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <p className="eyebrow">Deployments</p>
          <h2>Model endpoints</h2>
        </div>
        <div className="header-actions">
          <Button variant="primary" onClick={onCreate}>
            New deployment
          </Button>
        </div>
      </div>

      {error ? (
        <div className="notice error-notice">
          <strong>Unable to load deployments.</strong>
          <p>{error}</p>
          <Button onClick={onRefresh}>Try again</Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="table-shell skeleton">
          <div />
          <div />
          <div />
        </div>
      ) : null}

      {!isLoading && deployments.length === 0 ? (
        <div className="empty-state">
          <p className="eyebrow">No deployments yet</p>
          <h3>Ship your first model endpoint</h3>
          <Button variant="primary" onClick={onCreate}>
            New deployment
          </Button>
        </div>
      ) : null}

      {!isLoading && deployments.length > 0 ? (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Model</th>
                <th>GPU</th>
                <th>Replicas</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((deployment) => (
                <tr key={deployment.id} onClick={() => onOpen(deployment)}>
                  <td data-label="Name">
                    <strong>{deployment.name}</strong>
                    <small>{deployment.endpoint_url ?? deployment.id}</small>
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={deployment.status} />
                  </td>
                  <td data-label="Model">{deployment.model_source}</td>
                  <td data-label="GPU">{deployment.gpu_type}</td>
                  <td data-label="Replicas">{deployment.replicas}</td>
                  <td data-label="Updated">{formatDateTime(deployment.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
