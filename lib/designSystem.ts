export const ui = {
  // Page background (gradient + fallback-safe structure)
  background: "bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900",

  // Page base (use sparingly now — background is preferred)
  page: "bg-slate-50 dark:bg-slate-950",

  // Card system (this is your biggest visual lever)
  card: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800",

  cardHover: "hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",

  // Text hierarchy (this is what makes UI feel “designed”)
  heading: "text-slate-900 dark:text-white font-semibold",
  subtext: "text-slate-600 dark:text-slate-300",
  mutedText: "text-slate-500 dark:text-slate-400",

  // Shape system
  radius: "rounded-xl",

  // Spacing helpers (missing in your current system)
  pagePadding: "px-4 sm:px-6 lg:px-8 py-6",
  cardPadding: "p-4 sm:p-6",
  sectionGap: "space-y-4",
};