import { colors, spacing } from "@/lib/designSystem";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${colors.background} min-h-screen`}>
      <div className={`${spacing.page} max-w-6xl mx-auto`}>
        {children}
      </div>
    </div>
  );
}