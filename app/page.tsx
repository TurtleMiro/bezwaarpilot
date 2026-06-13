"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CasesProvider, useCases } from "@/lib/CasesContext";
import { Case } from "@/lib/types";
import { formatDate, isOverdue, isDueSoon, todayISO, addWeeks } from "@/lib/dateUtils";

const FASE_TABS = [
  { key: "Intake",      label: "Intake",                bg: "bg-blue-500",   activePill: "bg-blue-50 text-blue-700",   dot: "bg-blue-500"   },
  { key: "Informeel",  label: "Informele afhandeling", bg: "bg-orange-500", activePill: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
  { key: "Hoorzitting",label: "Hoorzitting",           bg: "bg-purple-500", activePill: "bg-purple-50 text-purple-700", dot: "bg-purple-500" },
  { key: "Advies",     label: "Advies",                bg: "bg-red-500",    activePill: "bg-red-50 text-red-700",      dot: "bg-red-500"    },
  { key: "Afronding",  label: "Afronding",             bg: "bg-emerald-600",activePill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
];

const FASE_STEPS = ["Intake", "Informeel", "Hoorzitting", "Advies", "Afronding"];

const FASE_COLORS: Record<string, { ring: string; text: string; bg: string }> = {
  Intake:      { ring: "ring-blue-200",   text: "text-blue-600",   bg: "bg-blue-500"    },
  Informeel:   { ring: "ring-orange-200", text: "text-orange-600", bg: "bg-orange-500"  },
  Hoorzitting: { ring: "ring-purple-200", text: "text-purple-600", bg: "bg-purple-500"  },
  Advies:      { ring: "ring-red-200",    text: "text-red-600",    bg: "bg-red-500"     },
  Afronding:   { ring: "ring-emerald-200",text: "text-emerald-600",bg: "bg-emerald-600" },
};

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardContent() {
  const { cases, updateCase } = useCases();
  const router = useRouter();
  const [search, setSearch]       = useState("");
  const [faseFilter, setFaseFilter] = useState("Alle");
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId]   = useState<string | null>(null);

  const selectedCase = selectedId ? (cases.find((c) => c.id === selectedId) ?? null) : null;

  const faseCounts = FASE_TABS.reduce<Record<string, number>>((acc, f) => {
    acc[f.key] = cases.filter((c) => c.fase === f.key).length;
    return acc;
  }, {});

  const filtered = cases.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !search || c.zaaknummer.toLowerCase().includes(q) || c.bezwaarmaker.toLowerCase().includes(q);
    const matchFase   = faseFilter === "Alle" || c.fase === faseFilter;
    let matchQuick    = true;
    if (quickFilter === "actie")   matchQuick = isOverdue(c.actiedatum);
    else if (quickFilter === "termijn") matchQuick = isDueSoon(c.actiedatum, 7) && !isOverdue(c.actiedatum);
    else if (quickFilter === "wachten") matchQuick = c.volgendeActie?.toLowerCase().includes("wacht") ?? false;
    else if (quickFilter === "afgerond") matchQuick = c.fase === "Afronding";
    return matchSearch && matchFase && matchQuick;
  });

  useEffect(() => {
    if (cases.length > 0 && !selectedId) setSelectedId(cases[0].id);
  }, [cases.length]);

  useEffect(() => {
    if (filtered.length > 0 && !filtered.find((c) => c.id === selectedId))
      setSelectedId(filtered[0].id);
  }, [faseFilter, quickFilter, search]);

  const counts = {
    actie:    cases.filter((c) => isOverdue(c.actiedatum)).length,
    termijn:  cases.filter((c) => isDueSoon(c.actiedatum, 7) && !isOverdue(c.actiedatum)).length,
    wachten:  cases.filter((c) => c.volgendeActie?.toLowerCase().includes("wacht") ?? false).length,
    afgerond: cases.filter((c) => c.fase === "Afronding").length,
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg)" }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="flex items-stretch bg-white border-b border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] z-20 flex-shrink-0 h-[58px]">

        {/* Logo */}
        <div className="flex items-center px-5 gap-3 border-r border-gray-100 w-[232px] flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-white">
              <path d="M2 3h12v2H2V3zm0 4h8v2H2V7zm0 4h10v2H2v-2z" fill="currentColor" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900 text-sm tracking-tight">BezwaarPilot</span>
        </div>

        {/* Phase tabs */}
        <div className="flex flex-1 overflow-x-auto px-2 gap-1 items-center">
          {FASE_TABS.map((tab) => {
            const active = faseFilter === tab.key;
            const count  = faseCounts[tab.key] ?? 0;
            return (
              <button
                key={tab.key}
                onClick={() => { setFaseFilter(tab.key); setQuickFilter(null); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 whitespace-nowrap ${
                  active
                    ? `${tab.activePill} shadow-sm ring-1 ring-inset ring-black/5`
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                <span className={`w-5 h-5 rounded-full ${tab.bg} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0`}>
                  {count}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right actions */}
        <div className="flex items-center px-4 gap-2 border-l border-gray-100">
          <button className="p-2 rounded-xl hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-[11px] font-bold select-none shadow-sm">
            JD
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ────────────────────────────────────────────────── */}
        <aside className="w-[232px] border-r border-gray-100 flex flex-col flex-shrink-0 bg-white">

          {/* Search + new */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">
                Alle zaken
                <span className="ml-1.5 font-normal text-gray-400">{cases.length}</span>
              </span>
              <button
                onClick={() => router.push("/nieuw")}
                title="Nieuwe zaak"
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
                className="w-full text-xs rounded-xl border border-gray-200 bg-gray-50 pl-7 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white placeholder:text-gray-400 transition-all duration-150"
              />
            </div>
          </div>

          {/* Quick filters */}
          <div className="px-2 pb-2 border-b border-gray-100">
            {[
              { id: "actie",   label: "Actie vereist",     count: counts.actie,    dot: "bg-red-400"    },
              { id: "termijn", label: "Termijn < 7 dagen",  count: counts.termijn,  dot: "bg-amber-400"  },
              { id: "wachten", label: "Wachten op reactie", count: counts.wachten,  dot: "bg-blue-400"   },
              { id: "afgerond",label: "Afgerond",           count: counts.afgerond, dot: "bg-gray-300"   },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setQuickFilter(quickFilter === f.id ? null : f.id);
                  if (quickFilter !== f.id) setFaseFilter("Alle");
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-xl text-xs transition-all duration-150 ${
                  quickFilter === f.id
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.dot}`} />
                  {f.label}
                </span>
                <span className={`tabular-nums ${quickFilter === f.id ? "text-blue-600 font-semibold" : "text-gray-400"}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Case list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map((c) => {
              const days   = daysUntil(c.actiedatum);
              const overdue = days !== null && days < 0;
              const soon    = days !== null && days >= 0 && days <= 7;
              const active  = selectedId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-3 py-3 border-b border-gray-50 transition-all duration-150 relative group ${
                    active ? "bg-blue-50" : "hover:bg-gray-50/80"
                  }`}
                >
                  {/* Active indicator */}
                  <div className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-all duration-200 ${active ? "bg-blue-500" : "bg-transparent"}`} />

                  <div className="flex items-center justify-between mb-0.5 pl-1">
                    <span className={`text-xs font-bold transition-colors ${active ? "text-blue-600" : "text-gray-500 group-hover:text-blue-500"}`}>
                      {c.zaaknummer}
                    </span>
                    <FaseBadge fase={c.fase} small />
                  </div>
                  <div className="text-xs font-semibold text-gray-800 mb-0.5 truncate pl-1">{c.bezwaarmaker}</div>
                  <div className="text-[11px] text-gray-400 truncate mb-1.5 pl-1">{c.volgendeActie}</div>
                  {days !== null && (
                    <div className={`flex items-center gap-1 text-[11px] font-medium pl-1 ${
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
              <div className="py-12 text-center">
                <div className="text-gray-300 text-2xl mb-2">○</div>
                <p className="text-xs text-gray-400">Geen zaken gevonden</p>
              </div>
            )}
            {(faseFilter !== "Alle" || quickFilter || search) && filtered.length > 0 && (
              <button
                onClick={() => { setFaseFilter("Alle"); setQuickFilter(null); setSearch(""); }}
                className="w-full py-2.5 text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50/50 border-t border-gray-100 transition-colors"
              >
                Bekijk alle zaken →
              </button>
            )}
          </div>
        </aside>

        {/* ── Main panel ─────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
          {selectedCase ? (
            <CaseDetailPanel
              key={selectedCase.id}
              zaak={selectedCase}
              onUpdate={(updates) => updateCase({ ...selectedCase, ...updates })}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-300" viewBox="0 0 32 32" fill="none">
                  <rect x="5" y="4" width="22" height="24" rx="3" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 12h12M10 18h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 font-medium">Selecteer een zaak</p>
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
  const [zaak, setZaak]                     = useState<Case>(initialZaak);
  const [saved, setSaved]                   = useState(false);
  const [showZaakgegevens, setShowZaakgegevens] = useState(false);

  useEffect(() => { setZaak(initialZaak); }, [initialZaak.id]);

  function applyWorkflow(updates: Partial<Case>) {
    const updated = { ...zaak, ...updates };
    setZaak(updated);
    updateCase(updated);
    onUpdate(updates);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleFieldChange(field: keyof Case, value: string) {
    const updated: Case = { ...zaak, [field]: value };
    if (field === "datumBesluit" && value) {
      const einde  = addWeeks(value, 6);
      updated.einddatumBezwaartermijn = einde;
      const term12 = addWeeks(einde, 12);
      updated.beslistermijn12Weken = term12;
      if (updated.verdaagd === "Ja") updated.beslistermijnNaVerdaging = addWeeks(term12, 6);
    }
    if (field === "verdaagd") {
      if (value === "Ja" && updated.beslistermijn12Weken)
        updated.beslistermijnNaVerdaging = addWeeks(updated.beslistermijn12Weken, 6);
      else if (value === "Nee")
        updated.beslistermijnNaVerdaging = "";
    }
    setZaak(updated);
  }

  function handleSave() {
    updateCase(zaak);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const faseIndex          = FASE_STEPS.indexOf(zaak.fase);
  const currentFaseColor   = FASE_COLORS[zaak.fase] ?? FASE_COLORS.Intake;
  const daysToActie        = daysUntil(zaak.actiedatum);
  const daysToBeslistermijn = daysUntil(zaak.beslistermijnNaVerdaging || zaak.beslistermijn12Weken);
  const actieOverdue       = daysToActie !== null && daysToActie < 0;
  const actieSoon          = daysToActie !== null && daysToActie >= 0 && daysToActie <= 7;

  return (
    <div className="min-h-full">

      {/* ── Sticky header ──────────────────────────────────────────── */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-100 px-6 py-4 sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">

        {/* Case title row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <h1 className="text-base font-bold text-gray-900 tracking-tight">{zaak.zaaknummer}</h1>
            <span className="text-sm text-gray-400 font-medium">{zaak.bezwaarmaker}</span>
            {zaak.status && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                {zaak.status}
              </span>
            )}
            {saved && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full ring-1 ring-emerald-200/60 animate-in fade-in duration-200">
                ✓ Opgeslagen
              </span>
            )}
          </div>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 font-medium shadow-sm">
            Meer acties <span className="text-gray-300 text-base leading-none">···</span>
          </button>
        </div>

        {/* Phase progress */}
        <div className="flex items-center gap-0">
          {FASE_STEPS.map((fase, i) => {
            const done    = i < faseIndex;
            const current = i === faseIndex;
            const color   = FASE_COLORS[fase] ?? FASE_COLORS.Intake;
            return (
              <div key={fase} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                    done
                      ? "bg-emerald-500 border-emerald-500 shadow-sm"
                      : current
                      ? `${color.bg} border-transparent shadow-md ring-4 ${color.ring}`
                      : "bg-white border-gray-200"
                  }`}>
                    {done ? (
                      <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 14 14" fill="currentColor">
                        <path fillRule="evenodd" d="M11.78 3.72a.75.75 0 010 1.06l-5.5 5.5a.75.75 0 01-1.06 0L1.72 6.78a.75.75 0 011.06-1.06L5.75 8.19l4.97-4.47a.75.75 0 011.06 0z" />
                      </svg>
                    ) : (
                      <span className={`text-xs font-bold ${current ? "text-white" : "text-gray-300"}`}>{i + 1}</span>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold whitespace-nowrap tracking-tight ${
                    current ? color.text : done ? "text-emerald-500" : "text-gray-300"
                  }`}>
                    {fase}
                  </span>
                </div>
                {i < FASE_STEPS.length - 1 && (
                  <div className={`h-px flex-1 mx-2 mb-5 transition-all duration-500 ${i < faseIndex ? "bg-emerald-300" : "bg-gray-100"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Content grid ───────────────────────────────────────────── */}
      <div className="p-5 grid grid-cols-3 gap-4">

        {/* Left 2 cols */}
        <div className="col-span-2 space-y-4">

          {/* Fase + timer card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 grid grid-cols-2 gap-5">
            {/* Huidige fase */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Huidige fase</p>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${currentFaseColor.bg} shadow-sm`}>
                  <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{zaak.fase}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-tight">{zaak.status || "—"}</p>
                </div>
              </div>
            </div>

            {/* Timer */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Resterende tijd</p>
              {daysToActie !== null ? (
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                    actieOverdue ? "bg-red-500" : actieSoon ? "bg-amber-500" : "bg-blue-500"
                  }`}>
                    <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M10 6.5v3.5l2.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${actieOverdue ? "text-red-600" : actieSoon ? "text-amber-600" : "text-gray-900"}`}>
                      {actieOverdue ? `${Math.abs(daysToActie)} dagen te laat` : `Nog ${daysToActie} dagen`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Actiedatum: {formatDate(zaak.actiedatum)}</p>
                  </div>
                </div>
              ) : (
                <span className="text-sm text-gray-300">Niet ingesteld</span>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4">

            {/* Beslistermijn */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-t-2xl" />
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Beslistermijn</p>
              {daysToBeslistermijn !== null ? (
                <>
                  <p className={`text-2xl font-bold leading-tight ${daysToBeslistermijn < 14 ? "text-red-600" : daysToBeslistermijn < 30 ? "text-amber-600" : "text-gray-900"}`}>
                    Nog {daysToBeslistermijn}
                    <span className="text-base font-semibold text-gray-400 ml-1">dagen</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(zaak.beslistermijnNaVerdaging || zaak.beslistermijn12Weken)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-300">Niet ingesteld</p>
              )}
            </div>

            {/* Actie vereist */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-orange-500 rounded-t-2xl" />
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Actie vereist</p>
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-orange-500" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M7 1a6 6 0 100 12A6 6 0 007 1zm0 10a1 1 0 110-2 1 1 0 010 2zm.5-3.5h-1l-.25-4h1.5L7.5 7.5z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-800 leading-snug">{zaak.volgendeActie || "—"}</p>
              </div>
            </div>
          </div>

          {/* Volgende actie + workflow */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-orange-500" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M7 1a6 6 0 100 12A6 6 0 007 1zm0 10a1 1 0 110-2 1 1 0 010 2zm.5-3.5h-1l-.25-4h1.5L7.5 7.5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Volgende actie</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{zaak.volgendeActie || "—"}</p>
                </div>
              </div>
              {zaak.actiedatum && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-100">
                  <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 14 14" fill="none">
                    <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M5 1v2M9 1v2M2 5h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  {formatDate(zaak.actiedatum)}
                </div>
              )}
            </div>

            <div className="border-t border-gray-50 pt-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Beschikbare acties</p>
              <WorkflowActions zaak={zaak} onUpdate={applyWorkflow} />
            </div>
          </div>

          {/* Zaakgegevens collapsible */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowZaakgegevens(!showZaakgegevens)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50/80 transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Zaakgegevens
              </span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showZaakgegevens ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="none">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            {showZaakgegevens && (
              <div className="px-5 pb-5 border-t border-gray-50">
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <EditableField label="Zaaknummer"           value={zaak.zaaknummer}         onChange={(v) => handleFieldChange("zaaknummer", v)} />
                  <EditableField label="Bezwaarmaker"         value={zaak.bezwaarmaker}        onChange={(v) => handleFieldChange("bezwaarmaker", v)} />
                  <EditableField label="Datum ontvangst"      value={zaak.datumOntvangst}      type="date" onChange={(v) => handleFieldChange("datumOntvangst", v)} />
                  <EditableField label="Datum besluit"        value={zaak.datumBesluit}        type="date" onChange={(v) => handleFieldChange("datumBesluit", v)} />
                  <EditableField label="Beslistermijn"        value={zaak.beslistermijn12Weken} type="date" onChange={(v) => handleFieldChange("beslistermijn12Weken", v)} />
                  <EditableField label="Actiedatum"           value={zaak.actiedatum}          type="date" onChange={(v) => handleFieldChange("actiedatum", v)} />
                  <EditableField label="Datum hoorzitting"    value={zaak.datumHoorzitting}    type="date" onChange={(v) => handleFieldChange("datumHoorzitting", v)} />
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Verdaagd</label>
                    <select
                      className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                      value={zaak.verdaagd}
                      onChange={(e) => handleFieldChange("verdaagd", e.target.value)}
                    >
                      <option value="Nee">Nee</option>
                      <option value="Ja">Ja</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Aantekeningen</label>
                  <textarea
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 min-h-[64px] resize-y transition-all"
                    value={zaak.aantekeningen}
                    onChange={(e) => handleFieldChange("aantekeningen", e.target.value)}
                    placeholder="Notities..."
                  />
                </div>
                <button
                  className="mt-3 inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm hover:shadow-md transition-all duration-150 active:scale-[0.98]"
                  onClick={handleSave}
                >
                  Wijzigingen opslaan
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* AI Assistent */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm">
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M7 1a6 6 0 100 12A6 6 0 007 1zm0 10a1 1 0 110-2 1 1 0 010 2zm.5-3.5h-1l-.25-4h1.5L7.5 7.5z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-900">AI Assistent</span>
              </div>
              <span className="text-gray-300 text-base">···</span>
            </div>
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Huidige fase</p>
              <div className={`${currentFaseColor.bg} bg-opacity-10 rounded-xl px-3 py-2`}>
                <span className={`text-sm font-semibold ${currentFaseColor.text}`}>{zaak.fase}</span>
              </div>
            </div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Actie vereist</p>
            <label className="flex items-start gap-2 cursor-pointer group">
              <input type="checkbox" className="mt-0.5 rounded border-gray-300 text-blue-600" readOnly />
              <span className="text-xs text-gray-600 group-hover:text-gray-900 leading-relaxed transition-colors">{zaak.volgendeActie || "—"}</span>
            </label>
          </div>

          {/* Snelle acties */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Snelle acties</p>
            <div className="space-y-0.5">
              {[
                { label: "Reminder sturen naar vakafdeling", icon: "→" },
                { label: "Reactie toelichten",               icon: "✎" },
                { label: "Notitie toevoegen",                icon: "+" },
                { label: "Document uploaden",                icon: "↑" },
              ].map((action, i) => (
                <button
                  key={i}
                  className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-50 px-2.5 py-2 rounded-xl transition-all duration-150 text-left group"
                >
                  <span>{action.label}</span>
                  <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Help */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 11a1 1 0 110-2 1 1 0 010 2zm.75-4h-1.5l-.25-3.5h2L8.75 8z" />
              </svg>
              <span className="text-xs font-semibold text-blue-700">Hulp nodig?</span>
            </div>
            <p className="text-xs text-blue-600/70 mb-2.5 leading-relaxed">
              Bekijk uitleg over deze stap en het proces.
            </p>
            <button className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors">
              Open uitleg →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Workflow actions ─────────────────────────────────────────────────────────

type ActionDef = { label: string; variant: "green" | "red" | "blue"; updates: Partial<Case> };

function getActionsForFase(fase: string): ActionDef[] {
  switch (fase) {
    case "Intake":
      return [
        { label: "Ontvangstbevestiging verzonden", variant: "green", updates: { status: "Ontvangstbevestiging verzonden", fase: "Informeel", volgendeActie: "Beoordeel informele afhandeling" } },
        { label: "Herstelverzuimbrief verzonden",  variant: "red",   updates: { status: "🔴 In afwachting herstel", volgendeActie: "Controleer hersteltermijn" } },
        { label: "Herstel ontvangen",              variant: "blue",  updates: { status: "🟢 Herstel ontvangen", fase: "Informeel", volgendeActie: "Beoordeel informele afhandeling" } },
      ];
    case "Informeel":
      return [
        { label: "Informeel afgerond",      variant: "green", updates: { status: "🟢 Informele afhandeling afgerond", volgendeActie: "Verzoek intrekking bezwaar versturen" } },
        { label: "Informeel niet geslaagd", variant: "red",   updates: { status: "🔵 Zitting plannen", fase: "Zitting", volgendeActie: "Plan hoorzitting" } },
        { label: "Zitting plannen",         variant: "blue",  updates: { fase: "Hoorzitting", volgendeActie: "Hoorzitting plannen" } },
      ];
    case "Zitting":
    case "Hoorzitting":
      return [
        { label: "Zitting gepland",    variant: "green", updates: { status: "🔵 Zitting gepland", volgendeActie: "Uitnodigingen versturen" } },
        { label: "Hoorzitting geweest",variant: "blue",  updates: { status: "🟣 Advies uitwerken", fase: "Advies", volgendeActie: "Conceptadvies maken" } },
      ];
    case "Advies":
      return [
        { label: "Advies verzonden", variant: "green", updates: { status: "🟣 Advies verzonden", fase: "Afronding", adviesUitgebracht: "Ja", datumAdvies: todayISO(), volgendeActie: "Wachten op beslissing" } as Partial<Case> },
      ];
    case "Afronding":
      return [
        { label: "Beslissing ontvangen", variant: "green", updates: { beslissingOpBezwaar: "Ja" as const, datumBeslissingOpBezwaar: todayISO(), volgendeActie: "Zaak sluiten" } },
        { label: "Zaak afgerond",        variant: "blue",  updates: { status: "⚫ Afgerond", volgendeActie: "Geen" } },
      ];
    default:
      return [];
  }
}

function WorkflowActions({ zaak, onUpdate }: { zaak: Case; onUpdate: (u: Partial<Case>) => void }) {
  const actions = getActionsForFase(zaak.fase);
  if (!actions.length) return <p className="text-xs text-gray-400">Geen acties beschikbaar.</p>;
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

  const styles: Record<ActionDef["variant"], { base: string; iconBg: string }> = {
    green: { base: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300", iconBg: "bg-emerald-500" },
    red:   { base: "bg-red-50   border-red-200   text-red-700   hover:bg-red-100   hover:border-red-300",   iconBg: "bg-red-500"     },
    blue:  { base: "bg-blue-50  border-blue-200  text-blue-700  hover:bg-blue-100  hover:border-blue-300",  iconBg: "bg-blue-500"    },
  };

  const icons: Record<ActionDef["variant"], JSX.Element> = {
    green: <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor"><path fillRule="evenodd" d="M10.28 3.28a.75.75 0 010 1.06l-5 5a.75.75 0 01-1.06 0l-2-2a.75.75 0 011.06-1.06L4.75 7.69l4.47-4.41a.75.75 0 011.06 0z" /></svg>,
    red:   <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor"><path d="M2.72 2.72a.75.75 0 011.06 0L6 4.94l2.22-2.22a.75.75 0 111.06 1.06L7.06 6l2.22 2.22a.75.75 0 11-1.06 1.06L6 7.06 3.78 9.28a.75.75 0 01-1.06-1.06L4.94 6 2.72 3.78a.75.75 0 010-1.06z" /></svg>,
    blue:  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor"><path d="M5 6a2 2 0 100-4 2 2 0 000 4zm-4 4c0-1.657 1.79-3 4-3s4 1.343 4 3H1zm8-3a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm1.5 3h-1.6c-.13-.37-.38-.71-.7-.97.36-.08.73-.03 1.3.47v.5z" /></svg>,
  };

  const s = styles[action.variant];

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all duration-150 active:scale-[0.97] ${
        clicked ? "bg-emerald-50 border-emerald-300 text-emerald-700" : s.base
      }`}
    >
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${clicked ? "bg-emerald-500" : s.iconBg}`}>
        {clicked
          ? <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor"><path fillRule="evenodd" d="M10.28 3.28a.75.75 0 010 1.06l-5 5a.75.75 0 01-1.06 0l-2-2a.75.75 0 011.06-1.06L4.75 7.69l4.47-4.41a.75.75 0 011.06 0z" /></svg>
          : icons[action.variant]
        }
      </div>
      {action.label}
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FaseBadge({ fase, small }: { fase: string; small?: boolean }) {
  const colors: Record<string, string> = {
    Intake:      "bg-blue-100    text-blue-700",
    Informeel:   "bg-orange-100  text-orange-700",
    Zitting:     "bg-violet-100  text-violet-700",
    Hoorzitting: "bg-purple-100  text-purple-700",
    Advies:      "bg-red-100     text-red-700",
    Afronding:   "bg-emerald-100 text-emerald-700",
  };
  const cls = colors[fase] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${cls} ${small ? "text-[10px] px-1.5 py-px" : "text-xs px-2 py-0.5"}`}>
      {fase}
    </span>
  );
}

function EditableField({ label, value, type = "text", onChange }: {
  label: string; value: string; type?: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      <input
        type={type}
        className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all duration-150 bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <CasesProvider>
      <DashboardContent />
    </CasesProvider>
  );
}
