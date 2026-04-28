import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return <div {...props}>{children}</div>;
}
