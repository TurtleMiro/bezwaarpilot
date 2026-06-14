"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CasesProvider, useCases } from "@/lib/CasesContext";
import { Case } from "@/lib/types";
import { formatDate, isOverdue, isDueSoon, todayISO, addWeeks } from "@/lib/dateUtils";
import { generateId } from "@/lib/store";
import { signOut } from "next-auth/react";

const FASE_ICONS: Record<string, JSX.Element> = {
  Intake:      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />,
  Informeel:   <path d="M18 10c0 3.866-3.582 7-8 7a8.96 8.96 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" />,
  Hoorzitting: <><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></>,
  Advies:      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />,
  Afronding:   <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />,
};

const FASE_TABS = [
  { key: "Intake",       label: "Intake",                bg: "bg-blue-500",    pill: "bg-blue-600 text-white",    inactive: "text-gray-600 hover:bg-blue-50 hover:text-blue-700"    },
  { key: "Informeel",   label: "Inform. afhandeling",  bg: "bg-orange-500",  pill: "bg-orange-500 text-white",  inactive: "text-gray-600 hover:bg-orange-50 hover:text-orange-700"  },
  { key: "Hoorzitting", label: "Hoorzitting",           bg: "bg-purple-500",  pill: "bg-purple-600 text-white",  inactive: "text-gray-600 hover:bg-purple-50 hover:text-purple-700"  },
  { key: "Advies",      label: "Advies",                bg: "bg-emerald-500", pill: "bg-emerald-600 text-white", inactive: "text-gray-600 hover:bg-emerald-50 hover:text-emerald-700" },
  { key: "Afronding",   label: "Afronding",             bg: "bg-slate-500",   pill: "bg-slate-600 text-white",   inactive: "text-gray-600 hover:bg-slate-50 hover:text-slate-700"   },
];

const FASE_STEPS = ["Intake", "Informeel", "Hoorzitting", "Advies", "Afronding"];

const FASE_COLORS: Record<string, { ring: string; text: string; bg: string; light: string; border: string }> = {
  Intake:      { ring: "ring-blue-200",    text: "text-blue-700",    bg: "bg-blue-500",    light: "bg-blue-50",    border: "border-blue-200"    },
  Informeel:   { ring: "ring-orange-200",  text: "text-orange-700",  bg: "bg-orange-500",  light: "bg-orange-50",  border: "border-orange-200"  },
  Hoorzitting: { ring: "ring-purple-200",  text: "text-purple-700",  bg: "bg-purple-500",  light: "bg-purple-50",  border: "border-purple-200"  },
  Advies:      { ring: "ring-emerald-200", text: "text-emerald-700", bg: "bg-emerald-500", light: "bg-emerald-50", border: "border-emerald-200" },
  Afronding:   { ring: "ring-slate-200",   text: "text-slate-700",   bg: "bg-slate-500",   light: "bg-slate-50",   border: "border-slate-200"   },
};

