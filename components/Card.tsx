import React from "react";
import { ui } from "@/lib/designSystem";

type CardProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
};

export default function Card({
  title,
  subtitle,
  children,
  className = "",
  hover = true,
}: CardProps) {
  return (
    <div
      className={[
        ui.card,
        ui.radius,
        hover ? ui.cardHover : "",
        "p-6",
        className,
      ].join(" ")}
    >
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h2 className={ui.heading}>{title}</h2>}
          {subtitle && <p className={ui.subtext}>{subtitle}</p>}
        </div>
      )}

      {children}
    </div>
  );
}