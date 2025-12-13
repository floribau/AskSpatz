import { Link } from "react-router-dom";
import { SpatzIcon } from "./SpatzIcon";

interface HeaderProps {
  onNewNegotiation?: () => void;
}

export function Header({ onNewNegotiation }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-3">
          <SpatzIcon size={36} />
          <span className="text-xl font-semibold text-foreground">
            ask<span className="text-primary">Spatz</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