const FASE_UITLEG: Record<string, { steps: string[]; tip: string }> = {
  Intake:      { steps: ["Controleer of het bezwaar tijdig en volledig is ingediend.", "Stuur een ontvangstbevestiging aan de bezwaarmaker.", "Is het bezwaar onvolledig? Stuur een herstelverzuimbrief.", "Ontvang het herstel en ga door naar de informele fase."], tip: "De bezwaartermijn is 6 weken na de besluitdatum. Controleer dit altijd als eerste." },
  Informeel:   { steps: ["Neem contact op met de vakafdeling voor een informele reactie.", "Stuur zo nodig een reminder als er geen reactie komt.", "Beoordeel de reactie van de vakafdeling.", "Geslaagd? Sluit informeel af. Niet geslaagd? Plan een zitting."], tip: "Informele afhandeling bespaart tijd voor alle partijen. Probeer dit altijd eerst." },
  Hoorzitting: { steps: ["Plan een datum voor de hoorzitting.", "Stuur uitnodigingen aan bezwaarmaker en vakafdeling.", "Bereid de hoorzitting voor met het procesdossier.", "Houd de hoorzitting en leg het verslag vast."], tip: "Zorg dat uitnodigingen minimaal 2 weken van tevoren worden verstuurd." },
  Zitting:     { steps: ["Plan een datum voor de hoorzitting.", "Stuur uitnodigingen aan bezwaarmaker en vakafdeling.", "Bereid de hoorzitting voor met het procesdossier.", "Houd de hoorzitting en leg het verslag vast."], tip: "Zorg dat uitnodigingen minimaal 2 weken van tevoren worden verstuurd." },
  Advies:      { steps: ["Schrijf het conceptadvies op basis van de hoorzitting.", "Laat het conceptadvies controleren.", "Stuur het definitieve advies naar het bestuursorgaan."], tip: "Het advies moet binnen de beslistermijn verstuurd worden." },
  Afronding:   { steps: ["Wacht op de beslissing op bezwaar van het bestuursorgaan.", "Ontvang en registreer de beslissing.", "Sluit de zaak af in het systeem."], tip: "Bewaar alle documenten zorgvuldig voor het archief." },
};

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardContent() {
  const { cases, updateCase, addCase, deleteCase } = useCases();
  const router = useRouter();
  const [search, setSearch]         = useState("");
  const [faseFilter, setFaseFilter] = useState("Alle");
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

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
    if      (quickFilter === "actie")    matchQuick = isOverdue(c.actiedatum);
    else if (quickFilter === "termijn")  matchQuick = isDueSoon(c.actiedatum, 2) && !isOverdue(c.actiedatum);
    else if (quickFilter === "normaal")  matchQuick = !isOverdue(c.actiedatum) && !isDueSoon(c.actiedatum, 2) && c.fase !== "Afronding";
    else if (quickFilter === "afgerond") matchQuick = c.fase === "Afronding";
    return matchSearch && matchFase && matchQuick;
  });

  useEffect(() => {
    if (cases.length > 0 && !selectedId) setSelectedId(cases[0].id);
  }, [cases.length]); // eslint-disable-line

  useEffect(() => {
    if (filtered.length > 0 && !filtered.find((c) => c.id === selectedId))
      setSelectedId(filtered[0].id);
  }, [faseFilter, quickFilter, search]); // eslint-disable-line

  const counts = {
    actie:    cases.filter((c) => isOverdue(c.actiedatum)).length,
    termijn:  cases.filter((c) => isDueSoon(c.actiedatum, 2) && !isOverdue(c.actiedatum)).length,
    normaal:  cases.filter((c) => !isOverdue(c.actiedatum) && !isDueSoon(c.actiedatum, 2) && c.fase !== "Afronding").length,
    afgerond: cases.filter((c) => c.fase === "Afronding").length,
  };

  function handleUpdate(base: Case, updates: Partial<Case>) {
    updateCase({ ...base, ...updates });
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Top header ─────────────────────────────────────────────────── */}
      <header className="flex items-center h-14 bg-white border-b border-gray-200 z-20 flex-shrink-0 px-4 gap-3">

        {/* Logo — matches sidebar width */}
        <div className="flex items-center gap-2.5 flex-shrink-0 w-52">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="BezwaarPilot" className="w-7 h-7 rounded-md object-cover" />
          <span className="font-bold text-gray-900 text-sm tracking-tight">BezwaarPilot</span>
        </div>

        {/* Phase filter tabs */}
        <div className="hidden md:flex flex-1 items-center gap-1.5">
          {FASE_TABS.map((tab) => {
            const active = faseFilter === tab.key;
            const count  = faseCounts[tab.key] ?? 0;
            return (
              <button
                key={tab.key}
                onClick={() => { setFaseFilter(active ? "Alle" : tab.key); setQuickFilter(null); setMobileShowDetail(false); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border ${
                  active
                    ? `${tab.pill} border-transparent shadow-sm`
                    : `bg-white ${tab.inactive} border-gray-200`
                }`}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  {FASE_ICONS[tab.key]}
                </svg>
                {tab.label}
                <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  active ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500"
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Right: new case + bell + avatar */}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <button
            onClick={() => router.push("/nieuw")}
            className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-full hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Nieuwe zaak
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Uitloggen"
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold select-none shadow-sm">
            BP
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Dark sidebar ────────────────────────────────────────────── */}
        <aside className={`flex-col flex-shrink-0 bg-gray-900 border-r border-white/5
          ${mobileShowDetail ? "hidden" : "flex w-full"} md:flex md:w-52`}>

          {/* Search + add */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-300">
                Alle zaken <span className="text-gray-500 font-normal">{cases.length}</span>
              </span>
              <button
                onClick={() => router.push("/nieuw")}
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-sm"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Zoek zaak..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs rounded-lg bg-white/8 border border-white/10 text-gray-200 pl-7 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:bg-white/12 placeholder:text-gray-500 transition-all"
              />
            </div>
          </div>

          {/* Status legend / quick filters */}
          <div className="px-2 pb-2 border-b border-white/5">
            {[
              { id: "actie",    label: "Actie vereist",     count: counts.actie,    dot: "bg-red-500"     },
              { id: "termijn",  label: "Termijn < 2 dagen", count: counts.termijn,  dot: "bg-amber-400"   },
              { id: "normaal",  label: "Normaal",           count: counts.normaal,  dot: "bg-emerald-500" },
              { id: "afgerond", label: "Afgerond",          count: counts.afgerond, dot: "bg-gray-500"    },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => { setQuickFilter(quickFilter === f.id ? null : f.id); if (quickFilter !== f.id) setFaseFilter("Alle"); }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all duration-150 ${
                  quickFilter === f.id ? "bg-white/10 text-white font-medium" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${f.dot}`} />
                  {f.label}
                </span>
                <span className="text-[11px] tabular-nums text-gray-500">{f.count}</span>
              </button>
            ))}
          </div>

          {/* Case list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map((c) => {
              const days    = daysUntil(c.actiedatum);
              const overdue = days !== null && days < 0;
              const soon    = days !== null && days >= 0 && days <= 2;
              const active  = selectedId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelectedId(c.id); setMobileShowDetail(true); }}
                  className={`w-full text-left px-3 py-3 border-b border-white/5 transition-all duration-150 relative ${
                    active ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <div className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full transition-all ${
                    overdue ? "bg-red-500" : soon ? "bg-amber-400" : active ? "bg-blue-400" : "bg-transparent"
                  }`} />
                  <div className="flex items-center justify-between mb-0.5 pl-2">
                    <span className={`text-xs font-bold ${active ? "text-white" : "text-gray-300"}`}>{c.zaaknummer}</span>
                    <FaseBadge fase={c.fase} small dark />
                  </div>
                  <div className={`text-xs font-medium truncate mb-0.5 pl-2 ${active ? "text-gray-200" : "text-gray-400"}`}>{c.bezwaarmaker}</div>
                  <div className="text-[11px] text-gray-500 truncate pl-2">{c.volgendeActie}</div>
                  {days !== null && (
                    <div className={`flex items-center gap-1 text-[11px] font-medium pl-2 mt-1 ${overdue ? "text-red-400" : soon ? "text-amber-400" : "text-gray-500"}`}>
                      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M6 3.5V6l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                      {overdue ? `${Math.abs(days)}d te laat` : `Nog ${days}d`}
                    </div>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-xs text-gray-500">Geen zaken gevonden</p>
              </div>
            )}
            {(faseFilter !== "Alle" || quickFilter || search) && filtered.length > 0 && (
              <button
                onClick={() => { setFaseFilter("Alle"); setQuickFilter(null); setSearch(""); }}
                className="w-full py-2.5 text-[11px] text-gray-500 hover:text-gray-300 hover:bg-white/5 border-t border-white/5 transition-colors"
              >
                Bekijk alle zaken →
              </button>
            )}
          </div>

          {/* Mobile fase pills */}
          <div className="md:hidden flex gap-1.5 px-3 py-2.5 overflow-x-auto border-t border-white/5 flex-shrink-0" style={{ scrollbarWidth: "none" }}>
            {FASE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setFaseFilter(tab.key === faseFilter ? "Alle" : tab.key); setQuickFilter(null); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  faseFilter === tab.key ? `${tab.pill} shadow-sm` : "bg-white/10 text-gray-400"
                }`}
              >
                <span className={`w-4 h-4 rounded-full ${tab.bg} text-white text-[9px] font-bold flex items-center justify-center`}>
                  {faseCounts[tab.key] ?? 0}
                </span>
                {tab.label}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className={`flex-1 overflow-y-auto bg-gray-50 ${mobileShowDetail ? "flex flex-col" : "hidden"} md:flex md:flex-col`}>
          {selectedCase ? (
            <CaseDetailPanel
              key={selectedCase.id}
              zaak={selectedCase}
              onUpdate={(updates) => handleUpdate(selectedCase, updates)}
              onBack={() => setMobileShowDetail(false)}
              onDelete={(id) => { deleteCase(id); setSelectedId(null); setMobileShowDetail(false); }}
              onDuplicate={(zaak) => {
                const copy = { ...zaak, id: generateId(), zaaknummer: zaak.zaaknummer + "-KOPIE" };
                addCase(copy);
                setSelectedId(copy.id);
              }}
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

        {/* ── Right AI panel ───────────────────────────────────────────── */}
        {selectedCase && (
          <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
            <RightPanel
              zaak={selectedCase}
              onUpdate={(updates) => handleUpdate(selectedCase, updates)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

// ─── Case detail panel (center) ───────────────────────────────────────────────

function CaseDetailPanel({ zaak: initialZaak, onUpdate, onBack, onDelete, onDuplicate }: {
  zaak: Case;
  onUpdate: (u: Partial<Case>) => void;
  onBack?: () => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (zaak: Case) => void;
}) {
  const { updateCase } = useCases();
  const [zaak, setZaak]                           = useState<Case>(initialZaak);
  const [saved, setSaved]                         = useState(false);
  const [showZaakgegevens, setShowZaakgegevens]   = useState(false);
  const [showMeerActies, setShowMeerActies]       = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFaseModal, setShowFaseModal]         = useState(false);
  const [showExportModal, setShowExportModal]     = useState(false);
  const [copied, setCopied]                       = useState(false);
  const meerActiesRef                             = useRef<HTMLDivElement>(null);

  useEffect(() => { setZaak(initialZaak); setShowZaakgegevens(false); setShowMeerActies(false); }, [initialZaak.id]); // eslint-disable-line

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (meerActiesRef.current && !meerActiesRef.current.contains(e.target as Node))
        setShowMeerActies(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
    onUpdate(zaak);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function buildExportText() {
    return [
      `BezwaarPilot — Zaakexport`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Zaaknummer:      ${zaak.zaaknummer}`,
      `Bezwaarmaker:    ${zaak.bezwaarmaker}`,
      `Fase:            ${zaak.fase}`,
      `Status:          ${zaak.status || "—"}`,
      ``,
      `Datum ontvangst: ${formatDate(zaak.datumOntvangst) || "—"}`,
      `Datum besluit:   ${formatDate(zaak.datumBesluit) || "—"}`,
      `Beslistermijn:   ${formatDate(zaak.beslistermijn12Weken) || "—"}`,
      `Actiedatum:      ${formatDate(zaak.actiedatum) || "—"}`,
      `Hoorzitting:     ${formatDate(zaak.datumHoorzitting) || "—"}`,
      ``,
      `Volgende actie:  ${zaak.volgendeActie || "—"}`,
      zaak.aantekeningen ? `\nAantekeningen:\n${zaak.aantekeningen}` : "",
    ].filter((l) => l !== undefined).join("\n");
  }

  function handleCopyExport() {
    navigator.clipboard.writeText(buildExportText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const faseIndex           = FASE_STEPS.indexOf(zaak.fase);
  const currentFaseColor    = FASE_COLORS[zaak.fase] ?? FASE_COLORS.Intake;
  const daysToActie         = daysUntil(zaak.actiedatum);
  const daysToBeslistermijn = daysUntil(zaak.beslistermijnNaVerdaging || zaak.beslistermijn12Weken);
  const actieOverdue        = daysToActie !== null && daysToActie < 0;
  const actieSoon           = daysToActie !== null && daysToActie >= 0 && daysToActie <= 2;

  return (
    <div className="min-h-full">

      {/* ── Sticky header ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-5 pt-4 pb-4 sticky top-0 z-10 shadow-sm">

        {/* Title row */}
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              {onBack && (
                <button onClick={onBack} className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-600" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M7.707 13.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L4.414 7H14a1 1 0 110 2H4.414l3.293 3.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">{zaak.zaaknummer}</h1>
              {(actieOverdue || actieSoon) && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm0 7.5a.75.75 0 110-1.5.75.75 0 010 1.5zM6.5 6h-1L5.25 3h1.5L6.5 6z" />
                  </svg>
                  Herinnering sturen
                </span>
              )}
              {saved && (
                <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">✓ Opgeslagen</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{zaak.bezwaarmaker}</p>
          </div>
          {/* Meer acties dropdown */}
          <div className="relative ml-3 flex-shrink-0" ref={meerActiesRef}>
            <button
              onClick={() => setShowMeerActies(!showMeerActies)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all font-medium whitespace-nowrap shadow-sm"
            >
              Meer acties
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showMeerActies ? "rotate-180" : ""}`} viewBox="0 0 14 14" fill="none">
                <path d="M3.5 6l3.5 3.5L10.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            {showMeerActies && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-gray-200 shadow-lg z-30 py-1 overflow-hidden">
                <button
                  onClick={() => { setShowFaseModal(true); setShowMeerActies(false); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                  </svg>
                  Fase handmatig wijzigen
                </button>
                <button
                  onClick={() => { onDuplicate?.(zaak); setShowMeerActies(false); setSaved(true); setTimeout(() => setSaved(false), 2500); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" /><path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
                  </svg>
                  Zaak dupliceren
                </button>
                <button
                  onClick={() => { setShowExportModal(true); setShowMeerActies(false); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Zaak exporteren
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { setShowDeleteConfirm(true); setShowMeerActies(false); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-red-600 hover:bg-red-50 transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Zaak verwijderen
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Phase stepper */}
        <div className="flex items-center overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {FASE_STEPS.map((fase, i) => {
            const done    = i < faseIndex;
            const current = i === faseIndex;
            const color   = FASE_COLORS[fase] ?? FASE_COLORS.Intake;
            return (
              <div key={fase} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                    done    ? "bg-emerald-500 border-emerald-500 shadow-sm"
                    : current ? `${color.bg} border-transparent shadow-md ring-4 ${color.ring}`
                    : "bg-gray-50 border-gray-200"
                  }`}>
                    {done ? (
                      <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className={`w-4 h-4 ${current ? "text-white" : "text-gray-300"}`} viewBox="0 0 20 20" fill="currentColor">
                        {FASE_ICONS[fase]}
                      </svg>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold whitespace-nowrap ${
                    current ? color.text : done ? "text-emerald-600" : "text-gray-300"
                  }`}>{fase}</span>
                </div>
                {i < FASE_STEPS.length - 1 && (
                  <div className={`h-px flex-1 mx-2 mb-5 ${i < faseIndex ? "bg-emerald-300" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="p-5 space-y-4">

        {/* Top info cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Huidige fase */}
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Huidige fase</p>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${currentFaseColor.bg} shadow-sm`}>
                <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">{zaak.fase}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{zaak.status || "In behandeling"}</p>
              </div>
            </div>
          </div>

          {/* Resterende tijd */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Resterende tijd</p>
            {daysToActie !== null ? (
              <>
                <p className={`text-xl font-bold leading-tight ${actieOverdue ? "text-red-600" : actieSoon ? "text-amber-500" : "text-gray-900"}`}>
                  {actieOverdue ? `${Math.abs(daysToActie)}d` : `${daysToActie}d`}
                </p>
                <p className={`text-[11px] mt-0.5 ${actieOverdue ? "text-red-500" : actieSoon ? "text-amber-500" : "text-gray-400"}`}>
                  {actieOverdue ? "te laat" : "resterend"}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-300">—</p>
            )}
          </div>

          {/* Beslistermijn */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Beslistermijn</p>
            {daysToBeslistermijn !== null ? (
              <>
                <p className={`text-xl font-bold leading-tight ${daysToBeslistermijn < 14 ? "text-red-600" : daysToBeslistermijn < 30 ? "text-amber-500" : "text-gray-900"}`}>
                  {daysToBeslistermijn}d
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(zaak.beslistermijnNaVerdaging || zaak.beslistermijn12Weken)}</p>
              </>
            ) : (
              <p className="text-sm text-gray-300">—</p>
            )}
          </div>
        </div>

        {/* Second row: dates */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Datum ontvangst", value: formatDate(zaak.datumOntvangst) },
            { label: "Datum besluit",   value: formatDate(zaak.datumBesluit)   },
            { label: "Actiedatum",      value: formatDate(zaak.actiedatum)     },
            { label: "Hoorzitting",     value: formatDate(zaak.datumHoorzitting) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
              <p className="text-sm font-semibold text-gray-800">{value || "—"}</p>
            </div>
          ))}
        </div>

        {/* Volgende actie */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Volgende actie</p>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4.5 h-4.5 text-orange-500" viewBox="0 0 18 18" fill="currentColor" width="18" height="18">
                <path d="M9 1a8 8 0 100 16A8 8 0 009 1zm0 13a1 1 0 110-2 1 1 0 010 2zm.5-4.5h-1L8.25 5h1.5L9.5 9.5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{zaak.volgendeActie || "—"}</p>
              {zaak.actiedatum && (
                <p className="text-xs text-gray-400 mt-0.5">Actiedatum: {formatDate(zaak.actiedatum)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Beschikbare acties */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Beschikbare acties</p>
          <WorkflowActions zaak={zaak} onUpdate={applyWorkflow} />
        </div>

        {/* Zaakgegevens collapsible */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowZaakgegevens(!showZaakgegevens)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
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
            <div className="px-4 pb-4 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <EditableField label="Zaaknummer"        value={zaak.zaaknummer}          onChange={(v) => handleFieldChange("zaaknummer", v)} />
                <EditableField label="Bezwaarmaker"      value={zaak.bezwaarmaker}         onChange={(v) => handleFieldChange("bezwaarmaker", v)} />
                <EditableField label="Datum ontvangst"   value={zaak.datumOntvangst}       type="date" onChange={(v) => handleFieldChange("datumOntvangst", v)} />
                <EditableField label="Datum besluit"     value={zaak.datumBesluit}         type="date" onChange={(v) => handleFieldChange("datumBesluit", v)} />
                <EditableField label="Beslistermijn"     value={zaak.beslistermijn12Weken} type="date" onChange={(v) => handleFieldChange("beslistermijn12Weken", v)} />
                <EditableField label="Actiedatum"        value={zaak.actiedatum}           type="date" onChange={(v) => handleFieldChange("actiedatum", v)} />
                <EditableField label="Datum hoorzitting" value={zaak.datumHoorzitting}     type="date" onChange={(v) => handleFieldChange("datumHoorzitting", v)} />
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
                onClick={handleSave}
                className="mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm transition-all"
              >
                Wijzigingen opslaan
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Delete confirmation modal ─────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-gray-900 mb-1">Zaak verwijderen?</h2>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              <span className="font-semibold">{zaak.zaaknummer}</span> — {zaak.bezwaarmaker} wordt permanent verwijderd. Dit kan niet ongedaan worden gemaakt.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { onDelete?.(zaak.id); setShowDeleteConfirm(false); }}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors shadow-sm"
              >
                Ja, verwijderen
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fase modal ────────────────────────────────────────────── */}
      {showFaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} onClick={() => setShowFaseModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-gray-900 mb-1">Fase handmatig wijzigen</h2>
            <p className="text-xs text-gray-400 mb-4">Huidige fase: <span className="font-semibold text-gray-700">{zaak.fase}</span></p>
            <div className="space-y-1.5">
              {FASE_STEPS.map((fase) => {
                const color = FASE_COLORS[fase];
                const active = zaak.fase === fase;
                return (
                  <button
                    key={fase}
                    onClick={() => {
                      applyWorkflow({ fase } as Partial<Case>);
                      setShowFaseModal(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                      active
                        ? `${color.light} ${color.text} ${color.border}`
                        : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <svg className={`w-4 h-4 flex-shrink-0 ${active ? color.text : "text-gray-400"}`} viewBox="0 0 20 20" fill="currentColor">
                      {FASE_ICONS[fase]}
                    </svg>
                    {fase}
                    {active && <span className="ml-auto text-xs font-semibold opacity-60">huidig</span>}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowFaseModal(false)} className="mt-4 w-full py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50 transition-colors">
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* ── Export modal ──────────────────────────────────────────── */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} onClick={() => setShowExportModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Zaak exporteren</h2>
              <button onClick={() => setShowExportModal(false)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <pre className="text-[11px] text-gray-600 bg-gray-50 rounded-xl p-4 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto border border-gray-100">
              {buildExportText()}
            </pre>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCopyExport}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                  copied ? "bg-emerald-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {copied ? "✓ Gekopieerd!" : "Kopieer naar klembord"}
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
              >
                Afdrukken
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Right AI panel ───────────────────────────────────────────────────────────

function RightPanel({ zaak, onUpdate }: { zaak: Case; onUpdate: (u: Partial<Case>) => void }) {
  const { updateCase } = useCases();
  const [showNoteForm, setShowNoteForm]           = useState(false);
  const [noteInput, setNoteInput]                 = useState("");
  const [showCategorieForm, setShowCategorieForm] = useState(false);
  const [categorieSelected, setCategorieSelected] = useState<string | null>(null);
  const [categorieNote, setCategorieNote]         = useState("");
  const [showHelpModal, setShowHelpModal]         = useState(false);
  const [actionChecked, setActionChecked]         = useState(false);
  const [reminderSent, setReminderSent]           = useState(false);
  const [aiMessages, setAiMessages]               = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [aiInput, setAiInput]                     = useState("");
  const [aiLoading, setAiLoading]                 = useState(false);
  const fileInputRef                              = useRef<HTMLInputElement>(null);
  const aiEndRef                                  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActionChecked(false);
    setShowNoteForm(false); setNoteInput("");
    setShowCategorieForm(false); setCategorieSelected(null); setCategorieNote("");
    setAiMessages([]); setAiInput("");
  }, [zaak.id]);

  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const currentFaseColor = FASE_COLORS[zaak.fase] ?? FASE_COLORS.Intake;

  async function sendToAI() {
    const msg = aiInput.trim();
    if (!msg || aiLoading) return;
    const updated = [...aiMessages, { role: "user" as const, text: msg }];
    setAiMessages(updated);
    setAiInput("");
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: aiMessages,
          caseContext: {
            zaaknummer: zaak.zaaknummer,
            bezwaarmaker: zaak.bezwaarmaker,
            fase: zaak.fase,
            volgendeActie: zaak.volgendeActie,
            aantekeningen: zaak.aantekeningen,
          },
        }),
      });
      const data = await res.json();
      setAiMessages([...updated, { role: "ai", text: data.reply ?? data.error ?? "Er is een fout opgetreden." }]);
    } catch {
      setAiMessages([...updated, { role: "ai", text: "Verbindingsfout. Probeer het opnieuw." }]);
    } finally {
      setAiLoading(false);
    }
  }

  function handleReminder() {
    const subject = encodeURIComponent(`Reminder: ${zaak.zaaknummer} – ${zaak.bezwaarmaker}`);
    const body    = encodeURIComponent(`Beste,\n\nHierbij een herinnering betreffende:\n\nZaaknummer: ${zaak.zaaknummer}\nBezwaarmaker: ${zaak.bezwaarmaker}\nFase: ${zaak.fase}\nActie: ${zaak.volgendeActie}\nActiedatum: ${formatDate(zaak.actiedatum)}\n\nMet vriendelijke groet,\nBezwaarPilot`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setReminderSent(true);
    setTimeout(() => setReminderSent(false), 3000);
  }

  function handleNoteSubmit() {
    if (!noteInput.trim()) return;
    const ts      = new Date().toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const newNote = zaak.aantekeningen ? `${zaak.aantekeningen}\n\n[${ts}] ${noteInput.trim()}` : `[${ts}] ${noteInput.trim()}`;
    const updated = { ...zaak, aantekeningen: newNote };
    updateCase(updated);
    onUpdate({ aantekeningen: newNote });
    setNoteInput("");
    setShowNoteForm(false);
  }

  function handleCategorieSubmit() {
    if (!categorieSelected) return;
    const ts      = new Date().toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const entry   = categorieNote.trim()
      ? `[${ts}] Reactie: ${categorieSelected} — ${categorieNote.trim()}`
      : `[${ts}] Reactie: ${categorieSelected}`;
    const newNote = zaak.aantekeningen ? `${zaak.aantekeningen}\n\n${entry}` : entry;
    const updated = { ...zaak, aantekeningen: newNote };
    updateCase(updated);
    onUpdate({ aantekeningen: newNote });
    setCategorieSelected(null);
    setCategorieNote("");
    setShowCategorieForm(false);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const updated = { ...zaak, uploadedBezwaarFileName: file.name };
    updateCase(updated);
    onUpdate({ uploadedBezwaarFileName: file.name });
    e.target.value = "";
  }

  const snelleActies = [
    {
      label: reminderSent ? "E-mail geopend" : "Herinnering naar aanvrager",
      onClick: handleReminder,
      done: reminderSent,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-500",
      icon: <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />,
    },
    {
      label: "Reactie categoriseren",
      onClick: () => { setShowCategorieForm(!showCategorieForm); setShowNoteForm(false); },
      done: showCategorieForm,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-500",
      icon: <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />,
    },
    {
      label: "Notitie toevoegen",
      onClick: () => { setShowNoteForm(!showNoteForm); setShowCategorieForm(false); },
      done: showNoteForm,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-500",
      icon: <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />,
    },
    {
      label: zaak.uploadedBezwaarFileName ? zaak.uploadedBezwaarFileName : "Document uploaden",
      onClick: () => fileInputRef.current?.click(),
      done: !!zaak.uploadedBezwaarFileName,
      iconBg: zaak.uploadedBezwaarFileName ? "bg-emerald-100" : "bg-gray-100",
      iconColor: zaak.uploadedBezwaarFileName ? "text-emerald-500" : "text-gray-500",
      icon: zaak.uploadedBezwaarFileName
        ? <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        : <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />,
    },
  ];

  return (
    <div className="flex flex-col h-full">

      {/* Huidige fase */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Huidige fase</p>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${currentFaseColor.light} ${currentFaseColor.text} border ${currentFaseColor.border}`}>
          {zaak.fase}
        </span>
        {zaak.status && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{zaak.status}</p>}
      </div>

      {/* Actie vereist */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Actie vereist</p>
        <label className="flex items-start gap-2.5 cursor-pointer group" onClick={() => setActionChecked(!actionChecked)}>
          <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
            actionChecked ? "bg-blue-600 border-blue-600" : "border-gray-300 group-hover:border-blue-400"
          }`}>
            {actionChecked && (
              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="currentColor">
                <path fillRule="evenodd" d="M8.5 2.5a.75.75 0 010 1.06l-4 4a.75.75 0 01-1.06 0l-1.5-1.5a.75.75 0 011.06-1.06L4 6l3.47-3.47a.75.75 0 011.03-.03z" />
              </svg>
            )}
          </div>
          <span className={`text-xs leading-relaxed transition-colors ${actionChecked ? "line-through text-gray-400" : "text-gray-700 group-hover:text-gray-900"}`}>
            {zaak.volgendeActie || "—"}
          </span>
        </label>
      </div>

      {/* Snelle acties */}
      <div className="px-4 py-3 flex-1">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Snelle acties</p>
        <div className="space-y-1">
          {snelleActies.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all group text-left ${
                a.done ? "hover:bg-emerald-50" : "hover:bg-gray-50"
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${a.iconBg}`}>
                <svg className={`w-3.5 h-3.5 ${a.iconColor}`} viewBox="0 0 20 20" fill="currentColor">
                  {a.icon}
                </svg>
              </div>
              <span className={`flex-1 text-xs font-medium ${a.done ? "text-emerald-600" : "text-gray-700 group-hover:text-gray-900"}`}>
                {a.label}
              </span>
              <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${a.done ? "text-emerald-400" : "text-gray-300 group-hover:text-gray-500"}`} viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          ))}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.jpg,.png" />
        </div>

        {/* Categorie form */}
        {showCategorieForm && (
          <div className="mt-2 p-3 bg-orange-50 border border-orange-100 rounded-xl">
            <p className="text-[11px] font-semibold text-orange-700 mb-2">Selecteer een categorie</p>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {["Akkoord", "Gedeeltelijk akkoord", "Niet akkoord", "Meer info nodig"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategorieSelected(categorieSelected === cat ? null : cat)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left leading-tight ${
                    categorieSelected === cat
                      ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <textarea
              value={categorieNote}
              onChange={(e) => setCategorieNote(e.target.value)}
              placeholder="Optionele toelichting..."
              className="w-full rounded-lg border border-orange-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 min-h-[48px] resize-none transition-all placeholder:text-gray-400"
            />
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={handleCategorieSubmit}
                disabled={!categorieSelected}
                className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Opslaan
              </button>
              <button onClick={() => { setShowCategorieForm(false); setCategorieSelected(null); setCategorieNote(""); }} className="px-3 py-1.5 rounded-lg text-gray-500 hover:bg-white text-xs transition-colors">
                Annuleren
              </button>
            </div>
          </div>
        )}

        {/* Inline note form */}
        {showNoteForm && (
          <div className="mt-2">
            <textarea
              autoFocus
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Typ uw notitie..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 min-h-[72px] resize-none transition-all"
              onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleNoteSubmit(); }}
            />
            <div className="flex gap-2 mt-1.5">
              <button onClick={handleNoteSubmit} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm">Opslaan</button>
              <button onClick={() => { setShowNoteForm(false); setNoteInput(""); }} className="px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 text-xs transition-colors">Annuleren</button>
            </div>
          </div>
        )}

        {/* Notes preview */}
        {zaak.aantekeningen && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Aantekeningen</p>
            <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed line-clamp-4">{zaak.aantekeningen}</p>
          </div>
        )}
      </div>

      {/* AI Chat */}
      <div className="border-t border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a4 4 0 00-4 4c0 1.49.82 2.79 2.03 3.47L5.5 14h5l-.53-5.53A4 4 0 008 1z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-gray-800">AI Assistent</span>
          </div>
          <button
            onClick={() => setShowHelpModal(true)}
            className="text-[11px] text-blue-500 hover:text-blue-700 font-medium transition-colors"
          >
            Fase-uitleg →
          </button>
        </div>

        {/* Messages */}
        <div className="overflow-y-auto px-4 space-y-2" style={{ maxHeight: "160px", minHeight: "56px" }}>
          {aiMessages.length === 0 && (
            <p className="text-[11px] text-gray-400 leading-relaxed pb-1">
              Stel een vraag, vraag om een conceptbrief, of laat de AI de zaak samenvatten.
            </p>
          )}
          {aiMessages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[92%] px-2.5 py-1.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-700 rounded-bl-sm"
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {aiLoading && (
            <div className="flex justify-start pb-1">
              <div className="bg-gray-100 px-3 py-2 rounded-xl rounded-bl-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={aiEndRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-2.5 border-t border-gray-100 flex-shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendToAI(); } }}
              placeholder="Stel een vraag..."
              rows={1}
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none transition-all placeholder:text-gray-400"
              style={{ maxHeight: "80px" }}
            />
            <button
              onClick={sendToAI}
              disabled={!aiInput.trim() || aiLoading}
              className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Help modal */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowHelpModal(false)}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${currentFaseColor.bg} shadow-sm`}>
                <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Fase: {zaak.fase}</h2>
                <p className="text-xs text-gray-400">Stap-voor-stap uitleg</p>
              </div>
            </div>
            <div className="space-y-2.5 mb-4">
              {(FASE_UITLEG[zaak.fase]?.steps ?? []).map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold text-white ${currentFaseColor.bg}`}>{i + 1}</div>
                  <p className="text-xs text-gray-700 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
            {FASE_UITLEG[zaak.fase]?.tip && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
                <p className="text-xs text-amber-700 leading-relaxed"><span className="font-semibold">Tip: </span>{FASE_UITLEG[zaak.fase].tip}</p>
              </div>
            )}
            <button onClick={() => setShowHelpModal(false)} className="w-full py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition-colors">
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Workflow actions ─────────────────────────────────────────────────────────

type ActionDef = { label: string; variant: "green" | "red" | "blue"; updates: Partial<Case> };

function getActionsForFase(fase: string): ActionDef[] {
  switch (fase) {
    case "Intake":      return [
      { label: "Ontvangstbevestiging verzonden", variant: "green", updates: { status: "Ontvangstbevestiging verzonden", fase: "Informeel", volgendeActie: "Beoordeel informele afhandeling" } },
      { label: "Herstelverzuimbrief verzonden",  variant: "red",   updates: { status: "In afwachting herstel", volgendeActie: "Controleer hersteltermijn" } },
      { label: "Herstel ontvangen",              variant: "blue",  updates: { status: "Herstel ontvangen", fase: "Informeel", volgendeActie: "Beoordeel informele afhandeling" } },
    ];
    case "Informeel":   return [
      { label: "Informeel afgerond",      variant: "green", updates: { status: "Informele afhandeling afgerond", volgendeActie: "Verzoek intrekking bezwaar versturen" } },
      { label: "Informeel niet geslaagd", variant: "red",   updates: { status: "Zitting plannen", fase: "Zitting", volgendeActie: "Plan hoorzitting" } },
      { label: "Zitting plannen",         variant: "blue",  updates: { fase: "Hoorzitting", volgendeActie: "Hoorzitting plannen" } },
    ];
    case "Zitting":
    case "Hoorzitting": return [
      { label: "Zitting gepland",     variant: "green", updates: { status: "Zitting gepland", volgendeActie: "Uitnodigingen versturen" } },
      { label: "Hoorzitting geweest", variant: "blue",  updates: { status: "Advies uitwerken", fase: "Advies", volgendeActie: "Conceptadvies maken" } },
    ];
    case "Advies":      return [
      { label: "Advies verzonden", variant: "green", updates: { status: "Advies verzonden", fase: "Afronding", adviesUitgebracht: "Ja", datumAdvies: todayISO(), volgendeActie: "Wachten op beslissing" } as Partial<Case> },
    ];
    case "Afronding":   return [
      { label: "Beslissing ontvangen", variant: "green", updates: { beslissingOpBezwaar: "Ja" as const, datumBeslissingOpBezwaar: todayISO(), volgendeActie: "Zaak sluiten" } },
      { label: "Zaak afgerond",        variant: "blue",  updates: { status: "Afgerond", volgendeActie: "Geen" } },
    ];
    default: return [];
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
  function handleClick() { onUpdate(action.updates); setClicked(true); setTimeout(() => setClicked(false), 2000); }

  const styles = {
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
        {clicked ? <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor"><path fillRule="evenodd" d="M10.28 3.28a.75.75 0 010 1.06l-5 5a.75.75 0 01-1.06 0l-2-2a.75.75 0 011.06-1.06L4.75 7.69l4.47-4.41a.75.75 0 011.06 0z" /></svg> : icons[action.variant]}
      </div>
      {action.label}
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FaseBadge({ fase, small, dark }: { fase: string; small?: boolean; dark?: boolean }) {
  const light: Record<string, string> = {
    Intake:      "bg-blue-100    text-blue-700",
    Informeel:   "bg-orange-100  text-orange-700",
    Zitting:     "bg-violet-100  text-violet-700",
    Hoorzitting: "bg-purple-100  text-purple-700",
    Advies:      "bg-emerald-100 text-emerald-700",
    Afronding:   "bg-gray-100    text-gray-600",
  };
  const darkCls: Record<string, string> = {
    Intake:      "bg-blue-500/20    text-blue-300",
    Informeel:   "bg-orange-500/20  text-orange-300",
    Zitting:     "bg-violet-500/20  text-violet-300",
    Hoorzitting: "bg-purple-500/20  text-purple-300",
    Advies:      "bg-emerald-500/20 text-emerald-300",
    Afronding:   "bg-gray-500/20    text-gray-400",
  };
  const cls = dark ? (darkCls[fase] ?? "bg-gray-500/20 text-gray-400") : (light[fase] ?? "bg-gray-100 text-gray-600");
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${cls} ${small ? "text-[10px] px-1.5 py-px" : "text-xs px-2 py-0.5"}`}>
      {fase}
    </span>
  );
}

function EditableField({ label, value, type = "text", onChange }: { label: string; value: string; type?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      <input
        type={type}
        className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-white"
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
