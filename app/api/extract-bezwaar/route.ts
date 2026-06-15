import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const SYSTEM_PROMPT = `Je bent een expert in Nederlandse bestuursrechtelijke procedures. Je analyseert bezwaarschriften op de vereisten van artikel 6:5 Algemene wet bestuursrecht (Awb).

Artikel 6:5 Awb vereist:
1. Naam en adres van de indiener
2. Dagtekening (datum van het bezwaarschrift)
3. Omschrijving van het besluit waartegen bezwaar wordt gemaakt
4. De gronden van het bezwaar
5. Ondertekening

Analyseer het document en retourneer UITSLUITEND een geldig JSON object (geen uitleg, geen markdown, geen tekst erbuiten):
{
  "bezwaarmaker": "volledige naam of null",
  "gemachtigde": "naam gemachtigde of null",
  "adres": "adres van bezwaarmaker of null",
  "datumBezwaarschrift": "YYYY-MM-DD of null",
  "datumBesluit": "YYYY-MM-DD of null",
  "omschrijvingBesluit": "omschrijving bestreden besluit of null",
  "typeBesluit": "type besluit of null",
  "grondenAanwezig": true of false,
  "grondenSamenvatting": "samenvatting gronden of null",
  "ondertekeningAanwezig": true of false,
  "adresAanwezig": true of false,
  "dagtekeningAanwezig": true of false,
  "ontbrekendeVelden": ["array met namen van ontbrekende vereiste velden"],
  "opmerkingen": "opmerkingen over formele gebreken of null"
}`;

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI niet geconfigureerd — voeg GROQ_API_KEY toe." }, { status: 503 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Geen bestand ontvangen" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileName = file.name.toLowerCase();

  let extractedText = "";

  try {
    if (fileName.endsWith(".pdf")) {
      const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
      const data = await pdfParse(buffer);
      extractedText = data.text;
    } else if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else {
      return NextResponse.json({ error: "Bestandstype niet ondersteund. Gebruik PDF of DOCX." }, { status: 400 });
    }
  } catch (err) {
    console.error("Tekstextractie mislukt:", err);
    return NextResponse.json({ error: "Kon tekst niet extraheren. Mogelijk een gescand (niet-doorzoekbaar) PDF." }, { status: 422 });
  }

  if (!extractedText.trim()) {
    return NextResponse.json({ error: "Geen tekst gevonden in het bestand. Waarschijnlijk een gescand document zonder tekstlaag." }, { status: 422 });
  }

  // Groq context limit — keep first 8000 chars
  const textForAI = extractedText.slice(0, 8000);

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analyseer dit bezwaarschrift:\n\n${textForAI}` },
      ],
      max_tokens: 1024,
      temperature: 0.1,
    }),
  });

  if (!groqResponse.ok) {
    const err = await groqResponse.text();
    console.error("Groq fout:", err);
    return NextResponse.json({ error: "AI-analyse mislukt: " + groqResponse.statusText }, { status: 500 });
  }

  const groqData = await groqResponse.json();
  const content: string = groqData.choices?.[0]?.message?.content ?? "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? content);
    return NextResponse.json({ extracted: parsed });
  } catch {
    console.error("JSON parse mislukt:", content);
    return NextResponse.json({ error: "AI retourneerde geen geldig formaat. Probeer opnieuw." }, { status: 500 });
  }
}
