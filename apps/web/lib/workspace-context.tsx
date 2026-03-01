"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const STORAGE_KEY = "deeppling.workspace.orgId";

interface WorkspaceContextValue {
  orgId: string;
  setOrgId: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [orgId, setOrgIdState] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setOrgIdState(stored);
    } catch {
      // no-op in restricted environments
    }
  }, []);

  const setOrgId = (id: string) => {
    setOrgIdState(id);
    try {
      if (id) {
        window.localStorage.setItem(STORAGE_KEY, id);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // no-op
    }
  };

  return (
    <WorkspaceContext.Provider value={{ orgId, setOrgId }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
