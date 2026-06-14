"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CasesProvider, useCases } from "@/lib/CasesContext";
import { Case } from "@/lib/types";
import { addWeeks, todayISO } from "@/lib/dateUtils";
import { generateId } from "@/lib/store";

function NieuweZaakForm() {
  const router = useRouter();
  const { addCase } = useCases();

  const [form, setForm] = useState({
    zaaknummer: "",
    bezwaarmaker: "",
    datumOntvangst: todayISO(),
    datumBesluit: "",
    einddatumBezwaartermijn: "",
    beslistermijn12Weken: "",
    verdaagd: "Nee" as "Ja" | "Nee",
    beslistermijnNaVerdaging: "",
    actiedatum: "",
    datumHoorzitting: "",
    aantekeningen: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleChange(field: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-calculate dates
      if (field === "datumBesluit" && value) {
        const einde = addWeeks(value, 6);
        next.einddatumBezwaartermijn = einde;
        if (einde) {
          const term12 = addWeeks(einde, 12);
          next.beslistermijn12Weken = term12;
          if (next.verdaagd === "Ja" && term12) {
            next.beslistermijnNaVerdaging = addWeeks(term12, 6);
          }
        }
      }
      if (field === "verdaagd") {
        if (value === "Ja" && next.beslistermijn12Weken) {
          next.beslistermijnNaVerdaging = addWeeks(next.beslistermijn12Weken, 6);
        } else if (value === "Nee") {
          next.beslistermijnNaVerdaging = "";
        }
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.zaaknummer.trim()) errs.zaaknummer = "Vereist";
    if (!form.bezwaarmaker.trim()) errs.bezwaarmaker = "Vereist";
    if (!form.datumOntvangst) errs.datumOntvangst = "Vereist";
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const newCase: Case = {
      id: generateId(),
      ...form,
      status: "Intake gestart",
      fase: "Intake",
      volgendeActie: "Beoordeel bezwaarschrift",
      adviesUitgebracht: "Nee",
      beslissingOpBezwaar: "Nee",
      datumAdvies: "",
      datumBeslissingOpBezwaar: "",
    };

    addCase(newCase);
    router.push(`/zaak/${newCase.id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-700 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M7.707 13.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L4.414 7H14a1 1 0 110 2H4.414l3.293 3.293a1 1 0 010 1.414z" clipRule="evenodd"/>
            </svg>
          </button>
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="BezwaarPilot" className="w-6 h-6 rounded-md object-cover" />
            <span className="font-semibold text-gray-900 text-sm">BezwaarPilot</span>
          </a>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-600 font-medium">Nieuwe zaak</span>
        </div>
      </header>
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Nieuwe bezwaarzaak</h1>
        <p className="text-sm text-gray-500 mt-0.5">Status en fase worden automatisch ingesteld</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField label="Zaaknummer *" error={errors.zaaknummer}>
              <input
                type="text"
                className="input"
                placeholder="BZ-2024-0001"
                value={form.zaaknummer}
                onChange={(e) => handleChange("zaaknummer", e.target.value)}
              />
            </FormField>
            <FormField label="Bezwaarmaker *" error={errors.bezwaarmaker}>
              <input
                type="text"
                className="input"
                placeholder="Naam bezwaarmaker"
                value={form.bezwaarmaker}
                onChange={(e) => handleChange("bezwaarmaker", e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField label="Datum ontvangst *" error={errors.datumOntvangst}>
              <input
                type="date"
                className="input"
                value={form.datumOntvangst}
                onChange={(e) => handleChange("datumOntvangst", e.target.value)}
              />
            </FormField>
            <FormField label="Datum besluit">
              <input
                type="date"
                className="input"
                value={form.datumBesluit}
                onChange={(e) => handleChange("datumBesluit", e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField label="Einddatum bezwaartermijn" hint="Wordt berekend: besluitdatum + 6 weken">
              <input
                type="date"
                className="input"
                value={form.einddatumBezwaartermijn}
                onChange={(e) => handleChange("einddatumBezwaartermijn", e.target.value)}
              />
            </FormField>
            <FormField label="Beslistermijn 12 weken" hint="Wordt berekend: einddatum + 12 weken">
              <input
                type="date"
                className="input"
                value={form.beslistermijn12Weken}
                onChange={(e) => handleChange("beslistermijn12Weken", e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField label="Verdaagd">
              <select
                className="input"
                value={form.verdaagd}
                onChange={(e) => handleChange("verdaagd", e.target.value)}
              >
                <option value="Nee">Nee</option>
                <option value="Ja">Ja</option>
              </select>
            </FormField>
            <FormField
              label="Beslistermijn na verdaging"
              hint={form.verdaagd === "Ja" ? "Wordt berekend: 12-wekentermijn + 6 weken" : "Alleen bij verdaging"}
            >
              <input
                type="date"
                className="input"
                value={form.beslistermijnNaVerdaging}
                onChange={(e) => handleChange("beslistermijnNaVerdaging", e.target.value)}
                disabled={form.verdaagd === "Nee"}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField label="Actiedatum">
              <input
                type="date"
                className="input"
                value={form.actiedatum}
                onChange={(e) => handleChange("actiedatum", e.target.value)}
              />
            </FormField>
            <FormField label="Datum hoorzitting">
              <input
                type="date"
                className="input"
                value={form.datumHoorzitting}
                onChange={(e) => handleChange("datumHoorzitting", e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Aantekeningen">
            <textarea
              className="input min-h-[80px] resize-y"
              placeholder="Optionele notities bij deze zaak..."
              value={form.aantekeningen}
              onChange={(e) => handleChange("aantekeningen", e.target.value)}
            />
          </FormField>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
            <p className="font-medium text-blue-800 mb-1">Automatische workflow instellingen</p>
            <div className="text-blue-700 space-y-0.5">
              <p>Status: <span className="font-medium">Intake gestart</span></p>
              <p>Fase: <span className="font-medium">Intake</span></p>
              <p>Volgende actie: <span className="font-medium">Beoordeel bezwaarschrift</span></p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary">
              Zaak aanmaken
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => router.push("/")}
            >
              Annuleren
            </button>
          </div>
        </form>
      </div>
    </div>
    </div>
  );
}

function FormField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
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
