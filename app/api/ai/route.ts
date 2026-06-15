import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const tools = [
  {
    type: "function",
    function: {
      name: "update_field",
      description: "Update a specific field of the current bezwaar case. Use this when the user asks to change, set, or update case information such as dates, next action, phase, or status.",
      parameters: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: ["actiedatum", "volgendeActie", "fase", "datumHoorzitting", "datumBesluit", "datumOntvangst", "status"],
            description: "The field to update",
          },
          value: {
            type: "string",
            description: "The new value. For date fields use YYYY-MM-DD format. For fase use exactly one of: Intake, Informeel, Hoorzitting, Advies, Afronding",
          },
          label: {
            type: "string",
            description: "Short Dutch description of the change shown to the user before they confirm, e.g. 'Actiedatum instellen op 20 juni 2026'",
          },
        },
        required: ["field", "value", "label"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_note",
      description: "Append a timestamped note to the case's aantekeningen. Use this when the user wants to log something, add a note, or when you draft text they want saved.",
      parameters: {
        type: "object",
        properties: {
          note: {
            type: "string",
            description: "The note text to append (without timestamp, that is added automatically)",
          },
          label: {
            type: "string",
            description: "Short Dutch description shown to the user before they confirm, e.g. 'Notitie toevoegen: bezwaarmaker heeft gebeld'",
          },
        },
        required: ["note", "label"],
      },
    },
  },
];

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

  const systemPrompt = `Je bent een AI assistent voor BezwaarPilot, een systeem voor het beheren van bezwaarzaken bij de Nederlandse overheid. Je helpt medewerkers met het opstellen van brieven, het analyseren van bezwaren, het beantwoorden van vragen over de bezwaarprocedure, en het bijwerken van zaakgegevens.

Huidige zaak:
- Zaaknummer: ${caseContext.zaaknummer}
- Bezwaarmaker: ${caseContext.bezwaarmaker}
- Fase: ${caseContext.fase}
- Volgende actie: ${caseContext.volgendeActie || "Niet ingesteld"}
- Aantekeningen: ${caseContext.aantekeningen || "Geen"}

Gebruik de beschikbare tools wanneer de gebruiker iets wil wijzigen of opslaan in de zaak. Vraag altijd bevestiging via de tool (dat doet het systeem automatisch). Antwoord altijd in het Nederlands. Wees beknopt maar volledig.`;

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
      tools,
      tool_choice: "auto",
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Groq error:", err);
    return NextResponse.json({ error: "AI-fout: " + response.statusText }, { status: 500 });
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const msg = choice?.message;
  const toolCall = msg?.tool_calls?.[0];
  const text = msg?.content;

  if (toolCall) {
    let args: Record<string, string> = {};
    try { args = JSON.parse(toolCall.function.arguments); } catch { /* keep empty */ }
    return NextResponse.json({
      reply: text || `Ik wil de volgende wijziging doorvoeren: ${args.label || ""}`,
      toolCall: { name: toolCall.function.name, args },
    });
  }

  if (!text) return NextResponse.json({ error: "Geen antwoord ontvangen van AI" }, { status: 500 });
  return NextResponse.json({ reply: text });
}
