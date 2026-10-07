import { toast } from "sonner";
import type { ReactNode } from "react";

type ToastKind = "info" | "success" | "warn" | "error";

const kindDot: Record<ToastKind, string> = {
  info: "bg-text-dim",
  success: "bg-accent-gold",
  warn: "bg-accent-gold",
  error: "bg-danger",
};

function Badge({
  kind = "info",
  label,
  description,
  action,
  onDismiss,
}: {
  kind?: ToastKind;
  label: ReactNode;
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  onDismiss: () => void;
}) {
  return (
    <div className="card-soft edge-soft flex items-center gap-3 border border-border px-4 py-2.5 min-w-[280px] max-w-[420px]">
      <span className={`h-1.5 w-1.5 rounded-full ${kindDot[kind]}`} aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="micro-caps text-text-secondary truncate">{label}</div>
        {description ? (
          <div className="mt-0.5 text-[11px] text-text-dim truncate">{description}</div>
        ) : null}
      </div>
      {action ? (
        <button
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
          className="micro-caps shrink-0 rounded-md border border-accent-gold-dim px-3 py-1 text-accent-gold transition-colors hover:bg-accent-gold-dim/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
        >
          {action.label}
        </button>
      ) : null}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-text-dim transition-colors hover:text-foreground"
      >
        ×
      </button>
    </div>
  );
}

type Options = {
  description?: ReactNode;
  duration?: number;
  action?: { label: string; onClick: () => void };
};

function emit(kind: ToastKind, label: ReactNode, opts: Options = {}) {
  return toast.custom(
    (id) => (
      <Badge
        kind={kind}
        label={label}
        description={opts.description}
        action={opts.action}
        onDismiss={() => toast.dismiss(id)}
      />
    ),
    { duration: opts.duration ?? 3200, unstyled: true }
  );
}


export const notify = {
  info: (label: ReactNode, opts?: Options) => emit("info", label, opts),
  success: (label: ReactNode, opts?: Options) => emit("success", label, opts),
  warn: (label: ReactNode, opts?: Options) => emit("warn", label, opts),
  error: (label: ReactNode, opts?: Options) => emit("error", label, opts),
  undoable: (
    label: ReactNode,
    onUndo: () => void,
    opts: Options & { actionLabel?: string } = {}
  ) =>
    toast.custom(
      (id) => (
        <Badge
          kind="info"
          label={label}
          description={opts.description}
          action={{ label: opts.actionLabel ?? "Undo", onClick: onUndo }}
          onDismiss={() => toast.dismiss(id)}
        />
      ),
      { duration: opts.duration ?? 5000, unstyled: true }
    ),
  dismiss: (id?: string | number) => toast.dismiss(id),
};
