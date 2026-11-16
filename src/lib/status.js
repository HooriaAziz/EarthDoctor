import { CheckCircle2, CircleDashed, Loader2, MinusCircle, XCircle } from "lucide-react";

// Status vocabulary shared by badges and source chips. Each status has a
// text label and an icon, so state is never conveyed by colour alone.
const STATUS_META = {
  connected: { label: "Connected", tone: "ok", Icon: CheckCircle2 },
  loaded: { label: "Current", tone: "ok", Icon: CheckCircle2 },
  partial: { label: "Partial", tone: "warn", Icon: MinusCircle },
  loading: { label: "Loading", tone: "info", Icon: Loader2 },
  unavailable: { label: "Unavailable", tone: "bad", Icon: XCircle },
  error: { label: "Unavailable", tone: "bad", Icon: XCircle },
  "not-covered": { label: "Not covered", tone: "muted", Icon: MinusCircle },
  idle: { label: "Idle", tone: "muted", Icon: CircleDashed },
};

export function statusMeta(status) {
  return STATUS_META[status] || STATUS_META.idle;
}

