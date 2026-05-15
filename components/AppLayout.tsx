import { ui } from "@/lib/designSystem";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${ui.background} min-h-screen`}>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </div>
    </div>
  );
}