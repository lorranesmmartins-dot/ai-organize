/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PaymentRecord, validatePaymentRecord } from '../types/payment';
import { calculateDaysDiff, getLocalDateString } from './financialPriorities';
import { formatCurrencyBRL, formatDateBR, STATUS_MAP } from './formatters';
import { findDuplicatePayment } from './duplicateDetector';

export interface OverdueInsightItem {
  payment: PaymentRecord;
  daysOverdue: number;
}

export interface UpcomingInsightItem {
  payment: PaymentRecord;
  daysRemaining: number; // 0 = vence hoje, 1..7 = próximos 7 dias
}

export interface InconsistencyInsightItem {
  id: string;
  type: 'agendado_vencido' | 'vencido_sem_data' | 'pago_sem_valor' | 'possivel_duplicidade';
  title: string;
  description: string;
  payment: PaymentRecord;
}

export interface IncompleteInsightItem {
  payment: PaymentRecord;
  missingLabels: string[];
}

export interface OpenSupplierHighlight {
  fornecedor: string;
  isUnidentified: boolean;
  openAmount: number; // pendente + vencido + agendado
  pendingAmount: number; // pendente + vencido
  scheduledAmount: number; // agendado
  overdueAmount: number; // (pendente + vencido) com vencimento < hoje
  openCount: number;
  missingValueCount: number;
  payments: PaymentRecord[];
}

export interface PriorityRecommendation {
  id: string;
  level: 'critica' | 'alta' | 'media' | 'atencao';
  title: string;
  detail: string;
}

export interface AIInsightsDiagnosis {
  referenceDate: string;
  totalCount: number;
  overdueItems: OverdueInsightItem[];
  overdueTotalAmount: number;
  overdueWithoutValueCount: number;
  upcomingDueSoonItems: UpcomingInsightItem[]; // vence hoje ou nos próximos 7 dias (pendente/vencido/agendado)
  upcomingDueSoonAmount: number;
  inconsistencies: InconsistencyInsightItem[];
  incompleteItems: IncompleteInsightItem[];
  undefinedStatusItems: PaymentRecord[];
  openSuppliers: OpenSupplierHighlight[];
  recommendations: PriorityRecommendation[];
}

export interface AssistantEvidenceItem {
  label: string;
  value: string;
  detail?: string;
  payment?: PaymentRecord;
}

export interface AssistantAnswer {
  id: string;
  question: string;
  answer: string;
  status: 'answered' | 'insufficient_data';
  caveat?: string;
  evidence: AssistantEvidenceItem[];
}

