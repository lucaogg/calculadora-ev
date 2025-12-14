import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY ausente na Vercel" });
    }

    const { tipo, marca, modelo, ano, uf } = req.body || {};
    if (!tipo || !marca || !modelo || !ano) {
      return res.status(400).json({ ok: false, error: "Campos obrigatórios: tipo, marca, modelo, ano" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = `
Você é um especialista em mercado automotivo brasileiro.
Responda SOMENTE com JSON válido, no formato:

{
  "preco_fipe": number,
  "consumo_km_l": number | null,
  "consumo_km_kwh": number | null,
  "autonomia_km": number | null,
  "seguro_medio_anual": number,
  "depreciacao_primeiro_ano_pct": number,
  "depreciacao_demais_anos_pct": number,
  "ipva_pct": number,
  "confianca": "alta" | "media" | "baixa",
  "observacoes": "string curta"
}

Regras:
- Se tipo="comb": preencher consumo_km_l; consumo_km_kwh/autonomia_km = null
- Se tipo="ev": preencher consumo_km_kwh e, se possível, autonomia_km; consumo_km_l = null
- Se não souber: confianca="baixa" e explique em observacoes
`;

    const user = `
Tipo: ${tipo}
Marca: ${marca}
Modelo: ${modelo}
Ano: ${ano}
UF: ${uf || "SP"}
`;

    // ✅ Usa Chat Completions (compatível com response_format)
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      response_format: { type: "json_object" }
    });

    const text = completion.choices?.[0]?.message?.content || "{}";
    const data = JSON.parse(text);

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}


