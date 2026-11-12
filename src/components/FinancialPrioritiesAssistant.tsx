/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  AlertOctagon,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  CalendarCheck,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Edit2,
  Check,
  Info,
  Layers,
  ArrowRight,
  Filter,
  Sliders,
} from 'lucide-react';
import { PaymentRecord, PaymentStatus } from '../types/payment';
import { formatCurrencyBRL, formatDateBR, STATUS_MAP } from '../utils/formatters';
import {
  analyzeFinancialPriorities,
  getLocalDateString,
  PriorityCategorySummary,
  PriorityItem,
} from '../utils/financialPriorities';

interface FinancialPrioritiesAssistantProps {
  payments: PaymentRecord[];
  onEditPayment: (payment: PaymentRecord) => void;
  onToggleStatus: (id: string, newStatus: PaymentStatus) => void;
  onNavigateToTab?: (tab: 'todos' | 'incompletos' | 'auditoria' | 'extracao') => void;
}

export const FinancialPrioritiesAssistant: React.FC<FinancialPrioritiesAssistantProps> = ({
  payments,
  onEditPayment,
  onToggleStatus,
  onNavigateToTab,
}) => {
  // Data atual obtida automaticamente pelo sistema (sem deixar datas fixas no código)
  const systemToday = useMemo(() => getLocalDateString(), []);

  // Permite simular outra data exclusivamente para fins de teste e auditoria
  const [testDate, setTestDate] = useState<string>(systemToday);
  const [isSimulatingDate, setIsSimulatingDate] = useState<boolean>(false);

  // Categoria ativa para visualização detalhada
  const [selectedCategory, setSelectedCategory] = useState<
    'todos' | 'atrasados' | 'venceHoje' | 'proximos7Dias' | 'incompletos' | 'futuros' | 'pagos'
  >('todos');

  // Estado para expandir ou recolher cartões
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    atrasados: true,
    venceHoje: true,
    proximos7Dias: true,
    incompletos: true,
    futuros: false,
    pagos: false,
  });

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Análise recalculada dinamicamente quando a lista de pagamentos ou a data mudar
  const report = useMemo(() => {
    const effectiveDate = isSimulatingDate ? testDate : systemToday;
    return analyzeFinancialPriorities(payments, effectiveDate);
  }, [payments, testDate, isSimulatingDate, systemToday]);

  const handleResetDate = () => {
    setTestDate(systemToday);
    setIsSimulatingDate(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header do Assistente de Prioridades */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-2xs shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Assistente de Prioridades Financeiras
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  Regras Locais Automáticas
                </span>
                {report.temAlertasUrgentes && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60 animate-pulse">
                    <AlertOctagon className="w-3 h-3" />
                    Atenção Imediata
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">
                Acompanhamento contínuo dos pagamentos cadastrados. Classifica urgências por prazo de vencimento,
                aponta pendências de cadastro e calcula totais financeiros sem duplicidade nem dados inventados.
              </p>
            </div>
          </div>

          {/* Controle de Data de Referência Automática com Distribuição Otimizada */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 border border-slate-200/80 px-3.5 py-2.5 rounded-xl text-xs text-slate-700 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5] shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-700">Data Base:</span>
                <span className="font-mono font-bold text-slate-900 text-xs">
                  {formatDateBR(isSimulatingDate ? testDate : systemToday)}
                </span>
                {!isSimulatingDate ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    Hoje
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/60">
                    Simulação Ativa
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {isSimulatingDate ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={testDate}
                    onChange={(e) => setTestDate(e.target.value || systemToday)}
                    className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleResetDate}
                    title="Voltar para a data atual do sistema"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Data Real</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSimulatingDate(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-2xs cursor-pointer shrink-0"
                  title="Simular uma data diferente para testar a classificação de vencimentos"
                >
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Simular Outra Data</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. Grid de Cartões de Resumo das 4 Categorias Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-5">
          {/* Cartão 1: Em Atraso */}
          <button
            type="button"
            onClick={() => setSelectedCategory(selectedCategory === 'atrasados' ? 'todos' : 'atrasados')}
            className={`text-left p-4.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              selectedCategory === 'atrasados'
                ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                : 'bg-white hover:bg-slate-50/80 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 uppercase tracking-wider">
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                  Em Atraso
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                  {report.categorias.atrasados.quantidade}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight">
                {formatCurrencyBRL(report.categorias.atrasados.valorTotalConhecido)}
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
              <span className="font-medium text-rose-700">Prioridade Crítica</span>
              {report.categorias.atrasados.qtdSemValor > 0 && (
                <span className="text-amber-800 font-semibold text-[11px]">
                  {report.categorias.atrasados.qtdSemValor} sem valor
                </span>
              )}
            </div>
          </button>

          {/* Cartão 2: Vence Hoje */}
          <button
            type="button"
            onClick={() => setSelectedCategory(selectedCategory === 'venceHoje' ? 'todos' : 'venceHoje')}
            className={`text-left p-4.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              selectedCategory === 'venceHoje'
                ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-white hover:bg-slate-50/80 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Vence Hoje
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                  {report.categorias.venceHoje.quantidade}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight">
                {formatCurrencyBRL(report.categorias.venceHoje.valorTotalConhecido)}
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
              <span className="font-medium text-amber-800">Prioridade Alta</span>
              {report.categorias.venceHoje.qtdSemValor > 0 && (
                <span className="text-amber-800 font-semibold text-[11px]">
                  {report.categorias.venceHoje.qtdSemValor} sem valor
                </span>
              )}
            </div>
          </button>

          {/* Cartão 3: Próximos 7 Dias */}
          <button
            type="button"
            onClick={() => setSelectedCategory(selectedCategory === 'proximos7Dias' ? 'todos' : 'proximos7Dias')}
            className={`text-left p-4.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              selectedCategory === 'proximos7Dias'
                ? 'bg-sky-50/70 border-sky-300 ring-2 ring-sky-500/20 shadow-xs'
                : 'bg-white hover:bg-slate-50/80 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 uppercase tracking-wider">
                  <CalendarCheck className="w-4 h-4 text-sky-600" />
                  Próximos 7 Dias
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-900">
                  {report.categorias.proximos7Dias.quantidade}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight">
                {formatCurrencyBRL(report.categorias.proximos7Dias.valorTotalConhecido)}
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
              <span className="font-medium text-sky-800">Prioridade Média</span>
              {report.categorias.proximos7Dias.qtdSemValor > 0 && (
                <span className="text-amber-800 font-semibold text-[11px]">
                  {report.categorias.proximos7Dias.qtdSemValor} sem valor
                </span>
              )}
            </div>
          </button>

          {/* Cartão 4: Incompletos com Descrição Explícita do Valor Conhecido */}
          <button
            type="button"
            onClick={() => setSelectedCategory(selectedCategory === 'incompletos' ? 'todos' : 'incompletos')}
            className={`text-left p-4.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              selectedCategory === 'incompletos'
                ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-white hover:bg-slate-50/80 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Incompletos
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                  {report.categorias.incompletos.quantidade}
                </span>
              </div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-tight mt-1 mb-0.5">
                Valor conhecido dos incompletos
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight">
                {formatCurrencyBRL(report.categorias.incompletos.valorTotalConhecido)}
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
              <span className="font-medium text-amber-800">Atenção Cadastral</span>
              {report.categorias.incompletos.qtdSemValor > 0 && (
                <span className="text-amber-800 font-semibold text-[11px]">
                  {report.categorias.incompletos.qtdSemValor} sem valor
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Resumo Consolidado de Totais com Segmented Control Modernizado */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-3 flex-wrap">
            <span>
              Total de pendentes:{' '}
              <strong className="text-slate-900 font-mono font-bold">{report.totalPendentes}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span>
              Montante pendente conhecido:{' '}
              <strong className="text-slate-900 font-mono font-bold">
                {formatCurrencyBRL(report.valorTotalPendenteConhecido)}
              </strong>
            </span>
            {report.qtdTotalSemValor > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-amber-800 font-medium inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {report.qtdTotalSemValor} sem valor informado
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="text-slate-500 text-[11px] font-medium hidden sm:inline">Exibir:</span>
            <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200/60 text-xs overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setSelectedCategory('todos')}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer text-xs ${
                  selectedCategory === 'todos' ? 'bg-white font-semibold text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas as Seções
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('atrasados')}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer text-xs ${
                  selectedCategory === 'atrasados' ? 'bg-white font-semibold text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Atrasados ({report.categorias.atrasados.quantidade})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('venceHoje')}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer text-xs ${
                  selectedCategory === 'venceHoje' ? 'bg-white font-semibold text-amber-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hoje ({report.categorias.venceHoje.quantidade})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('proximos7Dias')}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer text-xs ${
                  selectedCategory === 'proximos7Dias' ? 'bg-white font-semibold text-sky-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Dias ({report.categorias.proximos7Dias.quantidade})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('incompletos')}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer text-xs ${
                  selectedCategory === 'incompletos' ? 'bg-white font-semibold text-amber-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Incompletos ({report.categorias.incompletos.quantidade})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Seções Detalhadas com Recomendações e Lista de Lançamentos */}
      <div className="space-y-5">
        {/* SEÇÃO 1: PAGAMENTOS EM ATRASO (Prioridade Crítica) */}
        {(selectedCategory === 'todos' || selectedCategory === 'atrasados') && (
          <CategorySection
            category={report.categorias.atrasados}
            isExpanded={expandedSections.atrasados}
            onToggleExpand={() => toggleSection('atrasados')}
            onEditPayment={onEditPayment}
            onToggleStatus={onToggleStatus}
            badgeColor="rose"
            icon={<AlertOctagon className="w-5 h-5 text-rose-600" />}
            referenceDate={report.dataReferencia}
          />
        )}

        {/* SEÇÃO 2: VENCEM HOJE (Prioridade Alta) */}
        {(selectedCategory === 'todos' || selectedCategory === 'venceHoje') && (
          <CategorySection
            category={report.categorias.venceHoje}
            isExpanded={expandedSections.venceHoje}
            onToggleExpand={() => toggleSection('venceHoje')}
            onEditPayment={onEditPayment}
            onToggleStatus={onToggleStatus}
            badgeColor="amber"
            icon={<Clock className="w-5 h-5 text-amber-600" />}
            referenceDate={report.dataReferencia}
          />
        )}

        {/* SEÇÃO 3: PRÓXIMOS 7 DIAS (Prioridade Média) */}
        {(selectedCategory === 'todos' || selectedCategory === 'proximos7Dias') && (
          <CategorySection
            category={report.categorias.proximos7Dias}
            isExpanded={expandedSections.proximos7Dias}
            onToggleExpand={() => toggleSection('proximos7Dias')}
            onEditPayment={onEditPayment}
            onToggleStatus={onToggleStatus}
            badgeColor="sky"
            icon={<CalendarCheck className="w-5 h-5 text-sky-600" />}
            referenceDate={report.dataReferencia}
          />
        )}

        {/* SEÇÃO 4: REGISTROS INCOMPLETOS (Atenção Cadastral) */}
        {(selectedCategory === 'todos' || selectedCategory === 'incompletos') && (
          <CategorySection
            category={report.categorias.incompletos}
            isExpanded={expandedSections.incompletos}
            onToggleExpand={() => toggleSection('incompletos')}
            onEditPayment={onEditPayment}
            onToggleStatus={onToggleStatus}
            badgeColor="yellow"
            icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
            referenceDate={report.dataReferencia}
            isIncompleteSection
          />
        )}

        {/* SEÇÃO ADICIONAL: PAGAMENTOS JÁ QUITADOS (Informativo / Auditoria) */}
        {selectedCategory === 'todos' && (
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Pagamentos Já Quitados ({report.categorias.pagos.quantidade})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pagamentos com status "Pago" são expressamente desconsiderados de todas as listas de atrasos e pendências operacionais.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleSection('pagos')}
                className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 font-semibold cursor-pointer px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span>{expandedSections.pagos ? 'Recolher' : 'Visualizar quitados'}</span>
                {expandedSections.pagos ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>

            {expandedSections.pagos && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                {report.categorias.pagos.itens.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    Nenhum pagamento registrado como "Pago" no momento.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {report.categorias.pagos.itens.map(({ payment }) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-100/80 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate">{payment.fornecedor || 'Fornecedor não informado'}</span>
                            <div className="text-slate-500 text-[11px] mt-0.5">
                              Vencimento original: <span className="font-mono">{formatDateBR(payment.dataVencimento)}</span> · Categoria: {payment.categoria || 'Geral'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <span className="font-bold font-mono text-slate-900 block tabular-nums">
                            {formatCurrencyBRL(payment.valor)}
                          </span>
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 mt-0.5 border border-emerald-200/60">
                            Quitado
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface CategorySectionProps {
  category: PriorityCategorySummary;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEditPayment: (payment: PaymentRecord) => void;
  onToggleStatus: (id: string, newStatus: PaymentStatus) => void;
  badgeColor: 'rose' | 'amber' | 'sky' | 'yellow';
  icon: React.ReactNode;
  referenceDate: string;
  isIncompleteSection?: boolean;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  isExpanded,
  onToggleExpand,
  onEditPayment,
  onToggleStatus,
  badgeColor,
  icon,
  referenceDate,
  isIncompleteSection = false,
}) => {
  const colorStyles = {
    rose: {
      badgeBg: 'bg-rose-50 text-rose-800 border-rose-200/80',
      pillBg: 'bg-rose-100 text-rose-800',
      recBg: 'bg-rose-50/70 border-rose-200 text-rose-950',
      itemBorder: 'hover:border-rose-300',
    },
    amber: {
      badgeBg: 'bg-amber-50 text-amber-900 border-amber-200/80',
      pillBg: 'bg-amber-100 text-amber-900',
      recBg: 'bg-amber-50/70 border-amber-200 text-amber-950',
      itemBorder: 'hover:border-amber-300',
    },
    sky: {
      badgeBg: 'bg-sky-50 text-sky-900 border-sky-200/80',
      pillBg: 'bg-sky-100 text-sky-900',
      recBg: 'bg-sky-50/70 border-sky-200 text-sky-950',
      itemBorder: 'hover:border-sky-300',
    },
    yellow: {
      badgeBg: 'bg-amber-50 text-amber-900 border-amber-200/80',
      pillBg: 'bg-amber-100 text-amber-900',
      recBg: 'bg-amber-50/70 border-amber-200 text-amber-950',
      itemBorder: 'hover:border-amber-300',
    },
  }[badgeColor];

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Cabeçalho da Seção */}
      <div
        onClick={onToggleExpand}
        className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 shrink-0 shadow-2xs">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {category.titulo}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colorStyles.pillBg}`}>
                {category.quantidade} {category.quantidade === 1 ? 'registro' : 'registros'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${colorStyles.badgeBg}`}>
                {category.nivelLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{category.subtitulo}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-slate-400 block font-medium">Total Conhecido:</span>
            <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
              {formatCurrencyBRL(category.valorTotalConhecido)}
            </span>
          </div>
          <button
            type="button"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label={isExpanded ? 'Recolher seção' : 'Expandir seção'}
          >
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Conteúdo Expansível */}
      {isExpanded && (
        <div className="px-4 sm:px-6 pb-5 space-y-4 border-t border-slate-100 pt-4">
          {/* Caixa de Recomendação de Prioridade */}
          <div className={`p-3.5 sm:p-4 rounded-xl border text-xs flex items-start gap-3 shadow-2xs ${colorStyles.recBg}`}>
            <div className="w-6 h-6 rounded-md bg-white/80 border border-slate-200/40 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <Info className="w-3.5 h-3.5 shrink-0 opacity-90" />
            </div>
            <div className="leading-relaxed">
              <strong className="font-bold text-slate-900 block mb-0.5 text-xs">Recomendação Operacional:</strong>
              <p className="text-slate-700 leading-relaxed text-xs">{category.recomendacao}</p>
            </div>
          </div>

          {/* Lista de Registros */}
          {category.itens.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-slate-700">
                Nenhum pagamento nesta situação no momento.
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Todos os registros estão devidamente categorizados e em dia.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {category.itens.map((item) => (
                <PriorityItemRow
                  key={item.payment.id}
                  item={item}
                  category={category}
                  onEditPayment={onEditPayment}
                  onToggleStatus={onToggleStatus}
                  isIncompleteSection={isIncompleteSection}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface PriorityItemRowProps {
  item: PriorityItem;
  category: PriorityCategorySummary;
  onEditPayment: (payment: PaymentRecord) => void;
  onToggleStatus: (id: string, newStatus: PaymentStatus) => void;
  isIncompleteSection?: boolean;
}

const PriorityItemRow: React.FC<PriorityItemRowProps> = ({
  item,
  category,
  onEditPayment,
  onToggleStatus,
  isIncompleteSection,
}) => {
  const { payment, diasAtraso, diasRestantes, motivoIncompletude } = item;
  const statusInfo = STATUS_MAP[payment.situacao];

  return (
    <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
      {/* Coluna 1: Fornecedor, Categoria, Notas e Dados Ausentes */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-900 text-sm leading-snug">
            {payment.fornecedor && payment.fornecedor.trim() !== '' ? (
              payment.fornecedor
            ) : (
              <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md text-[11px] font-semibold">
                Fornecedor não informado
              </span>
            )}
          </span>

          {payment.numeroNota && (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono border border-slate-200/60">
              NF: {payment.numeroNota}
            </span>
          )}

          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusInfo.badgeClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1 ${statusInfo.dotClass}`} />
            {statusInfo.label}
          </span>
        </div>

        <div className="text-slate-500 text-[11px] flex items-center gap-2 flex-wrap">
          {payment.categoria && (
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
              {payment.categoria}
            </span>
          )}
          {payment.categoria && payment.observacoes && <span className="text-slate-300">·</span>}
          {payment.observacoes && (
            <span className="truncate max-w-sm text-slate-500" title={payment.observacoes}>
              {payment.observacoes}
            </span>
          )}
        </div>

        {/* Motivos de incompletude específicos / Justificativa da Prioridade */}
        {motivoIncompletude && motivoIncompletude.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] text-amber-800 font-semibold uppercase tracking-wider">Atenção cadastral:</span>
            {motivoIncompletude.map((motivo, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-medium"
              >
                {motivo}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Coluna 2: Vencimento & Prazos */}
      <div className="sm:text-right shrink-0 min-w-[145px]">
        <div className="text-[11px] text-slate-500">
          Vencimento:{' '}
          <span className="font-semibold font-mono text-slate-800">
            {formatDateBR(payment.dataVencimento)}
          </span>
        </div>

        {diasAtraso !== undefined && diasAtraso > 0 && (
          <div className="inline-flex items-center gap-1 text-rose-700 font-bold text-xs mt-1 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            <span>Atrasado há {diasAtraso} {diasAtraso === 1 ? 'dia' : 'dias'}</span>
          </div>
        )}

        {diasRestantes === 0 && (
          <div className="inline-flex items-center gap-1 text-amber-900 font-bold text-xs mt-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Vence no dia de hoje!</span>
          </div>
        )}

        {diasRestantes !== undefined && diasRestantes > 0 && (
          <div className="inline-flex items-center gap-1 text-sky-800 font-semibold text-xs mt-1 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            <span>Vence em {diasRestantes} {diasRestantes === 1 ? 'dia' : 'dias'}</span>
          </div>
        )}

        {!payment.dataVencimento && (
          <div className="inline-flex items-center gap-1 text-amber-800 font-medium text-[11px] mt-1 bg-amber-50/80 px-2 py-0.5 rounded-full border border-amber-200/60">
            <span>Sem prazo cadastrado</span>
          </div>
        )}
      </div>

      {/* Coluna 3: Valor Conhecido */}
      <div className="sm:text-right shrink-0 min-w-[125px]">
        <div className="text-[11px] text-slate-400 font-medium">Valor Total:</div>
        <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900 tracking-tight">
          {payment.valor !== null && payment.valor !== undefined && !isNaN(payment.valor) && payment.valor > 0 ? (
            formatCurrencyBRL(payment.valor)
          ) : (
            <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
              Não informado
            </span>
          )}
        </div>
      </div>

      {/* Coluna 4: Ações Operacionais Imediatas */}
      <div className="flex items-center gap-1.5 shrink-0 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        <button
          type="button"
          onClick={() => onEditPayment(payment)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
          title="Editar ou preencher informações faltantes"
        >
          <Edit2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Editar</span>
        </button>

        {payment.situacao !== 'pago' && (
          <button
            type="button"
            onClick={() => onToggleStatus(payment.id, 'pago')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-colors shadow-2xs cursor-pointer"
            title="Marcar como Pago (atualiza o resumo de prioridades instantaneamente)"
          >
            <Check className="w-3.5 h-3.5 text-emerald-700" />
            <span>Quitar</span>
          </button>
        )}
      </div>
    </div>
  );
};
