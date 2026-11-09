import { useRef, useState, type FormEvent } from "react";
import { publicCopy } from "./presentation.ts";

type Attempt = { idempotencyKey: string; serializedBody: string };

export function LeadForm() {
  const { VITE_LEAD_INTAKE_ENABLED, VITE_LEAD_CONSENT_POLICY_VERSION, VITE_LEAD_CONSENT_COPY, VITE_API_URL } = import.meta.env;
  const consentPolicyVersion = VITE_LEAD_CONSENT_POLICY_VERSION?.trim();
  const configured = VITE_LEAD_INTAKE_ENABLED === "true"
    && Boolean(consentPolicyVersion)
    && Boolean(VITE_LEAD_CONSENT_COPY?.trim())
    && Boolean(VITE_API_URL?.trim());
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const attempt = useRef<Attempt | undefined>(undefined);

  if (!configured) {
    return <p>{publicCopy("Discovery booking and inquiries are not open.", "Discovery booking and inquiries are not open in this preview.")}</p>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      company: String(data.get("company") ?? ""),
      message: String(data.get("message") ?? ""),
      consent: data.get("consent") === "on",
      consentPolicyVersion,
      website: String(data.get("website") ?? ""),
    };
    const serializedBody = JSON.stringify(body);
    const requestAttempt = attempt.current?.serializedBody === serializedBody
      ? attempt.current
      : { idempotencyKey: crypto.randomUUID(), serializedBody };
    attempt.current = requestAttempt;
    setSending(true);
    setStatus("");
    try {
      const response = await fetch(new URL("/leads", VITE_API_URL), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": requestAttempt.idempotencyKey,
        },
        body: serializedBody,
      });
      if (!response.ok) {
        setStatus(response.status === 503
          ? "Inquiry submissions are temporarily unavailable."
          : "We could not submit your inquiry. Please review it and try again.");
        return;
      }
      setStatus("Thank you. Your inquiry was received.");
      attempt.current = undefined;
      form.reset();
    } catch {
      setStatus("We could not reach the inquiry service. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="lead-form" onSubmit={submit}>
      <label>Name <input name="name" autoComplete="name" maxLength={100} required /></label>
      <label>Email <input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label>Company (optional) <input name="company" autoComplete="organization" maxLength={120} /></label>
      <label>How can we help? <textarea name="message" minLength={10} maxLength={3000} rows={6} required /></label>
      <label className="honeypot" aria-hidden="true">
        Leave this field blank <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="consent">
        <input name="consent" type="checkbox" required />
        <span>{VITE_LEAD_CONSENT_COPY}</span>
      </label>
      <button className="button" type="submit" disabled={sending}>
        {sending ? "Sending..." : "Send inquiry"}
      </button>
      <p role="status" aria-live="polite">{status}</p>
    </form>
  );
}
