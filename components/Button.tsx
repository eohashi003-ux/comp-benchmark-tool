import { ButtonHTMLAttributes } from "react";

export default function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement>
) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50 " +
        (props.className ?? "")
      }
    />
  );
}