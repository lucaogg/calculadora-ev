import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY não encontrada nas variáveis de ambiente"
      });
    }

    const { tipo, marca, modelo, ano, uf } = req.body || {};

    if (!tipo || !marca || !modelo || !ano) {
      return res.status(400).json({
        ok: false,
        error: "Campos obrigatórios faltando"
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: "Responda APENAS JSON válido, sem texto extra."
        },
        {
          role: "user",
          content: `
Tipo: ${tipo}
Marca: ${marca}
Modelo: ${modelo}
Ano: ${ano}
UF: ${uf || "SP"}

Retorne JSON com:
preco_fipe,
consumo_km_l OU consumo_km_kwh,
seguro_medio_anual,
depreciacao_primeiro_ano_pct,
depreciacao_demais_anos_pct,
ipva_pct
          `
        }
      ],
      response_format: { type: "json_object" }
    });

    const text = response.output_text;
    const data = JSON.parse(text);

    return res.status(200).json({ ok: true, data });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || String(err)
    });
  }
}

