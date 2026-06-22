import type { ReactNode } from "react";
import { useTheme } from "next-themes";
import { Bell, Clock, Info, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import {
  clampTimeLimit,
  DEFAULT_PREFERENCES,
  MAX_TIME_LIMIT,
  MIN_TIME_LIMIT,
  usePreferences,
} from "../lib/use-preferences";

const CARD =
  "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm";
// release-please keeps this in sync with the app version on each release.
const APP_VERSION = "0.3.0"; // x-release-please-version

const THEMES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/** App settings: theme (delegated to next-themes), the solver time limit and
    completion toast (persisted via usePreferences), and an About card. Every
    control writes through immediately - there is no explicit Save. */
export function SettingsRoute() {
  const { theme, setTheme } = useTheme();
  const { prefs, setPref } = usePreferences();

  return (
    <div className="relative z-10 h-full overflow-y-auto p-8 md:p-10" data-tour="settings">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Settings
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Tune how the scheduler runs and how ChronoSolve looks. Changes save instantly.
          </p>
        </header>

        <Section
          title="Appearance"
          description="Pick a theme or follow your system."
          dataTour="settings-appearance"
        >
          <div className="flex gap-2">
            {THEMES.map((option) => (
              <ThemeButton
                key={option.value}
                option={option}
                active={(theme ?? "system") === option.value}
                onSelect={() => setTheme(option.value)}
              />
            ))}
          </div>
        </Section>

        <Section
          title="Scheduler"
          description="How long the solver searches before returning its best timetable."
          dataTour="settings-scheduler"
        >
          <SettingRow icon={Clock} label="Max execution time">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={MIN_TIME_LIMIT}
                max={MAX_TIME_LIMIT}
                value={prefs.timeLimit}
                onChange={(event) => setPref("timeLimit", clampSeconds(event.target.value))}
                className="w-20 rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-right text-sm tabular-nums focus:border-indigo-500 focus:outline-none dark:border-neutral-700"
              />
              <span className="text-sm text-neutral-500 dark:text-neutral-400">seconds</span>
            </div>
          </SettingRow>
        </Section>

        <Section title="Notifications" description="Show a toast when a solve finishes.">
          <SettingRow icon={Bell} label="Notify on solve complete">
            <Toggle
              on={prefs.notifyOnComplete}
              onToggle={() => setPref("notifyOnComplete", !prefs.notifyOnComplete)}
            />
          </SettingRow>
        </Section>

        <AboutCard />
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
  dataTour,
}: {
  title: string;
  description: string;
  children: ReactNode;
  dataTour?: string;
}) {
  return (
    <section className={`p-6 ${CARD}`} data-tour={dataTour}>
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type ThemeOption = (typeof THEMES)[number];

function ThemeButton({
  option,
  active,
  onSelect,
}: {
  option: ThemeOption;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;
  return (
    <button
      onClick={onSelect}
      className={`flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors ${
        active
          ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800/50"
      }`}
    >
      <Icon size={20} />
      {option.label}
    </button>
  );
}

function SettingRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
        <Icon size={16} className="text-indigo-500" />
        {label}
      </span>
      {children}
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? "bg-indigo-600" : "bg-neutral-300 dark:bg-neutral-700"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function AboutCard() {
  // App identity only. The guided tour and help hints live in the Help menu
  // (top bar + native Help), so About no longer carries a replay button.
  return (
    <section className={`flex items-start gap-3 p-6 ${CARD}`}>
      <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-500">
        <Info size={18} />
      </div>
      <div className="text-sm">
        <div className="font-semibold text-neutral-900 dark:text-neutral-100">ChronoSolve</div>
        <div className="text-neutral-500 dark:text-neutral-400">Version {APP_VERSION}</div>
        <p className="mt-2 max-w-prose text-neutral-500 dark:text-neutral-400">
          Conflict-free university timetabling powered by constraint solving.
        </p>
      </div>
    </section>
  );
}

/** Keep the persisted limit a whole number of seconds within the supported
    range; a non-numeric field falls back to the default rather than persisting NaN. */
function clampSeconds(raw: string): number {
  const seconds = Math.round(Number(raw));
  if (!Number.isFinite(seconds)) return DEFAULT_PREFERENCES.timeLimit;
  return clampTimeLimit(seconds);
}
