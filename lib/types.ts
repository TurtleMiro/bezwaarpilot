export interface Case {
  id: string;
  zaaknummer: string;
  bezwaarmaker: string;
  status: string;
  fase: string;
  datumOntvangst: string;
  datumBesluit: string;
  einddatumBezwaartermijn: string;
  beslistermijn12Weken: string;
  verdaagd: "Ja" | "Nee";
  beslistermijnNaVerdaging: string;
  volgendeActie: string;
  actiedatum: string;
  datumHoorzitting: string;
  adviesUitgebracht: "Ja" | "Nee";
  datumAdvies: string;
  beslissingOpBezwaar: "Ja" | "Nee";
  datumBeslissingOpBezwaar: string;
  aantekeningen: string;
  uploadedBezwaarFileName?: string;
  generatedDocument?: string;
}

export type FaseFilter =
  | "Alle"
  | "Intake"
  | "Informeel"
  | "Zitting"
  | "Hoorzitting"
  | "Advies"
  | "Afronding";

export const STATUS_VALUES = {
  INTAKE_GESTART: "Intake gestart",
  ONTVANGSTBEVESTIGING_VERZONDEN: "Ontvangstbevestiging verzonden",
  IN_AFWACHTING_HERSTEL: "🔴 In afwachting herstel",
  HERSTEL_ONTVANGEN: "🟢 Herstel ontvangen",
  IN_AFWACHTING_INFORMEEL: "🟠 In afwachting informele afhandeling",
  INFORMEEL_AFGEROND: "🟢 Informele afhandeling afgerond",
  ZITTING_PLANNEN: "🔵 Zitting plannen",
  ZITTING_GEPLAND: "🔵 Zitting gepland",
  UITNODIGINGEN_VERZONDEN: "🔵 Uitnodigingen verzonden",
  ADVIES_UITWERKEN: "🟣 Advies uitwerken",
  ADVIES_VERZONDEN: "🟣 Advies verzonden",
  AFGEROND: "⚫ Afgerond",
} as const;
