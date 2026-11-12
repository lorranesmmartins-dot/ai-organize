/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertCircle, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { PaymentRecord, validatePaymentRecord } from '../types/payment';
import { formatCurrencyBRL } from '../utils/formatters';

interface MetricCardsProps {
  payments: PaymentRecord[];
  onSelectIncompleteFilter: () => void;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  payments,
  onSelectIncompleteFilter,
}) => {
  // Cálculos financeiros
  let totalCadastrado = 0;
  let countSemValor = 0;

  let totalPago = 0;
  let countPago = 0;

  let totalPendente = 0;
  let countPendente = 0;

  let countIncompletos = 0;
  let missingFornecedor = 0;
  let missingValor = 0;
  let missingVencimento = 0;
  let missingSituacao = 0;

  payments.forEach((p) => {
    const val = validatePaymentRecord(p);
    if (val.isIncomplete) {
      countIncompletos++;
      val.missingFields.forEach((f) => {
        if (f.key === 'fornecedor') missingFornecedor++;
        if (f.key === 'valor') missingValor++;
        if (f.key === 'dataVencimento') missingVencimento++;
        if (f.key === 'situacao') missingSituacao++;
      });
    }

    if (p.valor !== null && !isNaN(p.valor) && p.valor > 0) {
      totalCadastrado += p.valor;
      if (p.situacao === 'pago') {
        totalPago += p.valor;
        countPago++;
      } else if (p.situacao === 'pendente' || p.situacao === 'agendado' || p.situacao === 'vencido') {
        totalPendente += p.valor;
        countPendente++;
      }
    } else {
      countSemValor++;
    }
  });

  const missingIssues: string[] = [];
  if (missingValor > 0) {
    missingIssues.push(`${missingValor} sem valor`);
  }
  if (missingVencimento > 0) {
    missingIssues.push(`${missingVencimento} sem vencimento`);
  }
  if (missingSituacao > 0) {
    missingIssues.push(`${missingSituacao} sem situação`);
  }
  if (missingFornecedor > 0) {
    missingIssues.push(`${missingFornecedor} sem fornecedor`);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Registrado */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Registrado
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {/* Valor principal monetário */}
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
              {formatCurrencyBRL(totalCadastrado)}
            </div>

            {/* Informação secundária com destaque visual para a quantidade */}
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-700">
                {payments.length} lançamentos
              </span>
              {countSemValor > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {countSemValor} sem valor
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="text-slate-500">Base consolidada</span>
          <span className="text-[11px] text-slate-400">Total geral</span>
        </div>
      </div>

      {/* 2. Total Pago (Quitados) */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Pagamentos Quitados
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {/* Valor principal monetário */}
            <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums tracking-tight">
              {formatCurrencyBRL(totalPago)}
            </div>

            {/* Informação secundária com destaque visual para a quantidade */}
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-emerald-800">
                {countPago} liquidados
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="text-slate-500">Comprovados</span>
          <span className="text-[11px] text-emerald-600 font-medium">100% liquidados</span>
        </div>
      </div>

      {/* 3. A Vencer / Pendente (Agendados & Abertos) */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              A Pagar / Em Aberto
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {/* Valor principal monetário */}
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
              {formatCurrencyBRL(totalPendente)}
            </div>

            {/* Informação secundária com destaque visual para a quantidade */}
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-sky-800">
                {countPendente} em aberto
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="text-slate-500">Fluxo programado</span>
          <span className="text-[11px] text-sky-600 font-medium">Contas a pagar</span>
        </div>
      </div>

      {/* 4. Destaque: Registros Incompletos / Auditoria de Dados */}
      <div
        onClick={onSelectIncompleteFilter}
        className={`rounded-xl border p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between h-full group ${
          countIncompletos > 0
            ? 'bg-white border-amber-300 hover:border-amber-400 hover:bg-amber-50/20'
            : 'bg-white border-slate-200/90'
        }`}
        title="Clique para filtrar apenas os registros incompletos"
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider">
              Auditoria de Dados
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                countIncompletos > 0
                  ? 'bg-amber-100 text-amber-700 group-hover:bg-amber-200'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {/* Valor principal: quantidade de registros incompletos */}
            <div
              className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${
                countIncompletos > 0 ? 'text-amber-950' : 'text-slate-700'
              }`}
            >
              {countIncompletos} {countIncompletos === 1 ? 'incompleto' : 'incompletos'}
            </div>

            {/* Informação secundária com destaque visual: quantos registros precisam de conferência e síntese */}
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-amber-900">
                {countIncompletos > 0
                  ? `${countIncompletos} ${countIncompletos === 1 ? 'precisa de conferência' : 'precisam de conferência'}`
                  : '100% preenchidos'}
              </span>
              {missingIssues.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {missingIssues.join(' · ')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-amber-800">
          <span className="text-[11px] text-slate-500 truncate mr-2" title={missingIssues.length > 0 ? `Problemas identificados: ${missingIssues.join(', ')}` : 'Nenhuma pendência cadastral'}>
            {countIncompletos > 0 ? 'Pendência de cadastro' : 'Campos validados'}
          </span>
          {countIncompletos > 0 && (
            <span className="font-semibold text-[#4F46E5] group-hover:underline text-[11px] inline-flex items-center gap-1 shrink-0">
              Filtrar &rarr;
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
