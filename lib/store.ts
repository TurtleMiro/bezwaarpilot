"use client";

import { Case } from "./types";
import { sampleCases } from "./sampleData";

const STORAGE_KEY = "bezwaarpilot_cases";

export function loadCases(): Case[] {
  if (typeof window === "undefined") return sampleCases;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveCases(sampleCases);
      return sampleCases;
    }
    return JSON.parse(raw) as Case[];
  } catch {
    return sampleCases;
  }
}

export function saveCases(cases: Case[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
}

export function getCaseById(id: string): Case | undefined {
  return loadCases().find((c) => c.id === id);
}

export function updateCase(updated: Case): void {
  const cases = loadCases();
  const idx = cases.findIndex((c) => c.id === updated.id);
  if (idx !== -1) {
    cases[idx] = updated;
    saveCases(cases);
  }
}

export function addCase(newCase: Case): void {
  const cases = loadCases();
  cases.unshift(newCase);
  saveCases(cases);
}

export function generateId(): string {
  return "case-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
