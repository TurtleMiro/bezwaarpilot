"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CasesProvider, useCases } from "@/lib/CasesContext";
import { Case } from "@/lib/types";
import { todayISO, addDays, addWeeks, formatDate } from "@/lib/dateUtils";
import { generateId } from "@/lib/store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedData {
  bezwaarmaker?: string | null;
  gemachtigde?: string | null;
  adres?: string | null;
  datumBezwaarschrift?: string | null;
  datumBesluit?: string | null;
  omschrijvingBesluit?: string | null;
  typeBesluit?: string | null;
  grondenAanwezig?: boolean | null;
  grondenSamenvatting?: string | null;
  ondertekeningAanwezig?: boolean | null;
  adresAanwezig?: boolean | null;
  dagtekeningAanwezig?: boolean | null;
  ontbrekendeVelden?: string[];
  opmerkingen?: string | null;
}

interface Awb65Check {
  namePresent: boolean | "uncertain";
  addressPresent: boolean | "uncertain";
  datePresent: boolean | "uncertain";
  signaturePresent: boolean | "uncertain";
  decisionDescriptionPresent: boolean | "uncertain";
  groundsPresent: boolean | "uncertain";
  missingOrUncertain: string[];
}

interface RepresentativeInfo {
  name: string | null;
  type: "advocaat" | "onzeker";
  authorizationFound: boolean;
}

// ─── Analysis utilities ───────────────────────────────────────────────────────

function analyzeAwb65Requirements(extracted: ExtractedData): Awb65Check {
  const toResult = (val: boolean | null | undefined): boolean | "uncertain" =>
    val === null || val === undefined ? "uncertain" : val;

  const namePresent: boolean | "uncertain" = extracted.bezwaarmaker ? true : "uncertain";
  const addressPresent = toResult(extracted.adresAanwezig);
  const datePresent = toResult(extracted.dagtekeningAanwezig);
  const signaturePresent = toResult(extracted.ondertekeningAanwezig);
  const decisionDescriptionPresent: boolean | "uncertain" = extracted.omschrijvingBesluit ? true : "uncertain";
  const groundsPresent = toResult(extracted.grondenAanwezig);

  const labelMap: Record<string, string> = {
    namePresent: "Naam indiener",
    addressPresent: "Adres indiener",
    datePresent: "Dagtekening",
    signaturePresent: "Ondertekening",
    decisionDescriptionPresent: "Omschrijving besluit",
    groundsPresent: "Gronden / omschrijving bezwaar",
  };

  const entries: Record<string, boolean | "uncertain"> = {
    namePresent, addressPresent, datePresent, signaturePresent,
    decisionDescriptionPresent, groundsPresent,
  };

  const missingOrUncertain = Object.entries(entries)
    .filter(([, v]) => v !== true)
    .map(([k]) => labelMap[k]);

  return {
    namePresent, addressPresent, datePresent, signaturePresent,
    decisionDescriptionPresent, groundsPresent, missingOrUncertain,
  };
}

function detectRepresentative(extracted: ExtractedData): RepresentativeInfo | null {
  if (!extracted.gemachtigde) return null;
  const name = extracted.gemachtigde;
  const lower = name.toLowerCase();
  const isAdvocaat = lower.includes("advocat") || lower.includes("mr.") || lower.includes("mr ");
  return {
    name,
    type: isAdvocaat ? "advocaat" : "onzeker",
    authorizationFound: false,
  };
}

// ─── Document templates ───────────────────────────────────────────────────────

function generateOntvangstbevestiging(extracted: ExtractedData): string {
  const decisionDate = extracted.datumBesluit ? formatDate(extracted.datumBesluit) : "[datum besluit]";
  const decisionDesc = extracted.omschrijvingBesluit || "[omschrijving besluit]";
  const today = formatDate(todayISO());
  return `Datum: ${today}

Geachte heer, mevrouw,

Uw bezwaarschrift is in goede orde ontvangen. Uw bezwaarschrift is gericht tegen het besluit van ${decisionDate}, inhoudende ${decisionDesc}.

Uw bezwaarschrift is voor behandeling in handen gesteld van de algemene commissie bezwaarschriften. Deze onafhankelijke commissie is belast met de advisering over de ingediende bezwaren.

Op grond van artikel 7:10, eerste lid, van de Algemene wet bestuursrecht dient op uw bezwaarschrift binnen 12 weken, gerekend vanaf de dag na die waarop de termijn voor het indienen van het bezwaarschrift is verstreken, te worden beslist. De beslissing op uw bezwaarschrift wordt op grond van artikel 7:10, derde lid, van de Algemene wet bestuursrecht voor ten hoogste zes weken verdaagd.

In het kader van de bezwaarprocedure kan een hoorzitting worden gehouden. U ontvangt hiervoor te zijner tijd een schriftelijke uitnodiging.

Met vriendelijke groet,

[Naam secretaris]
Commissie Bezwaarschriften`;
}

