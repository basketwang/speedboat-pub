import type { GpuType, WizardErrors, WizardValues } from "../types";
import { formatCurrency } from "@/lib/format";

type Props = {
  values: WizardValues;
  errors: WizardErrors;
  gpuTypes: GpuType[];
  selectedGpu: GpuType | null;
  monthlyCost: number;
  error: string | null;
  onChange: (patch: Partial<WizardValues>) => void;
};

export function HardwareStep({
  values,
  errors,
  gpuTypes,
  selectedGpu,
  monthlyCost,
  error,
  onChange
}: Props) {
  return (
    <div className="step-content">
      <div>
        <h3>Hardware</h3>
      </div>

      {error ? (
        <div className="notice error-notice">
          <strong>GPU types failed to load.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="cost-panel">
        <div>
          <span>Estimated monthly</span>
          <strong>{selectedGpu ? formatCurrency(monthlyCost) : "Select GPU"}</strong>
        </div>
        <p>
          {selectedGpu
            ? `${values.replicas || "0"} replica x ${formatCurrency(
                selectedGpu.hourly_cost_usd,
                2
              )}/hr x 24 x 30`
            : "Choose hardware to estimate monthly cost."}
        </p>
      </div>

      <div className="gpu-grid" role="radiogroup" aria-label="GPU type">
        {gpuTypes.map((gpu) => (
          <button
            className={gpu.id === values.gpu_type ? "gpu-card selected" : "gpu-card"}
            aria-checked={gpu.id === values.gpu_type}
            key={gpu.id}
            onClick={() => onChange({ gpu_type: gpu.id })}
            role="radio"
            type="button"
          >
            <strong>{gpu.name}</strong>
            <span>{gpu.vram_gb}GB VRAM</span>
            <small>{formatCurrency(gpu.hourly_cost_usd, 2)} / hr</small>
          </button>
        ))}
      </div>
      {errors.gpu_type ? <p className="field-error">{errors.gpu_type}</p> : null}
    </div>
  );
}
