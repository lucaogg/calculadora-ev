import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  try {
    const { tipo, marca, modelo, ano, uf } = req.body || {};

    if (!tipo || !marca || !modelo || !ano) {
      return res.status(400).json({ ok: false, error: "Campos obrigatórios: tipo, marca, modelo, ano" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = `
Você é um assistente especializado em mercado automotivo brasileiro.
Retorne SEMPRE um JSON válido e somente o JSON, no formato:

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
- Se tipo = "comb", preencha consumo_km_l e deixe consumo_km_kwh/autonomia_km como null.
- Se tipo = "ev", preencha consumo_km_kwh e (se possível) autonomia_km; consumo_km_l = null.
- ipva_pct: estime com base na UF se souber; caso contrário use 4.
- Se estiver incerto, marque confianca baixa e explique em observacoes.
`;

    const user = `
Tipo: ${tipo}
Marca: ${marca}
Modelo: ${modelo}
Ano: ${ano}
UF: ${uf || "desconhecida"}

Responda somente com o JSON.
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      response_format: { type: "json_object" }
    });

    const text = response.output[0].content[0].text;
    const data = JSON.parse(text);

    return res.status(200).json({ ok: true, data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Erro no preset" });
  }
}
