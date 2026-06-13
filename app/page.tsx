"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CasesProvider, useCases } from "@/lib/CasesContext";
import { Case } from "@/lib/types";
import { formatDate, isOverdue, isDueSoon, todayISO, addWeeks } from "@/lib/dateUtils";

const FASE_TABS = [
  { key: "Intake", label: "Intake", bg: "bg-blue-500", text: "text-blue-600", ring: "ring-blue-200" },
  { key: "Informeel", label: "Informele afhandeling", bg: "bg-orange-500", text: "text-orange-600", ring: "ring-orange-200" },
  { key: "Hoorzitting", label: "Hoorzitting", bg: "bg-purple-500", text: "text-purple-600", ring: "ring-purple-200" },
  { key: "Advies", label: "Advies", bg: "bg-red-500", text: "text-red-600", ring: "ring-red-200" },
  { key: "Afronding", label: "Afronding", bg: "bg-green-600", text: "text-green-700", ring: "ring-green-200" },
];

const FASE_STEPS = ["Intake", "Informeel", "Hoorzitting", "Advies", "Afronding"];

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

function DashboardContent() {
  const { cases, updateCase } = useCases();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [faseFilter, setFaseFilter] = useState("Alle");
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedCase = selectedId ? (cases.find((c) => c.id === selectedId) ?? null) : null;

  const faseCounts = FASE_TABS.reduce<Record<string, number>>((acc, f) => {
    acc[f.key] = cases.filter((c) => c.fase === f.key).length;
    return acc;
  }, {});

  const filtered = cases.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      c.zaaknummer.toLowerCase().includes(q) ||
      c.bezwaarmaker.toLowerCase().includes(q);
    const matchFase = faseFilter === "Alle" || c.fase === faseFilter;
    let matchQuick = true;
    if (quickFilter === "actie") matchQuick = isOverdue(c.actiedatum);
    else if (quickFilter === "termijn") matchQuick = isDueSoon(c.actiedatum, 7) && !isOverdue(c.actiedatum);
    else if (quickFilter === "wachten") matchQuick = c.volgendeActie?.toLowerCase().includes("wacht") ?? false;
    else if (quickFilter === "afgerond") matchQuick = c.fase === "Afronding";
    return matchSearch && matchFase && matchQuick;
  });

  // Auto-select first case
  useEffect(() => {
    if (cases.length > 0 && !selectedId) setSelectedId(cases[0].id);
  }, [cases.length]);

  useEffect(() => {
    if (filtered.length > 0 && !filtered.find((c) => c.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [faseFilter, quickFilter, search]);

  const counts = {
    actie: cases.filter((c) => isOverdue(c.actiedatum)).length,
    termijn: cases.filter((c) => isDueSoon(c.actiedatum, 7) && !isOverdue(c.actiedatum)).length,
    wachten: cases.filter((c) => c.volgendeActie?.toLowerCase().includes("wacht") ?? false).length,
    afgerond: cases.filter((c) => c.fase === "Afronding").length,
  };

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* ── Top navigation ──────────────────────────────────────────── */}
      <header className="flex items-stretch border-b border-gray-200 bg-white z-20 flex-shrink-0 h-16">
        {/* Logo */}
        <div className="flex items-center px-4 gap-2.5 border-r border-gray-200 w-60 flex-shrink-0">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white">
              <path d="M2 3h12v2H2V3zm0 4h8v2H2V7zm0 4h10v2H2v-2z" fill="currentColor" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900 text-sm tracking-tight">BezwaarPilot</span>
        </div>

        {/* Phase tabs */}
        <div className="flex flex-1 overflow-x-auto">
          {FASE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setFaseFilter(tab.key); setQuickFilter(null); }}
              className={`flex items-center gap-2.5 px-5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                faseFilter === tab.key
                  ? `border-current ${tab.text}`
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className={`text-white text-xs font-bold px-2 py-0.5 rounded-full ${tab.bg}`}>
                {faseCounts[tab.key] ?? 0}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Avatar */}
        <div className="flex items-center px-4 gap-2 border-l border-gray-200">
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold select-none">
            JD
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left sidebar ─────────────────────────────────────────── */}
        <aside className="w-60 border-r border-gray-200 flex flex-col flex-shrink-0 bg-white">
          {/* Sidebar top */}
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-sm font-semibold text-gray-800">
                Alle zaken{" "}
                <span className="text-gray-400 font-normal text-xs">{cases.length}</span>
              </span>
              <button
                onClick={() => router.push("/nieuw")}
                title="Nieuwe zaak"
                className="p-1 rounded-md hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-500" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Zoek zaak..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs rounded-lg border border-gray-200 bg-gray-50 pl-7 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Quick filters */}
          <div className="px-2 py-1.5 border-b border-gray-100">
            {[
              { id: "actie", label: "Actie vereist", count: counts.actie, dot: "bg-red-500" },
              { id: "termijn", label: "Termijn < 7 dagen", count: counts.termijn, dot: "bg-amber-500" },
              { id: "wachten", label: "Wachten op reactie", count: counts.wachten, dot: "bg-blue-400" },
              { id: "afgerond", label: "Afgerond", count: counts.afgerond, dot: "bg-gray-400" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setQuickFilter(quickFilter === f.id ? null : f.id);
                  if (quickFilter !== f.id) setFaseFilter("Alle");
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                  quickFilter === f.id ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.dot}`} />
                  {f.label}
                </span>
                <span className={`font-semibold ${quickFilter === f.id ? "text-blue-600" : "text-gray-400"}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Case list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map((c) => {
              const days = daysUntil(c.actiedatum);
              const overdue = days !== null && days < 0;
              const soon = days !== null && days >= 0 && days <= 7;
              const active = selectedId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-3 py-3 border-b border-gray-100 transition-colors relative ${
                    active ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  {active && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500" />}
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold text-blue-600">{c.zaaknummer}</span>
                    <FaseBadge fase={c.fase} small />
                  </div>
                  <div className="text-xs font-medium text-gray-800 mb-0.5 truncate">{c.bezwaarmaker}</div>
                  <div className="text-xs text-gray-400 truncate mb-1.5">{c.volgendeActie}</div>
                  {days !== null && (
                    <div className={`flex items-center gap-1 text-xs font-medium ${
                      overdue ? "text-red-500" : soon ? "text-amber-500" : "text-gray-400"
                    }`}>
                      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M6 3.5V6l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                      {overdue ? `${Math.abs(days)} dagen te laat` : `Nog ${days} dagen`}
                    </div>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-10 text-center text-xs text-gray-400">Geen zaken gevonden</div>
            )}
            {(faseFilter !== "Alle" || quickFilter || search) && (
              <button
                onClick={() => { setFaseFilter("Alle"); setQuickFilter(null); setSearch(""); }}
                className="w-full py-2.5 text-xs text-blue-600 hover:bg-blue-50 border-t border-gray-100 transition-colors"
              >
                Bekijk alle zaken →
              </button>
            )}
          </div>
        </aside>

        {/* ── Main detail panel ────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {selectedCase ? (
            <CaseDetailPanel
              key={selectedCase.id}
              zaak={selectedCase}
              onUpdate={(updates) => updateCase({ ...selectedCase, ...updates })}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
              <svg className="w-14 h-14" viewBox="0 0 48 48" fill="none">
                <rect x="8" y="6" width="32" height="36" rx="3" stroke="currentColor" strokeWidth="2" />
                <path d="M16 18h16M16 26h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-sm text-gray-400">Selecteer een zaak</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Case detail panel ────────────────────────────────────────────────────────

function CaseDetailPanel({ zaak: initialZaak, onUpdate }: { zaak: Case; onUpdate: (u: Partial<Case>) => void }) {
  const { updateCase } = useCases();
  const [zaak, setZaak] = useState<Case>(initialZaak);
  const [saved, setSaved] = useState(false);
  const [showZaakgegevens, setShowZaakgegevens] = useState(false);

  useEffect(() => { setZaak(initialZaak); }, [initialZaak.id]);

  function applyWorkflow(updates: Partial<Case>) {
    const updated = { ...zaak, ...updates };
    setZaak(updated);
    updateCase(updated);
    onUpdate(updates);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleFieldChange(field: keyof Case, value: string) {
    const updated: Case = { ...zaak, [field]: value };
    if (field === "datumBesluit" && value) {
      const einde = addWeeks(value, 6);
      updated.einddatumBezwaartermijn = einde;
      const term12 = addWeeks(einde, 12);
      updated.beslistermijn12Weken = term12;
      if (updated.verdaagd === "Ja") updated.beslistermijnNaVerdaging = addWeeks(term12, 6);
    }
    if (field === "verdaagd") {
      if (value === "Ja" && updated.beslistermijn12Weken) {
        updated.beslistermijnNaVerdaging = addWeeks(updated.beslistermijn12Weken, 6);
      } else if (value === "Nee") {
        updated.beslistermijnNaVerdaging = "";
      }
    }
    setZaak(updated);
  }

  function handleSave() {
    updateCase(zaak);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const faseIndex = FASE_STEPS.indexOf(zaak.fase);
  const daysToActie = daysUntil(zaak.actiedatum);
  const daysToBeslistermijn = daysUntil(zaak.beslistermijnNaVerdaging || zaak.beslistermijn12Weken);
  const actieOverdue = daysToActie !== null && daysToActie < 0;
  const actieSoon = daysToActie !== null && daysToActie >= 0 && daysToActie <= 7;

  return (
    <div className="min-h-full">
      {/* Case header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-lg font-bold text-gray-900">{zaak.zaaknummer}</span>
            {zaak.status && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                {zaak.status}
              </span>
            )}
            {saved && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                ✓ Opgeslagen
              </span>
            )}
            <span className="text-sm text-gray-500">{zaak.bezwaarmaker}</span>
          </div>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors font-medium">
            Meer acties
            <span className="text-gray-400">···</span>
          </button>
        </div>

        {/* Phase progress */}
        <div className="flex items-center">
          {FASE_STEPS.map((fase, i) => {
            const done = i < faseIndex;
            const current = i === faseIndex;
            return (
              <div key={fase} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    done ? "bg-green-500 border-green-500" : current ? "bg-blue-600 border-blue-600" : "bg-white border-gray-200"
                  }`}>
                    {done ? (
                      <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                      </svg>
                    ) : (
                      <span className={`text-xs font-bold ${current ? "text-white" : "text-gray-400"}`}>{i + 1}</span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap ${
                    current ? "text-blue-600" : done ? "text-green-600" : "text-gray-400"
                  }`}>
                    {fase === "Informeel" ? "Informeel" : fase}
                  </span>
                </div>
                {i < FASE_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 mb-4 ${i < faseIndex ? "bg-green-400" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main content grid */}
      <div className="p-5 grid grid-cols-3 gap-4">
        {/* Left + center: fase info + actions (2 cols) */}
        <div className="col-span-2 space-y-4">

          {/* Huidige fase + timer */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 font-medium mb-2">Huidige fase</div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{zaak.fase}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{zaak.status || "—"}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-400 font-medium mb-2">Resterende tijd in deze fase</div>
              {daysToActie !== null ? (
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    actieOverdue ? "bg-red-100" : actieSoon ? "bg-amber-100" : "bg-blue-50"
                  }`}>
                    <svg className={`w-5 h-5 ${actieOverdue ? "text-red-500" : actieSoon ? "text-amber-500" : "text-blue-400"}`} viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <div className={`text-sm font-bold ${actieOverdue ? "text-red-600" : actieSoon ? "text-amber-600" : "text-gray-900"}`}>
                      {actieOverdue ? `${Math.abs(daysToActie)} dagen te laat` : `Nog ${daysToActie} dagen`}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">Actiedatum: {formatDate(zaak.actiedatum)}</div>
                  </div>
                </div>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </div>
          </div>

          {/* Beslistermijn + Actie vereist */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Beslistermijn</div>
              {daysToBeslistermijn !== null ? (
                <>
                  <div className="text-2xl font-bold text-gray-900 leading-tight">
                    Nog {daysToBeslistermijn} dagen
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Uiterste datum: {formatDate(zaak.beslistermijnNaVerdaging || zaak.beslistermijn12Weken)}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-400">Niet ingesteld</div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Actie vereist</div>
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-orange-500" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M7 1a6 6 0 100 12A6 6 0 007 1zm0 10a1 1 0 110-2 1 1 0 010 2zm.5-3.5h-1l-.25-4h1.5L7.5 7.5z" />
                  </svg>
                </div>
                <div className="text-sm font-semibold text-gray-900 leading-snug">{zaak.volgendeActie || "—"}</div>
              </div>
            </div>
          </div>

          {/* Volgende actie + available actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Volgende actie</div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-orange-500" viewBox="0 0 14 14" fill="currentColor">
                      <path d="M7 1a6 6 0 100 12A6 6 0 007 1zm0 10a1 1 0 110-2 1 1 0 010 2zm.5-3.5h-1l-.25-4h1.5L7.5 7.5z" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{zaak.volgendeActie || "—"}</span>
                </div>
              </div>
              {zaak.actiedatum && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                  <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 14 14" fill="none">
                    <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M5 1v2M9 1v2M2 5h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  {formatDate(zaak.actiedatum)}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3">
              <div className="text-xs text-gray-400 font-medium mb-2.5">Beschikbare acties</div>
              <WorkflowActions zaak={zaak} onUpdate={applyWorkflow} />
            </div>
          </div>

          {/* Zaakgegevens collapsible */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowZaakgegevens(!showZaakgegevens)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span>Zaakgegevens</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showZaakgegevens ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="none">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            {showZaakgegevens && (
              <div className="px-4 pb-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <EditableField label="Zaaknummer" value={zaak.zaaknummer} onChange={(v) => handleFieldChange("zaaknummer", v)} />
                  <EditableField label="Bezwaarmaker" value={zaak.bezwaarmaker} onChange={(v) => handleFieldChange("bezwaarmaker", v)} />
                  <EditableField label="Datum ontvangst" value={zaak.datumOntvangst} type="date" onChange={(v) => handleFieldChange("datumOntvangst", v)} />
                  <EditableField label="Datum besluit" value={zaak.datumBesluit} type="date" onChange={(v) => handleFieldChange("datumBesluit", v)} />
                  <EditableField label="Beslistermijn 12 weken" value={zaak.beslistermijn12Weken} type="date" onChange={(v) => handleFieldChange("beslistermijn12Weken", v)} />
                  <EditableField label="Actiedatum" value={zaak.actiedatum} type="date" onChange={(v) => handleFieldChange("actiedatum", v)} />
                  <EditableField label="Datum hoorzitting" value={zaak.datumHoorzitting} type="date" onChange={(v) => handleFieldChange("datumHoorzitting", v)} />
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Verdaagd</label>
                    <select
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={zaak.verdaagd}
                      onChange={(e) => handleFieldChange("verdaagd", e.target.value)}
                    >
                      <option value="Nee">Nee</option>
                      <option value="Ja">Ja</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-gray-400 mb-1">Aantekeningen</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px] resize-y"
                    value={zaak.aantekeningen}
                    onChange={(e) => handleFieldChange("aantekeningen", e.target.value)}
                    placeholder="Notities..."
                  />
                </div>
                <button className="mt-3 inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors" onClick={handleSave}>
                  Opslaan
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* AI Assistent */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M7 1a6 6 0 100 12A6 6 0 007 1zm0 10a1 1 0 110-2 1 1 0 010 2zm.5-3.5h-1l-.25-4h1.5L7.5 7.5z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-900">AI Assistent</span>
              </div>
              <button className="text-gray-300 hover:text-gray-400 text-lg leading-none">···</button>
            </div>
            <div className="mb-3">
              <div className="text-xs text-gray-400 font-medium mb-1.5">Huidige fase</div>
              <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-sm font-semibold text-orange-700">
                {zaak.fase}
              </div>
            </div>
            <div className="text-xs text-gray-400 font-medium mb-1.5">Actie vereist</div>
            <label className="flex items-start gap-2 cursor-pointer group">
              <input type="checkbox" className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" readOnly />
              <span className="text-xs text-gray-700 group-hover:text-gray-900 leading-relaxed">{zaak.volgendeActie || "—"}</span>
            </label>
          </div>

          {/* Snelle acties */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Snelle acties</div>
            <div className="space-y-0.5">
              {[
                "Reminder sturen naar vakafdeling",
                "Reactie toelichten",
                "Notitie toevoegen",
                "Document uploaden",
              ].map((label, i) => (
                <button
                  key={i}
                  className="w-full flex items-center justify-between text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-2 py-2 rounded-lg transition-colors text-left"
                >
                  <span>{label}</span>
                  <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Hulp */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 11a1 1 0 110-2 1 1 0 010 2zm.75-4h-1.5l-.25-3.5h2L8.75 8z" />
              </svg>
              <span className="text-xs font-semibold text-gray-700">Hulp nodig?</span>
            </div>
            <p className="text-xs text-gray-400 mb-2 leading-relaxed">
              Bekijk uitleg over deze stap en het proces.
            </p>
            <button className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
              Open uitleg →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Workflow actions ─────────────────────────────────────────────────────────

type ActionDef = {
  label: string;
  variant: "green" | "red" | "blue";
  updates: Partial<Case>;
};

function getActionsForFase(fase: string): ActionDef[] {
  switch (fase) {
    case "Intake":
      return [
        { label: "Ontvangstbevestiging verzonden", variant: "green", updates: { status: "Ontvangstbevestiging verzonden", fase: "Informeel", volgendeActie: "Beoordeel informele afhandeling" } },
        { label: "Herstelverzuimbrief verzonden", variant: "red", updates: { status: "🔴 In afwachting herstel", volgendeActie: "Controleer hersteltermijn" } },
        { label: "Herstel ontvangen", variant: "blue", updates: { status: "🟢 Herstel ontvangen", fase: "Informeel", volgendeActie: "Beoordeel informele afhandeling" } },
      ];
    case "Informeel":
      return [
        { label: "Informeel afgerond", variant: "green", updates: { status: "🟢 Informele afhandeling afgerond", volgendeActie: "Verzoek intrekking bezwaar versturen" } },
        { label: "Informeel niet geslaagd", variant: "red", updates: { status: "🔵 Zitting plannen", fase: "Zitting", volgendeActie: "Plan hoorzitting" } },
        { label: "Zitting plannen", variant: "blue", updates: { fase: "Hoorzitting", volgendeActie: "Hoorzitting plannen" } },
      ];
    case "Zitting":
    case "Hoorzitting":
      return [
        { label: "Zitting gepland", variant: "green", updates: { status: "🔵 Zitting gepland", volgendeActie: "Uitnodigingen versturen" } },
        { label: "Hoorzitting geweest", variant: "blue", updates: { status: "🟣 Advies uitwerken", fase: "Advies", volgendeActie: "Conceptadvies maken" } },
      ];
    case "Advies":
      return [
        { label: "Advies verzonden", variant: "green", updates: { status: "🟣 Advies verzonden", fase: "Afronding", adviesUitgebracht: "Ja", datumAdvies: todayISO(), volgendeActie: "Wachten op beslissing" } as Partial<Case> },
      ];
    case "Afronding":
      return [
        { label: "Beslissing ontvangen", variant: "green", updates: { beslissingOpBezwaar: "Ja" as const, datumBeslissingOpBezwaar: todayISO(), volgendeActie: "Zaak sluiten" } },
        { label: "Zaak afgerond", variant: "blue", updates: { status: "⚫ Afgerond", volgendeActie: "Geen" } },
      ];
    default:
      return [];
  }
}

function WorkflowActions({ zaak, onUpdate }: { zaak: Case; onUpdate: (u: Partial<Case>) => void }) {
  const actions = getActionsForFase(zaak.fase);
  if (actions.length === 0) return <p className="text-xs text-gray-400">Geen acties beschikbaar voor deze fase.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a, i) => <WorkflowActionButton key={i} action={a} onUpdate={onUpdate} />)}
    </div>
  );
}

function WorkflowActionButton({ action, onUpdate }: { action: ActionDef; onUpdate: (u: Partial<Case>) => void }) {
  const [clicked, setClicked] = useState(false);

  function handleClick() {
    onUpdate(action.updates);
    setClicked(true);
    setTimeout(() => setClicked(false), 2000);
  }

  const variantStyles: Record<ActionDef["variant"], string> = {
    green: "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
    red: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
    blue: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
  };

  const iconBg: Record<ActionDef["variant"], string> = {
    green: "bg-green-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
  };

  const iconContent: Record<ActionDef["variant"], JSX.Element> = {
    green: (
      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor">
        <path fillRule="evenodd" d="M10.28 3.28a.75.75 0 010 1.06l-5 5a.75.75 0 01-1.06 0l-2-2a.75.75 0 011.06-1.06L4.75 7.69l4.47-4.41a.75.75 0 011.06 0z" />
      </svg>
    ),
    red: (
      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor">
        <path d="M2.72 2.72a.75.75 0 011.06 0L6 4.94l2.22-2.22a.75.75 0 111.06 1.06L7.06 6l2.22 2.22a.75.75 0 11-1.06 1.06L6 7.06 3.78 9.28a.75.75 0 01-1.06-1.06L4.94 6 2.72 3.78a.75.75 0 010-1.06z" />
      </svg>
    ),
    blue: (
      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor">
        <path d="M5 6a2 2 0 100-4 2 2 0 000 4zm-4 4c0-1.657 1.79-3 4-3s4 1.343 4 3H1zm8-3a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm1.5 3h-1.6c-.13-.37-.38-.71-.7-.97.36-.08.73-.03 1.3.47v.5z" />
      </svg>
    ),
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
        clicked ? "bg-green-50 border-green-300 text-green-700" : variantStyles[action.variant]
      }`}
    >
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${clicked ? "bg-green-500" : iconBg[action.variant]}`}>
        {clicked ? (
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor">
            <path fillRule="evenodd" d="M10.28 3.28a.75.75 0 010 1.06l-5 5a.75.75 0 01-1.06 0l-2-2a.75.75 0 011.06-1.06L4.75 7.69l4.47-4.41a.75.75 0 011.06 0z" />
          </svg>
        ) : iconContent[action.variant]}
      </div>
      {action.label}
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FaseBadge({ fase, small }: { fase: string; small?: boolean }) {
  const colors: Record<string, string> = {
    Intake: "bg-blue-100 text-blue-700",
    Informeel: "bg-orange-100 text-orange-700",
    Zitting: "bg-violet-100 text-violet-700",
    Hoorzitting: "bg-purple-100 text-purple-700",
    Advies: "bg-red-100 text-red-700",
    Afronding: "bg-green-100 text-green-700",
  };
  const cls = colors[fase] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${cls} ${small ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"}`}>
      {fase}
    </span>
  );
}

function EditableField({ label, value, type = "text", onChange }: {
  label: string; value: string; type?: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <CasesProvider>
      <DashboardContent />
    </CasesProvider>
  );
}
