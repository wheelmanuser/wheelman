import type { HTMLAttributes, ReactNode } from "react";

export function Badge({
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { children?: ReactNode }) {
  return <span {...props}>{children}</span>;
}
