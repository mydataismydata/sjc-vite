// Shared UI primitives: modal, toasts, badges, empty states, confirm dialog.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// --- toasts ----------------------------------------------------------------

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const push = useCallback((message, kind = 'ok') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'bad' ? 'bad' : ''}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// --- modal -----------------------------------------------------------------

export function Modal({ title, onClose, children, footer, size }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''} ${size === 'xl' ? 'modal-xl' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose, busy }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ marginTop: 0 }}>{message}</p>
    </Modal>
  );
}

// --- small bits ------------------------------------------------------------

export function Spinner() {
  return <div className="spin" />;
}

export function Badge({ tone = 'gray', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function ResponseBadge({ response }) {
  if (response === 'yes') return <Badge tone="green">Accepted</Badge>;
  if (response === 'no') return <Badge tone="red">Declined</Badge>;
  return <Badge tone="gray">No reply</Badge>;
}

export function StatusBadge({ status }) {
  if (status === 'published') return <Badge tone="green">Published</Badge>;
  if (status === 'draft') return <Badge tone="amber">Draft</Badge>;
  if (status === 'cancelled') return <Badge tone="red">Cancelled</Badge>;
  return <Badge>{status}</Badge>;
}

export function EmailStatusBadge({ status }) {
  const map = {
    not_sent: ['gray', 'Not sent'],
    queued: ['indigo', 'Queued'],
    sending: ['indigo', 'Sending'],
    sent: ['green', 'Sent'],
    simulated: ['green', 'Simulated'],
    failed: ['red', 'Failed'],
  };
  const [tone, label] = map[status] || ['gray', status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function Empty({ icon = '📭', title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-ico">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label ? <label>{label}</label> : null}
      {children}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function CopyBox({ value }) {
  const toast = useToast();
  return (
    <div className="copy-box">
      <span className="url" title={value}>{value}</span>
      <button
        className="btn btn-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast('Copied to clipboard');
          } catch {
            toast('Could not copy — select the text manually', 'bad');
          }
        }}
      >
        Copy
      </button>
    </div>
  );
}

// Insert text at the caret of a textarea/input controlled by React.
export function insertAtCursor(ref, current, snippet, onChange) {
  const el = ref.current;
  if (!el) { onChange(current + snippet); return; }
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const next = current.slice(0, start) + snippet + current.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + snippet.length;
    el.setSelectionRange(pos, pos);
  });
}
