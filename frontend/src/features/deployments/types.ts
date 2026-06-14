export type DeploymentStatus =
  | "pending"
  | "queued"
  | "pulling_image"
  | "loading_weights"
  | "warming_up"
  | "running"
  | "stopped"
  | "deleted"
  | "failed";

export type Autoscaling = {
  min: number;
  max: number;
  target_concurrency: number;
};

export type Deployment = {
  id: string;
  name: string;
  active_revision_id?: string;
  revision?: DeploymentRevision;
  revisions?: DeploymentRevision[];
  model_source: string;
  gpu_type: string;
  replicas: number;
  autoscaling: Autoscaling;
  env: Record<string, string>;
  status: DeploymentStatus;
  endpoint_url: string | null;
  created_at: string;
  updated_at: string;
};

export type DeploymentRevision = {
  id: string;
  deployment_run_id?: string;
  deployment_id: string;
  version: number;
  model_source: string;
  gpu_type: string;
  replicas: number;
  autoscaling: Autoscaling;
  env: Record<string, string>;
  status: DeploymentStatus;
  endpoint_url: string | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  updated_at: string;
  activated_at: string | null;
  deactivated_at: string | null;
};

export type GpuType = {
  id: string;
  name: string;
  vram_gb: number;
  hourly_cost_usd: number;
};

export type ParasailModel = {
  id: string;
  object: "model";
  owned_by: string;
  context_length: number;
  capabilities: string[];
  recommended_configuration?: CreateDeploymentRecommendation;
  pricing: {
    input_per_mtok_usd: number;
    output_per_mtok_usd: number;
  };
};

export type CreateDeploymentRecommendation = {
  gpu_type: string;
  replicas: number;
  autoscaling: Autoscaling;
  env: Record<string, string>;
};

export type CreateDeploymentRequest = {
  name: string;
  model_source: string;
  gpu_type: string;
  replicas: number;
  autoscaling: Autoscaling;
  env: Record<string, string>;
};

export type UpdateDeploymentConfigRequest = Pick<
  CreateDeploymentRequest,
  "gpu_type" | "replicas" | "autoscaling" | "env"
>;

export type DraftNumber = number | "";

export type LogLine = {
  id: string;
  sequence: number;
  ts: string;
  level: "debug" | "info" | "warn" | "error";
  deployment_id: string;
  message: string;
};

export type WizardValues = Omit<CreateDeploymentRequest, "replicas" | "autoscaling"> & {
  replicas: DraftNumber;
  autoscaling: {
    min: DraftNumber;
    max: DraftNumber;
    target_concurrency: DraftNumber;
  };
};

export type WizardErrorKey =
  | keyof WizardValues
  | "duplicateName"
  | "source"
  | "autoscalingMin"
  | "autoscalingMax"
  | "autoscalingTarget";

export type WizardErrors = Partial<Record<WizardErrorKey, string>>;

export type ParsedModelSource = {
  normalized: string;
  owner: string;
  repo: string;
};

export type ModelSupportCheck =
  | {
      state: "idle";
      message: string;
      matchedModel?: never;
    }
  | {
      state: "loading";
      message: string;
      matchedModel?: never;
    }
  | {
      state: "supported";
      message: string;
      matchedModel: ParasailModel;
    }
  | {
      state: "unsupported" | "invalid" | "unavailable";
      message: string;
      matchedModel?: never;
    };
