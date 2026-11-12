/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle } from 'lucide-react';
import { PaymentRecord, validatePaymentRecord } from '../types/payment';

interface IncompleteAlertBannerProps {
  payments: PaymentRecord[];
  onFilterIncomplete: () => void;
  onOpenAudit: () => void;
  isFilterActive: boolean;
  onClearFilter: () => void;
}

export const IncompleteAlertBanner: React.FC<IncompleteAlertBannerProps> = ({
  payments,
  onFilterIncomplete,
  onOpenAudit,
  isFilterActive,
  onClearFilter,
}) => {
  const incompleteRecords = payments.map((p) => ({
    payment: p,
    validation: validatePaymentRecord(p),
  })).filter((item) => item.validation.isIncomplete);

  if (incompleteRecords.length === 0) {
    return (
      <div className="bg-white border border-emerald-200/80 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-600 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-semibold text-emerald-950">
              Integridade verificada:
            </span>{' '}
            Todos os {payments.length} lançamentos possuem fornecedor, valor, vencimento e situação definidos.
          </div>
        </div>
        <span className="text-[11px] text-emerald-700 font-medium hidden sm:inline bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
          100% preenchido
        </span>
      </div>
    );
  }

  // Contagem específica de cada campo ausente para transparência total
  let missingFornecedor = 0;
  let missingValor = 0;
  let missingVencimento = 0;
  let missingSituacao = 0;

  incompleteRecords.forEach(({ validation }) => {
    validation.missingFields.forEach((f) => {
      if (f.key === 'fornecedor') missingFornecedor++;
      if (f.key === 'valor') missingValor++;
      if (f.key === 'dataVencimento') missingVencimento++;
      if (f.key === 'situacao') missingSituacao++;
    });
  });

  const missingSummaries: string[] = [];
  if (missingFornecedor > 0) missingSummaries.push(`${missingFornecedor} sem fornecedor`);
  if (missingValor > 0) missingSummaries.push(`${missingValor} sem valor`);
  if (missingVencimento > 0) missingSummaries.push(`${missingVencimento} sem vencimento`);
  if (missingSituacao > 0) missingSummaries.push(`${missingSituacao} sem situação`);

  return (
    <div className="bg-white border border-amber-200/90 rounded-xl p-3 sm:px-4 sm:py-3 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700 shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
                {incompleteRecords.length} {incompleteRecords.length === 1 ? 'pendência' : 'pendências'}
              </span>
              <span className="text-xs font-semibold text-[#172033] truncate">
                Campos obrigatórios requerem conferência
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5 truncate">
              Pendências identificadas:{' '}
              <span className="font-medium text-amber-900">
                {missingSummaries.join(' · ')}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {isFilterActive ? (
            <button
              type="button"
              onClick={onClearFilter}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Exibir Todos os Registros
            </button>
          ) : (
            <button
              type="button"
              onClick={onFilterIncomplete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-950 bg-amber-100/80 hover:bg-amber-200/80 border border-amber-200 rounded-lg transition-colors"
            >
              <span>Ver Incompletos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAudit}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Auditoria
          </button>
        </div>
      </div>
    </div>
  );
};
