"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Case } from "./types";
import { loadCases, saveCases } from "./store";

interface CasesContextValue {
  cases: Case[];
  updateCase: (updated: Case) => void;
  addCase: (newCase: Case) => void;
  deleteCase: (id: string) => void;
  refresh: () => void;
}

const CasesContext = createContext<CasesContextValue | null>(null);

export function CasesProvider({ children }: { children: React.ReactNode }) {
  const [cases, setCases] = useState<Case[]>([]);

  const refresh = useCallback(() => {
    setCases(loadCases());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateCase = useCallback((updated: Case) => {
    setCases((prev) => {
      const next = prev.map((c) => (c.id === updated.id ? updated : c));
      saveCases(next);
      return next;
    });
  }, []);

  const addCase = useCallback((newCase: Case) => {
    setCases((prev) => {
      const next = [newCase, ...prev];
      saveCases(next);
      return next;
    });
  }, []);

  const deleteCase = useCallback((id: string) => {
    setCases((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveCases(next);
      return next;
    });
  }, []);

  return (
    <CasesContext.Provider value={{ cases, updateCase, addCase, deleteCase, refresh }}>
      {children}
    </CasesContext.Provider>
  );
}

export function useCases() {
  const ctx = useContext(CasesContext);
  if (!ctx) throw new Error("useCases must be used within CasesProvider");
  return ctx;
}
