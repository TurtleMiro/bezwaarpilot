"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CasesProvider, useCases } from "@/lib/CasesContext";
import { Case } from "@/lib/types";
import { addWeeks, todayISO } from "@/lib/dateUtils";
import { generateId } from "@/lib/store";

const EMPTY_FORM = {
  zaaknummer: "",
  bezwaarmaker: "",
  gemachtigde: "",
  omschrijvingBesluit: "",
  typeBesluit: "",
  datumOntvangst: todayISO(),
  datumBesluit: "",
  einddatumBezwaartermijn: "",
  beslistermijn12Weken: "",
  verdaagd: "Ja" as "Ja" | "Nee",
  beslistermijnNaVerdaging: "",
  actiedatum: "",
  datumHoorzitting: "",
  aantekeningen: "",
};

type FormState = typeof EMPTY_FORM;
type AiField = keyof FormState;

function NieuweZaakForm() {
  const router = useRouter();
  const { addCase } = useCases();

  const [mode, setMode] = useState<"upload" | "form">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [aiFilledFields, setAiFilledFields] = useState<Set<AiField>>(new Set());
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function recalcDates(next: FormState): FormState {
    if (next.datumBesluit) {
      const einde = addWeeks(next.datumBesluit, 6);
      next.einddatumBezwaartermijn = einde;
      const term12 = addWeeks(einde, 12);
      next.beslistermijn12Weken = term12;
      if (next.verdaagd === "Ja" && term12) {
        next.beslistermijnNaVerdaging = addWeeks(term12, 6);
      }
    }
    return next;
  }

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "datumBesluit" && value) return recalcDates(next);
      if (field === "verdaagd") {
        if (value === "Ja" && next.beslistermijn12Weken)
          next.beslistermijnNaVerdaging = addWeeks(next.beslistermijn12Weken, 6);
        else if (value === "Nee") next.beslistermijnNaVerdaging = "";
      }
      return next;
    });
    setAiFilledFields((prev) => { const s = new Set(prev); s.delete(field); return s; });
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  async function handleAnalyze() {
    if (!selectedFile) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const res = await fetch("/api/extract-bezwaar", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setAnalyzeError(json.error ?? "Analyse mislukt."); return; }

      const e = json.extracted;
      const filled = new Set<AiField>();

      const next = { ...EMPTY_FORM, datumOntvangst: todayISO() };

      const set = (field: AiField, val: string | null | undefined) => {
        if (val) { (next as Record<string, string>)[field] = val; filled.add(field); }
      };

      set("bezwaarmaker",        e.bezwaarmaker);
      set("gemachtigde",         e.gemachtigde);
      set("omschrijvingBesluit", e.omschrijvingBesluit);
      set("typeBesluit",         e.typeBesluit);
      set("datumBesluit",        e.datumBesluit);
      if (e.datumBezwaarschrift) { set("datumOntvangst", e.datumBezwaarschrift); }

      const withDates = recalcDates(next);
      if (next.datumBesluit) {
        filled.add("einddatumBezwaartermijn");
        filled.add("beslistermijn12Weken");
        filled.add("beslistermijnNaVerdaging");
      }

      setForm(withDates);
      setAiFilledFields(filled);
      setUploadedFileName(selectedFile.name);
      setMode("form");
    } catch {
      setAnalyzeError("Verbindingsfout. Controleer uw internetverbinding.");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.bezwaarmaker.trim()) errs.bezwaarmaker = "Vereist";
    if (!form.datumOntvangst) errs.datumOntvangst = "Vereist";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const newCase: Case = {
      id: generateId(),
      zaaknummer:               form.zaaknummer || `BZ-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
      bezwaarmaker:             form.bezwaarmaker,
      gemachtigde:              form.gemachtigde,
      omschrijvingBesluit:      form.omschrijvingBesluit,
      typeBesluit:              form.typeBesluit,
      datumOntvangst:           form.datumOntvangst,
      datumBesluit:             form.datumBesluit,
      einddatumBezwaartermijn:  form.einddatumBezwaartermijn,
      beslistermijn12Weken:     form.beslistermijn12Weken,
      verdaagd:                 form.verdaagd,
      beslistermijnNaVerdaging: form.beslistermijnNaVerdaging,
      actiedatum:               form.actiedatum || form.beslistermijn12Weken,
      datumHoorzitting:         form.datumHoorzitting,
      aantekeningen:            form.aantekeningen,
      status:                   "Intake gestart",
      fase:                     "Intake",
      volgendeActie:            "Beoordeel bezwaarschrift",
      adviesUitgebracht:        "Nee",
      beslissingOpBezwaar:      "Nee",
      datumAdvies:              "",
      datumBeslissingOpBezwaar: "",
      uploadedBezwaarFileName:  uploadedFileName ?? undefined,
      intakeKaartGegenereerd:   !!uploadedFileName,
      grondenAanwezig:          undefined,
      ondertekeningAanwezig:    undefined,
      adresAanwezig:            undefined,
      dagtekeningAanwezig:      undefined,
    };

    addCase(newCase);
    router.push(`/zaak/${newCase.id}`);
  }

  // ── Upload screen ──────────────────────────────────────────────────────────
  if (mode === "upload") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header onBack={() => router.push("/")} />
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Nieuwe bezwaarzaak</h1>
            <p className="text-sm text-gray-500 mt-1">Upload het bezwaarschrift — de AI vult de gegevens automatisch in</p>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-4">
            <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${selectedFile ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}>
              <svg className={`w-8 h-8 mb-2 ${selectedFile ? "text-blue-400" : "text-gray-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              {selectedFile ? (
                <p className="text-sm font-semibold text-blue-700">{selectedFile.name}</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-600">Klik om bestand te kiezen</p>
                  <p className="text-xs text-gray-400 mt-1">PDF of DOCX</p>
                </>
              )}
              <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSelectedFile(f); setAnalyzeError(null); } }} />
            </label>

            <button
              onClick={handleAnalyze}
              disabled={!selectedFile || analyzing}
              className="w-full py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                  Bezwaarschrift analyseren...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a4 4 0 00-4 4c0 1.49.82 2.79 2.03 3.47L5.5 14h5l-.53-5.53A4 4 0 008 1z" />
                  </svg>
                  Analyseren met AI
                </>
              )}
            </button>

            {analyzeError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-red-700 mb-0.5">Analyse mislukt</p>
                <p className="text-xs text-red-600">{analyzeError}</p>
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-gray-400">of</span>
              </div>
            </div>

            <button
              onClick={() => setMode("form")}
              className="w-full py-2.5 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Handmatig invullen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Review / manual form ───────────────────────────────────────────────────
  const aiCount = aiFilledFields.size;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onBack={() => setMode("upload")} backLabel={uploadedFileName ? "← Opnieuw uploaden" : "← Terug"} />
      <div className="max-w-2xl mx-auto px-4 py-6">

        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Zaakgegevens controleren</h1>
          {aiCount > 0 ? (
            <p className="text-sm text-gray-500 mt-0.5">
              <span className="text-blue-600 font-semibold">{aiCount} velden</span> automatisch ingevuld vanuit het bezwaarschrift — controleer en corrigeer waar nodig
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-0.5">Vul de zaakgegevens in</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Identificatie</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Zaaknummer" hint="Leeg laten voor automatisch nummer">
                <input type="text" className={fieldCls(false)} placeholder="BZ-2024-0001" value={form.zaaknummer} onChange={(e) => handleChange("zaaknummer", e.target.value)} />
              </FormField>
              <FormField label="Bezwaarmaker *" error={errors.bezwaarmaker}>
                <input type="text" className={fieldCls(aiFilledFields.has("bezwaarmaker"))} placeholder="Naam bezwaarmaker" value={form.bezwaarmaker} onChange={(e) => handleChange("bezwaarmaker", e.target.value)} />
              </FormField>
              <FormField label="Gemachtigde">
                <input type="text" className={fieldCls(aiFilledFields.has("gemachtigde"))} placeholder="Naam gemachtigde (optioneel)" value={form.gemachtigde} onChange={(e) => handleChange("gemachtigde", e.target.value)} />
              </FormField>
              <FormField label="Type besluit">
                <input type="text" className={fieldCls(aiFilledFields.has("typeBesluit"))} placeholder="Bijv. omgevingsvergunning" value={form.typeBesluit} onChange={(e) => handleChange("typeBesluit", e.target.value)} />
              </FormField>
              <FormField label="Omschrijving besluit" className="sm:col-span-2">
                <input type="text" className={fieldCls(aiFilledFields.has("omschrijvingBesluit"))} placeholder="Korte omschrijving van het bestreden besluit" value={form.omschrijvingBesluit} onChange={(e) => handleChange("omschrijvingBesluit", e.target.value)} />
              </FormField>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Termijnen</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Datum ontvangst *" error={errors.datumOntvangst}>
                <input type="date" className={fieldCls(aiFilledFields.has("datumOntvangst"))} value={form.datumOntvangst} onChange={(e) => handleChange("datumOntvangst", e.target.value)} />
              </FormField>
              <FormField label="Datum besluit">
                <input type="date" className={fieldCls(aiFilledFields.has("datumBesluit"))} value={form.datumBesluit} onChange={(e) => handleChange("datumBesluit", e.target.value)} />
              </FormField>
              <FormField label="Einddatum bezwaartermijn" hint="Besluitdatum + 6 weken">
                <input type="date" className={fieldCls(aiFilledFields.has("einddatumBezwaartermijn"))} value={form.einddatumBezwaartermijn} onChange={(e) => handleChange("einddatumBezwaartermijn", e.target.value)} />
              </FormField>
              <FormField label="Beslistermijn 12 weken" hint="Einddatum + 12 weken">
                <input type="date" className={fieldCls(aiFilledFields.has("beslistermijn12Weken"))} value={form.beslistermijn12Weken} onChange={(e) => handleChange("beslistermijn12Weken", e.target.value)} />
              </FormField>
              <FormField label="Verdaagd">
                <select className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-white" value={form.verdaagd} onChange={(e) => handleChange("verdaagd", e.target.value)}>
                  <option value="Ja">Ja</option>
                  <option value="Nee">Nee</option>
                </select>
              </FormField>
              <FormField label="Beslistermijn na verdaging" hint="12-wekentermijn + 6 weken">
                <input type="date" className={fieldCls(aiFilledFields.has("beslistermijnNaVerdaging"))} value={form.beslistermijnNaVerdaging} onChange={(e) => handleChange("beslistermijnNaVerdaging", e.target.value)} disabled={form.verdaagd === "Nee"} />
              </FormField>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Overig</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Actiedatum">
                <input type="date" className={fieldCls(false)} value={form.actiedatum} onChange={(e) => handleChange("actiedatum", e.target.value)} />
              </FormField>
              <FormField label="Datum hoorzitting">
                <input type="date" className={fieldCls(false)} value={form.datumHoorzitting} onChange={(e) => handleChange("datumHoorzitting", e.target.value)} />
              </FormField>
            </div>
            <FormField label="Aantekeningen">
              <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 min-h-[72px] resize-y transition-all" placeholder="Optionele notities..." value={form.aantekeningen} onChange={(e) => handleChange("aantekeningen", e.target.value)} />
            </FormField>
          </div>

          {aiCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-700">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0 text-[10px]">AI</span>
              Blauw gemarkeerde velden zijn automatisch ingevuld. Controleer ze vóór het opslaan.
            </div>
          )}

          <div className="flex gap-3 pb-6">
            <button type="submit" className="flex-1 py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm">
              Zaak aanmaken
            </button>
            <button type="button" className="px-5 py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors" onClick={() => router.push("/")}>
              Annuleren
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function fieldCls(aiField: boolean) {
  return `w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-blue-400 transition-all bg-white ${
    aiField
      ? "border-blue-300 bg-blue-50/50 focus:ring-blue-500/30 text-blue-900"
      : "border-gray-200 focus:ring-blue-500/30"
  }`;
}

function Header({ onBack, backLabel = "← Terug" }: { onBack: () => void; backLabel?: string }) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-700 transition-colors font-medium">
          {backLabel}
        </button>
        <span className="text-gray-200">|</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="BezwaarPilot" className="w-6 h-6 rounded-md object-cover" />
        <span className="font-semibold text-gray-900 text-sm">BezwaarPilot</span>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-600 font-medium">Nieuwe zaak</span>
      </div>
    </header>
  );
}

function FormField({ label, hint, error, children, className }: {
  label: string; hint?: string; error?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function NieuweZaakPage() {
  return (
    <CasesProvider>
      <NieuweZaakForm />
    </CasesProvider>
  );
}
