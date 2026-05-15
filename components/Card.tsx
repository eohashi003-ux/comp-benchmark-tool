import { colors, radius } from "@/lib/designSystem";

export default function Card({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${colors.card} ${radius.card} border border-gray-200 p-4 shadow-sm`}
    >
      {children}
    </div>
  );
}