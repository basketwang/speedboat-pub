import type { DeploymentStatus } from "@/features/deployments/types";
import { humanizeStatus } from "@/lib/format";

export function StatusBadge({ status }: { status: DeploymentStatus }) {
  return <span className={`status-badge status-${status}`}>{humanizeStatus(status)}</span>;
}
