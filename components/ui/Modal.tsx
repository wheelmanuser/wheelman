import type { HTMLAttributes, ReactNode } from "react";

export function Modal({
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return <div role="dialog" {...props}>{children}</div>;
}
