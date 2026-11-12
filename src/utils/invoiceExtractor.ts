/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CandidateValue {
  valor: number;
  rotulo: string; // Ex: "Valor da Fatura", "Total a Pagar", "Valor do Documento"
  contexto: string; // Trecho do documento onde apareceu
}

export interface CandidateDueDate {
  data: string; // Formato ISO YYYY-MM-DD
  dataOriginal: string; // Formato original encontrado (ex: "15/11/2026")
  rotulo: string; // Ex: "Vencimento da Fatura", "Vencimento do Boleto"
  contexto: string; // Trecho do documento
}

export interface ExtractedInvoiceData {
  fornecedor: string | null;

  // Valor total e gestão de divergência
  valor: number | null; // Se houver divergência, permanece null até escolha humana
  temDivergenciaValor: boolean;
  valoresCandidatos: CandidateValue[];

  // Vencimento e gestão de divergência
  dataVencimento: string | null; // Se houver divergência, permanece null até escolha humana
  temDivergenciaVencimento: boolean;
  vencimentosCandidatos: CandidateDueDate[];

  numeroNota?: string | null;
  observacoes?: string | null;
  avisoDivergencia?: string | null;
}

/**
 * Converte data em formatos comuns (DD/MM/AAAA, DD-MM-AAAA, DD.MM.AAAA) para YYYY-MM-DD.
 */
export function normalizeDateToISO(dateStr: string): string | null {
  if (!dateStr) return null;
  const clean = dateStr.trim().replace(/[.-]/g, '/');
  const parts = clean.split('/');
  if (parts.length !== 3) return null;

  let [day, month, year] = parts;
  if (!day || !month || !year) return null;

  if (year.length === 2) {
    year = '20' + year;
  }

  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > 2100) return null;

  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Converte string de valor monetário (ex: "1.450,80", "1450.80", "R$ 3.200,50") para número float.
 */
export function parseCurrencyString(valStr: string): number | null {
  if (!valStr) return null;
  let clean = valStr.replace(/[R$\s]/g, '').trim();

  // Caso brasileiro: pontos como milhar e vírgula como decimal (1.450,80)
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }

  const num = parseFloat(clean);
  if (isNaN(num) || num <= 0) return null;
  return Math.round(num * 100) / 100;
}

/**
 * Identifica se uma linha refere-se explicitamente a impostos, descontos ou subtotais,
 * para NÃO confundi-los com o valor total da cobrança.
 */
function isAuxiliaryTaxOrDiscount(line: string): boolean {
  return /\b(ICMS|ISS|IPI|PIS|COFINS|IRRF|CSLL|INSS|Impostos?|Tributos?|Desconto|Dedução|Base de Cálculo|Subtotal|Acréscimo)\b/i.test(
    line
  );
}

/**
 * Analisa o texto de uma nota fiscal, DANFE ou fatura identificando divergências e respeitando as regras fiscais.
 */
