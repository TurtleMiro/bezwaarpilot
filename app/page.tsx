"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CasesProvider, useCases } from "@/lib/CasesContext";
import { FaseFilter } from "@/lib/types";
import { formatDate, isOverdue, isDueSoon } from "@/lib/dateUtils";

const FASE_OPTIONS: FaseFilter[] = [
  "Alle",
  "Intake",
  "Informeel",
  "Zitting",
  "Hoorzitting",
  "Advies",
  "Afronding",
];

function DashboardContent() {
  const { cases } = useCases();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [faseFilter, setFaseFilter] = useState<FaseFilter>("Alle");

  const filtered = cases.filter((c) => {
    const matchSearch =
      search === "" ||
      c.zaaknummer.toLowerCase().includes(search.toLowerCase()) ||
      c.bezwaarmaker.toLowerCase().includes(search.toLowerCase());
    const matchFase = faseFilter === "Alle" || c.fase === faseFilter;
    return matchSearch && matchFase;
  });

  function getActiedatumClass(dateStr: string) {
    if (isOverdue(dateStr)) return "text-red-600 font-semibold";
    if (isDueSoon(dateStr, 7)) return "text-amber-600 font-medium";
    return "text-gray-700";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Bezwaarzaken</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cases.length} zaken in totaal</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => router.push("/nieuw")}
        >
          <svg className="w-4 h-4 mr-1.5" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Nieuwe zaak
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Zoek op zaaknummer of bezwaarmaker..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <select
          value={faseFilter}
          onChange={(e) => setFaseFilter(e.target.value as FaseFilter)}
          className="input w-auto min-w-[160px]"
        >
          {FASE_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f === "Alle" ? "Alle fases" : f}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Zaaknummer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Bezwaarmaker</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Fase</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Beslistermijn</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Volgende actie</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Actiedatum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                    Geen zaken gevonden
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/zaak/${c.id}`)}
                  >
                    <td className="px-4 py-3.5 font-medium text-blue-600 hover:text-blue-800">
                      {c.zaaknummer}
                    </td>
                    <td className="px-4 py-3.5 text-gray-900">{c.bezwaarmaker}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-gray-800">{c.status}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <FaseBadge fase={c.fase} />
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 font-mono text-xs">
                      {formatDate(c.beslistermijnNaVerdaging || c.beslistermijn12Weken)}
                    </td>
                    <td className="px-4 py-3.5 text-gray-700 max-w-[200px] truncate">
                      {c.volgendeActie}
                    </td>
                    <td className={`px-4 py-3.5 font-mono text-xs ${getActiedatumClass(c.actiedatum)}`}>
                      {formatDate(c.actiedatum)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 text-right">
          {filtered.length} van {cases.length} zaken weergegeven
        </p>
      )}
    </div>
  );
}

function FaseBadge({ fase }: { fase: string }) {
  const colors: Record<string, string> = {
    Intake: "bg-slate-100 text-slate-700",
    Informeel: "bg-blue-50 text-blue-700",
    Zitting: "bg-violet-50 text-violet-700",
    Hoorzitting: "bg-purple-50 text-purple-700",
    Advies: "bg-amber-50 text-amber-700",
    Afronding: "bg-green-50 text-green-700",
  };
  const cls = colors[fase] ?? "bg-gray-100 text-gray-700";
  return <span className={`badge ${cls}`}>{fase}</span>;
}

export default function DashboardPage() {
  return (
    <CasesProvider>
      <DashboardContent />
    </CasesProvider>
  );
}
