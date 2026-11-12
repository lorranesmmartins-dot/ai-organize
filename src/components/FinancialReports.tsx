/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  PieChart,
  Calendar,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  TrendingUp,
  Tag,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Edit,
  Info,
} from 'lucide-react';
import { PaymentRecord, validatePaymentRecord } from '../types/payment';
import { formatCurrencyBRL, formatDateBR, STATUS_MAP } from '../utils/formatters';
import { ActiveTabType } from './Header';

export type ReportPeriod = 'todos' | 'esteMes' | 'ultimos30' | 'personalizado';

interface FinancialReportsProps {
  payments: PaymentRecord[];
  onEditPayment: (payment: PaymentRecord) => void;
  onNavigateToTab?: (tab: ActiveTabType) => void;
}

export const FinancialReports: React.FC<FinancialReportsProps> = ({
  payments,
  onEditPayment,
  onNavigateToTab,
}) => {
  // Filtro de período selecionado
  const [period, setPeriod] = useState<ReportPeriod>('todos');

  // Datas personalizadas (padrão YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  // Opção para incluir lançamentos que não possuem data de vencimento
  const [includeUndated, setIncludeUndated] = useState(true);

  // Filtro de busca dentro da tabela do relatório
  const [tableSearch, setTableSearch] = useState('');

  // Cálculo do intervalo efetivo de datas conforme o filtro selecionado
  const { dateRangeLabel, startDateLimit, endDateLimit } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 a 11

    if (period === 'todos') {
      return {
        dateRangeLabel: 'Todos os períodos cadastrados no sistema',
        startDateLimit: null,
        endDateLimit: null,
      };
    }

    if (period === 'esteMes') {
      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);
      const startStr = firstDay.toISOString().split('T')[0];
      const endStr = lastDay.toISOString().split('T')[0];
      return {
        dateRangeLabel: `Este mês: ${formatDateBR(startStr)} até ${formatDateBR(endStr)}`,
        startDateLimit: startStr,
        endDateLimit: endStr,
      };
    }

    if (period === 'ultimos30') {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);
      const startStr = past30.toISOString().split('T')[0];
      const endStr = todayStr;
      return {
        dateRangeLabel: `Últimos 30 dias: ${formatDateBR(startStr)} até ${formatDateBR(endStr)}`,
        startDateLimit: startStr,
        endDateLimit: endStr,
      };
    }

    // Personalizado
    return {
      dateRangeLabel: `Personalizado: ${formatDateBR(customStartDate)} até ${formatDateBR(customEndDate)}`,
      startDateLimit: customStartDate,
      endDateLimit: customEndDate,
    };
  }, [period, customStartDate, customEndDate, todayStr]);

  // Filtragem dos pagamentos pelo período selecionado
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // Se não tem vencimento
      if (!p.dataVencimento) {
        return period === 'todos' ? true : includeUndated;
      }

      // Se temos limites de data
      if (startDateLimit && p.dataVencimento < startDateLimit) {
        return false;
      }
      if (endDateLimit && p.dataVencimento > endDateLimit) {
        return false;
      }

      return true;
    });
  }, [payments, period, startDateLimit, endDateLimit, includeUndated]);

  // Contagem de registros sem vencimento global e no filtro
  const totalSemVencimentoGlobal = useMemo(() => {
    return payments.filter((p) => !p.dataVencimento).length;
  }, [payments]);

  // Cálculos dos 5 Indicadores Gerenciais Obrigatórios
  const metrics = useMemo(() => {
    let totalFinanceiro = 0;
    let countComValor = 0;
    let countSemValor = 0;

    // 1. Pago / Quitado
    let totalQuitados = 0;
    let countQuitados = 0;

    // 2. Pendente (registrado como pendente ou vencido)
    let totalPendentes = 0;
    let countPendentes = 0;

    // 3. Agendado (programado, ainda não quitado)
    let totalAgendados = 0;
    let countAgendados = 0;

    // 4. Não definida (status ausente, vazio ou indefinida)
    let totalNaoDefinidos = 0;
    let countNaoDefinidos = 0;

    let totalAtrasados = 0;
    let countAtrasados = 0;

    let countIncompletos = 0;
    let countFaltaValor = 0;
    let countFaltaVencimento = 0;
    let countFaltaFornecedor = 0;
    let countFaltaSituacao = 0;

    filteredPayments.forEach((p) => {
      const validation = validatePaymentRecord(p);
      if (validation.isIncomplete) {
        countIncompletos++;
        validation.missingFields.forEach((f) => {
          if (f.key === 'valor') countFaltaValor++;
          if (f.key === 'dataVencimento') countFaltaVencimento++;
          if (f.key === 'fornecedor') countFaltaFornecedor++;
          if (f.key === 'situacao') countFaltaSituacao++;
        });
      }

      const hasValue = p.valor !== null && !isNaN(p.valor) && p.valor > 0;
      const val = hasValue && p.valor !== null ? p.valor : 0;
      if (hasValue) {
        totalFinanceiro += val;
        countComValor++;
      } else {
        countSemValor++;
      }

      // Classificação consistente dos 4 status
      if (p.situacao === 'pago') {
        totalQuitados += val;
        countQuitados++;
      } else if (p.situacao === 'pendente' || p.situacao === 'vencido') {
        totalPendentes += val;
        countPendentes++;
        // Atrasado se tiver vencimento anterior a hoje
        if (p.dataVencimento && p.dataVencimento < todayStr) {
          totalAtrasados += val;
          countAtrasados++;
        }
      } else if (p.situacao === 'agendado') {
        totalAgendados += val;
        countAgendados++;
      } else {
        // Status não definido, vazio ou não reconhecido (ex: Kroma Gráfica)
        totalNaoDefinidos += val;
        countNaoDefinidos++;
      }
    });

    const totalNaoQuitados = totalPendentes + totalAgendados + totalNaoDefinidos;
    const countNaoQuitados = countPendentes + countAgendados + countNaoDefinidos;

    const percentQuitados = totalFinanceiro > 0 ? (totalQuitados / totalFinanceiro) * 100 : 0;
    const percentPendentes = totalFinanceiro > 0 ? (totalPendentes / totalFinanceiro) * 100 : 0;
    const percentAgendados = totalFinanceiro > 0 ? (totalAgendados / totalFinanceiro) * 100 : 0;
    const percentNaoDefinidos = totalFinanceiro > 0 ? (totalNaoDefinidos / totalFinanceiro) * 100 : 0;
    const percentNaoQuitados = totalFinanceiro > 0 ? (totalNaoQuitados / totalFinanceiro) * 100 : 0;

    return {
      totalCadastrado: totalFinanceiro,
      totalQuitados,
      totalPendentes,
      totalAgendados,
      totalNaoDefinidos,
      totalNaoQuitados,
      totalAtrasados,
      countCadastrados: filteredPayments.length,
      countComValor,
      countSemValor,
      countQuitados,
      countPendentes,
      countAgendados,
      countNaoDefinidos,
      countNaoQuitados,
      countAtrasados,
      countIncompletos,
      countFaltaValor,
      countFaltaVencimento,
      countFaltaFornecedor,
      countFaltaSituacao,
      percentQuitados,
      percentPendentes,
      percentAgendados,
      percentNaoDefinidos,
      percentNaoQuitados,
    };
  }, [filteredPayments, todayStr]);

  // Gráfico 2: Distribuição por Categoria
  const categoryDistribution = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();

    filteredPayments.forEach((p) => {
      const cat = p.categoria?.trim() || 'Não categorizada';
      const current = map.get(cat) || { total: 0, count: 0 };
      const val = p.valor !== null && !isNaN(p.valor) && p.valor > 0 ? p.valor : 0;
      map.set(cat, {
        total: current.total + val,
        count: current.count + 1,
      });
    });

    const list = Array.from(map.entries()).map(([categoria, data]) => ({
      categoria,
      total: data.total,
      count: data.count,
      percent: metrics.totalCadastrado > 0 ? (data.total / metrics.totalCadastrado) * 100 : 0,
    }));

    return list.sort((a, b) => b.total - a.total);
  }, [filteredPayments, metrics.totalCadastrado]);

  // Gráfico 3: Evolução Mensal dos Pagamentos
  const monthlyEvolution = useMemo(() => {
    const map = new Map<
      string,
      {
        monthKey: string;
        label: string;
        total: number;
        quitados: number;
        pendentes: number;
        agendados: number;
        naoDefinidos: number;
        count: number;
      }
    >();

    filteredPayments.forEach((p) => {
      if (!p.dataVencimento) return;

      const [year, month] = p.dataVencimento.split('-');
      if (!year || !month) return;

      const monthKey = `${year}-${month}`;
      const label = `${month}/${year}`;

      const current = map.get(monthKey) || {
        monthKey,
        label,
        total: 0,
        quitados: 0,
        pendentes: 0,
        agendados: 0,
        naoDefinidos: 0,
        count: 0,
      };

      const val = p.valor !== null && !isNaN(p.valor) && p.valor > 0 ? p.valor : 0;
      current.total += val;
      current.count += 1;

      if (p.situacao === 'pago') {
        current.quitados += val;
      } else if (p.situacao === 'pendente' || p.situacao === 'vencido') {
        current.pendentes += val;
      } else if (p.situacao === 'agendado') {
        current.agendados += val;
      } else {
        current.naoDefinidos += val;
      }

      map.set(monthKey, current);
    });

    const sorted = Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    const maxVal = Math.max(...sorted.map((m) => m.total), 1);

    return {
      hasData: sorted.length > 0,
      months: sorted,
      maxVal,
    };
  }, [filteredPayments]);

  // Tabela filtrada com busca textual interna
  const tableData = useMemo(() => {
    if (!tableSearch.trim()) return filteredPayments;
    const q = tableSearch.toLowerCase();
    return filteredPayments.filter(
      (p) =>
        p.fornecedor.toLowerCase().includes(q) ||
        p.categoria?.toLowerCase().includes(q) ||
        p.numeroNota?.toLowerCase().includes(q) ||
        p.observacoes?.toLowerCase().includes(q)
    );
  }, [filteredPayments, tableSearch]);

  // Exportação CSV do relatório com separador ';' e UTF-8 BOM
  const handleExportCSV = () => {
    const headers = [
      'Fornecedor',
      'Número da Nota',
      'Categoria',
      'Data de Vencimento',
      'Situação',
      'Valor (R$)',
      'Status de Integridade',
      'Campos Ausentes',
      'Observações',
    ];

    const rows = filteredPayments.map((p) => {
      const validation = validatePaymentRecord(p);
      const missingStr = validation.missingFields.map((f) => f.label).join(' | ');

      return [
        `"${p.fornecedor.replace(/"/g, '""')}"`,
        `"${(p.numeroNota || '').replace(/"/g, '""')}"`,
        `"${(p.categoria || 'Não categorizada').replace(/"/g, '""')}"`,
        p.dataVencimento ? formatDateBR(p.dataVencimento) : 'Não informada',
        `"${STATUS_MAP[p.situacao]?.label || p.situacao}"`,
        p.valor !== null && !isNaN(p.valor) ? p.valor.toFixed(2).replace('.', ',') : 'Não informado',
        validation.isIncomplete ? 'Incompleto' : 'Completo',
        `"${missingStr}"`,
        `"${(p.observacoes || '').replace(/"/g, '""')}"`,
      ].join(';');
    });

    const periodTag = period === 'todos' ? 'todos_periodos' : period;
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `organiza_ai_relatorio_${periodTag}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Cabeçalho da Seção com Ações Rápidas */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-[#4F46E5] flex items-center justify-center shrink-0 shadow-2xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#172033] tracking-tight">
                Relatórios e Indicadores Gerenciais
              </h2>
              <p className="text-xs text-[#64748B]">
                Visão executiva consolidada de liquidações, pendências, fluxo programado e integridade cadastral.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg transition-colors shadow-2xs"
              title="Baixar planilha CSV com os dados filtrados"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exportar Relatório (CSV)</span>
            </button>

            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('prioridades')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#4F46E5] bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-150 rounded-lg transition-colors"
              >
                <span>Assistente de Prioridades</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 2. Barra de Filtros de Período em Segmented Control */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-600 mr-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Período:
            </span>

            <div className="inline-flex p-1 bg-slate-100/90 rounded-lg max-w-full flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setPeriod('todos')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === 'todos'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos os períodos
              </button>

              <button
                type="button"
                onClick={() => setPeriod('esteMes')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === 'esteMes'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Este mês
              </button>

              <button
                type="button"
                onClick={() => setPeriod('ultimos30')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === 'ultimos30'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Últimos 30 dias
              </button>

              <button
                type="button"
                onClick={() => setPeriod('personalizado')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === 'personalizado'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Personalizado
              </button>
            </div>
          </div>

          <div className="text-xs font-mono tabular-nums text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80 font-medium">
            {dateRangeLabel}
          </div>
        </div>

        {/* Inputs de Data para Período Personalizado */}
        {period === 'personalizado' && (
          <div className="p-3 bg-indigo-50/40 rounded-lg border border-indigo-100 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-indigo-950">Intervalo selecionado:</span>
            <div className="flex items-center gap-2">
              <label htmlFor="customStartDate" className="text-slate-600 font-medium">
                De:
              </label>
              <input
                id="customStartDate"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#4F46E5]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="customEndDate" className="text-slate-600 font-medium">
                Até:
              </label>
              <input
                id="customEndDate"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#4F46E5]"
              />
            </div>
          </div>
        )}

        {/* Tratamento transparente de registros sem vencimento */}
        {period !== 'todos' && totalSemVencimentoGlobal > 0 && (
          <div className="flex items-center justify-between gap-3 text-xs bg-amber-50/60 border border-amber-200/70 rounded-xl p-2.5 text-amber-900">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Existem <strong>{totalSemVencimentoGlobal} registros</strong> sem data de vencimento cadastrada.
              </span>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-semibold text-amber-950">
              <input
                type="checkbox"
                checked={includeUndated}
                onChange={(e) => setIncludeUndated(e.target.checked)}
                className="rounded text-[#4F46E5] focus:ring-[#4F46E5]"
              />
              <span>Incluir nos relatórios deste filtro</span>
            </label>
          </div>
        )}
      </div>

      {/* 2. Cinco Indicadores Gerenciais Obrigatórios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Indicador 1: Total Financeiro Cadastrado */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4.5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Cadastrado
              </span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl lg:text-2xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
                {formatCurrencyBRL(metrics.totalCadastrado)}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-slate-700">
                  {metrics.countCadastrados} lançamentos
                </span>
                {metrics.countSemValor > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {metrics.countSemValor} sem valor
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Base consolidada</span>
            <span className="font-medium text-slate-600">{metrics.countComValor} com valor</span>
          </div>
        </div>

        {/* Indicador 2: Total de Pagamentos Quitados */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4.5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                Pagamentos Quitados
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl lg:text-2xl font-bold text-emerald-700 font-mono tabular-nums tracking-tight">
                {formatCurrencyBRL(metrics.totalQuitados)}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-emerald-800">
                  {metrics.countQuitados} liquidados
                </span>
                <span className="inline-flex items-center text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/70">
                  {metrics.percentQuitados.toFixed(1)}% do total
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Baixa contábil</span>
            <span className="font-medium text-emerald-700">100% liquidados</span>
          </div>
        </div>

        {/* Indicador 3: Total de Pagamentos Pendentes */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4.5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
                Pagamentos Pendentes
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl lg:text-2xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
                {formatCurrencyBRL(metrics.totalPendentes)}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-amber-800">
                  {metrics.countPendentes} pendentes
                </span>
                <span className="inline-flex items-center text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200/70">
                  {metrics.percentPendentes.toFixed(1)}%
                </span>
              </div>
              {(metrics.countAgendados > 0 || metrics.countNaoDefinidos > 0) && (
                <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 flex flex-col gap-1">
                  {metrics.countAgendados > 0 && (
                    <div className="flex items-center justify-between text-sky-800">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                        Agendados ({metrics.countAgendados})
                      </span>
                      <strong className="font-mono">{formatCurrencyBRL(metrics.totalAgendados)}</strong>
                    </div>
                  )}
                  {metrics.countNaoDefinidos > 0 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        Não definida ({metrics.countNaoDefinidos})
                      </span>
                      <strong className="font-mono">{formatCurrencyBRL(metrics.totalNaoDefinidos)}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Fluxo em aberto</span>
            <span className="font-medium text-amber-700 font-mono">
              {formatCurrencyBRL(metrics.totalNaoQuitados)}
            </span>
          </div>
        </div>

        {/* Indicador 4: Quantidade de Pagamentos Cadastrados */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4.5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Lançamentos
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl lg:text-2xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
                {metrics.countCadastrados}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-slate-700">
                  {metrics.countCadastrados - metrics.countIncompletos} completos
                </span>
                {metrics.countIncompletos > 0 && (
                  <span className="text-[11px] text-slate-400">
                    · {metrics.countIncompletos} pendentes
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Escopo do período</span>
            <span className="font-medium text-indigo-600">
              {(( (metrics.countCadastrados - metrics.countIncompletos) / (metrics.countCadastrados || 1) ) * 100).toFixed(0)}% íntegros
            </span>
          </div>
        </div>

        {/* Indicador 5: Quantidade de Registros Incompletos */}
        <div
          onClick={() => onNavigateToTab && onNavigateToTab('incompletos')}
          className={`rounded-xl border p-4.5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between group ${
            onNavigateToTab ? 'cursor-pointer' : ''
          } ${
            metrics.countIncompletos > 0
              ? 'bg-amber-50/40 border-amber-300 hover:border-amber-400 hover:bg-amber-50/60'
              : 'bg-white border-slate-200/90'
          }`}
          title={onNavigateToTab ? 'Acessar módulo de Registros Incompletos' : undefined}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider">
                Incompletos
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  metrics.countIncompletos > 0
                    ? 'bg-amber-100 text-amber-700 group-hover:bg-amber-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div
                className={`text-xl lg:text-2xl font-bold font-mono tabular-nums tracking-tight ${
                  metrics.countIncompletos > 0 ? 'text-amber-950' : 'text-slate-800'
                }`}
              >
                {metrics.countIncompletos} {metrics.countIncompletos === 1 ? 'registro' : 'registros'}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-amber-900">
                  {metrics.countIncompletos > 0
                    ? `${metrics.countIncompletos} a conferir`
                    : '100% preenchidos'}
                </span>
              </div>
              {metrics.countIncompletos > 0 && (
                <div className="mt-2 text-[10px] text-amber-800 font-medium flex items-center gap-1 flex-wrap">
                  {metrics.countFaltaValor > 0 && (
                    <span className="bg-amber-100/70 px-1.5 py-0.5 rounded text-amber-900">
                      {metrics.countFaltaValor} sem valor
                    </span>
                  )}
                  {metrics.countFaltaVencimento > 0 && (
                    <span className="bg-amber-100/70 px-1.5 py-0.5 rounded text-amber-900">
                      {metrics.countFaltaVencimento} sem data
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-800">
            <span>Auditoria cadastral</span>
            {onNavigateToTab && metrics.countIncompletos > 0 && (
              <span className="font-semibold text-[#4F46E5] group-hover:underline inline-flex items-center gap-0.5">
                Resolver &rarr;
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alerta de transparência de registros com pendência cadastral */}
      {metrics.countSemValor > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="leading-relaxed">
              <strong className="font-semibold text-amber-900">Atenção contábil:</strong> {metrics.countSemValor} pagamento(s) no período selecionado não possuem valor informado. Para garantir fidedignidade, esses lançamentos não foram presumidos como R$ 0,00 e permanecem sinalizados como incompletos.
            </div>
          </div>
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('incompletos')}
              className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors shrink-0 self-end sm:self-center cursor-pointer border border-amber-200"
            >
              Conferir Incompletos &rarr;
            </button>
          )}
        </div>
      )}

      {/* 3. Seção de Gráficos e Visualizações */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Comparação Quitados vs Pendentes */}
        <div className="min-w-0 bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <PieChart className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Composição por Situação
                </h3>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                {metrics.countCadastrados} lançamentos
              </span>
            </div>

            {/* Visual Donut Chart SVG */}
            <div className="flex flex-col items-center justify-center my-4">
              <div className="relative w-44 h-44">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  {/* Fundo do círculo */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#F1F5F9"
                    strokeWidth="14"
                  />
                  {/* Segmento: Não definida (slate-400) */}
                  {metrics.totalCadastrado > 0 && metrics.percentNaoDefinidos > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#94A3B8"
                      strokeWidth="14"
                      strokeDasharray={`${(metrics.percentNaoDefinidos / 100) * 251.327} 251.327`}
                      strokeDashoffset={-((metrics.percentQuitados + metrics.percentPendentes + metrics.percentAgendados) / 100) * 251.327}
                    />
                  )}
                  {/* Segmento: Agendados (sky-500) */}
                  {metrics.totalCadastrado > 0 && metrics.percentAgendados > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#0284C7"
                      strokeWidth="14"
                      strokeDasharray={`${(metrics.percentAgendados / 100) * 251.327} 251.327`}
                      strokeDashoffset={-((metrics.percentQuitados + metrics.percentPendentes) / 100) * 251.327}
                    />
                  )}
                  {/* Segmento: Pendentes (amber-500) */}
                  {metrics.totalCadastrado > 0 && metrics.percentPendentes > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#F59E0B"
                      strokeWidth="14"
                      strokeDasharray={`${(metrics.percentPendentes / 100) * 251.327} 251.327`}
                      strokeDashoffset={-((metrics.percentQuitados / 100) * 251.327)}
                    />
                  )}
                  {/* Segmento: Quitados (emerald-500) */}
                  {metrics.totalCadastrado > 0 && metrics.percentQuitados > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#10B981"
                      strokeWidth="14"
                      strokeDasharray={`${(metrics.percentQuitados / 100) * 251.327} 251.327`}
                      strokeDashoffset="0"
                    />
                  )}
                </svg>
                {/* Texto Central */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                    {metrics.percentQuitados.toFixed(0)}%
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-0.5 border border-emerald-200/60">
                    Quitado
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Legenda Detalhada dos 4 status + Total não quitado */}
          <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
            {/* 1. Quitados */}
            <div className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="font-medium text-slate-700">Quitados:</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-emerald-700 font-mono">
                  {formatCurrencyBRL(metrics.totalQuitados)}
                </span>
                <span className="text-[11px] text-slate-400 ml-1.5 font-medium">
                  ({metrics.countQuitados})
                </span>
              </div>
            </div>

            {/* 2. Pendentes */}
            <div className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                <span className="font-medium text-slate-700">Pendentes:</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-amber-800 font-mono">
                  {formatCurrencyBRL(metrics.totalPendentes)}
                </span>
                <span className="text-[11px] text-slate-400 ml-1.5 font-medium">
                  ({metrics.countPendentes})
                </span>
              </div>
            </div>

            {/* 3. Agendados */}
            <div className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600 shrink-0"></span>
                <span className="font-medium text-slate-700">Agendados:</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-sky-800 font-mono">
                  {formatCurrencyBRL(metrics.totalAgendados)}
                </span>
                <span className="text-[11px] text-slate-400 ml-1.5 font-medium">
                  ({metrics.countAgendados})
                </span>
              </div>
            </div>

            {/* 4. Não definida */}
            <div className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0"></span>
                <span className="font-medium text-slate-700">Não definida:</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-700 font-mono">
                  {formatCurrencyBRL(metrics.totalNaoDefinidos)}
                </span>
                <span className="text-[11px] text-slate-400 ml-1.5 font-medium">
                  ({metrics.countNaoDefinidos})
                </span>
              </div>
            </div>

            {/* Total Ainda Não Quitado */}
            <div className="mt-2.5 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg flex items-center justify-between text-slate-900">
              <span className="text-xs font-semibold text-amber-950">Total ainda não quitado:</span>
              <span className="font-mono text-xs font-bold text-amber-900">
                {formatCurrencyBRL(metrics.totalNaoQuitados)} <span className="font-sans font-medium text-amber-800 text-[11px]">({metrics.countNaoQuitados})</span>
              </span>
            </div>

            {metrics.countAtrasados > 0 && (
              <div className="flex items-center justify-between text-rose-700 bg-rose-50/70 border border-rose-200/70 px-2.5 py-1.5 rounded-lg text-xs mt-1.5">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="text-[11px] font-semibold">Destes, em atraso:</span>
                </div>
                <span className="text-[11px] font-bold font-mono">
                  {formatCurrencyBRL(metrics.totalAtrasados)} ({metrics.countAtrasados})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Distribuição por Categoria ou Centro de Custo */}
        <div className="min-w-0 bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Tag className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Distribuição por Categoria
                </h3>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {categoryDistribution.length} categorias
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Participação de cada centro de custo sobre o montante financeiro total.
            </p>

            {categoryDistribution.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                Nenhum lançamento no período selecionado.
              </div>
            ) : (
              <div className="space-y-3.5">
                {categoryDistribution.slice(0, 5).map((cat, idx) => {
                  const colors = [
                    'bg-[#4F46E5]',
                    'bg-sky-600',
                    'bg-teal-600',
                    'bg-amber-600',
                    'bg-indigo-400',
                  ];
                  const barColor = colors[idx % colors.length];

                  return (
                    <div key={cat.categoria} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                          {cat.categoria}
                        </span>
                        <div className="text-right flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 font-mono">
                            {formatCurrencyBRL(cat.total)}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {cat.percent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${Math.max(cat.percent, 3)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {categoryDistribution.length > 5 && (
            <div className="pt-3 mt-4 border-t border-slate-100 text-center">
              <span className="text-[11px] font-medium text-slate-500">
                + {categoryDistribution.length - 5} outras categorias agrupadas
              </span>
            </div>
          )}
        </div>

        {/* Gráfico 3: Evolução Mensal dos Pagamentos */}
        <div className="min-w-0 bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Evolução Mensal
                </h3>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                Por vencimento
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Volume financeiro distribuído ao longo dos meses conhecidos.
            </p>

            {!monthlyEvolution.hasData ? (
              <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                <Calendar className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <span className="font-semibold text-slate-600">Dados insuficientes para evolução temporal</span>
                <p className="text-[11px] text-slate-400 mt-1">
                  Nenhum registro com data de vencimento no período filtrado.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Barras mensais proporcionais */}
                <div className="h-40 flex items-end justify-between gap-3 pt-4 pb-2 border-b border-slate-200">
                  {monthlyEvolution.months.map((m) => {
                    const heightPercent = Math.min(
                      100,
                      Math.max(12, Math.round((m.total / monthlyEvolution.maxVal) * 100))
                    );
                    const quitadosRatio = m.total > 0 ? (m.quitados / m.total) * 100 : 0;
                    const pendentesRatio = m.total > 0 ? (m.pendentes / m.total) * 100 : 0;
                    const agendadosRatio = m.total > 0 ? (m.agendados / m.total) * 100 : 0;
                    const naoDefinidosRatio = m.total > 0 ? (m.naoDefinidos / m.total) * 100 : 0;

                    return (
                      <div
                        key={m.monthKey}
                        className="flex-1 flex flex-col items-center h-full justify-end group relative"
                      >
                        {/* Tooltip com valores */}
                        <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity bg-[#172554] text-white text-[10px] rounded-lg px-2.5 py-2 pointer-events-none whitespace-nowrap z-20 shadow-xl border border-slate-700/60">
                          <div className="font-bold border-b border-slate-600/60 pb-1 mb-1">Total: {formatCurrencyBRL(m.total)}</div>
                          <div className="text-emerald-300">Quitados: {formatCurrencyBRL(m.quitados)}</div>
                          <div className="text-amber-300">Pendentes: {formatCurrencyBRL(m.pendentes)}</div>
                          {m.agendados > 0 && <div className="text-sky-300">Agendados: {formatCurrencyBRL(m.agendados)}</div>}
                          {m.naoDefinidos > 0 && <div className="text-slate-300">Não definida: {formatCurrencyBRL(m.naoDefinidos)}</div>}
                        </div>

                        {/* Barra composta */}
                        <div
                          className="w-full max-w-[42px] bg-slate-100 rounded-t-md overflow-hidden flex flex-col justify-end transition-all group-hover:brightness-95 shadow-2xs"
                          style={{ height: `${heightPercent}%` }}
                        >
                          {naoDefinidosRatio > 0 && (
                            <div
                              className="bg-slate-400 w-full"
                              style={{ height: `${naoDefinidosRatio}%` }}
                              title={`Não definida: ${formatCurrencyBRL(m.naoDefinidos)}`}
                            />
                          )}
                          {agendadosRatio > 0 && (
                            <div
                              className="bg-sky-500 w-full"
                              style={{ height: `${agendadosRatio}%` }}
                              title={`Agendados: ${formatCurrencyBRL(m.agendados)}`}
                            />
                          )}
                          {pendentesRatio > 0 && (
                            <div
                              className="bg-amber-500 w-full"
                              style={{ height: `${pendentesRatio}%` }}
                              title={`Pendentes: ${formatCurrencyBRL(m.pendentes)}`}
                            />
                          )}
                          {quitadosRatio > 0 && (
                            <div
                              className="bg-emerald-500 w-full"
                              style={{ height: `${quitadosRatio}%` }}
                              title={`Quitados: ${formatCurrencyBRL(m.quitados)}`}
                            />
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-600 mt-2 tracking-tight">
                          {m.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Sub-legenda da evolução mensal */}
                <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500"></span>
                    <span>Quitados</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-500"></span>
                    <span>Pendentes</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-sky-500"></span>
                    <span>Agendados</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-slate-400"></span>
                    <span>Não definida</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Meses identificados: <strong className="text-slate-700">{monthlyEvolution.months.length}</strong></span>
            <span className="font-semibold text-slate-700 font-mono">
              Pico: {formatCurrencyBRL(monthlyEvolution.maxVal)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Tabela Detalhada com os Lançamentos do Período */}
      <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-sm transition-shadow">
        <div className="p-4 sm:p-5 border-b border-slate-200/90 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Detalhamento de Pagamentos do Período
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200/70 text-slate-700">
                {tableData.length} exibidos
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Listagem individual com dados de fornecedor, categoria, vencimento, situação e integridade cadastral.
            </p>
          </div>

          {/* Busca dentro da tabela */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Buscar por fornecedor, categoria, NF..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#4F46E5] focus:border-[#4F46E5] pl-8.5 text-slate-800 placeholder:text-slate-400 shadow-2xs"
            />
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {tableData.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 bg-slate-50/30">
            Nenhum pagamento encontrado com os filtros e busca aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">Fornecedor</th>
                  <th className="px-4 py-3.5">Categoria</th>
                  <th className="px-4 py-3.5">Vencimento</th>
                  <th className="px-4 py-3.5">Situação</th>
                  <th className="px-4 py-3.5 text-right">Valor (R$)</th>
                  <th className="px-4 py-3.5 text-center">Integridade</th>
                  <th className="px-4 py-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableData.map((p) => {
                  const validation = validatePaymentRecord(p);
                  const statusConf = STATUS_MAP[p.situacao] || STATUS_MAP.indefinida;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Fornecedor */}
                      <td className="px-4 py-3.5 align-middle">
                        <div className="font-semibold text-slate-900">
                          {p.fornecedor || (
                            <span className="text-amber-700 italic">Não informado</span>
                          )}
                        </div>
                        {p.numeroNota && (
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">NF: {p.numeroNota}</div>
                        )}
                      </td>

                      {/* Categoria */}
                      <td className="px-4 py-3.5 align-middle text-slate-600">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200/50">
                          {p.categoria || 'Não definida'}
                        </span>
                      </td>

                      {/* Vencimento */}
                      <td className="px-4 py-3.5 align-middle text-slate-700 font-mono text-xs">
                        {p.dataVencimento ? (
                          formatDateBR(p.dataVencimento)
                        ) : (
                          <span className="text-amber-700 font-sans italic text-[11px]">
                            Sem data
                          </span>
                        )}
                      </td>

                      {/* Situação */}
                      <td className="px-4 py-3.5 align-middle">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusConf.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dotClass}`} />
                          {statusConf.label}
                        </span>
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-3.5 align-middle text-right font-mono font-bold text-slate-900 text-xs tabular-nums">
                        {p.valor !== null && !isNaN(p.valor) ? (
                          formatCurrencyBRL(p.valor)
                        ) : (
                          <span className="text-amber-700 font-sans italic font-normal text-[11px]">
                            Não informado
                          </span>
                        )}
                      </td>

                      {/* Integridade */}
                      <td className="px-4 py-3.5 align-middle text-center">
                        {validation.isIncomplete ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-md"
                            title={`Campos ausentes: ${validation.missingFields.map((f) => f.label).join(', ')}`}
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            {validation.missingFields.length} ausência(s)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Completo
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3.5 align-middle text-center">
                        <button
                          type="button"
                          onClick={() => onEditPayment(p)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4F46E5] hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-indigo-100"
                          title="Conferir ou editar lançamento"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Conferir</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Rodapé da tabela com somatórios do período */}
              <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-medium text-slate-900 text-xs">
                <tr>
                  <td className="px-4 py-3.5 text-slate-900" colSpan={2}>
                    Total geral: <span className="font-bold text-slate-950 font-mono">{formatCurrencyBRL(metrics.totalCadastrado)}</span> ({metrics.countCadastrados} lançamentos)
                  </td>
                  <td className="px-4 py-3.5 text-slate-700 text-xs">
                    Quitados: <span className="font-bold text-emerald-700 font-mono">{formatCurrencyBRL(metrics.totalQuitados)}</span> ({metrics.countQuitados} lançamentos)
                  </td>
                  <td className="px-4 py-3.5 text-slate-700 text-xs">
                    Ainda não quitados: <span className="font-bold text-amber-800 font-mono">{formatCurrencyBRL(metrics.totalNaoQuitados)}</span> ({metrics.countNaoQuitados} lançamentos)
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 text-xs">
                    {formatCurrencyBRL(metrics.totalCadastrado)}
                  </td>
                  <td colSpan={2} className="px-4 py-3.5 text-center text-xs text-slate-500">
                    <span className="font-semibold text-amber-800">{metrics.countIncompletos} registros com pendência</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
