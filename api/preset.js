import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const { tipo, marca, modelo, ano, uf } = req.body || {};
    if (!tipo || !marca || !modelo || !ano) {
      return res.status(400).json({ ok: false, error: "Campos obrigatórios: tipo, marca, modelo, ano" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY ausente nas Environment Variables da Vercel" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: "Retorne apenas JSON com os campos do preset." },
        { role: "user", content: `Tipo:${tipo}\nMarca:${marca}\nModelo:${modelo}\nAno:${ano}\nUF:${uf || "SP"}\nResponda só JSON.` }
      ],
      response_format: { type: "json_object" }
    });

    const text = response.output[0].content[0].text;
    const data = JSON.parse(text);

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    // ⚠️ DEBUG temporário: mostra o erro real
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err)
    });
  }
}
