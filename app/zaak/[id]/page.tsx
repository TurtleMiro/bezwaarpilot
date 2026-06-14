"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CasesProvider, useCases } from "@/lib/CasesContext";
import { Case } from "@/lib/types";
import { formatDate, todayISO, addWeeks } from "@/lib/dateUtils";

function ZaakDetailContent({ id }: { id: string }) {
  const { cases } = useCases();
  const zaak = cases.find((c) => c.id === id) ?? null;

  if (!zaak) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Zaak niet gevonden of laden...</p>
      </div>
    );
  }

  return <ZaakDetail zaak={zaak} />;
}

function ZaakDetail({ zaak: initialZaak }: { zaak: Case }) {
  const router = useRouter();
  const { updateCase } = useCases();
  const [zaak, setZaak] = useState<Case>(initialZaak);
  const [saved, setSaved] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [generatedDocs, setGeneratedDocs] = useState<Record<string, string>>({});

  useEffect(() => {
    setZaak(initialZaak);
  }, [initialZaak.id]);

  function applyWorkflow(updates: Partial<Case>) {
    const updated = { ...zaak, ...updates };
    setZaak(updated);
    updateCase(updated);
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
      if (updated.verdaagd === "Ja") {
        updated.beslistermijnNaVerdaging = addWeeks(term12, 6);
      }
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

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file.name);
      applyWorkflow({ uploadedBezwaarFileName: file.name });
    }
  }

  function generateDocument(type: string) {
    const placeholders: Record<string, string> = {
      ontvangstbevestiging: `[CONCEPT - ONTVANGSTBEVESTIGING]

Aan: ${zaak.bezwaarmaker}
Betreft: Bevestiging ontvangst bezwaarschrift – ${zaak.zaaknummer}
Datum: ${formatDate(todayISO())}

Geachte bezwaarmaker,

Hierbij bevestigen wij de ontvangst van uw bezwaarschrift d.d. ${formatDate(zaak.datumOntvangst)}.

Uw bezwaar heeft betrekking op het besluit van ${formatDate(zaak.datumBesluit)}.

De beslistermijn bedraagt 12 weken vanaf het einde van de bezwaartermijn, derhalve tot ${formatDate(zaak.beslistermijn12Weken)}.

Wij zullen uw bezwaar in behandeling nemen.

Met vriendelijke groet,
[Naam secretaris]
Commissie Bezwaarschriften`,

      herstelverzuimbrief: `[CONCEPT - HERSTELVERZUIMBRIEF]

Aan: ${zaak.bezwaarmaker}
Betreft: Herstelbrief – ${zaak.zaaknummer}
Datum: ${formatDate(todayISO())}

Geachte bezwaarmaker,

Op ${formatDate(zaak.datumOntvangst)} heeft u een bezwaarschrift ingediend. Helaas voldoet uw bezwaarschrift niet aan de formele vereisten. Wij verzoeken u het bezwaar binnen 2 weken aan te vullen.

Ontbreekt de aanvulling, dan kan het bezwaar niet-ontvankelijk worden verklaard.

Met vriendelijke groet,
[Naam secretaris]`,

      uitnodiging_hoorzitting: `[CONCEPT - UITNODIGING HOORZITTING]

Aan: ${zaak.bezwaarmaker}
Betreft: Uitnodiging hoorzitting – ${zaak.zaaknummer}
Datum: ${formatDate(todayISO())}

Geachte bezwaarmaker,

In het kader van de behandeling van uw bezwaarschrift nodigt de commissie u uit voor een hoorzitting.

Datum hoorzitting: ${formatDate(zaak.datumHoorzitting) || "[datum in te vullen]"}
Locatie: [Locatie in te vullen]

U kunt uw standpunt mondeling toelichten.

Met vriendelijke groet,
Commissie Bezwaarschriften`,

      conceptadvies: `[CONCEPT - ADVIES]

Zaaknummer: ${zaak.zaaknummer}
Bezwaarmaker: ${zaak.bezwaarmaker}
Datum advies: ${formatDate(todayISO())}

ADVIES COMMISSIE BEZWAARSCHRIFTEN

Ontvankelijkheid
Het bezwaarschrift is tijdig ingediend en voldoet aan de formele vereisten.

Overwegingen
[Overwegingen te completeren door jurist]

Conclusie
[Gegrond/Ongegrond verklaring te completeren]

Advies
De commissie adviseert het bezwaar [gegrond/ongegrond] te verklaren.

Handtekening: ___________________
Datum: ${formatDate(todayISO())}`,
    };

    setGeneratedDocs((prev) => ({
      ...prev,
      [type]: placeholders[type] ?? "[Document wordt hier gegenereerd]",
    }));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="flex items-center gap-2 text-gray-400 hover:text-gray-700 transition-colors">
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
            <span className="text-sm text-gray-600 font-medium">{zaak.zaaknummer}</span>
          </div>
        </div>
      </header>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Status header card */}
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-gray-900">{zaak.bezwaarmaker}</h1>
              <FaseBadge fase={zaak.fase} />
            </div>
            <p className="text-sm text-gray-400 font-mono">{zaak.zaaknummer}</p>
          </div>
          {saved && (
            <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" clipRule="evenodd"/>
              </svg>
              Opgeslagen
            </div>
          )}
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Status</p>
            <p className="text-xl font-bold text-gray-900">{zaak.status}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <HeaderField label="Fase" value={zaak.fase} />
            <HeaderField
              label="Beslistermijn"
              value={formatDate(zaak.beslistermijnNaVerdaging || zaak.beslistermijn12Weken)}
            />
            <HeaderField label="Volgende actie" value={zaak.volgendeActie} />
            <HeaderField label="Actiedatum" value={formatDate(zaak.actiedatum)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: basic info + workflow */}
        <div className="lg:col-span-2 space-y-6">

          {/* Zaakgegevens */}
          <div className="card p-5">
            <h2 className="section-title">Zaakgegevens</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EditableField label="Zaaknummer" value={zaak.zaaknummer} onChange={(v) => handleFieldChange("zaaknummer", v)} />
              <EditableField label="Bezwaarmaker" value={zaak.bezwaarmaker} onChange={(v) => handleFieldChange("bezwaarmaker", v)} />
              <EditableField label="Datum ontvangst" value={zaak.datumOntvangst} type="date" onChange={(v) => handleFieldChange("datumOntvangst", v)} />
              <EditableField label="Datum besluit" value={zaak.datumBesluit} type="date" onChange={(v) => handleFieldChange("datumBesluit", v)} />
              <EditableField label="Einddatum bezwaartermijn" value={zaak.einddatumBezwaartermijn} type="date" onChange={(v) => handleFieldChange("einddatumBezwaartermijn", v)} />
              <EditableField label="Beslistermijn 12 weken" value={zaak.beslistermijn12Weken} type="date" onChange={(v) => handleFieldChange("beslistermijn12Weken", v)} />
              <div>
                <label className="field-label">Verdaagd</label>
                <select className="input" value={zaak.verdaagd} onChange={(e) => handleFieldChange("verdaagd", e.target.value)}>
                  <option value="Nee">Nee</option>
                  <option value="Ja">Ja</option>
                </select>
              </div>
              <EditableField label="Beslistermijn na verdaging" value={zaak.beslistermijnNaVerdaging} type="date" onChange={(v) => handleFieldChange("beslistermijnNaVerdaging", v)} />
              <EditableField label="Actiedatum" value={zaak.actiedatum} type="date" onChange={(v) => handleFieldChange("actiedatum", v)} />
              <EditableField label="Datum hoorzitting" value={zaak.datumHoorzitting} type="date" onChange={(v) => handleFieldChange("datumHoorzitting", v)} />
            </div>
            <div className="mt-4">
              <label className="field-label">Aantekeningen</label>
              <textarea
                className="input min-h-[80px] resize-y"
                value={zaak.aantekeningen}
                onChange={(e) => handleFieldChange("aantekeningen", e.target.value)}
                placeholder="Notities bij deze zaak..."
              />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                <ReadonlyField label="Advies uitgebracht" value={zaak.adviesUitgebracht} />
                {zaak.datumAdvies && <ReadonlyField label="Datum advies" value={formatDate(zaak.datumAdvies)} />}
                <ReadonlyField label="Beslissing op bezwaar" value={zaak.beslissingOpBezwaar} />
                {zaak.datumBeslissingOpBezwaar && <ReadonlyField label="Datum beslissing" value={formatDate(zaak.datumBeslissingOpBezwaar)} />}
              </div>
              <button className="btn-primary text-sm" onClick={handleSave}>
                Wijzigingen opslaan
              </button>
            </div>
          </div>

          {/* Workflow sections */}
          <WorkflowSections zaak={zaak} onUpdate={applyWorkflow} />
        </div>

        {/* Right: AI + Documentgenerator */}
        <div className="space-y-6">
          {/* AI Intake placeholder */}
          <div className="card p-5">
            <h2 className="section-title">AI Intake</h2>
            <div className="space-y-3">
              <div>
                <label className="field-label">Upload bezwaarschrift</label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="text-center px-3">
                    <svg className="w-6 h-6 text-gray-300 mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="text-xs text-gray-400">
                      {uploadedFile ?? zaak.uploadedBezwaarFileName ?? "Klik om bestand te uploaden"}
                    </span>
                  </div>
                  <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx" />
                </label>
              </div>
              {(uploadedFile ?? zaak.uploadedBezwaarFileName) ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">AI-analyse (binnenkort beschikbaar)</p>
                  <p className="text-xs text-amber-700">
                    AI-analyse komt later: naam bezwaarmaker, besluitdatum, omschrijving besluit, gronden en eventuele gebreken worden hier automatisch herkend.
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">
                    Upload het bezwaarschrift voor automatische herkenning van gegevens (binnenkort beschikbaar).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Documentgenerator placeholder */}
          <div className="card p-5">
            <h2 className="section-title">Documentgenerator</h2>
            <div className="space-y-2">
              {[
                { key: "ontvangstbevestiging", label: "Genereer ontvangstbevestiging" },
                { key: "herstelverzuimbrief", label: "Genereer herstelverzuimbrief" },
                { key: "uitnodiging_hoorzitting", label: "Genereer uitnodiging hoorzitting" },
                { key: "conceptadvies", label: "Genereer conceptadvies" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <button className="btn-workflow" onClick={() => generateDocument(key)}>
                    <svg className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                      <path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M9 2v3h3M6 9h4M6 11h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    {label}
                  </button>
                  {generatedDocs[key] && (
                    <div className="mt-2 mb-1">
                      <textarea
                        className="input text-xs font-mono min-h-[120px] resize-y bg-gray-50"
                        defaultValue={generatedDocs[key]}
                        readOnly
                      />
                      <p className="text-xs text-gray-400 mt-1">Concept — kopieer naar uw tekstverwerker.</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

function WorkflowSections({ zaak, onUpdate }: { zaak: Case; onUpdate: (u: Partial<Case>) => void }) {
  return (
    <div className="space-y-4">
      <WorkflowSection title="1. Intake">
        <WorkflowButton
          label="Ontvangstbevestiging verzonden"
          description="Bevestiging gestuurd aan bezwaarmaker"
          onClick={() => onUpdate({
            status: "Ontvangstbevestiging verzonden",
            fase: "Informeel",
            verdaagd: "Ja",
            volgendeActie: "Procesdossier opvragen / informele afhandeling beoordelen",
          })}
        />
        <WorkflowButton
          label="Herstelverzuimbrief verzonden"
          description="Bezwaar onvolledig — herstelverzoek verstuurd"
          onClick={() => onUpdate({
            status: "🔴 In afwachting herstel",
            fase: "Intake",
            volgendeActie: "Controleer hersteltermijn",
          })}
        />
        <WorkflowButton
          label="Herstel ontvangen"
          description="Aanvulling op bezwaar ontvangen"
          onClick={() => onUpdate({
            status: "🟢 Herstel ontvangen",
            fase: "Informeel",
            volgendeActie: "Beoordeel informele afhandeling",
          })}
        />
      </WorkflowSection>

      <WorkflowSection title="2. Informele afhandeling">
        <WorkflowButton
          label="Start informele afhandeling"
          description="Informeel traject opgestart"
          onClick={() => onUpdate({
            status: "🟠 In afwachting informele afhandeling",
            fase: "Informeel",
            volgendeActie: "Check vakafdeling",
          })}
        />
        <WorkflowButton
          label="Reminder vakafdeling"
          description="Herinnering verstuurd aan vakafdeling"
          onClick={() => onUpdate({
            volgendeActie: "Reminder vakafdeling verzonden / wacht op reactie",
          })}
        />
        <WorkflowButton
          label="Informeel afgerond"
          description="Informele afhandeling succesvol afgerond"
          onClick={() => onUpdate({
            status: "🟢 Informele afhandeling afgerond",
            fase: "Informeel",
            volgendeActie: "Verzoek intrekking bezwaar versturen",
          })}
        />
        <WorkflowButton
          label="Informeel niet geslaagd"
          description="Geen overeenstemming — zitting plannen"
          onClick={() => onUpdate({
            status: "🔵 Zitting plannen",
            fase: "Zitting",
            volgendeActie: "Plan hoorzitting",
          })}
        />
      </WorkflowSection>

      <WorkflowSection title="3. Hoorzitting en advies">
        <WorkflowButton
          label="Zitting gepland"
          description="Datum hoorzitting vastgesteld"
          onClick={() => onUpdate({
            status: "🔵 Zitting gepland",
            fase: "Zitting",
            volgendeActie: "Uitnodigingen versturen",
          })}
        />
        <WorkflowButton
          label="Uitnodigingen verzonden"
          description="Partijen uitgenodigd voor hoorzitting"
          onClick={() => onUpdate({
            status: "🔵 Uitnodigingen verzonden",
            fase: "Zitting",
            volgendeActie: "Hoorzitting voorbereiden",
          })}
        />
        <WorkflowButton
          label="Hoorzitting geweest"
          description="Hoorzitting heeft plaatsgevonden"
          onClick={() => onUpdate({
            status: "🟣 Advies uitwerken",
            fase: "Advies",
            volgendeActie: "Conceptadvies maken",
          })}
        />
        <WorkflowButton
          label="Advies verzonden"
          description="Advies uitgebracht aan bestuursorgaan"
          onClick={() => onUpdate({
            status: "🟣 Advies verzonden",
            fase: "Afronding",
            adviesUitgebracht: "Ja",
            datumAdvies: todayISO(),
            volgendeActie: "Wachten op beslissing op bezwaar",
          })}
        />
      </WorkflowSection>

      <WorkflowSection title="4. Afronding">
        <WorkflowButton
          label="Beslissing op bezwaar ontvangen"
          description="Definitieve beslissing ontvangen van bestuursorgaan"
          onClick={() => onUpdate({
            beslissingOpBezwaar: "Ja",
            datumBeslissingOpBezwaar: todayISO(),
            volgendeActie: "Zaak sluiten",
          })}
        />
        <WorkflowButton
          label="Zaak afgerond"
          description="Zaak volledig afgesloten"
          onClick={() => onUpdate({
            status: "⚫ Afgerond",
            fase: "Afronding",
            volgendeActie: "Geen",
          })}
        />
      </WorkflowSection>
    </div>
  );
}

function WorkflowSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-gray-100">
          <div className="pt-3 space-y-2">{children}</div>
        </div>
      )}
    </div>
  );
}

function WorkflowButton({ label, description, onClick }: { label: string; description: string; onClick: () => void }) {
  const [clicked, setClicked] = useState(false);

  function handleClick() {
    onClick();
    setClicked(true);
    setTimeout(() => setClicked(false), 1500);
  }

  return (
    <button
      className={`btn-workflow group ${clicked ? "bg-green-50 border-green-200 text-green-800" : ""}`}
      onClick={handleClick}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-gray-400 group-hover:text-gray-500 mt-0.5">{description}</div>
      </div>
      {clicked ? (
        <svg className="w-4 h-4 text-green-500 flex-shrink-0 ml-2" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" clipRule="evenodd"/>
        </svg>
      ) : (
        <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 ml-2 transition-colors" viewBox="0 0 16 16" fill="none">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-gray-900 font-medium">{value || "—"}</p>
    </div>
  );
}

function EditableField({ label, value, type = "text", onChange }: {
  label: string; value: string; type?: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input type={type} className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-700">{value}</p>
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

export default function ZaakDetailPage({ params }: { params: { id: string } }) {
  return (
    <CasesProvider>
      <ZaakDetailContent id={params.id} />
    </CasesProvider>
  );
}