function generateHerstelverzuimbrief(extracted: ExtractedData, missingOrUncertain: string[]): string {
  const today = formatDate(todayISO());
  const hersteltermijn = formatDate(addDays(todayISO(), 14));
  const missingList = missingOrUncertain.map((m) => `- ${m}`).join("\n");
  return `Datum: ${today}

Geachte heer, mevrouw,

Uw bezwaarschrift is ontvangen. Het bezwaarschrift voldoet op dit moment nog niet volledig aan de vereisten van artikel 6:5 van de Algemene wet bestuursrecht.

Het volgende gebrek / de volgende gebreken zijn geconstateerd:
${missingList}

Ik bied u de gelegenheid om dit gebrek / deze gebreken binnen twee weken na verzending van deze brief te herstellen, dat wil zeggen uiterlijk ${hersteltermijn}. Indien u het gebrek / de gebreken niet binnen de gestelde termijn herstelt, kan uw bezwaarschrift niet-ontvankelijk worden verklaard. Dat betekent dat niet inhoudelijk op uw bezwaar wordt ingegaan.

Op grond van artikel 7:10, tweede lid, van de Algemene wet bestuursrecht wordt de beslistermijn opgeschort tot de dag waarop het verzuim is hersteld of de daarvoor gestelde termijn ongebruikt is verstreken.

Nadat het gebrek / de gebreken zijn hersteld, zal uw bezwaar verder in behandeling worden genomen.

Met vriendelijke groet,

[Naam secretaris]
Commissie Bezwaarschriften`;
}

// ─── Flow component ───────────────────────────────────────────────────────────

type FlowStep = "idle" | "loading" | "result" | "preview";

