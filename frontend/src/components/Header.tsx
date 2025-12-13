import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { SpatzIcon } from "./SpatzIcon";
import { Button } from "./ui/button";

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
            askLio <span className="text-primary">Autonomy</span>
          </span>
        </Link>
        <Button onClick={onNewNegotiation} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Start New Negotiation</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>
    </header>
  );
}
