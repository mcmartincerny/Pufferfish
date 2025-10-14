import { useEffect, useRef, useState } from "react";
import { setShowToastFunction } from "../Globals";
import styled from "@emotion/styled";
import { AnimatePresence, motion } from "framer-motion";
import { theme } from "./Theme";

type Toast = {
  message: string;
  style?: "info" | "success" | "warning" | "error";
  button?: { label: string; onClick: () => void };
};

export type ShowToastFunction = (message: string, options?: Omit<Toast, "message"> & { duration?: number }) => void;

const DEFAULT_TOAST_DURATION = 3000;
const DEFAULT_TOAST_STYLE = "info";

type QueuedToast = Toast & {
  id: string;
  duration?: number;
};

export const ToastManager = () => {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const showToast: ShowToastFunction = (message, options) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const toast: QueuedToast = {
        id,
        message,
        button: options?.button,
        duration: options?.duration,
        style: options?.style ?? DEFAULT_TOAST_STYLE,
      };
      setToasts((prev) => [...prev, toast]);
      const timeoutId = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timersRef.current.delete(id);
      }, toast.duration ?? DEFAULT_TOAST_DURATION);
      timersRef.current.set(id, timeoutId);
    };
    setShowToastFunction(showToast);
  }, []);

  const closeToast = (id: string) => {
    const timeoutId = timersRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastsContainer>
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            layout
            initial={{ y: 40, opacity: 0, scale: 0.5 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", stiffness: 350, damping: 20, mass: 1, opacity: { duration: 0.2 } }}
            variant={toast.style ?? DEFAULT_TOAST_STYLE}
          >
            <ToastContent>
              <ToastMessage title={toast.message}>{toast.message}</ToastMessage>
              {toast.button && (
                <ActionButton
                  onClick={() => {
                    try {
                      toast.button?.onClick();
                    } finally {
                      closeToast(toast.id);
                    }
                  }}
                >
                  {toast.button.label}
                </ActionButton>
              )}
            </ToastContent>
            <CloseButton aria-label="Close toast" title="Close" onClick={() => closeToast(toast.id)}>
              ×
            </CloseButton>
          </ToastItem>
        ))}
      </AnimatePresence>
    </ToastsContainer>
  );
};

const ToastsContainer = styled.div`
  position: fixed;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none; /* Allow clicks to pass through gaps */
`;

const ToastItem = styled(motion.div)<{ variant: NonNullable<Toast["style"]> }>`
  position: relative;
  min-width: 260px;
  max-width: 480px;
  width: max-content;
  background-color: ${theme.colors.lessBlack};
  border: 2px solid
    ${({ variant }) =>
      variant === "success"
        ? theme.colors.green
        : variant === "warning"
        ? theme.colors.orange
        : variant === "error"
        ? theme.colors.danger
        : theme.colors.white};
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35),
    0 0 0 2px
      ${({ variant }) =>
        variant === "success"
          ? theme.colors.greenDark
          : variant === "warning"
          ? theme.colors.orangeDark
          : variant === "error"
          ? theme.colors.danger
          : theme.colors.white + "30"};
  color: ${theme.colors.ultraWhite};
  padding: 12px 44px 12px 12px; /* space for close button */
  pointer-events: auto; /* enable interaction on toast */
`;

const ToastContent = styled.div`
  display: flex;
  align-items: left;
  gap: 12px;
`;

const ToastMessage = styled.div`
  font-size: 14px;
  line-height: 1.3;
  max-width: 360px;
  white-space: pre-wrap;
`;

const ActionButton = styled.button`
  margin-left: auto;
  background-color: ${theme.colors.blueishBlack};
  color: ${theme.colors.ultraWhite};
  border: 1px solid ${theme.colors.grey};
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 13px;

  &:hover {
    border-color: ${theme.colors.orange};
    color: ${theme.colors.orange};
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 26px;
  height: 26px;
  border: 1px solid ${theme.colors.grey};
  border-radius: 6px;
  background-color: ${theme.colors.lessBlack};
  color: ${theme.colors.ultraWhite};
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0;
  transition: all 0.15s ease;

  &:hover {
    background-color: ${theme.colors.greyDark};
    border-color: ${theme.colors.orange};
    color: ${theme.colors.orange};
  }
`;