function NieuwBezwaarFlow() {
  const router = useRouter();
  const { addCase } = useCases();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<FlowStep>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [awb65, setAwb65] = useState<Awb65Check | null>(null);
  const [rep, setRep] = useState<RepresentativeInfo | null>(null);
  const [docType, setDocType] = useState<"ontvangst" | "herstel" | null>(null);
  const [docText, setDocText] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleAnalyze() {
    if (!selectedFile) return;
    setStep("loading");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const res = await fetch("/api/extract-bezwaar", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Analyse mislukt."); setStep("idle"); return; }
      const data: ExtractedData = json.extracted;
      setExtracted(data);
      setAwb65(analyzeAwb65Requirements(data));
      setRep(detectRepresentative(data));
      setStep("result");
    } catch {
      setError("Verbindingsfout. Controleer uw internetverbinding.");
      setStep("idle");
    }
  }

  function handleGenerate(type: "ontvangst" | "herstel") {
    if (!extracted || !awb65) return;
    setDocType(type);
    setDocText(
      type === "ontvangst"
        ? generateOntvangstbevestiging(extracted)
        : generateHerstelverzuimbrief(extracted, awb65.missingOrUncertain)
    );
    setStep("preview");
  }

  function handleSaveAndOpen() {
    if (!extracted || !awb65 || !docType) return;
    const isHerstel = docType === "herstel";
    const hersteltermijn = addDays(todayISO(), 14);
    const besluit6wk = extracted.datumBesluit ? addWeeks(extracted.datumBesluit, 6) : "";
    const beslistermijn12wk = besluit6wk ? addWeeks(besluit6wk, 12) : "";

    const newCase: Case = {
      id: generateId(),
      zaaknummer: `BZ-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
      bezwaarmaker: extracted.bezwaarmaker || "Onbekend",
      gemachtigde: extracted.gemachtigde || "",
      omschrijvingBesluit: extracted.omschrijvingBesluit || "",
      typeBesluit: extracted.typeBesluit || "",
      datumOntvangst: todayISO(),
      datumBesluit: extracted.datumBesluit || "",
      einddatumBezwaartermijn: besluit6wk,
      beslistermijn12Weken: beslistermijn12wk,
      verdaagd: isHerstel ? "Nee" : "Ja",
      beslistermijnNaVerdaging: isHerstel ? "" : (beslistermijn12wk ? addWeeks(beslistermijn12wk, 6) : ""),
      actiedatum: isHerstel ? hersteltermijn : "",
      datumHoorzitting: "",
      aantekeningen: "",
      status: isHerstel ? "🔴 In afwachting herstel" : "Ontvangstbevestiging gegenereerd",
      fase: isHerstel ? "Intake" : "Informeel",
      volgendeActie: isHerstel
        ? "Controleer of herstel is ontvangen"
        : "Procesdossier opvragen / informele afhandeling beoordelen",
      adviesUitgebracht: "Nee",
      beslissingOpBezwaar: "Nee",
      datumAdvies: "",
      datumBeslissingOpBezwaar: "",
      hersteltermijn: isHerstel ? hersteltermijn : "",
      intakeKaartGegenereerd: true,
      uploadedBezwaarFileName: selectedFile?.name,
    };

    addCase(newCase);
    router.push(`/zaak/${newCase.id}`);
  }

  function handleCopy() {
    navigator.clipboard.writeText(docText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            ← Terug
          </button>
          <span className="text-gray-200">|</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="BezwaarPilot" className="w-6 h-6 rounded-md object-cover" />
          <span className="font-semibold text-gray-900 text-sm">BezwaarPilot</span>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-600 font-medium">Nieuw bezwaar</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* ── Step: idle / loading ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 12v2.25A1.75 1.75 0 003.75 16h10.5A1.75 1.75 0 0016 14.25V12M9 2v9M6 5l3-3 3 3" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Upload bezwaarschrift</h1>
              <p className="text-xs text-gray-500">PDF of DOCX — de AI controleert artikel 6:5 Awb automatisch</p>
            </div>
          </div>

          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
            selectedFile ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"
          }`}>
            {selectedFile ? (
              <div className="text-center">
                <svg className="w-6 h-6 text-blue-400 mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="text-sm font-semibold text-blue-700">{selectedFile.name}</p>
                <p className="text-xs text-blue-500 mt-0.5">Klik om ander bestand te kiezen</p>
              </div>
            ) : (
              <div className="text-center">
                <svg className="w-7 h-7 text-gray-300 mx-auto mb-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm font-semibold text-gray-600">Bestand uploaden</p>
                <p className="text-xs text-gray-400 mt-0.5">PDF of DOCX</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSelectedFile(f); setError(null); } }}
            />
          </label>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!selectedFile || step === "loading"}
            className="w-full py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {step === "loading" ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                Bezwaarschrift analyseren...
              </>
            ) : (
              "Analyseer bezwaarschrift"
            )}
          </button>
        </div>

        {/* ── Step: result ─────────────────────────────────────────────── */}
        {step === "result" && awb65 && (
          <>
            {/* Article 6:5 Awb check */}
            <Awb65CheckResult awb65={awb65} />

            {/* Representative block — only if detected */}
            {rep && <RepresentativeBlock rep={rep} />}

            {/* Conclusion + action */}
            <ConclusionBlock awb65={awb65} onGenerate={handleGenerate} />
          </>
        )}

        {/* ── Step: preview ────────────────────────────────────────────── */}
        {step === "preview" && (
          <DocumentPreview
            docType={docType!}
            docText={docText}
            copied={copied}
            onTextChange={setDocText}
            onCopy={handleCopy}
            onSave={handleSaveAndOpen}
            onBack={() => setStep("result")}
          />
        )}

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Awb65CheckResult({ awb65 }: { awb65: Awb65Check }) {
  const checks: { label: string; value: boolean | "uncertain" }[] = [
    { label: "Naam indiener",              value: awb65.namePresent },
    { label: "Adres indiener",             value: awb65.addressPresent },
    { label: "Dagtekening",                value: awb65.datePresent },
    { label: "Ondertekening",              value: awb65.signaturePresent },
    { label: "Omschrijving besluit",       value: awb65.decisionDescriptionPresent },
    { label: "Gronden / omschrijving bezwaar", value: awb65.groundsPresent },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-800">Controle artikel 6:5 Awb</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {checks.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-700">{label}</span>
            <CheckBadge value={value} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckBadge({ value }: { value: boolean | "uncertain" }) {
  if (value === true) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <span className="text-base leading-none">✅</span> aanwezig
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
        <span className="text-base leading-none">❗</span> ontbreekt
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
      <span className="text-base leading-none">❗</span> onzeker
    </span>
  );
}

function RepresentativeBlock({ rep }: { rep: RepresentativeInfo }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-800">Vertegenwoordiging</h2>
      </div>
      <div className="px-5 py-4 space-y-2">
        <Row label="Gemachtigde aangetroffen" value="ja" />
        <Row label="Naam gemachtigde" value={rep.name ?? "onbekend"} />
        <Row label="Type" value={rep.type === "advocaat" ? "advocaat / advocatenkantoor" : "niet-advocaat / onzeker"} />
        {rep.type === "advocaat" ? (
          <Row label="Machtiging nodig" value="nee" />
        ) : (
          <>
            <Row label="Machtiging aangetroffen" value="nee" />
            <p className="text-xs text-amber-700 flex items-center gap-1.5 mt-1">
              <span>❗</span> Controleer of een machtiging moet worden gevraagd.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-800 text-right">{value}</span>
    </div>
  );
}

function ConclusionBlock({ awb65, onGenerate }: {
  awb65: Awb65Check;
  onGenerate: (type: "ontvangst" | "herstel") => void;
}) {
  const allOk = awb65.missingOrUncertain.length === 0;

  if (allOk) {
    return (
      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 space-y-4">
        <p className="text-sm font-semibold text-emerald-800">
          ✅ Het bezwaarschrift lijkt te voldoen aan de vereisten van artikel 6:5 Awb.
        </p>
        <div>
          <p className="text-xs text-emerald-700 font-medium mb-3">Voorgestelde vervolgstap: genereer een ontvangstbevestiging.</p>
          <button
            onClick={() => onGenerate("ontvangst")}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm"
          >
            Genereer ontvangstbevestiging
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-100 rounded-2xl p-5 space-y-4">
      <p className="text-sm font-semibold text-red-800">
        ❗ Het bezwaarschrift lijkt nog niet volledig te voldoen aan de vereisten van artikel 6:5 Awb.
      </p>
      <div>
        <p className="text-xs text-red-700 font-medium mb-2">Ontbrekend of onzeker:</p>
        <ul className="space-y-1 mb-4">
          {awb65.missingOrUncertain.map((item) => (
            <li key={item} className="text-xs text-red-700 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs text-red-700 font-medium mb-3">Voorgestelde vervolgstap: genereer een ontvangstbevestiging met herstelverzuim.</p>
        <button
          onClick={() => onGenerate("herstel")}
          className="w-full py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 active:scale-[0.98] transition-all shadow-sm"
        >
          Genereer ontvangstbevestiging met herstelverzuim
        </button>
      </div>
    </div>
  );
}

function DocumentPreview({ docType, docText, copied, onTextChange, onCopy, onSave, onBack }: {
  docType: "ontvangst" | "herstel";
  docText: string;
  copied: boolean;
  onTextChange: (t: string) => void;
  onCopy: () => void;
  onSave: () => void;
  onBack: () => void;
}) {
  const title = docType === "ontvangst" ? "Ontvangstbevestiging" : "Ontvangstbevestiging met herstelverzuim";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden pb-6">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          ← Terug
        </button>
      </div>
      <div className="px-5 pt-4">
        <textarea
          className="w-full text-xs font-mono text-gray-700 border border-gray-200 rounded-xl p-3 resize-y focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300 transition-all bg-gray-50"
          rows={16}
          value={docText}
          onChange={(e) => onTextChange(e.target.value)}
        />
        <p className="text-xs text-gray-400 mt-1.5">Tekst is bewerkbaar — pas aan voor opslaan of kopiëren.</p>
      </div>
      <div className="px-5 pt-4 flex gap-3">
        <button
          onClick={onCopy}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all"
        >
          {copied ? "✓ Gekopieerd" : "Kopieer tekst"}
        </button>
        <button
          onClick={onSave}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm"
        >
          Opslaan bij zaak →
        </button>
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function NieuwBezwaarPage() {
  return (
    <CasesProvider>
      <NieuwBezwaarFlow />
    </CasesProvider>
  );
}
