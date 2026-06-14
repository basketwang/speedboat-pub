"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DeploymentDetail } from "@/features/deployments/DeploymentDetail";
import { DiagnosticsPanel } from "@/features/deployments/DiagnosticsPanel";
import { DeploymentList } from "@/features/deployments/DeploymentList";
import { DeploymentRevisionDetail } from "@/features/deployments/DeploymentRevisionDetail";
import { DeploymentWizard } from "@/features/deployments/DeploymentWizard";
import { listDeployments } from "@/features/deployments/api";
import type { Deployment } from "@/features/deployments/types";
import { recordEvent, useObservabilityEvents } from "@/lib/observability";

type View =
  | { name: "list" }
  | { name: "wizard" }
  | { name: "detail"; deploymentId: string }
  | { name: "revision"; deploymentId: string; revisionId: string };

export default function Home() {
  const [view, setView] = useState<View>({ name: "list" });
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const observabilityEvents = useObservabilityEvents();

  const refreshDeployments = useCallback(async function refreshDeployments() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await listDeployments();
      setDeployments(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load deployments.";
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDeploymentChange = useCallback((deployment: Deployment) => {
    setDeployments((current) =>
      current.map((item) => (item.id === deployment.id ? deployment : item))
    );
  }, []);

  useEffect(() => {
    recordEvent("app.opened", { route: "home" });
    void refreshDeployments();
  }, [refreshDeployments]);

  const activeDeployment = useMemo(() => {
    if (view.name !== "detail" && view.name !== "revision") {
      return null;
    }
    return deployments.find((deployment) => deployment.id === view.deploymentId) ?? null;
  }, [deployments, view]);

  return (
    <main className="app-shell">
      <section className="workspace" aria-live="polite">
        {view.name === "list" && (
          <DeploymentList
            deployments={deployments}
            error={loadError}
            isLoading={isLoading}
            onCreate={() => setView({ name: "wizard" })}
            onOpen={(deployment) => setView({ name: "detail", deploymentId: deployment.id })}
            onRefresh={refreshDeployments}
          />
        )}

        {view.name === "wizard" && (
          <DeploymentWizard
            existingDeploymentNames={deployments.map((deployment) => deployment.name)}
            onCancel={() => setView({ name: "list" })}
            onCreated={(deployment) => {
              setDeployments((current) => [deployment, ...current]);
              setView({ name: "detail", deploymentId: deployment.id });
            }}
          />
        )}

        {view.name === "detail" && (
          <DeploymentDetail
            deploymentId={view.deploymentId}
            initialDeployment={activeDeployment}
            onBack={() => {
              void refreshDeployments();
              setView({ name: "list" });
            }}
            onDeploymentChange={handleDeploymentChange}
            onOpenRevision={(deploymentId, revisionId) =>
              setView({ name: "revision", deploymentId, revisionId })
            }
          />
        )}

        {view.name === "revision" && (
          <DeploymentRevisionDetail
            deploymentId={view.deploymentId}
            revisionId={view.revisionId}
            onBack={() => setView({ name: "detail", deploymentId: view.deploymentId })}
          />
        )}
      </section>
      {process.env.NODE_ENV !== "production" ? (
        <DiagnosticsPanel events={observabilityEvents} />
      ) : null}
    </main>
  );
}
