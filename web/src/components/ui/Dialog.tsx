"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { XIcon } from "./icons";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  // a line under the title, like "Lines 3-4" or "Changes from v2"
  subtitle?: ReactNode;
  // extra controls in the header, before the close button
  actions?: ReactNode;
  variant: "drawer" | "modal";
  children: ReactNode;
};

const SHAPE = {
  drawer: "m-0 ml-auto h-dvh max-h-none w-[min(520px,100vw)] border-l",
  modal: "m-auto h-[min(85dvh,760px)] w-[min(1100px,calc(100vw-32px))] rounded-[14px] border",
};

// native <dialog>: focus stays inside, Esc closes it, and focus goes back to whatever opened it
export function Dialog({ open, onClose, title, subtitle, actions, variant, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `dialog-title-${variant}`;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // a click on the backdrop lands on the dialog element itself
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={`flex-col overflow-hidden border-line bg-surface-1 p-0 text-fg backdrop:bg-[#05070999] open:flex ${SHAPE[variant]}`}
    >
      <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-fg"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </dialog>
  );
}
