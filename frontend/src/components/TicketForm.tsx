import type { FormEvent } from "react";

export interface TicketFormValues {
  customer_name: string;
  customer_email: string;
  subject: string;
  description: string;
}

export type TicketFormErrors = Partial<Record<keyof TicketFormValues, string>>;

export const EMPTY_TICKET_FORM: TicketFormValues = {
  customer_name: "",
  customer_email: "",
  subject: "",
  description: "",
};

/** Limits mirror the backend (app/schemas.py): over-limit input is rejected here first. */
const LIMITS: Record<keyof TicketFormValues, { label: string; max: number }> = {
  customer_name: { label: "Customer name", max: 120 },
  customer_email: { label: "Customer email", max: 254 },
  subject: { label: "Subject", max: 200 },
  description: { label: "Description", max: 10000 },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateTicketForm(values: TicketFormValues): TicketFormErrors {
  const errors: TicketFormErrors = {};
  (Object.keys(LIMITS) as (keyof TicketFormValues)[]).forEach((field) => {
    const { label, max } = LIMITS[field];
    const trimmed = values[field].trim();
    if (trimmed.length === 0) {
      errors[field] = `${label} is required.`;
    } else if (trimmed.length > max) {
      errors[field] = `${label} must be ${max} characters or fewer.`;
    }
  });
  if (!errors.customer_email && !EMAIL_RE.test(values.customer_email.trim())) {
    errors.customer_email = "Enter a valid email address.";
  }
  return errors;
}

/** Trimmed payload actually sent. Never includes status/ids/timestamps. */
export function toCreatePayload(values: TicketFormValues): TicketFormValues {
  return {
    customer_name: values.customer_name.trim(),
    customer_email: values.customer_email.trim(),
    subject: values.subject.trim(),
    description: values.description.trim(),
  };
}

interface TicketFormProps {
  values: TicketFormValues;
  /** Errors to display (usually gated on touched/submit). */
  errors: TicketFormErrors;
  /** Raw validity of the values: controls the disabled submit. */
  isValid: boolean;
  submitting: boolean;
  submitLabel: string;
  onChange: (field: keyof TicketFormValues, value: string) => void;
  onBlurField: (field: keyof TicketFormValues) => void;
  onSubmit: (event: FormEvent) => void;
}

function Field({
  field,
  label,
  values,
  errors,
  onChange,
  onBlurField,
  multiline,
  type,
}: {
  field: keyof TicketFormValues;
  label: string;
  values: TicketFormValues;
  errors: TicketFormErrors;
  onChange: TicketFormProps["onChange"];
  onBlurField: TicketFormProps["onBlurField"];
  multiline?: boolean;
  type?: string;
}) {
  const error = errors[field];
  const errorId = `${field}-error`;
  const shared =
    "w-full rounded border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:outline-none " +
    (error
      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
      : "border-slate-300 focus:border-blue-500 focus:ring-blue-500");
  return (
    <div>
      <label
        htmlFor={field}
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          id={field}
          rows={5}
          value={values[field]}
          onChange={(event) => onChange(field, event.target.value)}
          onBlur={() => onBlurField(field)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder={label}
          className={shared}
        />
      ) : (
        <input
          id={field}
          type={type ?? "text"}
          autoComplete={field === "customer_email" ? "email" : "off"}
          value={values[field]}
          onChange={(event) => onChange(field, event.target.value)}
          onBlur={() => onBlurField(field)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder={label}
          className={shared}
        />
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export default function TicketForm({
  values,
  errors,
  isValid,
  submitting,
  submitLabel,
  onChange,
  onBlurField,
  onSubmit,
}: TicketFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field
        field="customer_name"
        label="Customer Name"
        values={values}
        errors={errors}
        onChange={onChange}
        onBlurField={onBlurField}
      />
      <Field
        field="customer_email"
        label="Customer Email"
        type="email"
        values={values}
        errors={errors}
        onChange={onChange}
        onBlurField={onBlurField}
      />
      <Field
        field="subject"
        label="Subject"
        values={values}
        errors={errors}
        onChange={onChange}
        onBlurField={onBlurField}
      />
      <Field
        field="description"
        label="Description"
        multiline
        values={values}
        errors={errors}
        onChange={onChange}
        onBlurField={onBlurField}
      />
      <div>
        <button
          type="submit"
          disabled={submitting || !isValid}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? "Creating…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
