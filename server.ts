/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '2mb' }));

// Inicialização segura do cliente Gemini SDK no backend
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

/**
 * Rota para verificar a disponibilidade da API do Gemini sem expor a chave
 */
app.get('/api/status-gemini', (req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  res.json({
    hasKey,
    model: 'gemini-3.8-flash',
    provider: 'Google AI Studio (Servidor Seguro)',
  });
});

/**
 * Rota segura para extração de dados de nota fiscal com Gemini
 */
app.post('/api/extrair-nota-gemini', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      res.status(400).json({
        success: false,
        error: 'TEXTO_VAZIO',
        message: 'O texto da nota fiscal não foi informado.',
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        success: false,
        error: 'SEM_CHAVE_API',
        message:
          'A variável de ambiente GEMINI_API_KEY não está configurada no servidor. É possível utilizar a extração por regras enquanto isso.',
      });
      return;
    }

    // Prompt aprimorado com regras explícitas para detecção de divergências
    const prompt = `Analise o texto da seguinte nota fiscal, fatura, boleto ou recibo brasileiro e extraia os dados com extremo rigor contábil.

TEXTO DO DOCUMENTO:
"""
${text}
"""

REGRAS OBRIGATÓRIAS DE SEGURANÇA E CONFORMIDADE:
1. NÃO invente, não deduza e não alucine dados que não estejam expressos no texto.
2. Fornecedor: retorne a Razão Social ou Nome Empresarial da empresa emitente. Se não for possível identificar, retorne null.
3. VALORES MONETÁRIOS E DIVERGÊNCIAS:
   - Identifique todos os valores que possam representar o TOTAL DA COBRANÇA a pagar.
   - NÃO confunda impostos isolados (ICMS, ISS, IPI, PIS, COFINS, IRRF), retenções, descontos ou subtotais parciais com o valor total da cobrança. Considere os rótulos e o contexto de cada número.
   - Se houver dois ou mais valores monetários diferentes que possam representar o total da cobrança (por exemplo, valor da fatura diferente do valor do boleto), marque "temDivergenciaValor": true.
   - NUNCA escolha automaticamente entre valores divergentes. Liste todos em "valoresCandidatos" com seus respectivos rótulos e trecho de contexto.
4. DATAS DE VENCIMENTO E DIVERGÊNCIAS:
   - Identifique as datas limites para pagamento da cobrança.
   - NÃO confunda data de emissão ou data da nota com data de vencimento. Se houver apenas data de emissão sem data de vencimento, não a marque como vencimento.
   - Se houver duas ou mais datas de vencimento diferentes concorrendo (por exemplo, vencimento da fatura diferente do vencimento do boleto), marque "temDivergenciaVencimento": true.
   - NUNCA escolha automaticamente entre datas divergentes. Liste todas em "vencimentosCandidatos" com seus respectivos rótulos e trecho de contexto.
5. Se não houver divergência e existir um único valor total legítimo, informe-o em "valor" (número float). Se houver divergência, defina "valor" como null.
6. Se não houver divergência e existir um único vencimento legítimo, informe-o em "dataVencimento" (formato YYYY-MM-DD ou DD/MM/AAAA). Se houver divergência, defina "dataVencimento" como null.`;

    let response: any;
    let modelUsed = 'gemini-3.1-flash-lite';

    const schemaConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fornecedor: {
            type: Type.STRING,
            description: 'Nome da empresa fornecedora ou null se não identificado no texto.',
          },
          valor: {
            type: Type.NUMBER,
            description: 'Valor total em Reais se houver apenas um valor legítimo sem divergência. Se houver divergência, retorne null.',
          },
          temDivergenciaValor: {
            type: Type.BOOLEAN,
            description: 'True se houver dois ou mais valores diferentes que possam representar o total da cobrança.',
          },
          valoresCandidatos: {
            type: Type.ARRAY,
            description: 'Lista de valores encontrados com rótulo e trecho de contexto.',
            items: {
              type: Type.OBJECT,
              properties: {
                valor: { type: Type.NUMBER },
                rotulo: { type: Type.STRING },
                contexto: { type: Type.STRING },
              },
            },
          },
          dataVencimento: {
            type: Type.STRING,
            description: 'Data de vencimento se for única e não divergente. Se houver divergência, retorne null.',
          },
          temDivergenciaVencimento: {
            type: Type.BOOLEAN,
            description: 'True se houver duas ou mais datas diferentes para o vencimento.',
          },
          vencimentosCandidatos: {
            type: Type.ARRAY,
            description: 'Lista de datas de vencimento encontradas com rótulo e trecho de contexto.',
            items: {
              type: Type.OBJECT,
              properties: {
                data: { type: Type.STRING },
                rotulo: { type: Type.STRING },
                contexto: { type: Type.STRING },
              },
            },
          },
          numeroNota: {
            type: Type.STRING,
            description: 'Número do documento ou NF, se houver.',
          },
          observacoes: {
            type: Type.STRING,
            description: 'Breve detalhe adicional identificado ou notas sobre divergências.',
          },
        },
      },
    };

    const candidateModels = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let lastError: any = null;

    for (const m of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: m,
          contents: prompt,
          config: schemaConfig,
        });
        modelUsed = m;
        lastError = null;
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Tentativa com modelo ${m} falhou:`, err?.message);
        // Pequena pausa antes do próximo modelo para mitigar picos de demanda (503/429)
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    if (!response || lastError) {
      throw new Error(
        `Modelos Gemini temporariamente indisponíveis (${lastError?.message || 'alta demanda'}). Você pode utilizar o modo de Regras Locais.`
      );
    }

    const rawJson = response?.text?.trim() || '{}';
    let parsedData: any = {};

    try {
      parsedData = JSON.parse(rawJson);
    } catch (jsonErr) {
      console.error('Falha ao decodificar JSON do Gemini:', rawJson);
      res.status(500).json({
        success: false,
        error: 'JSON_INVALIDO',
        message: 'A resposta do modelo não pôde ser interpretada como JSON.',
      });
      return;
    }

    // Normalização rigorosa de data para formato ISO YYYY-MM-DD
    const normalizeDateStr = (raw: string | null | undefined): string | null => {
      if (!raw || typeof raw !== 'string') return null;
      const clean = raw.trim();
      if (clean.toLowerCase() === 'null' || clean.toLowerCase() === 'undefined' || clean === '') return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

      const parts = clean.split(/[\/\.-]/);
      if (parts.length === 3) {
        let [d, m, y] = parts;
        if (d.length === 4) {
          return `${d}-${m.padStart(2, '0')}-${y.padStart(2, '0')}`;
        }
        if (y.length === 2) y = '20' + y;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return null;
    };

    const cleanString = (val: any): string | null => {
      if (!val || typeof val !== 'string') return null;
      const trimmed = val.trim();
      if (trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined' || trimmed === '') return null;
      return trimmed;
    };

    const fornecedor = cleanString(parsedData.fornecedor);

    // Gestão de valores e divergência
    let valoresCandidatos: any[] = Array.isArray(parsedData.valoresCandidatos)
      ? parsedData.valoresCandidatos
          .filter((item: any) => typeof item.valor === 'number' && !isNaN(item.valor) && item.valor > 0)
          .map((item: any) => ({
            valor: item.valor,
            rotulo: cleanString(item.rotulo) || 'Valor da cobrança',
            contexto: cleanString(item.contexto) || `R$ ${item.valor.toFixed(2)}`,
          }))
      : [];

    // Checa divergência mesmo se a flag booleana não tiver vindo marcada
    const uniqueValuesFound = Array.from(new Set(valoresCandidatos.map((i) => i.valor)));
    const temDivergenciaValor = Boolean(parsedData.temDivergenciaValor) || uniqueValuesFound.length > 1;

    let valor: number | null = null;
    if (!temDivergenciaValor) {
      if (typeof parsedData.valor === 'number' && !isNaN(parsedData.valor) && parsedData.valor > 0) {
        valor = parsedData.valor;
      } else if (uniqueValuesFound.length === 1) {
        valor = uniqueValuesFound[0];
      }
    }

    // Gestão de vencimentos e divergência
    let vencimentosCandidatos: any[] = Array.isArray(parsedData.vencimentosCandidatos)
      ? parsedData.vencimentosCandidatos
          .map((item: any) => {
            const iso = normalizeDateStr(item.data);
            return iso
              ? {
                  data: iso,
                  dataOriginal: item.data,
                  rotulo: cleanString(item.rotulo) || 'Vencimento',
                  contexto: cleanString(item.contexto) || item.data,
                }
              : null;
          })
          .filter(Boolean)
      : [];

    const uniqueDatesFound = Array.from(new Set(vencimentosCandidatos.map((i) => i.data)));
    const temDivergenciaVencimento = Boolean(parsedData.temDivergenciaVencimento) || uniqueDatesFound.length > 1;

    let dataVencimento: string | null = null;
    if (!temDivergenciaVencimento) {
      const parsedIso = normalizeDateStr(parsedData.dataVencimento);
      if (parsedIso) {
        dataVencimento = parsedIso;
      } else if (uniqueDatesFound.length === 1) {
        dataVencimento = uniqueDatesFound[0];
      }
    }

    const numeroNota = cleanString(parsedData.numeroNota);
    const observacoes = cleanString(parsedData.observacoes);

    res.json({
      success: true,
      modelUsed,
      data: {
        fornecedor,
        valor,
        temDivergenciaValor,
        valoresCandidatos,
        dataVencimento,
        temDivergenciaVencimento,
        vencimentosCandidatos,
        numeroNota,
        observacoes,
      },
    });
  } catch (err: any) {
    console.error('Erro na rota /api/extrair-nota-gemini:', err);
    res.status(500).json({
      success: false,
      error: 'ERRO_GEMINI',
      message: err?.message || 'Ocorreu um erro ao consultar o modelo Gemini.',
    });
  }
});

// Configuração do ambiente Vite / Static
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Organiza AI server rodando na porta ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
});
