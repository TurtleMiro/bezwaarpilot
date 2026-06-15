"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CasesProvider, useCases } from "@/lib/CasesContext";
import { Case } from "@/lib/types";
import { formatDate, isOverdue, isDueSoon, todayISO, addWeeks, addDays } from "@/lib/dateUtils";
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
  { key: "Intake",       label: "Intake",                bg: "bg-blue-500",    pill: "bg-blue-600 text-white",    inactive: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"        },
  { key: "Informeel",   label: "Inform. afhandeling",  bg: "bg-orange-500",  pill: "bg-orange-500 text-white",  inactive: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"  },
  { key: "Hoorzitting", label: "Hoorzitting",           bg: "bg-purple-500",  pill: "bg-purple-600 text-white",  inactive: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"  },
  { key: "Advies",      label: "Advies",                bg: "bg-emerald-500", pill: "bg-emerald-600 text-white", inactive: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
  { key: "Afronding",   label: "Afronding",             bg: "bg-slate-500",   pill: "bg-slate-600 text-white",   inactive: "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"    },
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
      <header className="flex items-center h-20 bg-white/95 backdrop-blur-sm border-b border-gray-200/80 z-20 flex-shrink-0 px-4 gap-3 shadow-sm">

        {/* Logo — matches sidebar width */}
        <div className="flex items-center gap-2.5 flex-shrink-0 w-52">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="BezwaarPilot" className="w-7 h-7 rounded-md object-cover" />
          <span className="font-bold text-gray-900 text-sm tracking-tight">BezwaarPilot</span>
        </div>

        {/* Phase filter tabs — large blocks matching mockup */}
        <div className="hidden md:flex flex-1 self-stretch items-stretch gap-2 py-2">
          {FASE_TABS.map((tab) => {
            const active = faseFilter === tab.key;
            const count  = faseCounts[tab.key] ?? 0;
            return (
              <button
                key={tab.key}
                onClick={() => { setFaseFilter(active ? "Alle" : tab.key); setQuickFilter(null); setMobileShowDetail(false); }}
                className={`flex-1 flex items-center gap-3 px-4 rounded-2xl text-sm font-bold transition-all duration-200 active:scale-[0.97] border ${
                  active
                    ? `${tab.pill} border-transparent shadow-lg`
                    : `${tab.inactive} shadow-sm`
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? "bg-white/20" : "bg-white/80 shadow-sm"}`}>
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                    {FASE_ICONS[tab.key]}
                  </svg>
                </div>
                <span className="leading-tight">{tab.label}</span>
                <span className={`ml-auto text-xs font-bold min-w-[24px] h-6 flex items-center justify-center rounded-full px-1.5 flex-shrink-0 ${
                  active ? "bg-white/30 text-white" : "bg-white text-gray-700 shadow-sm"
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Right: bell + avatar */}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
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
            {filtered.map((c, idx) => {
              const days    = daysUntil(c.actiedatum);
              const overdue = days !== null && days < 0;
              const soon    = days !== null && days >= 0 && days <= 2;
              const active  = selectedId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelectedId(c.id); setMobileShowDetail(true); }}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className={`animate-fadeUp w-full text-left px-3 py-3 border-b border-white/5 transition-all duration-200 relative ${
                    active ? "bg-white/12" : "hover:bg-white/7"
                  }`}
                >
                  <div className={`absolute left-0 top-2 bottom-2 rounded-r-full transition-all duration-300 ${
                    overdue ? "w-1 bg-red-500" : soon ? "w-1 bg-amber-400" : active ? "w-1 bg-blue-400" : "w-0 bg-transparent"
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
  const [uploadStatus, setUploadStatus]           = useState<"idle"|"loading"|"done"|"error">("idle");
  const [uploadResult, setUploadResult]           = useState<Record<string, unknown> | null>(null);
  const [uploadFileName, setUploadFileName]       = useState<string | null>(null);
  const [showOntvangst, setShowOntvangst]         = useState(false);
  const uploadInputRef                            = useRef<HTMLInputElement>(null);
  const meerActiesRef                             = useRef<HTMLDivElement>(null);
  const lastInitialRef                            = useRef(JSON.stringify(initialZaak));

  useEffect(() => {
    setZaak(initialZaak);
    lastInitialRef.current = JSON.stringify(initialZaak);
    setShowZaakgegevens(false);
    setShowMeerActies(false);
  }, [initialZaak.id]); // eslint-disable-line

  // Sync display when AI or another external source updates the case
  useEffect(() => {
    const str = JSON.stringify(initialZaak);
    if (str !== lastInitialRef.current) {
      lastInitialRef.current = str;
      setZaak(initialZaak);
    }
  }, [initialZaak]); // eslint-disable-line

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

  async function handleBezwaarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadFileName(file.name);
    setUploadStatus("loading");
    setUploadResult(null);
    setShowOntvangst(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract-bezwaar", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setUploadStatus("error"); return; }
      setUploadResult(json.extracted);
      setUploadStatus("done");
    } catch {
      setUploadStatus("error");
    }
  }

  function buildOntvangstbrief(): string {
    return `Aan: ${zaak.bezwaarmaker}
Betreft: Bevestiging ontvangst bezwaarschrift – ${zaak.zaaknummer}
Datum: ${formatDate(todayISO())}

Geachte heer/mevrouw ${zaak.bezwaarmaker},

Hierbij bevestigen wij de ontvangst van uw bezwaarschrift d.d. ${formatDate(zaak.datumOntvangst)}.

Uw bezwaar heeft betrekking op het besluit van ${formatDate(zaak.datumBesluit) || "[datum besluit]"}.

De beslistermijn bedraagt 12 weken vanaf het einde van de bezwaartermijn, derhalve tot ${formatDate(zaak.beslistermijn12Weken) || "[beslistermijn]"}.

Wij zullen uw bezwaarschrift in behandeling nemen. Mocht u vragen hebben, neemt u dan contact met ons op.

Met vriendelijke groet,

[Naam secretaris]
Commissie Bezwaarschriften`;
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
  const actieOverdue        = daysToActie !== null && daysToActie < 0;
  const actieSoon           = daysToActie !== null && daysToActie >= 0 && daysToActie <= 2;

  return (
    <div className="min-h-full">

      {/* ── Sticky header ──────────────────────────────────────────── */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200/80 px-5 pt-4 pb-4 sticky top-0 z-10 shadow-sm">

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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm active:scale-[0.97] transition-all duration-150 font-medium whitespace-nowrap shadow-sm"
            >
              Meer acties
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showMeerActies ? "rotate-180" : ""}`} viewBox="0 0 14 14" fill="none">
                <path d="M3.5 6l3.5 3.5L10.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            {showMeerActies && (
              <div className="animate-slideDown absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl border border-gray-200 shadow-xl z-30 py-1 overflow-hidden">
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

        {/* Bezwaarschrift uploaden */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-blue-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 10.5v1.75A1.75 1.75 0 003.75 14h8.5A1.75 1.75 0 0014 12.25V10.5M8 2.5v7M5.5 5L8 2.5 10.5 5" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-gray-800">Bezwaarschrift controleren</span>
              {uploadFileName && uploadStatus !== "loading" && (
                <span className="text-xs text-gray-400 truncate max-w-[140px]">{uploadFileName}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {uploadStatus === "done" && (
                <button
                  onClick={() => setShowOntvangst(!showOntvangst)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {showOntvangst ? "Verberg brief" : "Ontvangstbevestiging"}
                </button>
              )}
              <button
                onClick={() => uploadInputRef.current?.click()}
                disabled={uploadStatus === "loading"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 active:scale-[0.97] transition-all shadow-sm disabled:opacity-50"
              >
                {uploadStatus === "loading" ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" d="M7 1.5v7M4.5 4L7 1.5 9.5 4M2.5 10v1.5A1.5 1.5 0 004 13h6a1.5 1.5 0 001.5-1.5V10" />
                  </svg>
                )}
                {uploadStatus === "loading" ? "Analyseren…" : uploadStatus === "done" ? "Opnieuw" : "Upload"}
              </button>
              <input ref={uploadInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleBezwaarUpload} />
            </div>
          </div>

          {/* Results */}
          {uploadStatus === "error" && (
            <div className="px-4 pb-3">
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">Analyse mislukt — controleer het bestandstype (PDF of DOCX) en probeer opnieuw.</p>
            </div>
          )}

          {uploadStatus === "done" && uploadResult && (() => {
            const r = uploadResult as {
              grondenAanwezig?: boolean; ondertekeningAanwezig?: boolean;
              adresAanwezig?: boolean; dagtekeningAanwezig?: boolean;
              ontbrekendeVelden?: string[]; opmerkingen?: string | null;
            };
            const checks = [
              { label: "Naam & adres",         ok: r.adresAanwezig },
              { label: "Dagtekening",           ok: r.dagtekeningAanwezig },
              { label: "Gronden van bezwaar",   ok: r.grondenAanwezig },
              { label: "Ondertekening",         ok: r.ondertekeningAanwezig },
            ];
            const missing = checks.filter(c => !c.ok);
            const allOk = missing.length === 0;
            return (
              <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${allOk ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
                  {allOk
                    ? <><svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="currentColor"><path fillRule="evenodd" d="M12.5 3.5a.75.75 0 010 1.06l-6.25 6.25a.75.75 0 01-1.06 0L2 7.56A.75.75 0 113.06 6.5l2.69 2.69L11.44 3.5a.75.75 0 011.06 0z"/></svg>Bezwaarschrift voldoet aan art. 6:5 Awb</>
                    : <><svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="currentColor"><path d="M7 1a6 6 0 100 12A6 6 0 007 1zm0 9a.75.75 0 110-1.5.75.75 0 010 1.5zM7.5 7.25h-1L6.25 4h1.5L7.5 7.25z"/></svg>Ontbreekt: {missing.map(c => c.label).join(", ")}</>
                  }
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {checks.map(c => (
                    <div key={c.label} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg ${c.ok ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50"}`}>
                      <span className="text-[10px]">{c.ok ? "✓" : "✗"}</span>
                      {c.label}
                    </div>
                  ))}
                </div>
                {r.opmerkingen && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">{r.opmerkingen}</p>
                )}

                {/* Ontvangstbevestiging */}
                {showOntvangst && (() => {
                  const brief = buildOntvangstbrief();
                  const mailBody = encodeURIComponent(brief);
                  const mailSubject = encodeURIComponent(`Bevestiging ontvangst bezwaarschrift – ${zaak.zaaknummer}`);
                  return (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="text-xs font-semibold text-gray-600">Ontvangstbevestiging</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigator.clipboard.writeText(brief)}
                            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            Kopieer
                          </button>
                          <a
                            href={`mailto:?subject=${mailSubject}&body=${mailBody}`}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            Open in Outlook →
                          </a>
                        </div>
                      </div>
                      <textarea
                        readOnly
                        className="w-full text-xs font-mono p-3 text-gray-700 bg-white resize-none focus:outline-none"
                        rows={8}
                        value={brief}
                      />
                    </div>
                  );
                })()}
              </div>
            );
          })()}
        </div>

        {/* Top info cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Huidige fase */}
          <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
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

          <DeadlineCard label="Actiedatum" dateStr={zaak.actiedatum} />
          <DeadlineCard label="Beslistermijn" dateStr={zaak.beslistermijnNaVerdaging || zaak.beslistermijn12Weken} />
        </div>

        {/* Second row: dates */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Datum ontvangst", value: formatDate(zaak.datumOntvangst) },
            { label: "Datum besluit",   value: formatDate(zaak.datumBesluit)   },
            { label: "Hoorzitting",     value: formatDate(zaak.datumHoorzitting) },
            ...(zaak.hersteltermijn ? [{ label: "Hersteltermijn", value: formatDate(zaak.hersteltermijn) }] : []),
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
              <p className="text-sm font-semibold text-gray-800">{value || "—"}</p>
            </div>
          ))}
        </div>

        {/* Volgende actie */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
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
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Beschikbare acties</p>
          <WorkflowActions zaak={zaak} onUpdate={applyWorkflow} />
        </div>

        {/* Phase-specific content */}
        <PhaseContent zaak={zaak} onUpdate={applyWorkflow} />

        {/* Document generator */}
        <DocumentGenerator zaak={zaak} onUpdate={applyWorkflow} />

        {/* Zaakgegevens collapsible */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowZaakgegevens(!showZaakgegevens)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
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
          <div className="animate-fadeUp bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
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
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 active:scale-[0.97] transition-all shadow-sm"
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
          <div className="animate-fadeUp bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
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
          <div className="animate-fadeUp bg-white rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
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
  const [chatHeight, setChatHeight]               = useState(240);
  const [pendingToolCall, setPendingToolCall]     = useState<{ name: string; args: Record<string, string> } | null>(null);
  const fileInputRef                              = useRef<HTMLInputElement>(null);
  const aiEndRef                                  = useRef<HTMLDivElement>(null);
  const chatHistoriesRef                          = useRef<Map<string, { role: "user" | "ai"; text: string }[]>>(new Map());
  const prevCaseIdRef                             = useRef<string>(zaak.id);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = chatHeight;
    function onMove(ev: MouseEvent) {
      setChatHeight(Math.max(120, Math.min(520, startH + (startY - ev.clientY))));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  useEffect(() => {
    setActionChecked(false);
    setShowNoteForm(false); setNoteInput("");
    setShowCategorieForm(false); setCategorieSelected(null); setCategorieNote("");
    // Save chat history for the case we're leaving, restore for the new one
    chatHistoriesRef.current.set(prevCaseIdRef.current, aiMessages);
    prevCaseIdRef.current = zaak.id;
    setAiMessages(chatHistoriesRef.current.get(zaak.id) ?? []);
    setAiInput(""); setPendingToolCall(null);
  }, [zaak.id]); // eslint-disable-line

  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const currentFaseColor = FASE_COLORS[zaak.fase] ?? FASE_COLORS.Intake;

  const FIELD_LABELS: Record<string, string> = {
    actiedatum: "Actiedatum", volgendeActie: "Volgende actie", fase: "Fase",
    datumHoorzitting: "Datum hoorzitting", datumBesluit: "Datum besluit",
    datumOntvangst: "Datum ontvangst", status: "Status",
  };

  function formatPendingValue(field: string, value: string) {
    if (field.toLowerCase().includes("datum") && /^\d{4}-\d{2}-\d{2}$/.test(value))
      return formatDate(value);
    return value;
  }

  function applyToolCall() {
    if (!pendingToolCall) return;
    const ts = new Date().toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    if (pendingToolCall.name === "add_note") {
      const newNote = zaak.aantekeningen
        ? `${zaak.aantekeningen}\n\n[${ts}] ${pendingToolCall.args.note}`
        : `[${ts}] ${pendingToolCall.args.note}`;
      const updated = { ...zaak, aantekeningen: newNote };
      updateCase(updated);
      onUpdate({ aantekeningen: newNote });
    } else if (pendingToolCall.name === "update_field") {
      const updated = { ...zaak, [pendingToolCall.args.field]: pendingToolCall.args.value };
      updateCase(updated);
      onUpdate({ [pendingToolCall.args.field]: pendingToolCall.args.value });
    }
    setAiMessages((prev) => [...prev, { role: "ai", text: "✓ Wijziging toegepast." }]);
    setPendingToolCall(null);
  }

  function getRuleBasedResponse(msg: string): string | null {
    const lower = msg.toLowerCase().trim();
    if ((lower.includes("vat") && lower.includes("samen")) || lower === "samenvatting") {
      return `📋 Zaaksamenvatting\n\nZaaknummer: ${zaak.zaaknummer}\nBezwaarmaker: ${zaak.bezwaarmaker}\nFase: ${zaak.fase}\nStatus: ${zaak.status || "In behandeling"}\n\nDatum besluit: ${formatDate(zaak.datumBesluit) || "—"}\nDatum ontvangst: ${formatDate(zaak.datumOntvangst) || "—"}\nBeslistermijn: ${formatDate(zaak.beslistermijnNaVerdaging || zaak.beslistermijn12Weken) || "—"}\n\nVolgende actie: ${zaak.volgendeActie || "—"}\nActiedatum: ${formatDate(zaak.actiedatum) || "—"}${zaak.aantekeningen ? `\n\nAantekeningen:\n${zaak.aantekeningen.slice(0, 200)}${zaak.aantekeningen.length > 200 ? "..." : ""}` : ""}`;
    }
    if (lower.includes("volgende stap") || lower.includes("wat nu") || lower.includes("next step")) {
      return `🔄 Volgende stap\n\nDe zaak bevindt zich in de fase "${zaak.fase}".\n\nVolgende actie: ${zaak.volgendeActie || "Geen volgende actie bekend"}\n\n${zaak.actiedatum ? `Actiedatum: ${formatDate(zaak.actiedatum)}` : ""}`;
    }
    if (lower.includes("deadline") || lower.includes("termijn") || lower.includes("beslistermijn")) {
      const bt = zaak.beslistermijnNaVerdaging || zaak.beslistermijn12Weken;
      return `⏰ Termijnen\n\nBeslistermijn: ${formatDate(bt) || "Niet bekend"}\nActiedatum: ${formatDate(zaak.actiedatum) || "Niet bekend"}${zaak.hersteltermijn ? `\nHersteltermijn: ${formatDate(zaak.hersteltermijn)}` : ""}`;
    }
    if (lower.includes("fase") || lower.includes("status")) {
      return `📍 Huidige fase: ${zaak.fase}\nStatus: ${zaak.status || "In behandeling"}\n\nVolgende actie: ${zaak.volgendeActie || "—"}`;
    }
    return null;
  }

  async function sendToAI() {
    const msg = aiInput.trim();
    if (!msg || aiLoading) return;
    setPendingToolCall(null);
    const updated = [...aiMessages, { role: "user" as const, text: msg }];
    setAiMessages(updated);
    setAiInput("");

    const localReply = getRuleBasedResponse(msg);
    if (localReply) {
      setAiMessages([...updated, { role: "ai", text: localReply }]);
      return;
    }

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
      if (data.toolCall) {
        setPendingToolCall(data.toolCall);
        setAiMessages([...updated, { role: "ai", text: data.reply }]);
      } else {
        setAiMessages([...updated, { role: "ai", text: data.reply ?? data.error ?? "Er is een fout opgetreden." }]);
      }
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
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-150 group text-left active:scale-[0.98] ${
                a.done ? "hover:bg-emerald-50 hover:shadow-sm" : "hover:bg-gray-50 hover:shadow-sm"
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
        {/* Resize handle */}
        <div
          onMouseDown={startResize}
          className="h-3 flex items-center justify-center cursor-row-resize hover:bg-blue-50 transition-colors group flex-shrink-0"
          title="Slepen om formaat aan te passen"
        >
          <div className="w-8 h-0.5 bg-gray-200 group-hover:bg-blue-300 rounded-full transition-colors" />
        </div>
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
        <div className="overflow-y-auto px-4 space-y-2" style={{ height: chatHeight + "px" }}>
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

        {/* Confirmation card */}
        {pendingToolCall && (
          <div className="animate-fadeUp mx-3 mb-2 p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex-shrink-0">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-4 h-4 rounded-md bg-indigo-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M7.5 1.5L6 3 7 4l1.5-1.5a.7.7 0 000-1L8 1a.7.7 0 00-1 0zM5.5 3.5l-3 3L2 8.5l2-.5 3-3-1-1z" />
                </svg>
              </div>
              <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Voorgestelde wijziging</p>
            </div>
            <p className="text-[11px] text-indigo-500 mb-2">
              Zaak: <span className="font-semibold text-indigo-700">{zaak.zaaknummer}</span> — {zaak.bezwaarmaker}
            </p>

            {pendingToolCall.name === "update_field" && (
              <div className="mb-2.5 bg-white rounded-xl border border-indigo-100 px-3 py-2">
                <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider mb-0.5">
                  {FIELD_LABELS[pendingToolCall.args.field] ?? pendingToolCall.args.field}
                </p>
                <p className="text-xs font-semibold text-indigo-900">
                  {formatPendingValue(pendingToolCall.args.field, pendingToolCall.args.value)}
                </p>
              </div>
            )}

            {pendingToolCall.name === "add_note" && (
              <div className="mb-2.5 bg-white rounded-xl border border-indigo-100 px-3 py-2">
                <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider mb-0.5">Toe te voegen notitie</p>
                <p className="text-xs text-indigo-900 leading-relaxed line-clamp-3">{pendingToolCall.args.note}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={applyToolCall}
                className="flex-1 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 active:scale-[0.97] transition-all shadow-sm"
              >
                Toepassen
              </button>
              <button
                onClick={() => { setPendingToolCall(null); setAiMessages((prev) => [...prev, { role: "ai", text: "Wijziging geannuleerd." }]); }}
                className="flex-1 py-1.5 rounded-xl border border-indigo-200 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 active:scale-[0.97] transition-all"
              >
                Annuleren
              </button>
            </div>
          </div>
        )}

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
          <div className="animate-fadeUp bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
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

// ─── Document Generator ───────────────────────────────────────────────────────

type DocType = "ontvangstbevestiging" | "herstelverzuimbrief" | "reminder_vakafdeling" | "verzoek_intrekking" | "uitnodiging_hoorzitting" | "conceptadvies";

function generateDocumentText(type: DocType, zaak: Case): string {
  switch (type) {
    case "ontvangstbevestiging":
      return `Geachte heer, mevrouw,\n\nUw bezwaarschrift is in goede orde ontvangen. Uw bezwaarschrift is gericht tegen het besluit van ${formatDate(zaak.datumBesluit)}, inhoudende ${zaak.omschrijvingBesluit || "[omschrijving besluit]"}.\n\nUw bezwaarschrift is voor behandeling in handen gesteld van de algemene commissie bezwaarschriften.\n\nOp grond van artikel 7:10, eerste lid, van de Algemene wet bestuursrecht dient op uw bezwaarschrift binnen 12 weken te worden beslist. De beslissing op uw bezwaarschrift wordt op grond van artikel 7:10, derde lid, van de Algemene wet bestuursrecht voor ten hoogste zes weken verdaagd.\n\nU ontvangt te zijner tijd nadere informatie over het verdere verloop van de bezwaarprocedure.\n\nMet vriendelijke groet,\n\n[Naam secretaris]\nCommissie Bezwaarschriften`;
    case "herstelverzuimbrief":
      return `Geachte heer, mevrouw,\n\nUw bezwaarschrift is ontvangen. Het bezwaarschrift voldoet op dit moment niet aan de vereisten van artikel 6:5 van de Algemene wet bestuursrecht.\n\nHet volgende gebrek is geconstateerd:\n[Geef hier het specifieke gebrek aan]\n\nIk bied u de gelegenheid dit gebrek binnen twee weken na verzending van deze brief te herstellen. Indien u het gebrek niet binnen de gestelde termijn herstelt, kan uw bezwaarschrift niet-ontvankelijk worden verklaard.\n\nMet vriendelijke groet,\n\n[Naam secretaris]\nCommissie Bezwaarschriften`;
    case "reminder_vakafdeling":
      return `Beste collega,\n\nIk wil graag informeren naar de stand van zaken van de informele afhandeling in zaak ${zaak.zaaknummer} van ${zaak.bezwaarmaker}.\n\nKun je aangeven of informele afhandeling mogelijk is of inmiddels is geslaagd?\n\nMet vriendelijke groet,\n\n[Naam secretaris]\nCommissie Bezwaarschriften`;
    case "verzoek_intrekking":
      return `Geachte heer, mevrouw,\n\nIk heb begrepen dat er mogelijk overeenstemming is bereikt over de informele afhandeling van uw bezwaar.\n\nIndien u uw bezwaar niet langer wenst voort te zetten, verzoek ik u dit schriftelijk te bevestigen door uw bezwaar in te trekken.\n\nMet vriendelijke groet,\n\n[Naam secretaris]\nCommissie Bezwaarschriften`;
    case "uitnodiging_hoorzitting":
      return `Geachte heer, mevrouw,\n\nHierbij nodig ik u uit voor de hoorzitting van de algemene commissie bezwaarschriften.\n\nDatum: ${formatDate(zaak.datumHoorzitting) || "[datum in te vullen]"}\nTijdstip: ${zaak.datumHoorzittingTijd || "[tijdstip in te vullen]"}\nLocatie: ${zaak.locatieHoorzitting || "[locatie in te vullen]"}\n\nTijdens de hoorzitting krijgt u de gelegenheid uw bezwaren mondeling toe te lichten.\n\nMet vriendelijke groet,\n\n[Naam secretaris]\nCommissie Bezwaarschriften`;
    case "conceptadvies":
      return `CONCEPTADVIES\nCommissie Bezwaarschriften\n\nZaaknummer: ${zaak.zaaknummer}\nBezwaarmaker: ${zaak.bezwaarmaker}\nDatum advies: ${formatDate(todayISO())}\n\n1. INLEIDING\n\nOp ${formatDate(zaak.datumOntvangst)} heeft de commissie een bezwaarschrift ontvangen van ${zaak.bezwaarmaker}. Het bezwaar is gericht tegen het besluit van ${formatDate(zaak.datumBesluit)}.\n\n2. PROCEDUREVERLOOP\n\nHet bezwaarschrift is op ${formatDate(zaak.datumOntvangst)} ontvangen. ${zaak.datumHoorzitting ? `Op ${formatDate(zaak.datumHoorzitting)} heeft een hoorzitting plaatsgevonden.` : "Er heeft nog geen hoorzitting plaatsgevonden."}\n\n3. ONTVANKELIJKHEID\n\n[De commissie dient te beoordelen of het bezwaarschrift tijdig is ingediend en aan de formele vereisten voldoet.]\n\nDe bezwaartermijn eindigde op ${formatDate(zaak.einddatumBezwaartermijn) || "[datum]"}. Het bezwaarschrift is ${zaak.datumOntvangst && zaak.einddatumBezwaartermijn && zaak.datumOntvangst <= zaak.einddatumBezwaartermijn ? "tijdig" : "[tijdig/te laat]"} ingediend.\n\n[Verdere inhoudelijke beoordeling dient door de jurist te worden ingevuld.]`;
  }
}

function DocumentGenerator({ zaak, onUpdate }: { zaak: Case; onUpdate: (u: Partial<Case>) => void }) {
  const [openDoc, setOpenDoc] = useState<DocType | null>(null);
  const [texts, setTexts] = useState<Partial<Record<DocType, string>>>({});
  const [copied, setCopied] = useState<DocType | null>(null);
  const [saved, setSaved] = useState<DocType | null>(null);

  const docs: { key: DocType; label: string }[] = [
    { key: "ontvangstbevestiging",    label: "Ontvangstbevestiging" },
    { key: "herstelverzuimbrief",     label: "Herstelverzuimbrief" },
    { key: "reminder_vakafdeling",    label: "Reminder vakafdeling" },
    { key: "verzoek_intrekking",      label: "Verzoek intrekking bezwaar" },
    { key: "uitnodiging_hoorzitting", label: "Uitnodiging hoorzitting" },
    { key: "conceptadvies",           label: "Conceptadvies" },
  ];

  function handleGenerate(key: DocType) {
    setTexts((prev) => ({ ...prev, [key]: generateDocumentText(key, zaak) }));
    setOpenDoc(key);
  }

  function handleCopy(key: DocType) {
    navigator.clipboard.writeText(texts[key] ?? "");
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleSave(key: DocType) {
    onUpdate({ savedDocuments: { ...(zaak.savedDocuments ?? {}), [key]: texts[key] ?? "" } });
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="none">
            <path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M9 2v3h3M6 9h4M6 11h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span className="text-sm font-semibold text-gray-700">Documentgenerator</span>
        </div>
        {openDoc && <button onClick={() => setOpenDoc(null)} className="text-xs text-gray-400 hover:text-gray-600">← Terug</button>}
      </div>
      {!openDoc ? (
        <div className="p-4 grid grid-cols-2 gap-2">
          {docs.map(({ key, label }) => (
            <button key={key} onClick={() => handleGenerate(key)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all text-left">
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                <path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              {label}
              {zaak.savedDocuments?.[key] && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500">{docs.find(d => d.key === openDoc)?.label}</p>
          <textarea
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-y bg-gray-50 leading-relaxed"
            rows={14}
            value={texts[openDoc] ?? ""}
            onChange={(e) => setTexts((prev) => ({ ...prev, [openDoc!]: e.target.value }))}
          />
          <div className="flex gap-2">
            <button onClick={() => handleCopy(openDoc)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${copied === openDoc ? "bg-emerald-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
              {copied === openDoc ? "✓ Gekopieerd!" : "Tekst kopiëren"}
            </button>
            <button onClick={() => handleSave(openDoc)}
              className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all ${saved === openDoc ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
              {saved === openDoc ? "✓ Opgeslagen!" : "Opslaan in zaak"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Phase-specific content ───────────────────────────────────────────────────

function PhaseContent({ zaak, onUpdate }: { zaak: Case; onUpdate: (u: Partial<Case>) => void }) {
  if (zaak.fase === "Intake") return <IntakePhaseContent zaak={zaak} onUpdate={onUpdate} />;
  if (zaak.fase === "Hoorzitting" || zaak.fase === "Zitting") return <HoorzittingPhaseContent zaak={zaak} onUpdate={onUpdate} />;
  if (zaak.fase === "Advies") return <AdviesPhaseContent zaak={zaak} onUpdate={onUpdate} />;
  if (zaak.fase === "Afronding") return <AfrondingPhaseContent zaak={zaak} onUpdate={onUpdate} />;
  return null;
}

function IntakePhaseContent({ zaak, onUpdate }: { zaak: Case; onUpdate: (u: Partial<Case>) => void }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(!!zaak.intakeKaartGegenereerd);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setAnalyzeError(null); }
  }

  async function analyzeWithAI() {
    if (!selectedFile) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/extract-bezwaar", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) { setAnalyzeError(json.error ?? "Analyse mislukt."); return; }

      const e = json.extracted;
      onUpdate({
        uploadedBezwaarFileName: selectedFile.name,
        intakeKaartGegenereerd: true,
        bezwaarmaker:          e.bezwaarmaker     ?? zaak.bezwaarmaker,
        gemachtigde:           e.gemachtigde      ?? zaak.gemachtigde,
        omschrijvingBesluit:   e.omschrijvingBesluit ?? zaak.omschrijvingBesluit,
        typeBesluit:           e.typeBesluit      ?? zaak.typeBesluit,
        datumBesluit:          e.datumBesluit     ?? zaak.datumBesluit,
        datumOntvangst:        e.datumBezwaarschrift ?? zaak.datumOntvangst,
        grondenAanwezig:       e.grondenAanwezig       ? "ja" : "nee",
        ondertekeningAanwezig: e.ondertekeningAanwezig ? "ja" : "nee",
        adresAanwezig:         e.adresAanwezig         ? "ja" : "nee",
        dagtekeningAanwezig:   e.dagtekeningAanwezig   ? "ja" : "nee",
      });
      setShowCard(true);
    } catch {
      setAnalyzeError("Verbindingsfout. Controleer uw internetverbinding.");
    } finally {
      setAnalyzing(false);
    }
  }

  const requiredFieldsComplete =
    !!zaak.bezwaarmaker && !!zaak.datumBesluit && !!zaak.datumOntvangst &&
    zaak.grondenAanwezig === "ja" && zaak.ondertekeningAanwezig === "ja" &&
    zaak.adresAanwezig === "ja" && zaak.dagtekeningAanwezig === "ja";

  const missingItems = [
    !zaak.bezwaarmaker && "Naam bezwaarmaker",
    !zaak.datumOntvangst && "Datum ontvangst",
    !zaak.datumBesluit && "Datum besluit",
    zaak.grondenAanwezig !== "ja" && "Gronden van bezwaar",
    zaak.ondertekeningAanwezig !== "ja" && "Ondertekening",
    zaak.adresAanwezig !== "ja" && "Adres indiener",
    zaak.dagtekeningAanwezig !== "ja" && "Dagtekening",
  ].filter(Boolean) as string[];

  const hasFile = selectedFile || zaak.uploadedBezwaarFileName;

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Bezwaarschrift analyseren</p>
        <div className="space-y-3">
          <label className={`flex items-center gap-3 w-full h-16 border-2 border-dashed rounded-xl cursor-pointer transition-all px-4 ${selectedFile ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50 hover:border-blue-300"}`}>
            <svg className={`w-5 h-5 flex-shrink-0 ${selectedFile ? "text-blue-400" : "text-gray-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <div className="min-w-0">
              <p className={`text-xs font-medium truncate ${selectedFile ? "text-blue-700" : "text-gray-400"}`}>
                {selectedFile?.name ?? zaak.uploadedBezwaarFileName ?? "Klik om bezwaarschrift te uploaden"}
              </p>
              <p className="text-[10px] text-gray-400">PDF of DOCX</p>
            </div>
            <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx" />
          </label>

          <button
            onClick={analyzeWithAI}
            disabled={!hasFile || analyzing}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                Analyseren met AI...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a4 4 0 00-4 4c0 1.49.82 2.79 2.03 3.47L5.5 14h5l-.53-5.53A4 4 0 008 1z" />
                </svg>
                {zaak.intakeKaartGegenereerd ? "Opnieuw analyseren" : "Analyseren met AI (Groq)"}
              </>
            )}
          </button>

          {analyzeError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <p className="text-xs font-semibold text-red-700 mb-0.5">Analyse mislukt</p>
              <p className="text-xs text-red-600">{analyzeError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Intake card */}
      {(showCard || zaak.intakeKaartGegenereerd) && (
        <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Intakekaart</p>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">AI-extractie</span>
          </div>

          {/* Missing fields alert */}
          {missingItems.length > 0 && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <p className="text-xs font-bold text-red-700 mb-1.5">⚠ Ontbrekende vereisten (art. 6:5 Awb)</p>
              <ul className="space-y-0.5">
                {missingItems.map((item) => (
                  <li key={item} className="text-xs text-red-600 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1">
            <IntakeField label="Bezwaarmaker"       value={zaak.bezwaarmaker}        onEdit={(v) => onUpdate({ bezwaarmaker: v })}       uncertain={!zaak.bezwaarmaker} />
            <IntakeField label="Gemachtigde"         value={zaak.gemachtigde}         onEdit={(v) => onUpdate({ gemachtigde: v })} />
            <IntakeField label="Datum ontvangst"     value={formatDate(zaak.datumOntvangst)}  uncertain={!zaak.datumOntvangst} />
            <IntakeField label="Datum besluit"       value={formatDate(zaak.datumBesluit)}    uncertain={!zaak.datumBesluit} />
            <IntakeField label="Omschrijving besluit" value={zaak.omschrijvingBesluit} onEdit={(v) => onUpdate({ omschrijvingBesluit: v })} uncertain={!zaak.omschrijvingBesluit} />
            <IntakeField label="Type besluit"        value={zaak.typeBesluit}         onEdit={(v) => onUpdate({ typeBesluit: v })}        uncertain={!zaak.typeBesluit} />
            <IntakeCheckField label="Gronden aanwezig"       value={zaak.grondenAanwezig       ?? "onbekend"} onChange={(v) => onUpdate({ grondenAanwezig:       v as "ja"|"nee"|"onbekend" })} />
            <IntakeCheckField label="Ondertekening aanwezig" value={zaak.ondertekeningAanwezig ?? "onbekend"} onChange={(v) => onUpdate({ ondertekeningAanwezig: v as "ja"|"nee"|"onbekend" })} />
            <IntakeCheckField label="Adres aanwezig"         value={zaak.adresAanwezig         ?? "onbekend"} onChange={(v) => onUpdate({ adresAanwezig:         v as "ja"|"nee"|"onbekend" })} />
            <IntakeCheckField label="Dagtekening aanwezig"   value={zaak.dagtekeningAanwezig   ?? "onbekend"} onChange={(v) => onUpdate({ dagtekeningAanwezig:   v as "ja"|"nee"|"onbekend" })} />
          </div>

          <div className="mt-3 pt-3 border-t border-blue-100">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Aanbevolen actie</p>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${requiredFieldsComplete ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
              <span>{requiredFieldsComplete ? "✓" : "⚠"}</span>
              {requiredFieldsComplete ? "Ontvangstbevestiging genereren" : "Herstelverzuimbrief genereren"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IntakeField({ label, value, uncertain, onEdit }: { label: string; value?: string; uncertain?: boolean; onEdit?: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
      <span className="text-xs text-gray-500 flex-shrink-0 w-40">{label}</span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {editing ? (
          <>
            <input autoFocus className="flex-1 text-xs border border-blue-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400" value={val} onChange={(e) => setVal(e.target.value)} />
            <button onClick={() => { onEdit?.(val); setEditing(false); }} className="text-[10px] text-blue-600 font-semibold hover:text-blue-800">OK</button>
          </>
        ) : (
          <>
            {uncertain && <span className="text-amber-500 flex-shrink-0">❗</span>}
            <span className={`text-xs font-medium truncate ${uncertain || !value ? "text-gray-400 italic" : "text-gray-800"}`}>{value || "Onbekend"}</span>
            {onEdit && <button onClick={() => setEditing(true)} className="text-[10px] text-gray-400 hover:text-blue-500 flex-shrink-0 ml-1">✏️</button>}
          </>
        )}
      </div>
    </div>
  );
}

function IntakeCheckField({ label, value, onChange }: { label: string; value: "ja"|"nee"|"onbekend"; onChange: (v: string) => void }) {
  const color = value === "ja" ? "text-emerald-600" : value === "nee" ? "text-red-600" : "text-amber-500";
  const icon  = value === "ja" ? "✓" : value === "nee" ? "✗" : "❗";
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
      <span className="text-xs text-gray-500 flex-shrink-0 w-40">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold ${color}`}>{icon} {value}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} className="text-[10px] border border-gray-200 rounded-lg px-1 py-0.5 focus:outline-none text-gray-600">
          <option value="ja">Ja</option>
          <option value="nee">Nee</option>
          <option value="onbekend">Onbekend</option>
        </select>
      </div>
    </div>
  );
}

function HoorzittingPhaseContent({ zaak, onUpdate }: { zaak: Case; onUpdate: (u: Partial<Case>) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Hoorzitting details</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <EditableField label="Datum hoorzitting" value={zaak.datumHoorzitting} type="date" onChange={(v) => onUpdate({ datumHoorzitting: v })} />
        <EditableField label="Tijdstip" value={zaak.datumHoorzittingTijd ?? ""} onChange={(v) => onUpdate({ datumHoorzittingTijd: v })} />
        <EditableField label="Locatie" value={zaak.locatieHoorzitting ?? ""} onChange={(v) => onUpdate({ locatieHoorzitting: v })} />
        <div className="sm:col-span-2 grid grid-cols-3 gap-2">
          {([
            { key: "dossierCompleet" as keyof Case,       label: "Dossier compleet" },
            { key: "stukkenGeanonimiseerd" as keyof Case, label: "Stukken geanonimiseerd" },
            { key: "partijenUitgenodigd" as keyof Case,   label: "Partijen uitgenodigd" },
          ]).map(({ key, label }) => (
            <div key={String(key)}>
              <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
              <select className="w-full rounded-xl border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={(zaak[key] as string) ?? ""}
                onChange={(e) => onUpdate({ [key]: e.target.value } as Partial<Case>)}>
                <option value="">—</option>
                <option value="ja">Ja</option>
                <option value="nee">Nee</option>
              </select>
            </div>
          ))}
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-medium text-gray-400 mb-1.5">Hoorzitting notities</p>
          <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-h-[64px] resize-y"
            value={zaak.hoorzittingNotities ?? ""} onChange={(e) => onUpdate({ hoorzittingNotities: e.target.value })} placeholder="Notities over de hoorzitting..." />
        </div>
      </div>
    </div>
  );
}

function AdviesPhaseContent({ zaak, onUpdate }: { zaak: Case; onUpdate: (u: Partial<Case>) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Advies details</p>
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1.5">Adviesrichting</p>
          <select className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            value={zaak.adviesRichting ?? ""} onChange={(e) => onUpdate({ adviesRichting: e.target.value })}>
            <option value="">— Selecteer —</option>
            <option value="gegrond">Gegrond</option>
            <option value="ongegrond">Ongegrond</option>
            <option value="niet-ontvankelijk">Niet-ontvankelijk</option>
            <option value="gedeeltelijk-gegrond">Gedeeltelijk gegrond</option>
          </select>
        </div>
        <EditableField label="Advies notities" value={zaak.adviesNotities ?? ""} onChange={(v) => onUpdate({ adviesNotities: v })} />
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1.5">Conceptadvies tekst</p>
          <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-h-[80px] resize-y"
            value={zaak.conceptAdviesTekst ?? ""} onChange={(e) => onUpdate({ conceptAdviesTekst: e.target.value })} placeholder="Concepttekst van het advies..." />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1.5">Feedback commissie</p>
          <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-h-[64px] resize-y"
            value={zaak.commissieFeedback ?? ""} onChange={(e) => onUpdate({ commissieFeedback: e.target.value })} placeholder="Feedback van de commissie..." />
        </div>
      </div>
    </div>
  );
}

function AfrondingPhaseContent({ zaak, onUpdate }: { zaak: Case; onUpdate: (u: Partial<Case>) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Afronding details</p>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1">Beslissing conform advies?</p>
            <select className="w-full rounded-xl border border-gray-200 px-2 py-1.5 text-xs focus:outline-none"
              value={zaak.beslissingConformAdvies ?? ""} onChange={(e) => onUpdate({ beslissingConformAdvies: e.target.value as "ja"|"nee" })}>
              <option value="">—</option><option value="ja">Ja</option><option value="nee">Nee</option>
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1">Contrair besluit?</p>
            <select className="w-full rounded-xl border border-gray-200 px-2 py-1.5 text-xs focus:outline-none"
              value={zaak.contrairBesluit ?? ""} onChange={(e) => onUpdate({ contrairBesluit: e.target.value as "ja"|"nee" })}>
              <option value="">—</option><option value="ja">Ja</option><option value="nee">Nee</option>
            </select>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1.5">Afsluit notities</p>
          <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-h-[64px] resize-y"
            value={zaak.afsluitNotities ?? ""} onChange={(e) => onUpdate({ afsluitNotities: e.target.value })} placeholder="Afsluitende notities..." />
        </div>
        {zaak.datumBeslissingOpBezwaar && (
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Beslissing op bezwaar ontvangen op</p>
            <p className="text-sm font-semibold text-gray-800">{formatDate(zaak.datumBeslissingOpBezwaar)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Workflow actions ─────────────────────────────────────────────────────────

type ActionDef = { label: string; variant: "green" | "red" | "blue"; updates: Partial<Case> };

function getActionsForFase(fase: string): ActionDef[] {
  switch (fase) {
    case "Intake": return [
      { label: "Ontvangstbevestiging verzonden", variant: "green", updates: { status: "Ontvangstbevestiging verzonden", fase: "Informeel", verdaagd: "Ja", volgendeActie: "Procesdossier opvragen / informele afhandeling beoordelen" } },
      { label: "Herstelverzuimbrief verzonden",  variant: "red",   updates: { status: "🔴 In afwachting herstel", fase: "Intake", hersteltermijn: addDays(todayISO(), 14), actiedatum: addDays(todayISO(), 14), volgendeActie: "Controleer hersteltermijn" } },
      { label: "Herstel ontvangen",              variant: "blue",  updates: { status: "🟢 Herstel ontvangen", fase: "Informeel", volgendeActie: "Beoordeel informele afhandeling" } },
      { label: "Geen herstel ontvangen",         variant: "red",   updates: { status: "🔴 Geen herstel ontvangen", fase: "Advies", volgendeActie: "Conceptadvies niet-ontvankelijk maken" } },
    ];
    case "Informeel": return [
      { label: "Start informele afhandeling",          variant: "blue",  updates: { status: "🟠 In afwachting informele afhandeling", fase: "Informeel", volgendeActie: "Check vakafdeling", actiedatum: addDays(todayISO(), 14) } },
      { label: "Reminder vakafdeling",                 variant: "blue",  updates: { volgendeActie: "Reminder vakafdeling verzonden / wacht op reactie", actiedatum: addDays(todayISO(), 7) } },
      { label: "Informeel afgerond",                   variant: "green", updates: { status: "🟢 Informele afhandeling afgerond", fase: "Informeel", volgendeActie: "Verzoek intrekking bezwaar versturen" } },
      { label: "Verzoek intrekking bezwaar versturen", variant: "blue",  updates: { status: "🟠 Wachten op intrekking", fase: "Informeel", volgendeActie: "Controleer of intrekking is ontvangen", actiedatum: addDays(todayISO(), 14) } },
      { label: "Intrekking ontvangen",                 variant: "green", updates: { status: "⚫ Afgerond", fase: "Afronding", volgendeActie: "Zaak sluiten" } },
      { label: "Geen intrekking ontvangen",            variant: "red",   updates: { status: "🔵 Zitting plannen", fase: "Hoorzitting", volgendeActie: "Plan hoorzitting" } },
      { label: "Informeel niet geslaagd",              variant: "red",   updates: { status: "🔵 Zitting plannen", fase: "Hoorzitting", volgendeActie: "Plan hoorzitting" } },
    ];
    case "Zitting":
    case "Hoorzitting": return [
      { label: "Zitting gepland",         variant: "blue",  updates: { status: "🔵 Zitting gepland", fase: "Hoorzitting", volgendeActie: "Uitnodigingen versturen" } },
      { label: "Uitnodigingen verzonden", variant: "blue",  updates: { status: "🔵 Uitnodigingen verzonden", fase: "Hoorzitting", volgendeActie: "Hoorzitting voorbereiden" } },
      { label: "Hoorzitting geweest",     variant: "green", updates: { status: "🟣 Advies uitwerken", fase: "Advies", volgendeActie: "Conceptadvies maken" } },
    ];
    case "Advies": return [
      { label: "Conceptadvies starten",        variant: "blue",  updates: { status: "🟣 Advies uitwerken", fase: "Advies", volgendeActie: "Conceptadvies delen met commissie" } },
      { label: "Feedback commissie ontvangen", variant: "blue",  updates: { status: "🟣 Feedback verwerken", fase: "Advies", volgendeActie: "Definitief advies maken" } },
      { label: "Advies verzonden",             variant: "green", updates: { status: "🟣 Advies verzonden", fase: "Afronding", adviesUitgebracht: "Ja", datumAdvies: todayISO(), volgendeActie: "Wachten op beslissing op bezwaar" } as Partial<Case> },
    ];
    case "Afronding": return [
      { label: "Beslissing op bezwaar ontvangen", variant: "green", updates: { beslissingOpBezwaar: "Ja" as const, datumBeslissingOpBezwaar: todayISO(), volgendeActie: "Zaak sluiten" } },
      { label: "Zaak afgerond",                   variant: "blue",  updates: { status: "⚫ Afgerond", fase: "Afronding", volgendeActie: "Geen" } },
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
      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all duration-150 active:scale-[0.96] hover:-translate-y-0.5 hover:shadow-md ${
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

function DeadlineCard({ label, dateStr }: { label: string; dateStr: string }) {
  if (!dateStr) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
        <p className="text-sm font-semibold text-gray-400">Geen termijn bekend</p>
      </div>
    );
  }
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  const diff   = Math.round((target.getTime() - today.getTime()) / 86400000);

  let text = "";
  let colorCls = "";
  if (diff === 0)      { text = "Vandaag";                    colorCls = "text-orange-600"; }
  else if (diff < 0)  { text = `${Math.abs(diff)} dagen te laat`; colorCls = "text-red-600"; }
  else if (diff <= 7) { text = `Nog ${diff} dagen`;           colorCls = "text-orange-500"; }
  else                { text = `Nog ${diff} dagen`;           colorCls = "text-gray-900"; }

  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${diff < 0 ? "border-red-200" : diff <= 7 ? "border-orange-200" : "border-gray-100"}`}>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-xl font-bold leading-tight ${colorCls}`}>{text}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(dateStr)}</p>
    </div>
  );
}

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
