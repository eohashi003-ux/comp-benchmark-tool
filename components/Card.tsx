import { ui } from "@/lib/designSystem";

export default function Card({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${ui.card} ${ui.radius} p-5 shadow-sm hover:shadow-md transition-shadow`}
    >
      {children}
    </div>
  );
}