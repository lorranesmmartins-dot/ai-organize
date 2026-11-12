/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Clock,
  Edit2,
  Trash2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { PaymentRecord, validatePaymentRecord, PaymentStatus } from '../types/payment';
import { formatCurrencyBRL, formatDateBR, STATUS_MAP, checkIsOverdue } from '../utils/formatters';

interface PaymentTableProps {
  payments: PaymentRecord[];
  onEditPayment: (payment: PaymentRecord) => void;
  onDeletePayment: (id: string) => void;
  onToggleStatus: (id: string, newStatus: PaymentStatus) => void;
  onOpenNewPayment: () => void;
}

export const PaymentTable: React.FC<PaymentTableProps> = ({
  payments,
  onEditPayment,
  onDeletePayment,
  onToggleStatus,
  onOpenNewPayment,
}) => {
  if (payments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h3 className="mt-3 text-base font-semibold text-slate-900">
          Nenhum registro encontrado
        </h3>
        <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
          Não há pagamentos correspondentes aos filtros selecionados. Tente alterar os critérios de busca ou cadastre um novo pagamento.
        </p>
        <div className="mt-5">
          <button
            onClick={onOpenNewPayment}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
          >
            Cadastrar Novo Pagamento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-semibold text-[11px] tracking-wider uppercase">
              <th scope="col" className="py-3 px-4 sm:px-6">
                Fornecedor
              </th>
              <th scope="col" className="py-3 px-4 text-right">
                Valor (R$)
              </th>
              <th scope="col" className="py-3 px-4">
                Vencimento
              </th>
              <th scope="col" className="py-3 px-4">
                Situação
              </th>
              <th scope="col" className="py-3 px-4">
                Integridade
              </th>
              <th scope="col" className="py-3 px-4 sm:px-6 text-right">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((payment) => {
              const validation = validatePaymentRecord(payment);
              const isOverdue = checkIsOverdue(payment.dataVencimento, payment.situacao);
              const statusCfg = STATUS_MAP[payment.situacao] || STATUS_MAP.indefinida;

              return (
                <tr
                  key={payment.id}
                  className={`transition-colors group ${
                    validation.isIncomplete
                      ? 'bg-amber-50/20 hover:bg-amber-50/40'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* 1. Nome do Fornecedor */}
                  <td className="py-3.5 px-4 sm:px-6 align-middle">
                    <div className="flex flex-col">
                      {payment.fornecedor && payment.fornecedor.trim() !== '' ? (
                        <span className="font-semibold text-[#172033] leading-snug">
                          {payment.fornecedor}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 text-rose-700 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="italic">Fornecedor não informado</span>
                        </div>
                      )}

                      {/* Observações ou categoria */}
                      {(payment.categoria || payment.observacoes) && (
                        <div className="mt-0.5 text-xs text-[#64748B] line-clamp-1 max-w-sm">
                          {payment.categoria && <span className="font-medium text-slate-600">{payment.categoria}</span>}
                          {payment.categoria && payment.observacoes && <span> · </span>}
                          {payment.observacoes && <span>{payment.observacoes}</span>}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 2. Valor do Pagamento (Alinhado à direita com numerais tabulares) */}
                  <td className="py-3.5 px-4 align-middle text-right font-mono tabular-nums">
                    {payment.valor !== null && !isNaN(payment.valor) && payment.valor > 0 ? (
                      <span className="font-bold text-[#172033] text-sm">
                        {formatCurrencyBRL(payment.valor)}
                      </span>
                    ) : (
                      <span className="text-[11px] font-sans text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-medium italic">
                        Não informado
                      </span>
                    )}
                  </td>

                  {/* 3. Data de Vencimento */}
                  <td className="py-3.5 px-4 align-middle">
                    {payment.dataVencimento ? (
                      <div className="flex items-center gap-1.5 font-mono tabular-nums text-slate-800">
                        <span>{formatDateBR(payment.dataVencimento)}</span>
                        {isOverdue && (
                          <span className="text-[10px] font-sans text-rose-700 bg-rose-50 border border-rose-200/80 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                            Atrasado
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-medium italic">
                        Não informada
                      </span>
                    )}
                  </td>

                  {/* 4. Situação do Pagamento */}
                  <td className="py-3.5 px-4 align-middle">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        payment.situacao === 'pago'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : payment.situacao === 'pendente'
                          ? 'bg-amber-50 text-amber-900 border-amber-200'
                          : payment.situacao === 'agendado'
                          ? 'bg-sky-50 text-sky-800 border-sky-200'
                          : payment.situacao === 'vencido'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          payment.situacao === 'pago'
                            ? 'bg-emerald-500'
                            : payment.situacao === 'pendente'
                            ? 'bg-amber-500'
                            : payment.situacao === 'agendado'
                            ? 'bg-sky-500'
                            : payment.situacao === 'vencido'
                            ? 'bg-rose-500'
                            : 'bg-slate-400'
                        }`}
                      />
                      <span>{statusCfg.label}</span>
                    </span>
                  </td>

                  {/* 5. Identificação de Informações Ausentes / Destaque de Incompletos */}
                  <td className="py-3.5 px-4 align-middle">
                    {validation.isIncomplete ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-950 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300 w-fit">
                          <AlertTriangle className="w-3 h-3 text-amber-800 shrink-0" />
                          <span>Incompleto</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Ausente:{' '}
                          <span className="text-amber-900 font-medium">
                            {validation.missingFields.map((f) => f.label).join(', ')}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 text-xs text-emerald-800 font-medium">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Completo</span>
                      </div>
                    )}
                  </td>

                  {/* 6. Ações Rápidas */}
                  <td className="py-3.5 px-4 sm:px-6 align-middle text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Ação rápida para marcar como pago ou voltar a pendente */}
                      {payment.situacao === 'pago' ? (
                        <button
                          type="button"
                          onClick={() => onToggleStatus(payment.id, 'pendente')}
                          title="Voltar status para Pendente"
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggleStatus(payment.id, 'pago')}
                          title="Marcar como Pago"
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Botão de Editar / Conferir */}
                      <button
                        type="button"
                        onClick={() => onEditPayment(payment)}
                        title={
                          validation.isIncomplete || payment.situacao === 'indefinida'
                            ? 'Conferir e preencher dados pendentes'
                            : 'Editar lançamento'
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                          validation.isIncomplete || payment.situacao === 'indefinida'
                            ? 'bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>{validation.isIncomplete || payment.situacao === 'indefinida' ? 'Conferir' : 'Editar'}</span>
                      </button>

                      {/* Botão de Excluir */}
                      <button
                        type="button"
                        onClick={() => onDeletePayment(payment.id)}
                        title="Excluir lançamento"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Rodapé da tabela com contagem e legenda */}
      <div className="bg-slate-50/80 border-t border-slate-200 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Linhas com destaque suave possuem dados pendentes de preenchimento</span>
          </div>
        </div>
        <div className="font-mono tabular-nums text-slate-600">
          Total listado: <strong className="text-slate-800">{payments.length}</strong>
        </div>
      </div>
    </div>
  );
};
