import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type NoticeColor = "orange" | "green" | "red" | "blue";

interface TopFixedNoticeProps {
  color: NoticeColor;
  message: ReactNode;
  textAction?: string;
  onAction?: () => void;
  className?: string;
}

const colorClasses: Record<NoticeColor, string> = {
  orange: "bg-orange-600",
  green: "bg-green-700",
  red: "bg-red-600",
  blue: "bg-blue-600",
};

export function TopFixedNotice({
  color,
  message,
  textAction,
  onAction,
  className,
}: TopFixedNoticeProps) {
  const [isVisible, setIsVisible] = useState(true);
  const noticeRef = useRef<HTMLDivElement>(null);

  // O #root é `flex items-center` (eixo horizontal), então um <div> espaçador
  // filho viraria um item de largura zero numa LINHA — não empurra nada.
  // A forma robusta de reservar a altura do banner fixo é dar padding-top no
  // <body> igual à altura REAL medida do banner. O ResizeObserver mantém
  // sincronizado (ex.: banner quebra em 2 linhas no mobile). O padding some ao
  // fechar (X) ou desmontar.
  useLayoutEffect(() => {
    const el = noticeRef.current;
    if (!el) return;

    const update = () => {
      const height = `${el.offsetHeight}px`;
      document.body.style.paddingTop = height;
      // Exposto como CSS var para elementos `position: fixed` (ex.: a sidebar),
      // que ignoram o padding do body e precisam descer manualmente.
      document.documentElement.style.setProperty("--top-notice-height", height);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);

    return () => {
      observer.disconnect();
      document.body.style.paddingTop = "";
      document.documentElement.style.removeProperty("--top-notice-height");
    };
  }, [isVisible]);

  if (!isVisible) return null;

  function handleClose() {
    setIsVisible(false);
  }

  return (
    <div
      ref={noticeRef}
      role="status"
      className={cn(
        "fixed flex left-0 right-0 top-0 z-50 px-2 py-1 shadow-sm text-white",
        colorClasses[color],
        className,
      )}
    >
      <div className="w-full flex items-center justify-center gap-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 text-sm">
            <span>{message}</span>
          </div>

          {onAction && (
            <button
              type="button"
              className="text-sm font-medium flex-2 items-center border border-white px-2 pb-0.5 rounded-sm cursor-pointer hover:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              onClick={onAction}
            >
              {textAction}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-md absolute right-0 p-1 opacity-70 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current/30"
          aria-label="Fechar aviso"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
