"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type NavLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "className"> & {
  className?: string;
  activeClassName?: string;
};

/** Lovable-compatible nav link using Next.js routing. */
export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, activeClassName, href, ...props }, ref) => {
    const pathname = usePathname();
    const path = typeof href === "string" ? href : href.pathname ?? "";
    const active =
      path === "/"
        ? pathname === "/" || pathname === "/library"
        : pathname === path || pathname.startsWith(`${path}/`);

    return (
      <Link
        ref={ref}
        href={href}
        className={cn(className, active ? activeClassName : undefined)}
        {...props}
      />
    );
  }
);

NavLink.displayName = "NavLink";
