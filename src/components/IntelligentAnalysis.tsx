/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  FileQuestion,
  Info,
  ClipboardCopy,
  ChevronRight,
  TrendingDown,
  ShieldCheck,
  ChevronDown,
  CalendarDays,
} from 'lucide-react';
import { PaymentRecord } from '../types/payment';
import { formatCurrencyBRL, formatDateBR } from '../utils/formatters';

interface IntelligentAnalysisProps {
  payments: PaymentRecord[];
  onEditPayment: (payment: PaymentRecord) => void;
  onNavigateToTab: (tab: 'todos' | 'incompletos' | 'auditoria') => void;
}

export const IntelligentAnalysis: React.FC<IntelligentAnalysisProps> = ({
  payments,
  onEditPayment,
  onNavigateToTab,
}) => {
  // Data de referência configurável (inicia com a data atual informada: 30/10/2026)
  const [referenceDate, setReferenceDate] = useState<string>('2026-10-30');
  // Janela de dias para considerar "próximo do vencimento" (padrão: 7 dias)
  const [horizonDays, setHorizonDays] = useState<number>(7);
  const [copied, setCopied] = useState<boolean>(false);
  const [showFutureOnTime, setShowFutureOnTime] = useState<boolean>(false);
  const [showPaidList, setShowPaidList] = useState<boolean>(false);

  /**
   * Cálculo determinístico de diferença de dias corridos entre duas datas YYYY-MM-DD.
   * Utiliza UTC puro para anular qualquer impacto de fuso horário ou horário de verão.
   * Resultado:
   *   > 0  => Target é anterior à Referência (Atrasado)
   *   === 0 => Target é a mesma data da Referência (Vence hoje)
   *   < 0  => Target é posterior à Referência (Futuro / A vencer)
   */
  const calculateDaysDiff = (dateStr: string, refStr: string): number => {
    const [yRef, mRef, dRef] = refStr.split('-').map(Number);
    const [yTarget, mTarget, dTarget] = dateStr.split('-').map(Number);

    const utcRef = Date.UTC(yRef, mRef - 1, dRef);
    const utcTarget = Date.UTC(yTarget, mTarget - 1, dTarget);

    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.round((utcRef - utcTarget) / msPerDay);
  };

  /**
   * Classificação estrita em 5 partições mutuamente exclusivas (garantia de zero duplicidade):
   * 1. Pagamentos com situação "Pago" (NUNCA aparecem como atrasados nem próximos do vencimento)
   * 2. Registros sem data de vencimento (isolados em seção separada sem inventar datas)
   * 3. Pagamentos em atraso (vencimento < referência e situação !== 'pago')
   * 4. Pagamentos futuros próximos do vencimento (vencimento >= referência e dias restantes <= horizonte e !== 'pago')
   * 5. Pagamentos futuros no prazo (vencimento >= referência e dias restantes > horizonte e !== 'pago')
   */
  const analysis = useMemo(() => {
    const overdue: Array<{ payment: PaymentRecord; daysOverdue: number }> = [];
    const upcoming: Array<{ payment: PaymentRecord; daysRemaining: number }> = [];
    const futureOnTime: Array<{ payment: PaymentRecord; daysRemaining: number }> = [];
    const missingDueDate: PaymentRecord[] = [];
    const paid: PaymentRecord[] = [];

    // Itera rigorosamente cada registro sem duplicidade
    payments.forEach((payment) => {
      // Regra 1: Pagamentos com situação "Pago" NUNCA devem aparecer como atrasados
      if (payment.situacao === 'pago') {
        paid.push(payment);
        return;
      }

      // Regra 4: Registros sem data de vencimento devem permanecer em uma seção separada
      if (!payment.dataVencimento || payment.dataVencimento.trim() === '') {
        missingDueDate.push(payment);
        return;
      }

      // Regra 2 & 3: Comparação temporal em relação à data de referência
      const diff = calculateDaysDiff(payment.dataVencimento, referenceDate);

      if (diff > 0) {
        // Vencimento anterior à referência e não pago => ATRASADO
        overdue.push({ payment, daysOverdue: diff });
      } else {
        // Vencimento futuro ou no dia (diff <= 0)
        const daysRemaining = Math.abs(diff);
        if (daysRemaining <= horizonDays) {
          // Próximos do vencimento (dentro do horizonte selecionado)
          upcoming.push({ payment, daysRemaining });
        } else {
          // Demais pagamentos futuros no prazo regular
          futureOnTime.push({ payment, daysRemaining });
        }
      }
    });

    // Ordenação determinística
    overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
    upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining);
    futureOnTime.sort((a, b) => a.daysRemaining - b.daysRemaining);

    // Totais financeiros estritamente particionados (sem dupla contagem)
    const sumValidValues = (list: PaymentRecord[]) =>
      list.reduce((sum, p) => (p.valor !== null && !isNaN(p.valor) && p.valor > 0 ? sum + p.valor : sum), 0);

    const totalOverdueAmount = sumValidValues(overdue.map((i) => i.payment));
    const overdueWithoutValueCount = overdue.filter((i) => i.payment.valor === null || i.payment.valor <= 0).length;

    const totalUpcomingAmount = sumValidValues(upcoming.map((i) => i.payment));
    const upcomingWithoutValueCount = upcoming.filter((i) => i.payment.valor === null || i.payment.valor <= 0).length;

    const totalFutureOnTimeAmount = sumValidValues(futureOnTime.map((i) => i.payment));
    const totalPaidAmount = sumValidValues(paid);
    const totalMissingDueDateAmount = sumValidValues(missingDueDate);

    // Montante global cadastrado (soma exata das 5 partições)
    const totalConsolidatedAmount =
      totalOverdueAmount +
      totalUpcomingAmount +
      totalFutureOnTimeAmount +
      totalPaidAmount +
      totalMissingDueDateAmount;

    return {
      overdue,
      upcoming,
      futureOnTime,
      missingDueDate,
      paid,
      totalOverdueAmount,
      overdueWithoutValueCount,
      totalUpcomingAmount,
      upcomingWithoutValueCount,
      totalFutureOnTimeAmount,
      totalPaidAmount,
      totalMissingDueDateAmount,
      totalConsolidatedAmount,
    };
  }, [payments, referenceDate, horizonDays]);

  // Função para simulação rápida de datas de teste
  const handleSetOffsetDays = (days: number) => {
    const base = new Date('2026-10-30T12:00:00Z');
    base.setUTCDate(base.getUTCDate() + days);
    setReferenceDate(base.toISOString().split('T')[0]);
  };

  // Copiar relatório formatado em texto
  const handleCopyReport = () => {
    let report = `*RELATÓRIO DE ANÁLISE INTELIGENTE - ORGANIZA AI*\n`;
    report += `Data de Referência da Análise: ${formatDateBR(referenceDate)}\n`;
    report += `Horizonte para Próximos Vencimentos: ${horizonDays} dias\n`;
    report += `Status: Regras automáticas verificadas sem duplicidade de valores\n`;
    report += `--------------------------------------------------------\n\n`;

    report += `1. PAGAMENTOS EM ATRASO (${analysis.overdue.length} lançamento(s) - Total: ${formatCurrencyBRL(analysis.totalOverdueAmount)}):\n`;
    if (analysis.overdue.length === 0) {
      report += `   Nenhum pagamento em atraso identificado para esta data.\n\n`;
    } else {
      analysis.overdue.forEach(({ payment, daysOverdue }, idx) => {
        const fornecedor = payment.fornecedor || 'FORNECEDOR NÃO INFORMADO';
        const valor = formatCurrencyBRL(payment.valor);
        const venc = formatDateBR(payment.dataVencimento);
        report += `   ${idx + 1}. ${fornecedor}\n`;
        report += `      - Valor: ${valor}\n`;
        report += `      - Vencimento: ${venc}\n`;
        report += `      - Atraso: ${daysOverdue} dia(s)\n`;
        if (payment.observacoes) report += `      - Nota: ${payment.observacoes}\n`;
      });
      report += `\n`;
    }

    report += `2. PAGAMENTOS PRÓXIMOS DO VENCIMENTO (${analysis.upcoming.length} lançamento(s) - Total: ${formatCurrencyBRL(analysis.totalUpcomingAmount)}):\n`;
    if (analysis.upcoming.length === 0) {
      report += `   Nenhum pagamento programado para os próximos ${horizonDays} dias.\n\n`;
    } else {
      analysis.upcoming.forEach(({ payment, daysRemaining }, idx) => {
        const fornecedor = payment.fornecedor || 'FORNECEDOR NÃO INFORMADO';
        const valor = formatCurrencyBRL(payment.valor);
        const venc = formatDateBR(payment.dataVencimento);
        const labelPrazo = daysRemaining === 0 ? 'Vence hoje!' : `Vence em ${daysRemaining} dia(s)`;
        report += `   ${idx + 1}. ${fornecedor}\n`;
        report += `      - Valor: ${valor}\n`;
        report += `      - Vencimento: ${venc} (${labelPrazo})\n`;
      });
      report += `\n`;
    }

    if (analysis.futureOnTime.length > 0) {
      report += `3. DEMAIS PAGAMENTOS FUTUROS NO PRAZO (${analysis.futureOnTime.length} lançamento(s) - Total: ${formatCurrencyBRL(analysis.totalFutureOnTimeAmount)}):\n`;
      analysis.futureOnTime.forEach(({ payment, daysRemaining }, idx) => {
        report += `   ${idx + 1}. ${payment.fornecedor || 'Sem fornecedor'} - ${formatCurrencyBRL(payment.valor)} - Vence em ${formatDateBR(payment.dataVencimento)} (${daysRemaining} dias)\n`;
      });
      report += `\n`;
    }

    report += `4. PAGAMENTOS JÁ QUITADOS (${analysis.paid.length} lançamento(s) - Total: ${formatCurrencyBRL(analysis.totalPaidAmount)}):\n`;
    report += `   (Excluídos de atraso e cobrança por estarem com situação 'Pago')\n`;
    analysis.paid.forEach((p, idx) => {
      report += `   ${idx + 1}. ${p.fornecedor || 'Sem fornecedor'} - ${formatCurrencyBRL(p.valor)} - Pago\n`;
    });
    report += `\n`;

    if (analysis.missingDueDate.length > 0) {
      report += `5. REGISTROS COM VENCIMENTO NÃO INFORMADO (${analysis.missingDueDate.length} registro(s) - Total: ${formatCurrencyBRL(analysis.totalMissingDueDateAmount)}):\n`;
      report += `   (Isolados em seção separada para evitar inferência arbitrária de datas)\n`;
      analysis.missingDueDate.forEach((p, idx) => {
        report += `   ${idx + 1}. ${p.fornecedor || 'Sem fornecedor'} - ${formatCurrencyBRL(p.valor)}\n`;
      });
      report += `\n`;
    }

    report += `--------------------------------------------------------\n`;
    report += `CONCILIAÇÃO FINANCEIRA TOTAL: ${formatCurrencyBRL(analysis.totalConsolidatedAmount)} em ${payments.length} registros cadastrados sem duplicidade.\n`;

    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Banner de Conformidade das Regras & Motor Determinístico */}
      <div className="bg-slate-100/90 border border-slate-200 rounded-xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900">
                Análise Inteligente · Regras Contábeis Validadas
              </h2>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                Sem Duplicidade de Totais
              </span>
              <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                Dados Originais Intactos
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              O motor de regras aplica particionamento estrito: pagamentos com situação <strong>"Pago"</strong> nunca são considerados atrasados; vencimentos anteriores à data de referência não quitados constam como <strong>atrasados</strong>; e compromissos futuros entram como <strong>próximos do vencimento</strong> dentro do período escolhido. Registros sem vencimento permanecem isolados sem inventar datas.
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Controle de Testes da Data de Referência */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Ponto de Referência Temporal para os Cálculos
            </span>
            <div className="mt-1 text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Data de Referência Utilizada: {formatDateBR(referenceDate)}</span>
              {referenceDate === '2026-10-30' && (
                <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                  Data Atual do Sistema
                </span>
              )}
            </div>
          </div>

          {/* Controles para alteração e teste da data */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label htmlFor="ref-date-input" className="text-xs text-slate-600 font-medium">
                Simular Data:
              </label>
              <input
                id="ref-date-input"
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value || '2026-10-30')}
                className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="horizon-select" className="text-xs text-slate-600 font-medium">
                Próximos em até:
              </label>
              <select
                id="horizon-select"
                value={horizonDays}
                onChange={(e) => setHorizonDays(Number(e.target.value))}
                className="px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value={3}>3 dias</option>
                <option value={5}>5 dias</option>
                <option value={7}>7 dias (1 semana)</option>
                <option value={15}>15 dias (quinzena)</option>
                <option value={30}>30 dias (mês)</option>
              </select>
            </div>

            <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
              <button
                onClick={() => setReferenceDate('2026-10-30')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  referenceDate === '2026-10-30'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title="Redefinir para 30/10/2026"
              >
                Hoje (30/10)
              </button>
              <button
                onClick={() => handleSetOffsetDays(7)}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                title="Avançar 7 dias a partir de 30/10/2026"
              >
                +7 dias
              </button>
              <button
                onClick={() => handleSetOffsetDays(15)}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                title="Avançar 15 dias a partir de 30/10/2026"
              >
                +15 dias
              </button>
            </div>

            <button
              onClick={handleCopyReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors shrink-0"
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              <span>{copied ? 'Relatório Copiado!' : 'Copiar Relatório'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cartões Síntese do Diagnóstico */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Pagamentos em Atraso */}
        <div className={`p-5 rounded-xl border transition-all ${
          analysis.overdue.length > 0
            ? 'bg-rose-50/70 border-rose-300'
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-900 uppercase tracking-wider">
              Atrasados (&lt; {formatDateBR(referenceDate)})
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-rose-900">
              {analysis.overdue.length} {analysis.overdue.length === 1 ? 'pagamento' : 'pagamentos'}
            </div>
            <div className="mt-1 text-xs text-rose-800 font-mono tabular-nums">
              Total: {formatCurrencyBRL(analysis.totalOverdueAmount)}
              {analysis.overdueWithoutValueCount > 0 && (
                <span className="block text-[11px] text-amber-800 font-sans mt-0.5">
                  ({analysis.overdueWithoutValueCount} sem valor definido)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Próximos do Vencimento */}
        <div className={`p-5 rounded-xl border transition-all ${
          analysis.upcoming.length > 0
            ? 'bg-amber-50/70 border-amber-300'
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
              Próximos (Até {horizonDays} dias)
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-900">
              {analysis.upcoming.length} {analysis.upcoming.length === 1 ? 'pagamento' : 'pagamentos'}
            </div>
            <div className="mt-1 text-xs text-amber-800 font-mono tabular-nums">
              Total: {formatCurrencyBRL(analysis.totalUpcomingAmount)}
              {analysis.upcomingWithoutValueCount > 0 && (
                <span className="block text-[11px] text-amber-800 font-sans mt-0.5">
                  ({analysis.upcomingWithoutValueCount} sem valor definido)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Pagamentos Sem Vencimento (Lacunas Cadastrais) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sem Vencimento
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <FileQuestion className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-800">
              {analysis.missingDueDate.length}
            </div>
            <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
              Total: {formatCurrencyBRL(analysis.totalMissingDueDateAmount)}
            </div>
          </div>
        </div>

        {/* 4. Pagamentos Já Quitados */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Quitados (Situação "Pago")
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
              {analysis.paid.length}
            </div>
            <div className="mt-1 text-xs text-emerald-700 font-mono tabular-nums">
              Total pago: {formatCurrencyBRL(analysis.totalPaidAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* Conciliação de Totais Financeiros Sem Duplicidade */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-semibold text-slate-900 block">
              Conciliação Financeira sem Duplicidade
            </span>
            <span className="text-slate-500">
              Total cadastrado no sistema distribuído nas categorias exclusivas:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-mono tabular-nums">
            <div>
              <span className="text-slate-500 mr-1">Atrasados:</span>
              <span className="font-bold text-rose-700">{formatCurrencyBRL(analysis.totalOverdueAmount)}</span>
            </div>
            <span>+</span>
            <div>
              <span className="text-slate-500 mr-1">Próximos:</span>
              <span className="font-bold text-amber-700">{formatCurrencyBRL(analysis.totalUpcomingAmount)}</span>
            </div>
            <span>+</span>
            <div>
              <span className="text-slate-500 mr-1">Futuros ({'>'}{horizonDays}d):</span>
              <span className="font-bold text-sky-700">{formatCurrencyBRL(analysis.totalFutureOnTimeAmount)}</span>
            </div>
            <span>+</span>
            <div>
              <span className="text-slate-500 mr-1">Quitados:</span>
              <span className="font-bold text-emerald-700">{formatCurrencyBRL(analysis.totalPaidAmount)}</span>
            </div>
            <span>+</span>
            <div>
              <span className="text-slate-500 mr-1">Sem Venc.:</span>
              <span className="font-bold text-slate-700">{formatCurrencyBRL(analysis.totalMissingDueDateAmount)}</span>
            </div>
            <span>=</span>
            <div className="bg-slate-100 px-2 py-1 rounded font-bold text-slate-900">
              {formatCurrencyBRL(analysis.totalConsolidatedAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* BLOCO 1: Pagamentos Atrasados (Requisito Explícito) */}
      <div className="bg-white rounded-xl border border-rose-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-rose-50/70 border-b border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-rose-200 text-rose-800 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-950">
                1. Pagamentos em Atraso Identificados ({analysis.overdue.length})
              </h3>
              <p className="text-xs text-rose-800">
                Lançamentos com vencimento anterior a {formatDateBR(referenceDate)} que <strong>não possuem situação "Pago"</strong>.
              </p>
            </div>
          </div>

          {analysis.overdue.length > 0 && (
            <span className="text-xs font-mono tabular-nums font-bold text-rose-900 bg-white/80 px-3 py-1 rounded-md border border-rose-300">
              Montante em atraso: {formatCurrencyBRL(analysis.totalOverdueAmount)}
            </span>
          )}
        </div>

        {analysis.overdue.length === 0 ? (
          <div className="py-8 px-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h4 className="mt-2 text-sm font-semibold text-slate-900">
              Nenhum pagamento em atraso!
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Para a data de referência de {formatDateBR(referenceDate)}, todos os compromissos com vencimento informado estão em dia ou já foram quitados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200 text-slate-600 font-semibold text-xs tracking-wider uppercase">
                  <th className="py-3 px-4 sm:px-6">Nome do Fornecedor</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4">Data de Vencimento</th>
                  <th className="py-3 px-4">Dias de Atraso</th>
                  <th className="py-3 px-4">Situação Cadastrada</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analysis.overdue.map(({ payment, daysOverdue }) => (
                  <tr key={payment.id} className="hover:bg-rose-50/30 transition-colors">
                    {/* Fornecedor */}
                    <td className="py-3.5 px-4 sm:px-6 align-top">
                      <div className="font-semibold text-slate-900">
                        {payment.fornecedor || (
                          <span className="text-rose-700 italic">Fornecedor não informado</span>
                        )}
                      </div>
                      {payment.observacoes && (
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {payment.observacoes}
                        </div>
                      )}
                    </td>

                    {/* Valor */}
                    <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                      {payment.valor !== null && !isNaN(payment.valor) && payment.valor > 0 ? (
                        <span className="font-bold text-slate-900 text-sm">
                          {formatCurrencyBRL(payment.valor)}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded italic font-sans">
                          Não informado
                        </span>
                      )}
                    </td>

                    {/* Data de Vencimento */}
                    <td className="py-3.5 px-4 align-top font-mono tabular-nums text-slate-800">
                      {formatDateBR(payment.dataVencimento)}
                    </td>

                    {/* Quantos dias de atraso possui */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                        <span className="font-mono tabular-nums">{daysOverdue}</span>{' '}
                        <span>{daysOverdue === 1 ? 'dia de atraso' : 'dias de atraso'}</span>
                      </div>
                    </td>

                    {/* Situação */}
                    <td className="py-3.5 px-4 align-top">
                      <span className="text-xs text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-medium capitalize">
                        {payment.situacao === 'vencido' ? 'Em atraso' : payment.situacao}
                      </span>
                    </td>

                    {/* Ação */}
                    <td className="py-3.5 px-4 sm:px-6 align-top text-right">
                      <button
                        onClick={() => onEditPayment(payment)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                      >
                        Ver / Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BLOCO 2: Pagamentos Próximos do Vencimento (Requisito Explícito) */}
      <div className="bg-white rounded-xl border border-amber-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-amber-50/70 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-amber-200 text-amber-800 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                2. Pagamentos Próximos do Vencimento ({analysis.upcoming.length})
              </h3>
              <p className="text-xs text-amber-800">
                Compromissos a vencer em até {horizonDays} dias corridos a partir de {formatDateBR(referenceDate)}.
              </p>
            </div>
          </div>

          {analysis.upcoming.length > 0 && (
            <span className="text-xs font-mono tabular-nums font-bold text-amber-900 bg-white/80 px-3 py-1 rounded-md border border-amber-300">
              Provisão necessária: {formatCurrencyBRL(analysis.totalUpcomingAmount)}
            </span>
          )}
        </div>

        {analysis.upcoming.length === 0 ? (
          <div className="py-8 px-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="mt-2 text-sm font-semibold text-slate-800">
              Nenhum pagamento nos próximos {horizonDays} dias
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Não há compromissos financeiros não quitados com vencimento para este intervalo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200 text-slate-600 font-semibold text-xs tracking-wider uppercase">
                  <th className="py-3 px-4 sm:px-6">Nome do Fornecedor</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4">Data de Vencimento</th>
                  <th className="py-3 px-4">Prazo Restante</th>
                  <th className="py-3 px-4">Situação Cadastrada</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analysis.upcoming.map(({ payment, daysRemaining }) => (
                  <tr key={payment.id} className="hover:bg-amber-50/30 transition-colors">
                    {/* Fornecedor */}
                    <td className="py-3.5 px-4 sm:px-6 align-top">
                      <div className="font-semibold text-slate-900">
                        {payment.fornecedor || (
                          <span className="text-rose-700 italic">Fornecedor não informado</span>
                        )}
                      </div>
                      {payment.observacoes && (
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {payment.observacoes}
                        </div>
                      )}
                    </td>

                    {/* Valor */}
                    <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                      {payment.valor !== null && !isNaN(payment.valor) && payment.valor > 0 ? (
                        <span className="font-bold text-slate-900 text-sm">
                          {formatCurrencyBRL(payment.valor)}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded italic font-sans">
                          Não informado
                        </span>
                      )}
                    </td>

                    {/* Vencimento */}
                    <td className="py-3.5 px-4 align-top font-mono tabular-nums text-slate-800">
                      {formatDateBR(payment.dataVencimento)}
                    </td>

                    {/* Prazo */}
                    <td className="py-3.5 px-4 align-top">
                      {daysRemaining === 0 ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-200 text-amber-950 border border-amber-300">
                          Vence hoje!
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-50 text-sky-900 border border-sky-200">
                          <Clock className="w-3.5 h-3.5 text-sky-600" />
                          <span>Vence em</span>
                          <span className="font-mono tabular-nums font-bold">{daysRemaining}</span>
                          <span>{daysRemaining === 1 ? 'dia' : 'dias'}</span>
                        </span>
                      )}
                    </td>

                    {/* Situação */}
                    <td className="py-3.5 px-4 align-top">
                      <span className="text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-medium capitalize">
                        {payment.situacao}
                      </span>
                    </td>

                    {/* Ação */}
                    <td className="py-3.5 px-4 sm:px-6 align-top text-right">
                      <button
                        onClick={() => onEditPayment(payment)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                      >
                        Ver / Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BLOCO 3: Transparência com Registros sem Vencimento (Isolados em seção separada) */}
      {analysis.missingDueDate.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <FileQuestion className="w-4 h-4 text-amber-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  3. Lançamentos com Data de Vencimento Ausente ({analysis.missingDueDate.length})
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Estes registros não foram incluídos nas categorias de atraso nem de proximidade para <strong>evitar inferências ou invenção de datas</strong>.
              </p>
            </div>
            <button
              onClick={() => onNavigateToTab('incompletos')}
              className="inline-flex items-center gap-1 text-xs text-indigo-700 font-semibold hover:text-indigo-900"
            >
              <span>Resolver Pendências</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {analysis.missingDueDate.map((p) => (
              <div
                key={p.id}
                className="py-2.5 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-800">
                    {p.fornecedor || 'Fornecedor não informado'}
                  </span>
                  <span className="text-slate-400 mx-2">·</span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {formatCurrencyBRL(p.valor)}
                  </span>
                  {p.observacoes && (
                    <span className="text-slate-500 ml-2 italic">({p.observacoes})</span>
                  )}
                </div>

                <button
                  onClick={() => onEditPayment(p)}
                  className="px-2.5 py-1 text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors"
                >
                  Informar Vencimento
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BLOCO 4: Demais Pagamentos Futuros no Prazo (além do horizonte selecionado) */}
      {analysis.futureOnTime.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowFutureOnTime(!showFutureOnTime)}>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">
                4. Demais Pagamentos Futuros no Prazo ({analysis.futureOnTime.length} lançamento(s) além de {horizonDays} dias)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono tabular-nums font-semibold text-slate-700">
                {formatCurrencyBRL(analysis.totalFutureOnTimeAmount)}
              </span>
              <button
                type="button"
                className="text-xs text-indigo-600 font-semibold flex items-center gap-1"
              >
                <span>{showFutureOnTime ? 'Recolher' : 'Exibir Lançamentos'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFutureOnTime ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {showFutureOnTime && (
            <div className="mt-3 pt-3 border-t border-slate-100 divide-y divide-slate-100">
              {analysis.futureOnTime.map(({ payment, daysRemaining }) => (
                <div key={payment.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800">
                      {payment.fornecedor || 'Fornecedor não informado'}
                    </span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {formatCurrencyBRL(payment.valor)}
                    </span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-slate-500 font-mono tabular-nums">
                      Vence em {formatDateBR(payment.dataVencimento)} ({daysRemaining} dias)
                    </span>
                  </div>
                  <button
                    onClick={() => onEditPayment(payment)}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    Ver / Editar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BLOCO 5: Pagamentos Já Quitados (Prova de Exclusão de Atraso) */}
      {analysis.paid.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowPaidList(!showPaidList)}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                5. Pagamentos com Situação "Pago" ({analysis.paid.length} quitado(s) - nunca classificados como atrasados)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono tabular-nums font-semibold text-emerald-800">
                {formatCurrencyBRL(analysis.totalPaidAmount)}
              </span>
              <button
                type="button"
                className="text-xs text-indigo-600 font-semibold flex items-center gap-1"
              >
                <span>{showPaidList ? 'Recolher' : 'Exibir Lançamentos'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPaidList ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {showPaidList && (
            <div className="mt-3 pt-3 border-t border-slate-100 divide-y divide-slate-100">
              {analysis.paid.map((payment) => (
                <div key={payment.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800">
                      {payment.fornecedor || 'Fornecedor não informado'}
                    </span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {formatCurrencyBRL(payment.valor)}
                    </span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-emerald-700 font-medium">
                      Liquidado (Vencimento era {formatDateBR(payment.dataVencimento)})
                    </span>
                  </div>
                  <button
                    onClick={() => onEditPayment(payment)}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    Ver / Editar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
