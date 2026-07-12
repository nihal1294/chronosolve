import type { Database } from "lucide-react";

/** Full-height empty/placeholder state with an icon, title, body, and action. */
export function CenteredState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: typeof Database;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative z-10 flex h-full items-center justify-center p-8" data-tour="timetable">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
          <Icon size={28} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{body}</p>
        <div className="mt-6 flex justify-center">{children}</div>
      </div>
    </div>
  );
}
