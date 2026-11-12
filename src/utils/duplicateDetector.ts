/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PaymentRecord } from '../types/payment';
import { formatCurrencyBRL, formatDateBR } from './formatters';

/**
 * Normaliza o nome do fornecedor para comparação semântica:
 * - Converte para minúsculas
 * - Remove acentos
 * - Remove sufixos jurídicos e de dados fictícios comuns (ltda, s/a, epp, ficticia, etc)
 * - Remove pontuação e espaços em excesso
 */
export function normalizeSupplier(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(ltda|s\.?a\.?|sa|me|epp|eireli|mei|ficticia|ficticio|solucoes|comercio|distribuicao)\b/gi, ' ')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai número da nota fiscal ou fatura a partir de campo direto ou texto de observações.
 * Ex: "NF nº 84920", "Nº da Nota: 84920", "Documento Fiscal nº 10934", "NF 45812", "Duplicata 84920/01"
 */
export function extractInvoiceNumber(text?: string | null): string | null {
  if (!text) return null;
  const clean = text.trim();
  if (!clean) return null;

  // Se o próprio texto já for apenas dígitos ou código curto (ex: "84920" ou "10934")
  if (/^[a-zA-Z0-9\-\/]{3,15}$/.test(clean) && /\d/.test(clean)) {
    return clean.replace(/[^a-zA-Z0-9]/g, '');
  }

  // Regex para capturar padrões comuns em documentos e notas fiscais
  const regexPatterns = [
    /(?:n[º°.]\s*da\s*nota|nota(?:\s*fiscal)?|fatura|duplicata|doc(?:umento)?(?:\s*fiscal)?|nf)\s*(?:n[º°.]|número|num)?[:\s#]*([a-zA-Z0-9\-\/]+)/i,
    /(?:documento|fatura)\s*n[º°.]?\s*[:\s#]*([a-zA-Z0-9\-\/]+)/i,
    /\bnf\s*[:\s#]*([a-zA-Z0-9\-\/]+)/i,
  ];

  for (const regex of regexPatterns) {
    const match = clean.match(regex);
    if (match && match[1]) {
      const code = match[1].replace(/[^a-zA-Z0-9]/g, '').trim();
      if (code.length >= 3) {
        return code;
      }
    }
  }

  return null;
}

/**
 * Verifica se dois valores monetários são considerados idênticos.
 * Trata tanto valores nulos/ausentes quanto valores numéricos com tolerância de centavos.
 */
export function isSameMonetaryValue(v1: number | null | undefined, v2: number | null | undefined): boolean {
  const isV1Empty = v1 === null || v1 === undefined || isNaN(v1);
  const isV2Empty = v2 === null || v2 === undefined || isNaN(v2);

  if (isV1Empty && isV2Empty) return true;
  if (isV1Empty || isV2Empty) return false;

  return Math.abs(v1 - v2) < 0.01;
}

/**
 * Verifica se duas datas de vencimento são idênticas.
 */
export function isSameDueDate(d1: string | null | undefined, d2: string | null | undefined): boolean {
  const clean1 = (d1 || '').trim();
  const clean2 = (d2 || '').trim();

  if (!clean1 && !clean2) return true;
  if (!clean1 || !clean2) return false;

  return clean1 === clean2;
}

/**
 * Compara similaridade de fornecedor entre dois registros.
 */
export function isSupplierMatch(name1?: string | null, name2?: string | null): boolean {
  const norm1 = normalizeSupplier(name1);
  const norm2 = normalizeSupplier(name2);

  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;

  // Se um nome contiver o outro com tamanho mínimo de 4 caracteres
  if (norm1.length >= 4 && norm2.length >= 4) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return true;
    }
  }

  return false;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingPayment?: PaymentRecord;
  matchedReasons: string[];
  summary: string;
}

/**
 * Realiza a verificação rigorosa de duplicidade antes de salvar.
 * Considera especialmente:
 * 1. Número da nota fiscal / documento
 * 2. Nome do fornecedor
 * 3. Valor da cobrança
 * 4. Data de vencimento
 *
 * @param existingPayments Lista atual de pagamentos cadastrados no sistema
 * @param candidate Dados do novo pagamento a ser conferido/salvo
 * @param ignoreId ID opcional a ser ignorado (usado em edição do próprio registro)
 */
export function findDuplicatePayment(
  existingPayments: PaymentRecord[],
  candidate: Partial<PaymentRecord>,
  ignoreId?: string
): DuplicateCheckResult {
  const candidateSupplier = (candidate.fornecedor || '').trim();
  const candidateInvoiceNum =
    candidate.numeroNota ||
    extractInvoiceNumber(candidate.observacoes) ||
    extractInvoiceNumber(candidate.fornecedor);

  for (const existing of existingPayments) {
    if (ignoreId && existing.id === ignoreId) {
      continue;
    }

    const matchedReasons: string[] = [];
    const existingInvoiceNum =
      existing.numeroNota ||
      extractInvoiceNumber(existing.observacoes) ||
      extractInvoiceNumber(existing.fornecedor);

    const sameInvoice = Boolean(
      candidateInvoiceNum &&
      existingInvoiceNum &&
      candidateInvoiceNum === existingInvoiceNum
    );

    const sameSupplier = isSupplierMatch(candidateSupplier, existing.fornecedor);
    const sameValue = isSameMonetaryValue(candidate.valor, existing.valor);
    const sameDueDate = isSameDueDate(candidate.dataVencimento, existing.dataVencimento);

    // REGRA 1: Mesmo número de Nota Fiscal E mesmo fornecedor ou mesmo valor
    if (sameInvoice && (sameSupplier || sameValue)) {
      matchedReasons.push(`Número da Nota Fiscal idêntico (${candidateInvoiceNum})`);
      if (sameSupplier) matchedReasons.push(`Fornecedor correspondente ("${existing.fornecedor}")`);
      if (sameValue && candidate.valor !== null && candidate.valor !== undefined) {
        matchedReasons.push(`Valor idêntico (${formatCurrencyBRL(candidate.valor)})`);
      }
      if (sameDueDate && candidate.dataVencimento) {
        matchedReasons.push(`Vencimento idêntico (${formatDateBR(candidate.dataVencimento)})`);
      }

      return {
        isDuplicate: true,
        existingPayment: existing,
        matchedReasons,
        summary: `Já existe um lançamento com a Nota Fiscal nº ${candidateInvoiceNum} cadastrado para ${existing.fornecedor}.`,
      };
    }

    // REGRA 2: Tríade Contábil (Mesmo Fornecedor + Mesmo Valor + Mesmo Vencimento)
    if (sameSupplier && sameValue && sameDueDate) {
      matchedReasons.push(`Mesmo fornecedor ("${existing.fornecedor}")`);
      if (candidate.valor !== null && candidate.valor !== undefined) {
        matchedReasons.push(`Mesmo valor de cobrança (${formatCurrencyBRL(candidate.valor)})`);
      } else {
        matchedReasons.push('Ambos sem valor informado');
      }
      if (candidate.dataVencimento) {
        matchedReasons.push(`Mesma data de vencimento (${formatDateBR(candidate.dataVencimento)})`);
      } else {
        matchedReasons.push('Ambos sem data de vencimento informada');
      }
      if (sameInvoice) {
        matchedReasons.push(`Mesmo número de documento (${candidateInvoiceNum})`);
      }

      const valDesc = candidate.valor !== null && candidate.valor !== undefined
        ? `no valor de ${formatCurrencyBRL(candidate.valor)}`
        : 'sem valor informado';
      const dateDesc = candidate.dataVencimento
        ? `vencendo em ${formatDateBR(candidate.dataVencimento)}`
        : 'sem data de vencimento';

      return {
        isDuplicate: true,
        existingPayment: existing,
        matchedReasons,
        summary: `Já existe um lançamento idêntico para ${existing.fornecedor} ${valDesc} (${dateDesc}).`,
      };
    }

    // REGRA 3: Caso de documento sem valor e sem vencimento (Cenário 2), com mesmo fornecedor e mesmo contexto
    if (
      sameSupplier &&
      candidate.valor === null &&
      existing.valor === null &&
      candidate.dataVencimento === null &&
      existing.dataVencimento === null
    ) {
      matchedReasons.push(`Mesmo fornecedor ("${existing.fornecedor}")`);
      matchedReasons.push('Ambos pendentes de definição de valor e vencimento');

      return {
        isDuplicate: true,
        existingPayment: existing,
        matchedReasons,
        summary: `Já existe um registro preliminar para ${existing.fornecedor} aguardando valor e vencimento.`,
      };
    }
  }

  return {
    isDuplicate: false,
    matchedReasons: [],
    summary: '',
  };
}
