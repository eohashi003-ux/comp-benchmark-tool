import { ui } from "@/lib/designSystem";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${ui.background} min-h-screen`}>
      <div className={`${ui.page} max-w-6xl mx-auto`}>
        {children}
      </div>
    </div>
  );
}