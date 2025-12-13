import { Bird } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpatzIconProps {
  size?: number;
  className?: string;
}

export function SpatzIcon({ size = 32, className = "" }: SpatzIconProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-primary text-primary-foreground",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Bird size={size * 0.6} />
    </div>
  );
}
