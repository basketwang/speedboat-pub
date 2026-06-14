import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { createDeployment, isRetriableApiError, listGpuTypes, listModels } from "./api";
import type { Deployment, GpuType, ParasailModel, WizardErrors, WizardValues } from "./types";
import { ConfigurationStep } from "./wizard/ConfigurationStep";
import { HardwareStep } from "./wizard/HardwareStep";
import { SourceStep } from "./wizard/SourceStep";
import { formatTokenPrice } from "@/lib/format";
import { createCorrelationId, recordEvent } from "@/lib/observability";
import { withRetry } from "@/lib/retry";
import { checkModelSupport, validateWizard } from "@/lib/validation";

type Props = {
  existingDeploymentNames: string[];
  onCancel: () => void;
  onCreated: (deployment: Deployment) => void;
};

const initialValues: WizardValues = {
  name: "",
  model_source: "",
  gpu_type: "",
  replicas: "",
  autoscaling: {
    min: "",
    max: "",
    target_concurrency: ""
  },
  env: {}
};

export function DeploymentWizard({ existingDeploymentNames, onCancel, onCreated }: Props) {
  const [values, setValues] = useState<WizardValues>(initialValues);
  const [gpuTypes, setGpuTypes] = useState<GpuType[]>([]);
  const [models, setModels] = useState<ParasailModel[]>([]);
  const [gpuError, setGpuError] = useState<string | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [, setRetryMessage] = useState<string | null>(null);
  const [appliedRecommendationModelId, setAppliedRecommendationModelId] = useState<string | null>(
    null
  );

  const errors = useMemo(() => validateWizard(values), [values]);
  const duplicateNameError = useMemo(
    () => getDuplicateNameError(values.name, existingDeploymentNames),
    [existingDeploymentNames, values.name]
  );
  const selectedGpu = gpuTypes.find((gpu) => gpu.id === values.gpu_type) ?? null;
  const modelSupport = useMemo(
    () =>
      checkModelSupport(values.model_source, models, {
        isLoading: isLoadingModels,
        error: modelsError
      }),
    [isLoadingModels, models, modelsError, values.model_source]
  );
  const shouldShowRequiredErrors =
    hasTriedSubmit ||
    Boolean(values.name.trim()) ||
    Boolean(values.model_source.trim()) ||
    modelSupport.state === "supported";
  const requiredErrors = useMemo(
    () =>
      shouldShowRequiredErrors
        ? getRequiredErrors(values, modelSupport.state === "supported")
        : {},
    [modelSupport.state, shouldShowRequiredErrors, values]
  );
  const displayErrors = useMemo(
    () => ({ ...errors, ...requiredErrors, ...duplicateNameError }),
    [duplicateNameError, errors, requiredErrors]
  );
  const monthlyCost = selectedGpu
    ? selectedGpu.hourly_cost_usd * (values.replicas || 0) * 24 * 30
    : 0;
  const selectedModel = modelSupport.state === "supported" ? modelSupport.matchedModel : null;
  const canDeploy =
    Object.keys(errors).length === 0 &&
    Object.keys(duplicateNameError).length === 0 &&
    Boolean(values.name.trim()) &&
    Boolean(values.model_source.trim()) &&
    Boolean(values.gpu_type) &&
    values.replicas !== "" &&
    values.autoscaling.min !== "" &&
    values.autoscaling.max !== "" &&
    values.autoscaling.target_concurrency !== "" &&
    modelSupport.state === "supported";
  const sourceSectionMeta =
    modelSupport.state === "supported"
      ? "Supported"
      : modelSupport.state === "loading"
        ? "Checking"
        : modelSupport.state === "idle"
          ? "Not configured"
          : "Needs attention";
  useEffect(() => {
    async function loadGpuTypes() {
      setGpuError(null);
      try {
        const data = await listGpuTypes();
        setGpuTypes(data);
      } catch (error) {
        setGpuError(error instanceof Error ? error.message : "Unable to load GPU types.");
      }
    }
    void loadGpuTypes();
  }, []);

  useEffect(() => {
    async function loadModels() {
      setIsLoadingModels(true);
      setModelsError(null);
      try {
        const data = await listModels();
        setModels(data);
      } catch (error) {
        setModelsError(error instanceof Error ? error.message : "Unable to load supported models.");
      } finally {
        setIsLoadingModels(false);
      }
    }
    void loadModels();
  }, []);

  useEffect(() => {
    if (modelSupport.state !== "supported") {
      return;
    }

    const model = modelSupport.matchedModel;
    const recommendation = model.recommended_configuration;
    if (appliedRecommendationModelId === model.id || !recommendation) {
      return;
    }

    setValues((current) => ({
      ...current,
      gpu_type: recommendation.gpu_type,
      replicas: recommendation.replicas,
      autoscaling: recommendation.autoscaling,
      env: recommendation.env
    }));
    setAppliedRecommendationModelId(model.id);
  }, [appliedRecommendationModelId, modelSupport]);

  function updateValues(patch: Partial<WizardValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  async function submit() {
    setHasTriedSubmit(true);
    const validation = validateWizard(values);
    const missingRequired = getRequiredErrors(values, modelSupport.state === "supported");
    const duplicateName = getDuplicateNameError(values.name, existingDeploymentNames);
    if (
      !canDeploy ||
      Object.keys(validation).length > 0 ||
      Object.keys(missingRequired).length > 0 ||
      Object.keys(duplicateName).length > 0 ||
      modelSupport.state !== "supported"
    ) {
      setSubmitError("Fix the highlighted fields and choose a supported model before deploying.");
      return;
    }

    const correlationId = createCorrelationId("deploy");
    const startedAt = performance.now();
    setIsSubmitting(true);
    setSubmitError(null);
    setRetryMessage(null);
    recordEvent("deployment.create.started", { route: "deployment-form", name: values.name }, correlationId);

    try {
      const deployment = await withRetry(
        () =>
          createDeployment(
            {
              ...values,
              replicas: values.replicas || 1,
              autoscaling: {
                min: values.autoscaling.min || 0,
                max: values.autoscaling.max || 1,
                target_concurrency: values.autoscaling.target_concurrency || 1
              }
            },
            { correlationId }
          ),
        {
          attempts: 3,
          baseDelayMs: 700,
          correlationId,
          shouldRetry: isRetriableApiError,
          onRetry: (attempt, delayMs) => {
            setRetryMessage(`Retry ${attempt} scheduled in ${Math.round(delayMs / 100) / 10}s.`);
          }
        }
      );

      recordEvent(
        "deployment.create.succeeded",
        {
          deploymentId: deployment.id,
          elapsedMs: Math.round(performance.now() - startedAt)
        },
        correlationId
      );
      onCreated(deployment);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Deployment failed.";
      recordEvent(
        "deployment.create.failed",
        {
          elapsedMs: Math.round(performance.now() - startedAt),
          error: message
        },
        correlationId
      );
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="screen">
      <div className="screen-header screen-header-with-back">
        <Button
          aria-label="Back to deployments"
          className="button-icon"
          title="Back to deployments"
          variant="ghost"
          onClick={onCancel}
        >
          <span aria-hidden>←</span>
        </Button>
        <div className="screen-title">
          <p className="eyebrow">New deployment</p>
          <h2>Configure model endpoint</h2>
        </div>
      </div>

      <div className="deploy-form-layout">
        <div className="deploy-form-main">
          <section className="form-section">
            <div className="form-section-header">
              <div>
                <h3>Model configuration</h3>
              </div>
              <span className="section-status">{sourceSectionMeta}</span>
            </div>
            <div className="model-config-stack">
              <SourceStep
                errors={displayErrors}
                isLoadingModels={isLoadingModels}
                models={models}
                supportCheck={modelSupport}
                values={values}
                onChange={updateValues}
              />
              {modelSupport.state === "supported" ? (
                <>
                  <HardwareStep
                    error={gpuError}
                    errors={displayErrors}
                    gpuTypes={gpuTypes}
                    monthlyCost={monthlyCost}
                    selectedGpu={selectedGpu}
                    values={values}
                    onChange={updateValues}
                  />
                  <ConfigurationStep errors={displayErrors} values={values} onChange={updateValues} />
                </>
              ) : null}
            </div>
          </section>

          {submitError ? (
            <div className="notice error-notice">
              <strong>Deployment was not created.</strong>
              <p>{submitError}</p>
            </div>
          ) : null}

        </div>

        <aside className="deploy-summary" aria-label="Deployment summary">
          <span className="panel-kicker">Deploy summary</span>
          <h3>{values.name || "Untitled deployment"}</h3>
          <dl>
            <div>
              <dt>Model</dt>
              <dd>{values.model_source || "Not selected"}</dd>
            </div>
            <div>
              <dt>GPU</dt>
              <dd>{selectedGpu?.name ?? "Not selected"}</dd>
            </div>
            <div>
              <dt>Replicas</dt>
              <dd>{values.replicas || "Not set"}</dd>
            </div>
            <div>
              <dt>Estimate</dt>
              <dd>{selectedGpu ? `$${monthlyCost.toLocaleString()}/mo` : "Select GPU"}</dd>
            </div>
            <div>
              <dt>Usage pricing</dt>
              <dd>
                {selectedModel ? (
                  <span className="usage-pricing">
                    <span>Input {formatTokenPrice(selectedModel.pricing.input_per_mtok_usd)}</span>
                    <span>Output {formatTokenPrice(selectedModel.pricing.output_per_mtok_usd)}</span>
                  </span>
                ) : (
                  "Select model"
                )}
              </dd>
            </div>
          </dl>
          <Button variant="primary" onClick={submit} disabled={isSubmitting || !canDeploy}>
            {isSubmitting ? "Deploying..." : "Deploy model"}
          </Button>
        </aside>
      </div>
    </div>
  );
}

function getRequiredErrors(values: WizardValues, isModelSupported: boolean): WizardErrors {
  const errors: WizardErrors = {};

  if (!values.name.trim()) {
    errors.name = "Enter a deployment name.";
  }

  if (!values.model_source.trim()) {
    errors.source = "Choose a supported model.";
  }

  if (!isModelSupported) {
    return errors;
  }

  if (!values.gpu_type) {
    errors.gpu_type = "Choose a GPU type.";
  }

  if (values.replicas === "") {
    errors.replicas = "Enter replicas.";
  }

  if (values.autoscaling.min === "") {
    errors.autoscalingMin = "Enter autoscale minimum.";
  }

  if (values.autoscaling.max === "") {
    errors.autoscalingMax = "Enter autoscale maximum.";
  }

  if (values.autoscaling.target_concurrency === "") {
    errors.autoscalingTarget = "Enter target concurrency.";
  }

  return errors;
}

function getDuplicateNameError(name: string, existingDeploymentNames: string[]): WizardErrors {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) {
    return {};
  }
  const isDuplicate = existingDeploymentNames.some(
    (existingName) => existingName.trim().toLowerCase() === normalizedName
  );
  return isDuplicate ? { name: "This deployment name is already in use." } : {};
}
