import { useEffect, useRef, useState } from "react";
import { Field, NumberInput, TextInput } from "@/components/Field";
import type { WizardErrors, WizardValues } from "../types";

type Props = {
  values: WizardValues;
  errors: WizardErrors;
  onChange: (patch: Partial<WizardValues>) => void;
};

export function ConfigurationStep({ values, errors, onChange }: Props) {
  const initialEnvText = stringifyEnv(values.env);
  const [envDraft, setEnvDraft] = useState(initialEnvText);
  const lastSyncedEnvText = useRef(initialEnvText);
  const runtimeErrors = [
    errors.replicas,
    errors.autoscalingMin,
    errors.autoscalingMax,
    errors.autoscalingTarget
  ].filter((error): error is string => Boolean(error));

  useEffect(() => {
    const nextEnvText = stringifyEnv(values.env);
    if (envDraft === lastSyncedEnvText.current) {
      setEnvDraft(nextEnvText);
    }
    lastSyncedEnvText.current = nextEnvText;
  }, [envDraft, values.env]);

  function updateAutoscaling(patch: Partial<WizardValues["autoscaling"]>) {
    onChange({ autoscaling: { ...values.autoscaling, ...patch } });
  }

  function updateEnv(text: string) {
    setEnvDraft(text);
    const env: Record<string, string> = {};
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const [key, ...rest] = line.split("=");
        if (key && rest.length > 0) {
          env[key.trim()] = rest.join("=").trim();
        }
      });
    onChange({ env });
  }

  return (
    <div className="step-content">
      <div>
        <h3>Runtime configuration</h3>
      </div>

      <div className="form-grid">
        <Field label="Replicas">
          <NumberInput
            className={errors.replicas ? "input-invalid" : undefined}
            min={1}
            max={16}
            value={values.replicas}
            placeholder="1"
            onChange={(event) =>
              onChange({ replicas: event.target.value === "" ? "" : Number(event.target.value) })
            }
          />
        </Field>
        <Field label="Autoscale min">
          <NumberInput
            className={errors.autoscalingMin ? "input-invalid" : undefined}
            min={0}
            value={values.autoscaling.min}
            placeholder="1"
            onChange={(event) =>
              updateAutoscaling({ min: event.target.value === "" ? "" : Number(event.target.value) })
            }
          />
        </Field>
        <Field label="Autoscale max">
          <NumberInput
            className={errors.autoscalingMax ? "input-invalid" : undefined}
            min={1}
            value={values.autoscaling.max}
            placeholder="2"
            onChange={(event) =>
              updateAutoscaling({ max: event.target.value === "" ? "" : Number(event.target.value) })
            }
          />
        </Field>
        <Field label="Target concurrency">
          <NumberInput
            className={errors.autoscalingTarget ? "input-invalid" : undefined}
            min={1}
            value={values.autoscaling.target_concurrency}
            onChange={(event) =>
              updateAutoscaling({
                target_concurrency:
                  event.target.value === "" ? "" : Number(event.target.value)
              })
            }
            placeholder="4"
          />
        </Field>
      </div>

      {runtimeErrors.length > 0 ? (
        <div className="runtime-validation" role="alert">
          {runtimeErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <Field
        label="Environment variables"
        hint="One KEY=value pair per line. Leave blank if the runtime defaults are enough."
      >
        <textarea
          className="input textarea"
          value={envDraft}
          onChange={(event) => updateEnv(event.target.value)}
          placeholder={`VLLM_ENGINE_ARGS=--max-model-len 16384
HF_HOME=/models/cache
LOG_LEVEL=info`}
          rows={5}
        />
      </Field>
    </div>
  );
}

function stringifyEnv(env: Record<string, string>) {
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}
