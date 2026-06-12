import { motion, type Variants } from "motion/react";

export type BrandLogoVariant = "primary" | "monochrome" | "wireframe" | "app-icon";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  size?: number | string;
  animated?: boolean;
  className?: string;
  theme?: "dark" | "light";
}

/** Brand mark from the Figma design system: three Gantt time blocks with a
    continuous routing path - the solver finding the optimal way through. */
export function BrandLogo({
  variant = "primary",
  size = 256,
  animated = true,
  className = "",
  theme = "dark",
}: BrandLogoProps) {
  const isWire = variant === "wireframe";
  const isMono = variant === "monochrome";
  const isAppIcon = variant === "app-icon";

  const colorIndigo = "#4338CA"; // Deep Indigo
  const colorTeal = "#0F766E"; // Sophisticated Teal
  const colorAmber = "#D97706"; // Warm Amber

  const monoFg = theme === "dark" ? "#ffffff" : "#0f172a";
  const monoBg = theme === "dark" ? "#0f172a" : "#ffffff";
  const wireColor = theme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(15,23,42,0.6)";
  const iconBgColor = "#0F172A";

  const blockProps = (color: string) => {
    if (isWire) return { fill: "none", stroke: wireColor, strokeWidth: 2 };
    if (isMono) return { fill: monoFg };
    return { fill: color };
  };

  const pathProps = {
    // In monochrome, the path cuts out of the blocks (stencil effect)
    stroke: isWire ? wireColor : isMono ? monoBg : "#ffffff",
    strokeWidth: 6,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeDasharray: isWire ? "6 4" : "none",
  };

  const blockVariant: Variants = {
    hidden: (direction: number) => ({ opacity: 0, x: direction * 15 }),
    visible: (custom: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: custom * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    }),
  };

  const pathVariant: Variants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: { delay: 0.6, duration: 1.2, ease: "easeInOut" },
    },
  };

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      initial={animated ? "hidden" : "visible"}
      animate="visible"
    >
      {isAppIcon && (
        <motion.rect
          x="0"
          y="0"
          width="100"
          height="100"
          rx="0"
          fill={iconBgColor}
          initial={animated ? { opacity: 0, scale: 0.95 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      )}

      {/* Gantt / timetable blocks with a balanced safe-area margin */}
      <g>
        <motion.rect
          x="12"
          y="16"
          width="40"
          height="18"
          rx="4"
          {...blockProps(colorIndigo)}
          custom={-1}
          variants={blockVariant}
        />
        <motion.rect
          x="28"
          y="41"
          width="44"
          height="18"
          rx="4"
          {...blockProps(colorTeal)}
          custom={1}
          variants={blockVariant}
        />
        <motion.rect
          x="48"
          y="66"
          width="40"
          height="18"
          rx="4"
          {...blockProps(colorAmber)}
          custom={-1}
          variants={blockVariant}
        />

        {/* The optimization path, jumping the gaps between blocks */}
        <motion.path
          d="M 20 25 H 34 A 8 8 0 0 1 42 33 V 42 A 8 8 0 0 0 50 50 H 52 A 8 8 0 0 1 60 58 V 67 A 8 8 0 0 0 68 75 H 80"
          {...pathProps}
          variants={pathVariant}
        />
      </g>
    </motion.svg>
  );
}
