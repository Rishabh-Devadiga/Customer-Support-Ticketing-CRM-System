import type { FormEvent } from "react";
import {
  DEFAULT_PRIORITY,
  TICKET_PRIORITIES,
  isTicketPriority,
  type TicketPriority,
} from "../types/tickets";

export interface TicketFormValues {
  customer_name: string;
  customer_email: string;
  subject: string;
  description: string;
  priority: TicketPriority;
}

export type TicketFormErrors = Partial<
  Record<keyof TicketFormValues, string>
>;

export const EMPTY_TICKET_FORM: TicketFormValues = {
  customer_name: "",
  customer_email: "",
  subject: "",
  description: "",
  priority: DEFAULT_PRIORITY,
};

/** Limits mirror the backend (app/schemas.py): over-limit input is rejected here first. */
type TextField = "customer_name" | "customer_email" | "subject" | "description";
const LIMITS: Record<TextField, { label: string; max: number }> = {
  customer_name: { label: "Customer name", max: 120 },
  customer_email: { label: "Customer email", max: 254 },
  subject: { label: "Subject", max: 200 },
  description: { label: "Description", max: 10000 },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateTicketForm(values: TicketFormValues): TicketFormErrors {
  const errors: TicketFormErrors = {};
  (Object.keys(LIMITS) as TextField[]).forEach((field) => {
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
  if (!isTicketPriority(values.priority)) {
    errors.priority = "Select a valid priority.";
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
    priority: values.priority,
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
    "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:ring-2 focus:outline-none " +
    (error
      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
      : "border-slate-300 focus:border-blue-500 focus:ring-blue-100");
  return (
    <div>
      <label
        htmlFor={field}
        className="mb-1.5 block text-sm font-semibold text-slate-700"
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
        <p id={errorId} className="mt-1.5 flex items-center gap-1 text-sm text-red-600">
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0">
            <path
              d="M8 5.5v3.5m0 2.5v.01M14.5 8A6.5 6.5 0 1 1 1.5 8a6.5 6.5 0 0 1 13 0Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
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
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
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
        <label
          htmlFor="priority"
          className="mb-1.5 block text-sm font-semibold text-slate-700"
        >
          Priority
        </label>
        <select
          id="priority"
          value={values.priority}
          onChange={(event) =>
            onChange(
              "priority",
              event.target.value as TicketFormValues["priority"],
            )
          }
          onBlur={() => onBlurField("priority")}
          aria-invalid={errors.priority ? true : undefined}
          aria-describedby={errors.priority ? "priority-error" : undefined}
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none sm:w-auto sm:min-w-56"
        >
          {TICKET_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
        {errors.priority && (
          <p id="priority-error" className="mt-1.5 text-sm text-red-600">
            {errors.priority}
          </p>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={submitting || !isValid}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {submitting ? "Creating…" : submitLabel}
        </button>
        <p className="text-xs text-slate-500 sm:ml-1">
          New tickets always start with status Open.
        </p>
      </div>
    </form>
  );
}