function hasValidAmount(valor: number | null | undefined): valor is number {
  return valor !== null && valor !== undefined && !isNaN(valor) && valor > 0;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getSupplierDisplay(fornecedor: string | undefined): {
  key: string;
  label: string;
  isUnidentified: boolean;
} {
  const trimmed = fornecedor?.trim();
  const isUnidentified =
    !trimmed ||
    trimmed.toLowerCase() === 'não informado' ||
    trimmed.toLowerCase() === 'a definir';

  return {
    key: isUnidentified ? '__NAO_INFORMADO__' : trimmed,
    label: isUnidentified ? 'Fornecedor não informado' : trimmed,
    isUnidentified,
  };
}

/**
 * Gera o diagnóstico de inteligência financeira reutilizando estritamente as mesmas
 * regras de status e temporais de Relatórios Financeiros / formatters / validation:
 * - Pago ('pago'): quitado.
 * - Pendente ('pendente' | 'vencido'): atrasado somente se dataVencimento < referenceDate.
 * - Agendado ('agendado'): programado; não é somado em atrasados (se vencido < hoje, sinalizado como inconsistência).
 * - Não definida ('indefinida' ou desconhecida): não é classificada como pendente nem atrasada; sinalizada em incompletos.
 * - Sem valor ou sem vencimento: permanece em incompletos sem presumir valores ou datas.
 */
export function buildAIInsightsDiagnosis(payments: PaymentRecord[]): AIInsightsDiagnosis {
  const referenceDate = getLocalDateString();

  const overdueItems: OverdueInsightItem[] = [];
  let overdueTotalAmount = 0;
  let overdueWithoutValueCount = 0;

  const upcomingDueSoonItems: UpcomingInsightItem[] = [];
  let upcomingDueSoonAmount = 0;

  const inconsistencies: InconsistencyInsightItem[] = [];
  const incompleteItems: IncompleteInsightItem[] = [];
  const undefinedStatusItems: PaymentRecord[] = [];

  const supplierMap = new Map<string, OpenSupplierHighlight>();

  payments.forEach((payment) => {
    const validAmt = hasValidAmount(payment.valor);
    const val: number = validAmt && payment.valor !== null ? payment.valor : 0;
    const hasDueDate = Boolean(payment.dataVencimento && payment.dataVencimento.trim() !== '');

    // 1. Validação de completude cadastral (sem presumir valores ou datas)
    const validation = validatePaymentRecord(payment);
    if (validation.isIncomplete) {
      incompleteItems.push({
        payment,
        missingLabels: validation.missingFields.map((f) => f.label),
      });
    }

    // 2. Situação não definida nunca entra como pendente nem atrasada
    if (payment.situacao === 'indefinida' || !STATUS_MAP[payment.situacao]) {
      undefinedStatusItems.push(payment);
    }

    // 3. Verificação de inconsistências específicas
    if (payment.situacao === 'pago' && !validAmt) {
      inconsistencies.push({
        id: `inc-pago-sem-valor-${payment.id}`,
        type: 'pago_sem_valor',
        title: 'Pagamento quitado sem valor informado',
        description:
          'Lançamento marcado como "Pago", porém sem valor monetário válido registrado.',
        payment,
      });
    }

    if (payment.situacao === 'vencido' && !hasDueDate) {
      inconsistencies.push({
        id: `inc-vencido-sem-data-${payment.id}`,
        type: 'vencido_sem_data',
        title: 'Status "Em atraso" sem data de vencimento',
        description:
          'A situação está marcada como vencida, mas não há data de vencimento cadastrada para apurar os dias de atraso.',
        payment,
      });
    }

    if (payment.situacao === 'agendado' && hasDueDate) {
      const diff = calculateDaysDiff(payment.dataVencimento!, referenceDate);
      if (diff < 0) {
        inconsistencies.push({
          id: `inc-agendado-vencido-${payment.id}`,
          type: 'agendado_vencido',
          title: 'Pagamento agendado com vencimento ultrapassado',
          description: `Agendado para ${formatDateBR(payment.dataVencimento)} (${Math.abs(diff)} dia(s) atrás). Verifique se a liquidação já ocorreu para atualizar o status para "Pago".`,
          payment,
        });
      }
    }

    // Checagem de possível duplicidade na base
    const dupCheck = findDuplicatePayment(payments, payment, payment.id);
    if (dupCheck.isDuplicate && dupCheck.existingPayment && payment.id > dupCheck.existingPayment.id) {
      inconsistencies.push({
        id: `inc-dup-${payment.id}`,
        type: 'possivel_duplicidade',
        title: 'Possível lançamento duplicado',
        description:
          dupCheck.summary ||
          'Existem outros registros com fornecedor, valor ou vencimento compatíveis.',
        payment,
      });
    }

    // 4. Classificação temporal idêntica à regra do Relatórios Financeiros
    const isPendingStatus = payment.situacao === 'pendente' || payment.situacao === 'vencido';
    const isScheduledStatus = payment.situacao === 'agendado';

    if (hasDueDate) {
      const diff = calculateDaysDiff(payment.dataVencimento!, referenceDate);

      // Atrasado: exclusivamente pendente ou vencido com data anterior a hoje
      if (isPendingStatus && diff < 0) {
        overdueItems.push({
          payment,
          daysOverdue: Math.abs(diff),
        });
        if (validAmt) {
          overdueTotalAmount += val;
        } else {
          overdueWithoutValueCount += 1;
        }
      }

      // Vencimentos próximos (hoje até 7 dias) para obrigações confirmadas (pendente/vencido/agendado)
      if ((isPendingStatus || isScheduledStatus) && diff >= 0 && diff <= 7) {
        upcomingDueSoonItems.push({
          payment,
          daysRemaining: diff,
        });
        if (validAmt) {
          upcomingDueSoonAmount += val;
        }
      }
    }

    // 5. Acumulador de fornecedores com valores em aberto (apenas pendente, vencido e agendado)
    if (isPendingStatus || isScheduledStatus) {
      const supInfo = getSupplierDisplay(payment.fornecedor);
      const current = supplierMap.get(supInfo.key) || {
        fornecedor: supInfo.label,
        isUnidentified: supInfo.isUnidentified,
        openAmount: 0,
        pendingAmount: 0,
        scheduledAmount: 0,
        overdueAmount: 0,
        openCount: 0,
        missingValueCount: 0,
        payments: [],
      };

      current.openCount += 1;
      current.payments.push(payment);

      if (validAmt) {
        current.openAmount += val;
        if (isPendingStatus) {
          current.pendingAmount += val;
          if (hasDueDate && calculateDaysDiff(payment.dataVencimento!, referenceDate) < 0) {
            current.overdueAmount += val;
          }
        } else if (isScheduledStatus) {
          current.scheduledAmount += val;
        }
      } else {
        current.missingValueCount += 1;
      }

      supplierMap.set(supInfo.key, current);
    }
  });

  // Ordenações determinísticas
  overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue);
  upcomingDueSoonItems.sort((a, b) => a.daysRemaining - b.daysRemaining);

  const openSuppliers = Array.from(supplierMap.values()).sort((a, b) => {
    if (b.openAmount !== a.openAmount) return b.openAmount - a.openAmount;
    return b.openCount - a.openCount;
  });

  // 6. Recomendações de prioridades fundamentadas exclusivamente nos achados reais
  const recommendations: PriorityRecommendation[] = [];

  if (overdueItems.length > 0) {
    recommendations.push({
      id: 'rec-atrasados',
      level: 'critica',
      title: `Regularizar ${overdueItems.length} pagamento(s) em atraso (${formatCurrencyBRL(overdueTotalAmount)})`,
      detail: `Há obrigações pendentes com vencimento anterior a ${formatDateBR(referenceDate)}. Priorize o contato com os fornecedores ou a quitação imediata para evitar encargos.`,
    });
  }

  const agendadosVencidos = inconsistencies.filter((i) => i.type === 'agendado_vencido');
  if (agendadosVencidos.length > 0) {
    const sumAgendadoVencido = agendadosVencidos.reduce(
      (sum, item) => (hasValidAmount(item.payment.valor) ? sum + item.payment.valor : sum),
      0
    );
    recommendations.push({
      id: 'rec-agendados-vencidos',
      level: 'alta',
      title: `Confirmar baixa de ${agendadosVencidos.length} lançamento(s) agendado(s) (${formatCurrencyBRL(sumAgendadoVencido)})`,
      detail:
        'Existem pagamentos com status "Agendado" cuja data prevista já passou. Confirme no extrato bancário se foram liquidados e atualize o status.',
    });
  }

  if (upcomingDueSoonItems.length > 0) {
    recommendations.push({
      id: 'rec-proximos-7',
      level: 'media',
      title: `Provisionar ${upcomingDueSoonItems.length} vencimento(s) nos próximos 7 dias (${formatCurrencyBRL(upcomingDueSoonAmount)})`,
      detail:
        'Organize o fluxo de caixa da semana para cobrir os compromissos com vencimento imediato ou próximo.',
    });
  }

  if (incompleteItems.length > 0 || undefinedStatusItems.length > 0) {
    recommendations.push({
      id: 'rec-incompletos',
      level: 'atencao',
      title: `Completar ${incompleteItems.length} registro(s) com dados ausentes ou indefinidos`,
      detail:
        'Registros sem valor, sem vencimento, sem fornecedor ou com situação não definida reduzem a previsibilidade do caixa e exigem conferência documental.',
    });
  }

  return {
    referenceDate,
    totalCount: payments.length,
    overdueItems,
    overdueTotalAmount,
    overdueWithoutValueCount,
    upcomingDueSoonItems,
    upcomingDueSoonAmount,
    inconsistencies,
    incompleteItems,
    undefinedStatusItems,
    openSuppliers,
    recommendations,
  };
}

