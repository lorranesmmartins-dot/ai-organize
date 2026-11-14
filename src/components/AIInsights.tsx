/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  BrainCircuit,
  Send,
  AlertTriangle,
  AlertCircle,
  Clock,
  ShieldAlert,
  Building2,
  ListChecks,
  Edit2,
  Info,
  CheckCircle2,
  FileWarning,
} from 'lucide-react';
import { PaymentRecord } from '../types/payment';
import { formatCurrencyBRL, formatDateBR, STATUS_MAP } from '../utils/formatters';
import {
  buildAIInsightsDiagnosis,
  answerFinancialQuestion,
  AssistantAnswer,
} from '../utils/aiInsightsEngine';

interface AIInsightsProps {
  payments: PaymentRecord[];
  onEditPayment: (payment: PaymentRecord) => void;
}

const SUGGESTED_QUESTIONS = [
  'Qual fornecedor possui maior valor em aberto?',
  'Quais pagamentos estão atrasados?',
  'Quais vencem nos próximos 7 dias?',
  'Quais inconsistências ou dados incompletos existem?',
  'Quanto já foi quitado?',
];

export const AIInsights: React.FC<AIInsightsProps> = ({ payments, onEditPayment }) => {
  const [questionInput, setQuestionInput] = useState('');
  const [answersHistory, setAnswersHistory] = useState<AssistantAnswer[]>([]);

  const diagnosis = useMemo(() => buildAIInsightsSummarySafe(payments), [payments]);

  function buildAIInsightsSummarySafe(list: PaymentRecord[]) {
    return buildAIInsightsDiagnosis(list);
  }

  const handleAskQuestion = (rawText?: string) => {
    const textToAsk = (rawText ?? questionInput).trim();
    if (!textToAsk) return;

    const response = answerFinancialQuestion(textToAsk, payments, diagnosis);
    setAnswersHistory((prev) => [response, ...prev]);
    if (rawText === undefined) {
      setQuestionInput('');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAskQuestion();
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Central de Inteligência e Consultas */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#172554] text-white flex items-center justify-center shrink-0">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#172033] tracking-tight">
                AI Insights · Central de Inteligência e Consultas
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Consultas em linguagem natural, detecção automática de riscos, inconsistências e prioridades baseadas exclusivamente nos lançamentos cadastrados.
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                <span>Base analisada: {diagnosis.totalCount} lançamento(s)</span>
                <span aria-hidden="true">·</span>
                <span>Data de referência: {formatDateBR(diagnosis.referenceDate)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. ASSISTENTE INTELIGENTE DE CONSULTAS (Foco Principal) */}
      <section
        aria-labelledby="ai-insights-assistant-heading"
        className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5"
      >
        <div>
          <h3 id="ai-insights-assistant-heading" className="text-sm font-bold text-[#172033]">
            Assistente Inteligente Financeiro
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            Pergunte sobre fornecedores em aberto, atrasos, vencimentos próximos ou pendências cadastrais. As respostas apresentam apenas os lançamentos reais da base.
          </p>
        </div>

        <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <label htmlFor="ai-insights-query" className="sr-only">
            Pergunta sobre os dados financeiros
          </label>
          <input
            id="ai-insights-query"
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            placeholder="Ex: Qual fornecedor possui maior valor em aberto? ou Quais pagamentos estão atrasados?"
            className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#4F46E5]/30 focus:border-[#4F46E5]"
          />
          <button
            type="submit"
            disabled={!questionInput.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#4F46E5] hover:bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors shrink-0 whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Consultar</span>
          </button>
        </form>

        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500 block">
            Consultas rápidas:
          </span>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleAskQuestion(q)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-[#4F46E5] rounded-lg transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {answersHistory.length > 0 ? (
          <div className="space-y-4 pt-3 border-t border-slate-200">
            {answersHistory.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-4 space-y-3 ${
                  item.status === 'insufficient_data'
                    ? 'bg-amber-50/40 border-amber-200'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="text-xs font-semibold text-slate-500">
                  Consulta: <span className="text-slate-900">{item.question}</span>
                </div>

                <p className="text-sm font-medium text-[#172033] leading-relaxed">
                  {item.answer}
                </p>

                {item.caveat && (
                  <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>{item.caveat}</span>
                  </div>
                )}

                {item.evidence.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 block">
                      Lançamentos que fundamentam esta resposta:
                    </span>
                    <div className="divide-y divide-slate-200/70 bg-white rounded-lg border border-slate-200">
                      {item.evidence.map((ev, idx) => (
                        <div
                          key={`${item.id}-ev-${idx}`}
                          className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 truncate">
                              {ev.label}
                            </div>
                            {ev.detail && (
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {ev.detail}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                            <span className="font-mono font-bold text-slate-900 tabular-nums">
                              {ev.value}
                            </span>
                            {ev.payment && (
                              <button
                                type="button"
                                onClick={() => onEditPayment(ev.payment!)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Editar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">
            Selecione uma consulta rápida ou digite sua pergunta acima para inspecionar os lançamentos cadastrados.
          </div>
        )}
      </section>

      {/* 2. IDENTIFICAÇÃO AUTOMÁTICA DE RISCOS, INCONSISTÊNCIAS E DADOS INCOMPLETOS */}
      <section aria-labelledby="ai-insights-risks-heading" className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Bloco A: Pagamentos Atrasados e Vencimentos Próximos */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-600 shrink-0" />
                <h3 id="ai-insights-risks-heading" className="text-sm font-bold text-[#172033]">
                  Atrasos e Vencimentos Críticos
                </h3>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                Janela de 7 dias
              </span>
            </div>

            {/* Subseção: Atrasados (consistente com Relatórios Financeiros) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-rose-800">
                  Pagamentos em atraso ({diagnosis.overdueItems.length})
                </span>
                <span className="font-mono font-bold text-rose-700 tabular-nums">
                  {formatCurrencyBRL(diagnosis.overdueTotalAmount)}
                </span>
              </div>

              {diagnosis.overdueItems.length === 0 ? (
                <div className="text-xs text-slate-500 py-2 border-t border-slate-100">
                  Nenhum pagamento pendente ou vencido com data anterior a {formatDateBR(diagnosis.referenceDate)}.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-rose-200/80 rounded-lg bg-rose-50/30">
                  {diagnosis.overdueItems.map(({ payment, daysOverdue }) => (
                    <div
                      key={payment.id}
                      className="px-3 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {payment.fornecedor?.trim() || 'Fornecedor não informado'}
                        </div>
                        <div className="text-[11px] text-rose-700 mt-0.5 tabular-nums">
                          Venc.: {formatDateBR(payment.dataVencimento)} · {daysOverdue} dia(s) de atraso
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {formatCurrencyBRL(payment.valor)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onEditPayment(payment)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-md transition-colors"
                          title="Editar lançamento"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subseção: Vencimentos próximos (Hoje a +7 dias) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  Vencimentos nos próximos 7 dias ({diagnosis.upcomingDueSoonItems.length})
                </span>
                <span className="font-mono font-bold text-[#172554] tabular-nums">
                  {formatCurrencyBRL(diagnosis.upcomingDueSoonAmount)}
                </span>
              </div>

              {diagnosis.upcomingDueSoonItems.length === 0 ? (
                <div className="text-xs text-slate-500 py-2">
                  Nenhum vencimento confirmado previsto para os próximos 7 dias.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {diagnosis.upcomingDueSoonItems.map(({ payment, daysRemaining }) => (
                    <div
                      key={payment.id}
                      className="px-3 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">
                          {payment.fornecedor?.trim() || 'Fornecedor não informado'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                          Venc.: {formatDateBR(payment.dataVencimento)} ·{' '}
                          {daysRemaining === 0 ? 'Vence hoje' : `em ${daysRemaining} dia(s)`} ·{' '}
                          {STATUS_MAP[payment.situacao]?.label || payment.situacao}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {formatCurrencyBRL(payment.valor)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onEditPayment(payment)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                          title="Editar lançamento"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bloco B: Inconsistências e Dados Incompletos */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <h3 className="text-sm font-bold text-[#172033]">
                  Inconsistências e Dados Incompletos
                </h3>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {diagnosis.inconsistencies.length + diagnosis.incompleteItems.length} alerta(s)
              </span>
            </div>

            {/* Inconsistências de Status / Duplicidades */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-800">
                Inconsistências detectadas ({diagnosis.inconsistencies.length})
              </div>
              {diagnosis.inconsistencies.length === 0 ? (
                <div className="text-xs text-slate-500 py-2 border-t border-slate-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Nenhuma inconsistência de status ou duplicidade detectada.</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-amber-200 rounded-lg bg-amber-50/30">
                  {diagnosis.inconsistencies.map((inc) => (
                    <div
                      key={inc.id}
                      className="px-3 py-2.5 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-amber-950">
                          {inc.title} · {inc.payment.fornecedor?.trim() || 'Fornecedor não informado'}
                        </div>
                        <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                          {inc.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatCurrencyBRL(inc.payment.valor)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onEditPayment(inc.payment)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-md transition-colors"
                          title="Corrigir lançamento"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Registros Incompletos / Situação Não Definida */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-800">
                Dados incompletos ou situação indefinida ({diagnosis.incompleteItems.length})
              </div>
              {diagnosis.incompleteItems.length === 0 ? (
                <div className="text-xs text-slate-500 py-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Todos os lançamentos possuem os campos obrigatórios preenchidos.</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {diagnosis.incompleteItems.map(({ payment, missingLabels }) => (
                    <div
                      key={payment.id}
                      className="px-3 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                          <FileWarning className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">
                            {payment.fornecedor?.trim() || 'Fornecedor não informado'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Ausente: {missingLabels.join(' · ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-mono text-slate-700 tabular-nums">
                          {formatCurrencyBRL(payment.valor)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onEditPayment(payment)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                          title="Completar dados"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. DESTAQUES DE FORNECEDORES EM ABERTO E RECOMENDAÇÕES DE PRIORIDADES */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Destaques de Fornecedores com Maiores Valores em Aberto */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#4F46E5] shrink-0" />
              <h3 className="text-sm font-bold text-[#172033]">
                Fornecedores com Maiores Valores em Aberto
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Top concentração
            </span>
          </div>

          {diagnosis.openSuppliers.length === 0 ? (
            <div className="py-6 text-xs text-slate-500">
              Não há fornecedores com valores pendentes ou agendados em aberto no momento.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {diagnosis.openSuppliers.slice(0, 5).map((sup, index) => (
                <div
                  key={sup.fornecedor}
                  className="px-3.5 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {index + 1}. {sup.fornecedor}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                      {sup.openCount} lançamento(s) em aberto
                      {sup.overdueAmount > 0 && (
                        <span className="text-rose-700 font-semibold">
                          {' '}· {formatCurrencyBRL(sup.overdueAmount)} em atraso
                        </span>
                      )}
                      {sup.scheduledAmount > 0 && (
                        <span className="text-sky-700">
                          {' '}· {formatCurrencyBRL(sup.scheduledAmount)} agendado
                        </span>
                      )}
                      {sup.missingValueCount > 0 && (
                        <span className="text-amber-700">
                          {' '}· {sup.missingValueCount} sem valor
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="font-mono font-bold text-[#172554] tabular-nums shrink-0">
                    {sup.openAmount > 0 ? formatCurrencyBRL(sup.openAmount) : 'Sem valor'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recomendações de Prioridades Fundamentadas */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-[#4F46E5] shrink-0" />
              <h3 className="text-sm font-bold text-[#172033]">
                Recomendações de Prioridades
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Baseado nos achados atuais
            </span>
          </div>

          {diagnosis.recommendations.length === 0 ? (
            <div className="p-4 rounded-lg bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Nenhuma pendência urgente ou inconsistência encontrada nos lançamentos atuais.
              </span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {diagnosis.recommendations.map((rec) => {
                const styleMap = {
                  critica: 'bg-rose-50/50 border-rose-200 text-rose-950',
                  alta: 'bg-amber-50/50 border-amber-200 text-amber-950',
                  media: 'bg-sky-50/50 border-sky-200 text-sky-950',
                  atencao: 'bg-slate-50 border-slate-200 text-slate-900',
                };
                const iconMap = {
                  critica: <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
                  alta: <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
                  media: <Clock className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />,
                  atencao: <FileWarning className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />,
                };

                return (
                  <div
                    key={rec.id}
                    className={`rounded-lg border p-3.5 flex items-start gap-2.5 text-xs ${styleMap[rec.level]}`}
                  >
                    {iconMap[rec.level]}
                    <div className="min-w-0">
                      <div className="font-bold">{rec.title}</div>
                      <p className="text-[11px] opacity-85 mt-0.5 leading-relaxed">
                        {rec.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
