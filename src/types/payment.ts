/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PaymentStatus = 'pendente' | 'agendado' | 'pago' | 'vencido' | 'indefinida';

export interface PaymentRecord {
  id: string;
  fornecedor: string; // Nome do fornecedor
  valor: number | null; // Valor em reais (null se não informado)
  dataVencimento: string | null; // Formato YYYY-MM-DD ou null se não informado
  situacao: PaymentStatus; // Situação do pagamento
  categoria?: string; // Ex: Serviços, Materiais, Logística, Tecnologia
  observacoes?: string; // Notas ou número de NF/boleto
  numeroNota?: string; // Número da Nota Fiscal ou Fatura (ex: 84920, 10934)
  criadoEm: string;
  atualizadoEm: string;
}

export type MissingFieldKey = 'fornecedor' | 'valor' | 'dataVencimento' | 'situacao';

export interface MissingFieldInfo {
  key: MissingFieldKey;
  label: string;
  descricao: string;
}

export interface PaymentValidationResult {
  isIncomplete: boolean;
  missingFields: MissingFieldInfo[];
}

/**
 * Identifica rigorosamente os campos ausentes em um registro de pagamento.
 * Sem inventar dados: se um campo não foi expressamente informado ou está em branco/nulo,
 * ele é apontado como ausente.
 */
export function validatePaymentRecord(payment: Partial<PaymentRecord>): PaymentValidationResult {
  const missingFields: MissingFieldInfo[] = [];

  // 1. Validação do fornecedor
  const fornecedorLimpo = payment.fornecedor?.trim();
  if (!fornecedorLimpo || fornecedorLimpo.toLowerCase() === 'não informado' || fornecedorLimpo.toLowerCase() === 'a definir') {
    missingFields.push({
      key: 'fornecedor',
      label: 'Nome do fornecedor',
      descricao: 'O nome ou razão social do fornecedor não foi informado.',
    });
  }

  // 2. Validação do valor do pagamento
  if (payment.valor === null || payment.valor === undefined || isNaN(payment.valor) || payment.valor <= 0) {
    missingFields.push({
      key: 'valor',
      label: 'Valor do pagamento',
      descricao: 'O montante a pagar não foi especificado ou é inválido.',
    });
  }

  // 3. Validação da data de vencimento
  if (!payment.dataVencimento || payment.dataVencimento.trim() === '') {
    missingFields.push({
      key: 'dataVencimento',
      label: 'Data de vencimento',
      descricao: 'A data limite para quitação do pagamento não foi preenchida.',
    });
  }

  // 4. Validação da situação do pagamento
  if (!payment.situacao || payment.situacao === 'indefinida') {
    missingFields.push({
      key: 'situacao',
      label: 'Situação do pagamento',
      descricao: 'O status do pagamento (Pendente, Agendado ou Pago) não foi selecionado.',
    });
  }

  return {
    isIncomplete: missingFields.length > 0,
    missingFields,
  };
}
