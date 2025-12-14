import OpenAI from "openai";

// Cache + rate-limit simples em memória (serverless: ajuda quando a instância é reutilizada)
globalThis.__presetCache ??= new Map(); // key -> { data, ts }
globalThis.__rateLimit ??= new Map();   // ip -> lastTs

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias
const MIN_INTERVAL_MS = 1500; // 1.5s entre requests por IP

export default async function handler(req, res) {
  try {
    // Só POST
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    // Chave obrigatória
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY ausente nas Environment Variables da Vercel" });
    }

    // Rate limit por IP
    const ipRaw = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
    const ip = String(ipRaw).split(",")[0].trim();
    const now = Date.now();
    const last = globalThis.__rateLimit.get(ip) || 0;
    if (now - last < MIN_INTERVAL_MS) {
      return res.status(429).json({ ok: false, error: "Muitas tentativas. Aguarde 2 segundos e tente de novo." });
    }
    globalThis.__rateLimit.set(ip, now);

    // Body
    const { tipo, marca, modelo, ano, uf } = req.body || {};
    if (!tipo || !marca || !modelo || !ano) {
      return res.status(400).json({ ok: false, error: "Campos obrigatórios: tipo, marca, modelo, ano" });
    }

    const tipoNorm = String(tipo).toLowerCase();
    if (tipoNorm !== "ev" && tipoNorm !== "comb") {
      return res.status(400).json({ ok: false, error: "tipo deve ser 'ev' ou 'comb'" });
    }

    const marcaNorm = String(marca).trim();
    const modeloNorm = String(modelo).trim();
    const anoNum = parseInt(ano, 10);
    const ufNorm = String(uf || "SP").trim().toUpperCase();

    if (!marcaNorm || !modeloNorm || !Number.isFinite(anoNum)) {
      return res.status(400).json({ ok: false, error: "Dados inválidos (marca/modelo/ano)" });
    }

    // Cache
    const key = `${tipoNorm}|${marcaNorm}|${modeloNorm}|${anoNum}|${ufNorm}`.toLowerCase();
    const cached = globalThis.__presetCache.get(key);
    if (cached && (now - cached.ts) < CACHE_TTL_MS) {
      return res.status(200).json({ ok: true, data: cached.data, cached: true });
    }

    // OpenAI
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
- Se tipo="comb": preencher consumo_km_l; consumo_km_kwh/autonomia_km = null.
- Se tipo="ev": preencher consumo_km_kwh e, se possível, autonomia_km; consumo_km_l = null.
- ipva_pct: estime por UF se souber; senão use 4.
- Se estiver incerto: confianca="baixa" e explique em observacoes.
- Use valores realistas para Brasil (aprox.). Não invente detalhes específicos quando não souber.
`;

    const user = `
Tipo: ${tipoNorm}
Marca: ${marcaNorm}
Modelo: ${modeloNorm}
Ano: ${anoNum}
UF: ${ufNorm}
`;

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

    // salva no cache
    globalThis.__presetCache.set(key, { data, ts: now });

    return res.status(200).json({ ok: true, data, cached: false });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