/**
 * Responde perguntas em linguagem natural utilizando exclusivamente os registros reais cadastrados.
 * Nunca inventa valores ou fornecedores e informa quando não há dados suficientes.
 */
export function answerFinancialQuestion(
  questionRaw: string,
  payments: PaymentRecord[],
  diagnosis: AIInsightsDiagnosis
): AssistantAnswer {
  const id = `ans-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const question = questionRaw.trim();
  const q = normalizeText(question);

  if (!question) {
    return {
      id,
      question,
      status: 'insufficient_data',
      answer: 'Digite uma pergunta para consultar os lançamentos financeiros cadastrados.',
      evidence: [],
    };
  }

  if (payments.length === 0) {
    return {
      id,
      question,
      status: 'insufficient_data',
      answer:
        'Não há dados suficientes: nenhum lançamento está cadastrado atualmente no AI Organize.',
      evidence: [],
    };
  }

  // 1. Consulta por fornecedor específico citado na pergunta
  const asksForRanking =
    q.includes('maior') ||
    q.includes('menor') ||
    q.includes('mais alto') ||
    q.includes('mais caro') ||
    q.includes('ranking') ||
    q.includes('principal') ||
    q.includes('quais');

  const uniqueSuppliers = Array.from(
    new Set(
      payments
        .map((p) => p.fornecedor?.trim())
        .filter((name): name is string => Boolean(name))
    )
  );

  const matchedSupplierName = uniqueSuppliers.find((supName) => {
    const normSup = normalizeText(supName);
    if (q.includes(normSup)) return true;
    const tokens = normSup
      .split(/[\s&.,/-]+/)
      .filter((t) => t.length >= 4 && !['ltda', 'ficticia', 'servicos', 'comercio', 'empresa'].includes(t));
    return tokens.length > 0 && tokens.some((tok) => q.includes(tok));
  });

  if (matchedSupplierName && !asksForRanking) {
    const supRecords = payments.filter((p) => p.fornecedor?.trim() === matchedSupplierName);
    const knownTotal = supRecords.reduce(
      (sum, p) => (hasValidAmount(p.valor) ? sum + p.valor : sum),
      0
    );
    const missingValCount = supRecords.filter((p) => !hasValidAmount(p.valor)).length;

    return {
      id,
      question,
      status: 'answered',
      answer: `Foram encontrados ${supRecords.length} lançamento(s) para "${matchedSupplierName}", somando ${formatCurrencyBRL(knownTotal)} em valores informados.`,
      caveat:
        missingValCount > 0
          ? `${missingValCount} lançamento(s) deste fornecedor não possuem valor informado.`
          : undefined,
      evidence: supRecords.map((p) => ({
        label: p.fornecedor || 'Fornecedor não informado',
        value: formatCurrencyBRL(p.valor),
        detail: `${STATUS_MAP[p.situacao]?.label || p.situacao} · Venc.: ${formatDateBR(p.dataVencimento)}`,
        payment: p,
      })),
    };
  }

  // 2. Qual fornecedor possui maior valor em aberto?
  if (
    (q.includes('fornecedor') || q.includes('credor') || q.includes('empresa') || q.includes('quem')) &&
    (q.includes('maior') || q.includes('mais')) &&
    (q.includes('aberto') || q.includes('pagar') || q.includes('pendente') || q.includes('devo'))
  ) {
    const ranked = diagnosis.openSuppliers.filter((s) => s.openAmount > 0);
    if (ranked.length === 0) {
      return {
        id,
        question,
        status: 'insufficient_data',
        answer: 'Não há nenhum fornecedor com valor em aberto definido nos lançamentos atuais.',
        evidence: [],
      };
    }

    const top = ranked[0];
    const detailParts: string[] = [];
    if (top.pendingAmount > 0) detailParts.push(`${formatCurrencyBRL(top.pendingAmount)} pendente/vencido`);
    if (top.scheduledAmount > 0) detailParts.push(`${formatCurrencyBRL(top.scheduledAmount)} agendado`);

    return {
      id,
      question,
      status: 'answered',
      answer: `O fornecedor com maior valor em aberto é "${top.fornecedor}", totalizando ${formatCurrencyBRL(top.openAmount)} em ${top.openCount} lançamento(s) (${detailParts.join(' + ')}).`,
      caveat:
        diagnosis.undefinedStatusItems.length > 0
          ? `Nota: ${diagnosis.undefinedStatusItems.length} lançamento(s) com situação "Não definida" não são classificados como pendentes ou atrasados.`
          : undefined,
      evidence: [
        ...ranked.slice(0, 3).map((s, idx) => ({
          label: `${idx + 1}º ${s.fornecedor}`,
          value: formatCurrencyBRL(s.openAmount),
          detail: `${s.openCount} lançamento(s) em aberto`,
        })),
        ...top.payments.map((p) => ({
          label: p.numeroNota ? `NF ${p.numeroNota} · ${top.fornecedor}` : top.fornecedor,
          value: formatCurrencyBRL(p.valor),
          detail: `${STATUS_MAP[p.situacao]?.label || p.situacao} · Venc.: ${formatDateBR(p.dataVencimento)}`,
          payment: p,
        })),
      ],
    };
  }

  // 3. Quais pagamentos estão atrasados?
  if (q.includes('atrasad') || q.includes('atraso') || q.includes('vencid')) {
    if (diagnosis.overdueItems.length === 0) {
      const agendadosVencidos = diagnosis.inconsistencies.filter((i) => i.type === 'agendado_vencido');
      return {
        id,
        question,
        status: 'answered',
        answer: `Não há pagamentos pendentes em atraso em relação a ${formatDateBR(diagnosis.referenceDate)}.`,
        caveat:
          agendadosVencidos.length > 0
            ? `Atenção: existe(m) ${agendadosVencidos.length} lançamento(s) com situação "Agendado" e data ultrapassada que exigem confirmação de baixa.`
            : undefined,
        evidence: [],
      };
    }

    const agendadosVencidos = diagnosis.inconsistencies.filter((i) => i.type === 'agendado_vencido');
    const caveats: string[] = [];
    if (diagnosis.overdueWithoutValueCount > 0) {
      caveats.push(`${diagnosis.overdueWithoutValueCount} lançamento(s) em atraso está(ão) sem valor informado.`);
    }
    if (agendadosVencidos.length > 0) {
      caveats.push(
        `Existem ainda ${agendadosVencidos.length} lançamento(s) marcados como "Agendado" com data anterior a hoje (sinalizados como inconsistência para confirmação).`
      );
    }

    return {
      id,
      question,
      status: 'answered',
      answer: `Existem ${diagnosis.overdueItems.length} pagamento(s) em atraso (referência ${formatDateBR(diagnosis.referenceDate)}), somando ${formatCurrencyBRL(diagnosis.overdueTotalAmount)}.`,
      caveat: caveats.length > 0 ? caveats.join(' ') : undefined,
      evidence: diagnosis.overdueItems.map((item) => ({
        label: item.payment.fornecedor?.trim() || 'Fornecedor não informado',
        value: formatCurrencyBRL(item.payment.valor),
        detail: `Venc.: ${formatDateBR(item.payment.dataVencimento)} (${item.daysOverdue} dia(s) de atraso) · ${STATUS_MAP[item.payment.situacao]?.label || item.payment.situacao}`,
        payment: item.payment,
      })),
    };
  }

  // 4. Vencimentos próximos / hoje / próximos 7 dias
  if (
    q.includes('proximo') ||
    q.includes('vence') ||
    q.includes('vencimento') ||
    q.includes('hoje') ||
    q.includes('semana') ||
    q.includes('7 dias')
  ) {
    if (q.includes('hoje')) {
      const todayItems = diagnosis.upcomingDueSoonItems.filter((u) => u.daysRemaining === 0);
      if (todayItems.length === 0) {
        return {
          id,
          question,
          status: 'answered',
          answer: `Nenhum pagamento confirmado vence hoje (${formatDateBR(diagnosis.referenceDate)}).`,
          evidence: [],
        };
      }
      const totalToday = todayItems.reduce(
        (sum, u) => (hasValidAmount(u.payment.valor) ? sum + u.payment.valor : sum),
        0
      );
      return {
        id,
        question,
        status: 'answered',
        answer: `${todayItems.length} pagamento(s) vencem hoje (${formatDateBR(diagnosis.referenceDate)}), somando ${formatCurrencyBRL(totalToday)}.`,
        evidence: todayItems.map((u) => ({
          label: u.payment.fornecedor?.trim() || 'Fornecedor não informado',
          value: formatCurrencyBRL(u.payment.valor),
          detail: `Vence hoje · ${STATUS_MAP[u.payment.situacao]?.label || u.payment.situacao}`,
          payment: u.payment,
        })),
      };
    }

    if (diagnosis.upcomingDueSoonItems.length === 0) {
      return {
        id,
        question,
        status: 'answered',
        answer: `Não há vencimentos previstos nos próximos 7 dias a partir de ${formatDateBR(diagnosis.referenceDate)}.`,
        caveat:
          diagnosis.incompleteItems.length > 0
            ? `Existem ${diagnosis.incompleteItems.length} registro(s) incompleto(s) que podem estar sem data de vencimento ou com situação indefinida.`
            : undefined,
        evidence: [],
      };
    }

    return {
      id,
      question,
      status: 'answered',
      answer: `Há ${diagnosis.upcomingDueSoonItems.length} pagamento(s) com vencimento nos próximos 7 dias, somando ${formatCurrencyBRL(diagnosis.upcomingDueSoonAmount)} em valores conhecidos.`,
      evidence: diagnosis.upcomingDueSoonItems.map((u) => ({
        label: u.payment.fornecedor?.trim() || 'Fornecedor não informado',
        value: formatCurrencyBRL(u.payment.valor),
        detail: `Venc.: ${formatDateBR(u.payment.dataVencimento)} (${u.daysRemaining === 0 ? 'Vence hoje' : `em ${u.daysRemaining} dia(s)`}) · ${STATUS_MAP[u.payment.situacao]?.label || u.payment.situacao}`,
        payment: u.payment,
      })),
    };
  }

  // 5. Inconsistências, riscos ou dados incompletos
  if (
    q.includes('incompleto') ||
    q.includes('risco') ||
    q.includes('inconsisten') ||
    q.includes('faltando') ||
    q.includes('ausente') ||
    q.includes('pendencia') ||
    q.includes('sem valor') ||
    q.includes('sem data') ||
    q.includes('sem fornecedor') ||
    q.includes('indefinid')
  ) {
    if (diagnosis.incompleteItems.length === 0 && diagnosis.inconsistencies.length === 0) {
      return {
        id,
        question,
        status: 'answered',
        answer: 'Não foram encontradas inconsistências ou registros com campos obrigatórios ausentes.',
        evidence: [],
      };
    }

    const evidence: AssistantEvidenceItem[] = [
      ...diagnosis.inconsistencies.map((inc) => ({
        label: `${inc.title} · ${inc.payment.fornecedor?.trim() || 'Fornecedor não informado'}`,
        value: formatCurrencyBRL(inc.payment.valor),
        detail: inc.description,
        payment: inc.payment,
      })),
      ...diagnosis.incompleteItems.map((inc) => ({
        label: `Incompleto · ${inc.payment.fornecedor?.trim() || 'Fornecedor não informado'}`,
        value: formatCurrencyBRL(inc.payment.valor),
        detail: `Faltando: ${inc.missingLabels.join(', ')}`,
        payment: inc.payment,
      })),
    ];

    return {
      id,
      question,
      status: 'answered',
      answer: `Foram identificados ${diagnosis.inconsistencies.length} inconsistência(s) de status/dados e ${diagnosis.incompleteItems.length} lançamento(s) incompleto(s) que exigem conferência.`,
      evidence,
    };
  }

  // 6. Pagamentos quitados / pagos
  if (q.includes('quitad') || q.includes('pago') || q.includes('liquidado')) {
    const paidPayments = payments.filter((p) => p.situacao === 'pago');
    const paidAmount = paidPayments.reduce(
      (sum, p) => (hasValidAmount(p.valor) ? sum + p.valor : sum),
      0
    );

    if (paidPayments.length === 0) {
      return {
        id,
        question,
        status: 'answered',
        answer: 'Nenhum pagamento consta com situação "Pago" nos registros atuais.',
        evidence: [],
      };
    }

    return {
      id,
      question,
      status: 'answered',
      answer: `Constam ${paidPayments.length} pagamento(s) quitado(s), totalizando ${formatCurrencyBRL(paidAmount)}.`,
      evidence: paidPayments.map((p) => ({
        label: p.fornecedor?.trim() || 'Fornecedor não informado',
        value: formatCurrencyBRL(p.valor),
        detail: `Pago · Venc.: ${formatDateBR(p.dataVencimento)}`,
        payment: p,
      })),
    };
  }

  // 7. Total em aberto / agendados / pendentes
  if (q.includes('aberto') || q.includes('a pagar') || q.includes('pendente') || q.includes('agendado')) {
    const pendingPayments = payments.filter((p) => p.situacao === 'pendente' || p.situacao === 'vencido');
    const scheduledPayments = payments.filter((p) => p.situacao === 'agendado');
    const targetList = q.includes('agendado')
      ? scheduledPayments
      : q.includes('pendente')
      ? pendingPayments
      : [...pendingPayments, ...scheduledPayments];

    const sumTarget = targetList.reduce(
      (sum, p) => (hasValidAmount(p.valor) ? sum + p.valor : sum),
      0
    );

    return {
      id,
      question,
      status: 'answered',
      answer: `Foram encontrados ${targetList.length} lançamento(s) correspondentes, somando ${formatCurrencyBRL(sumTarget)} em valores informados.`,
      caveat:
        diagnosis.undefinedStatusItems.length > 0
          ? `${diagnosis.undefinedStatusItems.length} registro(s) com situação "Não definida" não entram neste cálculo.`
          : undefined,
      evidence: targetList.map((p) => ({
        label: p.fornecedor?.trim() || 'Fornecedor não informado',
        value: formatCurrencyBRL(p.valor),
        detail: `${STATUS_MAP[p.situacao]?.label || p.situacao} · Venc.: ${formatDateBR(p.dataVencimento)}`,
        payment: p,
      })),
    };
  }

  // 8. Maior ou menor lançamento individual / fornecedor com maior valor geral
  if (q.includes('maior') || q.includes('menor') || q.includes('caro') || q.includes('barato')) {
    const withValue = payments.filter((p) => hasValidAmount(p.valor));
    if (withValue.length === 0) {
      return {
        id,
        question,
        status: 'insufficient_data',
        answer: 'Não há lançamentos com valor monetário definido para comparar.',
        evidence: [],
      };
    }

    const sorted = withValue.slice().sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0));
    const target = q.includes('menor') || q.includes('barato') ? sorted[sorted.length - 1] : sorted[0];
    const kind = q.includes('menor') || q.includes('barato') ? 'menor' : 'maior';

    return {
      id,
      question,
      status: 'answered',
      answer: `O lançamento de ${kind} valor individual registrado é de "${target.fornecedor?.trim() || 'Fornecedor não informado'}", no valor de ${formatCurrencyBRL(target.valor)}.`,
      evidence: [
        {
          label: target.fornecedor?.trim() || 'Fornecedor não informado',
          value: formatCurrencyBRL(target.valor),
          detail: `${STATUS_MAP[target.situacao]?.label || target.situacao} · Venc.: ${formatDateBR(target.dataVencimento)}`,
          payment: target,
        },
      ],
    };
  }

  // 9. Fallback honesto quando não há dados correspondentes
  return {
    id,
    question,
    status: 'insufficient_data',
    answer:
      'Não há dados suficientes ou correspondentes nos lançamentos cadastrados para responder com segurança a essa pergunta. Consulto apenas fornecedores, valores, vencimentos, atrasos, situações e inconsistências registrados no AI Organize.',
    evidence: [],
  };
}
