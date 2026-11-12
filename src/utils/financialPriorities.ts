/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PaymentRecord, validatePaymentRecord } from '../types/payment';

export type PriorityLevel = 'critica' | 'alta' | 'media' | 'atencao' | 'regular' | 'concluido';

export interface PriorityItem {
  payment: PaymentRecord;
  diasAtraso?: number; // Para pagamentos atrasados (> 0)
  diasRestantes?: number; // Para pagamentos futuros (>= 0)
  motivoIncompletude?: string[]; // Para pagamentos com dados faltantes
}

export interface PriorityCategorySummary {
  id: 'atrasados' | 'venceHoje' | 'proximos7Dias' | 'incompletos' | 'futuros' | 'pagos';
  titulo: string;
  subtitulo: string;
  nivelPrioridade: PriorityLevel;
  nivelLabel: string;
  quantidade: number;
  valorTotalConhecido: number;
  qtdSemValor: number;
  recomendacao: string;
  itens: PriorityItem[];
}

export interface FinancialPrioritiesReport {
  dataReferencia: string; // YYYY-MM-DD
  dataLimite7Dias: string; // YYYY-MM-DD
  totalRegistros: number;
  totalPendentes: number;
  totalPagos: number;
  valorTotalPendenteConhecido: number;
  qtdTotalSemValor: number;
  categorias: {
    atrasados: PriorityCategorySummary;
    venceHoje: PriorityCategorySummary;
    proximos7Dias: PriorityCategorySummary;
    incompletos: PriorityCategorySummary;
    futuros: PriorityCategorySummary;
    pagos: PriorityCategorySummary;
  };
  temAlertasUrgentes: boolean;
}

/**
 * Retorna a data atual local no formato ISO YYYY-MM-DD,
 * garantindo alinhamento com o fuso horário local do usuário (sem roll-over de UTC).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Adiciona N dias a uma data em formato YYYY-MM-DD e retorna nova data YYYY-MM-DD.
 */
