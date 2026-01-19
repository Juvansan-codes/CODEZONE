import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GameProvider } from "@/contexts/GameContext";
import { AuthProvider } from "@/contexts/AuthContext";

// Pages
import Gate from "./pages/Gate";
import Login from "./pages/Login";
import Registration from "./pages/Registration";
import OtpVerification from "./pages/OtpVerification";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Leaderboard from "./pages/Leaderboard";
import Analytics from "./pages/Analytics";
import Challenges from "./pages/Challenges";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GameProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Gate />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Registration />} />
              <Route path="/otp" element={<OtpVerification />} />
              <Route path="/lobby" element={<Lobby />} />
              <Route path="/game" element={<Game />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </GameProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
