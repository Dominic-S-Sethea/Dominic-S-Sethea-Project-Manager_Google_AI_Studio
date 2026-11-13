import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./theme/ThemeProvider";
import { AppShell } from "./components/layout/AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ReviewQueue from "./pages/ReviewQueue";
import AutomationStudio from "./pages/AutomationStudio";
import Appearance from "./pages/Appearance";
import Users from "./pages/Users";
import GitCommits from "./pages/GitCommits";
import Canvas from "./pages/Canvas";
import CanvasList from "./pages/CanvasList";
import ImportExport from "./pages/ImportExport";
import Connectors from "./pages/Connectors";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } } });

function ProtectedWorkspace() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

function Root() {
  const { user } = useAuth();
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<ProtectedWorkspace />}>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/review" element={<ReviewQueue />} />
      <Route path="/automation" element={<AutomationStudio />} />
      <Route path="/appearance" element={<Appearance />} />
      <Route path="/users" element={<Users />} />
      <Route path="/git-commits" element={<GitCommits />} />
      <Route path="/import-export" element={<ImportExport />} />
      <Route path="/connectors" element={<Connectors />} />
      <Route path="/canvas" element={<Canvas />} />
      <Route path="/canvas/:id" element={<Canvas />} />
      <Route path="/canvases" element={<CanvasList />} />
      <Route path="/canvases/:projectId" element={<CanvasList />} />
    </Route>
    <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
  </Routes>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><ThemeProvider><Root /></ThemeProvider></AuthProvider></BrowserRouter></QueryClientProvider></React.StrictMode>);
