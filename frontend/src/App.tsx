import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { Index } from "./pages/Index";
import { LiveRace } from "./pages/LiveRace";
import { NewNegotiation } from "./pages/NewNegotiation";
import { NotFound } from "./pages/NotFound";
import { Betting } from "./pages/Betting";
import { AllNegotiations } from "./pages/AllNegotiations";
import { AllVendors } from "./pages/AllVendors";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/all-negotiations" element={<AllNegotiations />} />
          <Route path="/all-vendors" element={<AllVendors />} />
          <Route path="/negotiation/:id" element={<LiveRace />} />
          <Route path="/negotiation/:id/betting" element={<Betting />} />
          <Route path="/betting" element={<Betting />} />
          <Route path="/new" element={<NewNegotiation />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

export default App;