export function addDaysToDateString(baseDateStr: string, days: number): string {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

/**
 * Calcula a diferença em dias corridos entre a data de vencimento e a data de referência.
 * Retorno:
 *  < 0: vencimento anterior à referência (Atrasado)
 * === 0: vencimento exatamente na data de referência (Vence Hoje)
 *  > 0: vencimento posterior à referência (Futuro)
 */
export function calculateDaysDiff(dueDateStr: string, referenceDateStr: string): number {
  const [yRef, mRef, dRef] = referenceDateStr.split('-').map(Number);
  const [yDue, mDue, dDue] = dueDateStr.split('-').map(Number);

  const utcRef = Date.UTC(yRef, mRef - 1, dRef);
  const utcDue = Date.UTC(yDue, mDue - 1, dDue);

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((utcDue - utcRef) / msPerDay);
}

/**
 * Gera a análise completa de prioridades financeiras seguindo rigorosamente as regras:
 * 1. Pagamentos em atraso: vencimento anterior à data de referência e status !== 'pago'.
 * 2. Pagamentos que vencem hoje: vencimento === data de referência e status !== 'pago'.
 * 3. Pagamentos que vencem nos próximos 7 dias: vencimento entre amanhã e hoje+7 e status !== 'pago'.
 * 4. Registros incompletos: especialmente os que não possuem valor ou data de vencimento (e status !== 'pago').
 * 5. Pagamentos com status 'pago' são ignorados nas listas de pendências.
 * 6. Resumo com contagem, totais conhecidos e recomendações claras.
 * 7. Não inventa dados e soma apenas valores definidos e válidos.
 */
export function analyzeFinancialPriorities(
  payments: PaymentRecord[],
  referenceDateInput?: string
): FinancialPrioritiesReport {
  const dataReferencia = referenceDateInput || getLocalDateString();
  const dataLimite7Dias = addDaysToDateString(dataReferencia, 7);

  // Baldes de classificação
  const atrasadosItens: PriorityItem[] = [];
  const venceHojeItens: PriorityItem[] = [];
  const proximos7DiasItens: PriorityItem[] = [];
  const incompletosItens: PriorityItem[] = [];
  const futurosItens: PriorityItem[] = [];
  const pagosItens: PriorityItem[] = [];

  payments.forEach((payment) => {
    // Regra 5: Pagamentos com status 'pago' NUNCA entram em listas de pendências
    if (payment.situacao === 'pago') {
      pagosItens.push({ payment });
      return;
    }

    // Validação de completude
    const validation = validatePaymentRecord(payment);
    const semValor = payment.valor === null || payment.valor === undefined || isNaN(payment.valor) || payment.valor <= 0;
    const semVencimento = !payment.dataVencimento || payment.dataVencimento.trim() === '';

    // Regra 4: Registros incompletos (especialmente sem valor ou sem vencimento)
    if (validation.isIncomplete) {
      const motivos: string[] = [];
      if (semValor) motivos.push('Valor não informado');
      if (semVencimento) motivos.push('Data de vencimento ausente');
      if (!payment.fornecedor || payment.fornecedor.trim() === '') motivos.push('Nome do fornecedor em branco');
      if (payment.situacao === 'indefinida') motivos.push('Situação de pagamento indefinida');

      incompletosItens.push({
        payment,
        motivoIncompletude: motivos,
      });
    }

    // Se não tiver data de vencimento, não é possível saber se está atrasado ou quando vence
    if (semVencimento) {
      return;
    }

    // Cálculo temporal relativo à data de referência
    const diff = calculateDaysDiff(payment.dataVencimento!, dataReferencia);

    if (diff < 0) {
      // Regra 1: Pagamento em atraso (pagamentos com situação 'indefinida' não devem ser classificados como em atraso)
      if (payment.situacao !== 'indefinida') {
        atrasadosItens.push({
          payment,
          diasAtraso: Math.abs(diff),
        });
      }
    } else if (diff === 0) {
      // Regra 2: Vence hoje
      venceHojeItens.push({
        payment,
        diasRestantes: 0,
      });
    } else if (diff >= 1 && diff <= 7) {
      // Regra 3: Vence nos próximos 7 dias
      proximos7DiasItens.push({
        payment,
        diasRestantes: diff,
      });
    } else {
      // Futuros além de 7 dias
      futurosItens.push({
        payment,
        diasRestantes: diff,
      });
    }
  });

  // Ordenação lógica interna de cada grupo
  // Atrasados: maior atraso primeiro
  atrasadosItens.sort((a, b) => (b.diasAtraso ?? 0) - (a.diasAtraso ?? 0));
  // Vence hoje: maior valor primeiro
  venceHojeItens.sort((a, b) => (b.payment.valor ?? 0) - (a.payment.valor ?? 0));
  // Próximos 7 dias: vencimento mais próximo primeiro (ascendente)
  proximos7DiasItens.sort((a, b) => (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0));
  // Incompletos: registros sem valor ou sem data no topo
  incompletosItens.sort((a, b) => (b.motivoIncompletude?.length ?? 0) - (a.motivoIncompletude?.length ?? 0));

  // Função auxiliar para calcular métricas financeiras sem inventar dados
  const computeMetrics = (items: PriorityItem[]) => {
    let valorTotalConhecido = 0;
    let qtdSemValor = 0;

    items.forEach(({ payment }) => {
      if (payment.valor !== null && payment.valor !== undefined && !isNaN(payment.valor) && payment.valor > 0) {
        valorTotalConhecido += payment.valor;
      } else {
        qtdSemValor += 1;
      }
    });

    return { valorTotalConhecido, qtdSemValor };
  };

  const atrasadosMetrics = computeMetrics(atrasadosItens);
  const venceHojeMetrics = computeMetrics(venceHojeItens);
  const proximos7DiasMetrics = computeMetrics(proximos7DiasItens);
  const incompletosMetrics = computeMetrics(incompletosItens);
  const futurosMetrics = computeMetrics(futurosItens);
  const pagosMetrics = computeMetrics(pagosItens);

  // Total geral pendente
  const pendingPayments = payments.filter((p) => p.situacao !== 'pago');
  let valorTotalPendenteConhecido = 0;
  let qtdTotalSemValor = 0;
  pendingPayments.forEach((p) => {
    if (p.valor !== null && p.valor !== undefined && !isNaN(p.valor) && p.valor > 0) {
      valorTotalPendenteConhecido += p.valor;
    } else {
      qtdTotalSemValor += 1;
    }
  });

  return {
    dataReferencia,
    dataLimite7Dias,
    totalRegistros: payments.length,
    totalPendentes: pendingPayments.length,
    totalPagos: pagosItens.length,
    valorTotalPendenteConhecido,
    qtdTotalSemValor,
    temAlertasUrgentes: atrasadosItens.length > 0 || venceHojeItens.length > 0,
    categorias: {
      atrasados: {
        id: 'atrasados',
        titulo: 'Pagamentos em Atraso',
        subtitulo: 'Vencimentos anteriores à data de referência que continuam pendentes',
        nivelPrioridade: 'critica',
        nivelLabel: 'Prioridade Crítica',
        quantidade: atrasadosItens.length,
        valorTotalConhecido: atrasadosMetrics.valorTotalConhecido,
        qtdSemValor: atrasadosMetrics.qtdSemValor,
        recomendacao:
          'Ação Imediata: Liquidar ou contatar o fornecedor urgentemente para renegociar prazos e impedir a cobrança de juros, multas moratórias ou protesto de títulos.',
        itens: atrasadosItens,
      },
      venceHoje: {
        id: 'venceHoje',
        titulo: 'Vencem Hoje',
        subtitulo: 'Pagamentos com vencimento na data de referência e pendentes de quitação',
        nivelPrioridade: 'alta',
        nivelLabel: 'Prioridade Alta',
        quantidade: venceHojeItens.length,
        valorTotalConhecido: venceHojeMetrics.valorTotalConhecido,
        qtdSemValor: venceHojeMetrics.qtdSemValor,
        recomendacao:
          'Atenção Urgente: Programar autorização e quitação bancária antes do fechamento do expediente das instituições financeiras para evitar atraso.',
        itens: venceHojeItens,
      },
      proximos7Dias: {
        id: 'proximos7Dias',
        titulo: 'Vencem nos Próximos 7 Dias',
        subtitulo: `Vencimentos previstos entre amanhã e ${dataLimite7Dias}`,
        nivelPrioridade: 'media',
        nivelLabel: 'Prioridade Média',
        quantidade: proximos7DiasItens.length,
        valorTotalConhecido: proximos7DiasMetrics.valorTotalConhecido,
        qtdSemValor: proximos7DiasMetrics.qtdSemValor,
        recomendacao:
          'Planejamento Semanal: Garantir disponibilidade de fluxo de caixa suficiente na conta operacional para suportar os desembolsos previstos na semana.',
        itens: proximos7DiasItens,
      },
      incompletos: {
        id: 'incompletos',
        titulo: 'Registros Incompletos',
        subtitulo: 'Lançamentos pendentes com dados cadastrais ausentes (valor ou data de vencimento)',
        nivelPrioridade: 'atencao',
        nivelLabel: 'Atenção Cadastral',
        quantidade: incompletosItens.length,
        valorTotalConhecido: incompletosMetrics.valorTotalConhecido,
        qtdSemValor: incompletosMetrics.qtdSemValor,
        recomendacao:
          'Regularização de Cadastro: Editar cada lançamento para incluir o valor exato ou a data de vencimento obtida junto ao fornecedor, eliminando riscos de surpresas financeiras.',
        itens: incompletosItens,
      },
      futuros: {
        id: 'futuros',
        titulo: 'Vencimentos Futuros (> 7 dias)',
        subtitulo: 'Obrigações futuras com vencimento em prazo confortável',
        nivelPrioridade: 'regular',
        nivelLabel: 'Prazo Confortável',
        quantidade: futurosItens.length,
        valorTotalConhecido: futurosMetrics.valorTotalConhecido,
        qtdSemValor: futurosMetrics.qtdSemValor,
        recomendacao:
          'Acompanhamento Regular: Nenhuma ação urgente necessária. Manter no radar para a próxima programação semanal de pagamentos.',
        itens: futurosItens,
      },
      pagos: {
        id: 'pagos',
        titulo: 'Pagamentos Já Quitados',
        subtitulo: 'Lançamentos com situação "Pago" (desconsiderados das listas de pendências)',
        nivelPrioridade: 'concluido',
        nivelLabel: 'Concluído',
        quantidade: pagosItens.length,
        valorTotalConhecido: pagosMetrics.valorTotalConhecido,
        qtdSemValor: pagosMetrics.qtdSemValor,
        recomendacao:
          'Registros Concluídos: Não demandam ação operacional. Comprovantes e quitações devidamente consolidados no histórico.',
        itens: pagosItens,
      },
    },
  };
}
