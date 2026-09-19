import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, createTicket } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import TicketForm, {
  EMPTY_TICKET_FORM,
  toCreatePayload,
  validateTicketForm,
  type TicketFormErrors,
  type TicketFormValues,
} from "../components/TicketForm";

type FieldTouched = Record<keyof TicketFormValues, boolean>;
const UNTOUCHED: FieldTouched = {
  customer_name: false,
  customer_email: false,
  subject: false,
  description: false,
  priority: false,
};

const KNOWN_FIELDS: (keyof TicketFormValues)[] = [
  "customer_name",
  "customer_email",
  "subject",
  "description",
];

/**
 * Map a FastAPI 422 `detail` array to per-field errors.
 * Client validation blocks these first, so this is a safety net, not the UX path.
 */
export function mapDetailToFieldErrors(detail: unknown): {
  fieldErrors: TicketFormErrors;
  formError: string | null;
} {
  const fieldErrors: TicketFormErrors = {};
  if (!Array.isArray(detail)) return { fieldErrors, formError: null };
  let formError: string | null = null;
  for (const entry of detail) {
    if (typeof entry !== "object" || entry === null) continue;
    const { loc, msg } = entry as { loc?: unknown; msg?: unknown };
    const message = typeof msg === "string" ? msg : "Invalid value.";
    const field =
      Array.isArray(loc) && loc.length > 0 ? loc[loc.length - 1] : null;
    if (
      typeof field === "string" &&
      (KNOWN_FIELDS as string[]).includes(field) &&
      !(field as keyof TicketFormValues in fieldErrors)
    ) {
      fieldErrors[field as keyof TicketFormValues] = message;
    } else {
      formError = formError === null ? message : `${formError}; ${message}`;
    }
  }
  return { fieldErrors, formError };
}

export default function NewTicketPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<TicketFormValues>(EMPTY_TICKET_FORM);
  const [touched, setTouched] = useState<FieldTouched>(UNTOUCHED);
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<TicketFormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Ref guard: two clicks in the same tick must not double-POST (state lags).
  const submittingRef = useRef(false);

  const clientErrors = validateTicketForm(values);
  const isValid = Object.keys(clientErrors).length === 0;
  const shownErrors: TicketFormErrors = { ...serverErrors };
  (Object.keys(clientErrors) as (keyof TicketFormValues)[]).forEach((field) => {
    if (touched[field] || attempted) {
      shownErrors[field] = clientErrors[field];
    }
  });

  const handleChange = (field: keyof TicketFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setServerErrors((prev) => {
      if (prev[field] === undefined) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleBlurField = (field: keyof TicketFormValues) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const submit = async () => {
    setAttempted(true);
    setApiError(null);
    if (Object.keys(validateTicketForm(values)).length > 0) return;
    if (submittingRef.current) return; // duplicate-submit guard
    submittingRef.current = true;
    setSubmitting(true);
    setServerErrors({});
    try {
      const ticket = await createTicket(toCreatePayload(values));
      navigate(`/tickets/${encodeURIComponent(ticket.ticket_id)}`);
    } catch (err: unknown) {
      submittingRef.current = false;
      setSubmitting(false);
      if (err instanceof ApiError && err.status === 422) {
        const { fieldErrors, formError } = mapDetailToFieldErrors(err.detail);
        if (Object.keys(fieldErrors).length > 0 || formError !== null) {
          setServerErrors(fieldErrors);
          setApiError(formError);
          return;
        }
      }
      setApiError(
        err instanceof ApiError ? err.message : "Something went wrong.",
      );
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  return (
    <section aria-labelledby="new-ticket-heading" className="mx-auto max-w-3xl">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
      >
        &larr; Back to all tickets
      </Link>
      <h1
        id="new-ticket-heading"
        className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]"
      >
        New ticket
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Fill in the customer and issue details below.
      </p>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <TicketForm
          values={values}
          errors={shownErrors}
          isValid={isValid}
          submitting={submitting}
          submitLabel="Create ticket"
          onChange={handleChange}
          onBlurField={handleBlurField}
          onSubmit={handleSubmit}
        />
        <div className="mt-4 border-t border-slate-100 pt-4">
          <Link
            to="/"
            className="inline-block rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Cancel
          </Link>
        </div>
      </div>

      {apiError !== null && (
        <div className="mt-4">
          <ErrorBanner message={apiError} onRetry={() => void submit()} />
        </div>
      )}
    </section>
  );
}
