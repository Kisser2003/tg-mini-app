import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-[56px] w-full rounded-[16px] border-none bg-[#1d1d20] px-[18px] py-[14px] text-[16px] text-white shadow-sm transition placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#007AFF]/50 focus-visible:bg-[#242428]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

