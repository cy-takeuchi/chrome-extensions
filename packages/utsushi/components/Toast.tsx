import { useEffect } from "react";

export type ToastState = { kind: "ok" | "error" | "info"; message: string; id: number };

export const Toast = ({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) => {
  useEffect(() => {
    if (!toast || toast.kind === "info") return;
    const t = setTimeout(onClose, toast.kind === "error" ? 10000 : 4000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: クリックで閉じられるようにしているだけで、放っておいても消える
    <div className={`toast toast-${toast.kind}`} role="status" onClick={onClose}>
      {toast.message}
    </div>
  );
};