export function extractInvoiceData(text: string): ExtractedInvoiceData {
  if (!text || text.trim() === '') {
    return {
      fornecedor: null,
      valor: null,
      temDivergenciaValor: false,
      valoresCandidatos: [],
      dataVencimento: null,
      temDivergenciaVencimento: false,
      vencimentosCandidatos: [],
      numeroNota: null,
    };
  }

  const lines = text.split(/\r?\n/);

  // 1. Fornecedor
  let fornecedor: string | null = null;
  const fornecedorPatterns = [
    /(?:Raz[aã]o\s*Social|Emitente|Fornecedor|Nome\s*Empresarial|Prestador\s*de\s*Servi[çc]os?|Nome\s*do\s*Emissor)\s*[:=-]\s*([^\n\r]+)/i,
    /(?:Empresa|Cedente)\s*[:=-]\s*([^\n\r]+)/i,
  ];

  for (const pattern of fornecedorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim().replace(/[;\.,]+$/, '');
      if (candidate.length > 2 && !candidate.toLowerCase().includes('não informado')) {
        fornecedor = candidate;
        break;
      }
    }
  }

  if (!fornecedor) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        /\b(?:Ltda\.?|S\.?A\.?|ME|EPP|EIRELI|Comércio|Serviços|Distribuidora)\b/i.test(trimmed) &&
        !/^(?:CNPJ|Inscrição|Endereço|Rua|Av|Avenida)/i.test(trimmed)
      ) {
        const cleanedLine = trimmed.replace(/\s*-\s*CNPJ.*$/i, '').trim();
        if (cleanedLine.length > 3) {
          fornecedor = cleanedLine;
          break;
        }
      }
    }
  }

  // 2. Extração de Valores e Detecção de Divergências
  const candidateValues: CandidateValue[] = [];
  const foundValuesSet = new Set<number>();

  // Regex para encontrar linhas com valores de total/cobrança
  const totalLineRegex = /(?:Valor\s*Total|Valor\s*da\s*Nota|Total\s*da\s*NF|Total\s*a\s*Pagar|Valor\s*Cobrado|Total\s*Líquido|Total|Valor\s*da\s*Fatura|Valor\s*do\s*Boleto|Valor\s*do\s*Documento)\s*[:=-]?\s*(?:R\$\s*)?([\d\.]+(?:,\d{1,2})?)/gi;

  for (const line of lines) {
    // Ignora linhas que são expressamente impostos ou deduções
    if (isAuxiliaryTaxOrDiscount(line) && !/total\s*a\s*pagar|valor\s*líquido/i.test(line)) {
      continue;
    }

    let match;
    while ((match = totalLineRegex.exec(line)) !== null) {
      const num = parseCurrencyString(match[1]);
      if (num && num > 0) {
        // Extrai rótulo aproximado
        const rotuloMatch = match[0].split(/[:=-]/)[0].trim();
        candidateValues.push({
          valor: num,
          rotulo: rotuloMatch || 'Valor da cobrança',
          contexto: line.trim(),
        });
        foundValuesSet.add(num);
      }
    }
  }

  // Se não achou em rótulos específicos de total, procura qualquer "R$ ..." não tributário
  if (candidateValues.length === 0) {
    const genericMoneyRegex = /R\$\s*([\d\.]+(?:,\d{2}))/gi;
    for (const line of lines) {
      if (isAuxiliaryTaxOrDiscount(line)) continue;
      let match;
      while ((match = genericMoneyRegex.exec(line)) !== null) {
        const num = parseCurrencyString(match[1]);
        if (num && num > 0) {
          candidateValues.push({
            valor: num,
            rotulo: 'Valor monetário identificado',
            contexto: line.trim(),
          });
          foundValuesSet.add(num);
        }
      }
    }
  }

  // Regra de Divergência de Valor: dois ou mais valores distintos encontrados
  const uniqueValues = Array.from(foundValuesSet);
  const temDivergenciaValor = uniqueValues.length > 1;
  const valorFinal = temDivergenciaValor ? null : uniqueValues.length === 1 ? uniqueValues[0] : null;

  // 3. Extração de Datas de Vencimento e Detecção de Divergências
  const candidateDates: CandidateDueDate[] = [];
  const foundDatesSet = new Set<string>();

  const dateRegex = /\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Se for expressamente data de emissão sem menção a vencimento, ignora
    if (/\b(?:emiss[aã]o|emitid[ao]|data\s*da\s*nota)\b/i.test(trimmed) && !/\b(?:vencimento|vence|venc|pagamento|limite|fatura|boleto)\b/i.test(trimmed)) {
      continue;
    }

    // Verifica se a linha tem indicador de vencimento ou pagamento
    const isDueDateLine = /\b(?:vencimento|vence\b|venc\b|pagamento\s*at[eé]|data\s*limite|bom\s*para|prazo)\b/i.test(trimmed);

    if (isDueDateLine) {
      let match;
      dateRegex.lastIndex = 0;
      while ((match = dateRegex.exec(trimmed)) !== null) {
        const rawDate = match[1];
        const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : normalizeDateToISO(rawDate);
        if (isoDate) {
          // Extrai rótulo descritivo da linha antes da data
          const prefix = trimmed.substring(0, match.index).replace(/^[-*•\s]+/, '').replace(/[:=-]\s*$/, '').trim();
          const rotulo = prefix && prefix.length > 3 ? prefix : 'Data de vencimento';
          candidateDates.push({
            data: isoDate,
            dataOriginal: rawDate,
            rotulo,
            contexto: trimmed,
          });
          foundDatesSet.add(isoDate);
        }
      }
    }
  }

  // Regra de Divergência de Vencimento: duas ou mais datas de vencimento distintas
  const uniqueDates = Array.from(foundDatesSet);
  const temDivergenciaVencimento = uniqueDates.length > 1;
  const vencimentoFinal = temDivergenciaVencimento ? null : uniqueDates.length === 1 ? uniqueDates[0] : null;

  // 4. Número da Nota Fiscal
  let numeroNota: string | null = null;
  const nfMatch = text.match(/(?:N[úu]mero\s*da\s*Nota|N[Ff]\s*N?[ºo°]?|N[oº°]\s*da\s*NF|DANFE\s*N[ºo°]?)\s*[:=-]?\s*(\d+)/i);
  if (nfMatch && nfMatch[1]) {
    numeroNota = nfMatch[1];
  }

  // Gera aviso se houver divergência
  let avisoDivergencia: string | null = null;
  if (temDivergenciaValor && temDivergenciaVencimento) {
    avisoDivergencia = 'Divergências detectadas em valores e datas de vencimento. Conferência humana obrigatória.';
  } else if (temDivergenciaValor) {
    avisoDivergencia = 'Foram encontrados múltiplos valores concorrentes de cobrança. Selecione o valor correto.';
  } else if (temDivergenciaVencimento) {
    avisoDivergencia = 'Foram encontradas múltiplas datas de vencimento concorrentes. Selecione a data correta.';
  }

  return {
    fornecedor,
    valor: valorFinal,
    temDivergenciaValor,
    valoresCandidatos: candidateValues,
    dataVencimento: vencimentoFinal,
    temDivergenciaVencimento,
    vencimentosCandidatos: candidateDates,
    numeroNota,
    avisoDivergencia,
  };
}
