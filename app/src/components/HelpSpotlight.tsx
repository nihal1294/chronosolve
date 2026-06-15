import { useEffect, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

interface HelpSpotlightProps {
  title: string;
  content: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

const POS: Record<NonNullable<HelpSpotlightProps["position"]>, string> = {
  top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
  bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
  left: "right-full mr-2 top-1/2 -translate-y-1/2",
  right: "left-full ml-2 top-1/2 -translate-y-1/2",
};

/** Ambient help: while Help Mode is on (body.help-mode-active, toggled by the
    WindowChrome Help button / Cmd+/), any wrapped element grows a pulsing dot
    and a hover tooltip. Reads the body class via a MutationObserver so it needs
    no React context - drop <HelpSpotlight> anywhere and it lights up in sync. */
export function HelpSpotlight({ title, content, children, position = "bottom" }: HelpSpotlightProps) {
  const [helpMode, setHelpMode] = useState(false);

  useEffect(() => {
    const sync = () => setHelpMode(document.body.classList.contains("help-mode-active"));
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    sync();
    return () => observer.disconnect();
  }, []);

  if (!helpMode) return <>{children}</>;

  return (
    <div className="relative inline-block group">
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] z-50 animate-pulse pointer-events-none" />
      <div className="ring-2 ring-indigo-500/50 rounded-md transition-all z-40 relative group-hover:ring-indigo-500">
        {children}
      </div>
      <div
        className={`absolute ${POS[position]} w-64 bg-indigo-600 text-white p-3 rounded-lg shadow-2xl z-[60] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none`}
      >
        <div className="flex items-start gap-2">
          <Info size={16} className="shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold leading-none mb-1">{title}</h4>
            <p className="text-xs text-indigo-100 leading-tight">{content}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
