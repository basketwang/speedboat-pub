import type {
  ModelSupportCheck,
  ParasailModel,
  ParsedModelSource,
  WizardErrors,
  WizardValues
} from "@/features/deployments/types";

export function parseModelSource(input: string): ParsedModelSource | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  let source = trimmed;
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname.includes("huggingface.co") && parts.length >= 2) {
      source = `${parts[0]}/${parts[1]}`;
    }
  } catch {
    source = trimmed.replace(/^\/+|\/+$/g, "");
  }

  const match = source.match(/^([A-Za-z0-9][A-Za-z0-9_.-]*)\/([A-Za-z0-9][A-Za-z0-9_.-]*)$/);
  if (!match) {
    return null;
  }

  return {
    normalized: `${match[1]}/${match[2]}`,
    owner: match[1],
    repo: match[2]
  };
}

export function slugifyDeploymentName(source: string) {
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function validateWizard(values: WizardValues) {
  const errors: WizardErrors = {};

  if (values.name.trim() && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(values.name)) {
    errors.name = "Use lowercase letters, numbers, and dashes. Start with a letter or number.";
  }

  if (values.replicas !== "" && (values.replicas < 1 || values.replicas > 16)) {
    errors.replicas = "Replicas must be between 1 and 16.";
  }

  if (
    values.autoscaling.min !== "" &&
    values.replicas !== "" &&
    values.autoscaling.min > values.replicas
  ) {
    errors.autoscalingMin = "Autoscaling minimum cannot be greater than replicas.";
  }

  if (
    values.autoscaling.max !== "" &&
    values.replicas !== "" &&
    values.autoscaling.max < values.replicas
  ) {
    errors.autoscalingMax = "Autoscaling maximum cannot be less than replicas.";
  }

  if (
    values.autoscaling.max !== "" &&
    values.autoscaling.min !== "" &&
    values.autoscaling.max < values.autoscaling.min
  ) {
    errors.autoscalingMin = "Autoscaling minimum cannot be greater than maximum.";
  }

  return errors;
}

export function checkModelSupport(
  source: string,
  models: ParasailModel[],
  options: { isLoading: boolean; error: string | null }
): ModelSupportCheck {
  const trimmedSource = source.trim();
  if (!trimmedSource) {
    return {
      state: "idle",
      message: "Enter a model source to check support."
    };
  }

  if (options.isLoading) {
    return {
      state: "loading",
      message: "Checking Parasail model support..."
    };
  }

  if (options.error) {
    return {
      state: "unavailable",
      message: `Could not check supported models: ${options.error}`
    };
  }

  const parsed = parseModelSource(trimmedSource);
  const normalizedSource = parsed?.normalized ?? trimmedSource;
  const matchedModel = findSupportedModel(normalizedSource, models);
  if (matchedModel) {
    return {
      state: "supported",
      matchedModel,
      message: `${matchedModel.id} is available for deployment.`
    };
  }

  return {
    state: "unsupported",
    message: "Choose one of the supported models from the list."
  };
}

function findSupportedModel(source: string, models: ParasailModel[]) {
  const normalizedSource = source.toLowerCase();
  return models.find((model) => model.id.toLowerCase() === normalizedSource);
}
