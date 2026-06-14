import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { message, history, caseContext } = await req.json();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI niet geconfigureerd — voeg GROQ_API_KEY toe als omgevingsvariabele." },
      { status: 503 }
    );
  }

  const systemPrompt = `Je bent een AI assistent voor BezwaarPilot, een systeem voor het beheren van bezwaarzaken bij de Nederlandse overheid. Je helpt medewerkers met het opstellen van brieven, het analyseren van bezwaren, en het beantwoorden van vragen over de bezwaarprocedure.

Huidige zaak:
- Zaaknummer: ${caseContext.zaaknummer}
- Bezwaarmaker: ${caseContext.bezwaarmaker}
- Fase: ${caseContext.fase}
- Volgende actie: ${caseContext.volgendeActie || "Niet ingesteld"}
- Aantekeningen: ${caseContext.aantekeningen || "Geen"}

Antwoord altijd in het Nederlands. Wees beknopt maar volledig.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...(history as { role: string; text: string }[]).map((h) => ({
      role: h.role === "ai" ? "assistant" : "user",
      content: h.text,
    })),
    { role: "user", content: message },
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Groq error:", err);
    return NextResponse.json({ error: "AI-fout: " + response.statusText }, { status: 500 });
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) return NextResponse.json({ error: "Geen antwoord ontvangen van AI" }, { status: 500 });

  return NextResponse.json({ reply: text });
}
