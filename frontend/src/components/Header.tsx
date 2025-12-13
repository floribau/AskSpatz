import { Link } from "react-router-dom";
import { SpatzIcon } from "./SpatzIcon";

interface HeaderProps {
  onNewNegotiation?: () => void;
}

export function Header({ onNewNegotiation }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-md supports-[backdrop-filter]:bg-gray-900/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-3">
          <SpatzIcon size={36} />
          <span className="text-xl font-semibold text-white">
            ask<span className="text-gray-400">Spatz</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
