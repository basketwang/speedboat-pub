import { useMemo, useState } from "react";
import { Field, TextInput } from "@/components/Field";
import { formatTokenPrice } from "@/lib/format";
import type { ModelSupportCheck, ParasailModel, WizardErrors, WizardValues } from "../types";

type Props = {
  values: WizardValues;
  errors: WizardErrors;
  supportCheck: ModelSupportCheck;
  models: ParasailModel[];
  isLoadingModels: boolean;
  onChange: (patch: Partial<WizardValues>) => void;
};

export function SourceStep({
  values,
  errors,
  supportCheck,
  models,
  isLoadingModels,
  onChange
}: Props) {
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const filteredModels = useMemo(
    () => filterModels(values.model_source, models),
    [models, values.model_source]
  );
  const visibleModels = filteredModels.slice(0, 8);
  const hasMoreModels = filteredModels.length > visibleModels.length;
  const supportError =
    supportCheck.state === "unsupported" || supportCheck.state === "unavailable"
      ? supportCheck.message
      : undefined;

  return (
    <div className="step-content">
      <Field
        label="Deployment name"
        error={errors.name}
        hint="Enter a lowercase name using letters, numbers, and dashes."
      >
        <TextInput
          className={errors.name ? "input-invalid" : undefined}
          value={values.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Enter a deployment name"
        />
      </Field>

      <Field
        label="Model source"
        error={errors.source ?? supportError}
        hint="Type to filter supported models, then choose the full owner/model id."
      >
        <div className="model-picker">
          <TextInput
            aria-autocomplete="list"
            aria-expanded={isModelMenuOpen}
            autoComplete="off"
            className={errors.source ?? supportError ? "input-invalid" : undefined}
            disabled={isLoadingModels}
            value={values.model_source}
            onBlur={() => setIsModelMenuOpen(false)}
            onChange={(event) => {
              onChange({ model_source: event.target.value });
              setIsModelMenuOpen(true);
            }}
            onFocus={() => setIsModelMenuOpen(true)}
            placeholder={isLoadingModels ? "Loading supported models..." : "Search owner/model"}
          />
          {isModelMenuOpen ? (
            <div className="model-picker-menu" role="listbox">
              {isLoadingModels ? (
                <p className="model-picker-empty">Loading supported models...</p>
              ) : null}
              {!isLoadingModels && visibleModels.length === 0 ? (
                <p className="model-picker-empty">No supported models match this search.</p>
              ) : null}
              {!isLoadingModels
                ? visibleModels.map((model) => (
                    <button
                      className={
                        model.id === values.model_source
                          ? "model-picker-option selected"
                          : "model-picker-option"
                      }
                      key={model.id}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onChange({ model_source: model.id });
                        setIsModelMenuOpen(false);
                      }}
                      role="option"
                      type="button"
                    >
                      <span>{model.id}</span>
                      <small>
                        {model.context_length.toLocaleString()} context ·{" "}
                        {model.capabilities.join(", ")}
                      </small>
                      <small>
                        Input {formatTokenPrice(model.pricing.input_per_mtok_usd)} · Output{" "}
                        {formatTokenPrice(model.pricing.output_per_mtok_usd)}
                      </small>
                    </button>
                  ))
                : null}
              {hasMoreModels ? (
                <p className="model-picker-empty">
                  Showing 8 of {filteredModels.length}. Keep typing to narrow the list.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Field>

    </div>
  );
}

function filterModels(query: string, models: ParasailModel[]) {
  const trimmed = query.trim();
  if (!trimmed) {
    return models;
  }

  const matcher = createMatcher(trimmed);
  return models.filter((model) => matcher.test(model.id));
}

function createMatcher(query: string) {
  try {
    return new RegExp(query, "i");
  } catch {
    return new RegExp(escapeRegExp(query), "i");
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
