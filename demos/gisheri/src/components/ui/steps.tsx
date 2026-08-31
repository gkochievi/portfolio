import { Check } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface StepsItem {
  title?: React.ReactNode;
  description?: React.ReactNode;
}

export interface StepsProps extends React.HTMLAttributes<HTMLOListElement> {
  current: number;
  items: StepsItem[];
}

const Steps = React.forwardRef<HTMLOListElement, StepsProps>(
  ({ className, current, items, ...props }, ref) => {
    return (
      <ol
        ref={ref}
        className={cn("flex w-full items-start", className)}
        {...props}
      >
        {items.map((item, index) => {
          const isCompleted = index < current;
          const isActive = index === current;
          const isLast = index === items.length - 1;

          return (
            <li
              key={index}
              className={cn(
                "flex items-start",
                !isLast && "flex-1",
              )}
            >
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                    isCompleted &&
                      "border-gold bg-gold text-primary-foreground",
                    isActive &&
                      "border-gold bg-gold/10 text-gold",
                    !isCompleted &&
                      !isActive &&
                      "border-border bg-background text-muted-foreground",
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                {item.title && (
                  <span
                    className={cn(
                      "mt-1.5 text-center text-xs",
                      isActive
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {item.title}
                  </span>
                )}
                {item.description && (
                  <span className="mt-0.5 text-center text-[10px] text-muted-foreground">
                    {item.description}
                  </span>
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mt-4 h-px flex-1 transition-colors",
                    isCompleted ? "bg-gold" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    );
  },
);
Steps.displayName = "Steps";

export { Steps };
