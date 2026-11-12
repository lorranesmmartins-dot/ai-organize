/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PaymentStatus } from '../types/payment';

/**
 * Formata um valor numérico para a moeda brasileira (BRL - R$).
 * Retorna fallback explícito se não houver valor informado.
 */
export function formatCurrencyBRL(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || isNaN(valor)) {
    return 'Não informado';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(valor);
}

/**
 * Formata data no padrão brasileiro (DD/MM/AAAA).
 * Retorna fallback explícito se não houver data informada.
 */
export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr.trim() === '') {
    return 'Não informada';
  }

  // Se já estiver no formato YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return 'Data inválida';
  }
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
}

/**
 * Informações visuais e semânticas de cada situação de pagamento
 */
export interface StatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

export const STATUS_MAP: Record<PaymentStatus, StatusConfig> = {
  pendente: {
    label: 'Pendente',
    badgeClass: 'text-amber-800 bg-amber-50 border border-amber-200/80',
    dotClass: 'bg-amber-500',
  },
  agendado: {
    label: 'Agendado',
    badgeClass: 'text-sky-800 bg-sky-50 border border-sky-200/80',
    dotClass: 'bg-sky-500',
  },
  pago: {
    label: 'Pago',
    badgeClass: 'text-emerald-800 bg-emerald-50 border border-emerald-200/80',
    dotClass: 'bg-emerald-500',
  },
  vencido: {
    label: 'Em atraso',
    badgeClass: 'text-rose-800 bg-rose-50 border border-rose-200/80',
    dotClass: 'bg-rose-500',
  },
  indefinida: {
    label: 'Não definida',
    badgeClass: 'text-slate-600 bg-slate-100 border border-slate-200',
    dotClass: 'bg-slate-400',
  },
};

/**
 * Verifica se a data de vencimento já passou para pagamentos pendentes/agendados
 */
export function checkIsOverdue(dataVencimento: string | null | undefined, situacao: PaymentStatus): boolean {
  if (!dataVencimento || situacao === 'pago' || situacao === 'indefinida') return false;
  
  const todayStr = new Date().toISOString().split('T')[0];
  return dataVencimento < todayStr;
}
