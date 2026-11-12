/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, HelpCircle, Trash2 } from 'lucide-react';
import { PaymentRecord, PaymentStatus, validatePaymentRecord } from '../types/payment';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payment: Partial<PaymentRecord>) => any;
  onDelete?: (id: string) => void;
  initialPayment?: PaymentRecord | null;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialPayment,
}) => {
  const [fornecedor, setFornecedor] = useState('');
  const [valorStr, setValorStr] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [situacao, setSituacao] = useState<PaymentStatus>('pendente');
  const [categoria, setCategoria] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setDuplicateWarning(null);
    setShowDeleteConfirm(false);
    if (initialPayment) {
      setFornecedor(initialPayment.fornecedor || '');
      setValorStr(
        initialPayment.valor !== null && initialPayment.valor !== undefined
          ? String(initialPayment.valor)
          : ''
      );
      setDataVencimento(initialPayment.dataVencimento || '');
      setSituacao(initialPayment.situacao || 'indefinida');
      setCategoria(initialPayment.categoria || '');
      setObservacoes(initialPayment.observacoes || '');
    } else {
      setFornecedor('');
      setValorStr('');
      setDataVencimento('');
      setSituacao('pendente');
      setCategoria('');
      setObservacoes('');
    }
  }, [initialPayment, isOpen]);

  if (!isOpen) return null;

  // Análise em tempo real dos campos preenchidos
  const parsedValor = valorStr.trim() === '' ? null : parseFloat(valorStr.replace(',', '.'));
  const currentDraft: Partial<PaymentRecord> = {
    fornecedor: fornecedor.trim(),
    valor: parsedValor,
    dataVencimento: dataVencimento || null,
    situacao,
  };

  const validation = validatePaymentRecord(currentDraft);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateWarning(null);

    const res = onSave({
      id: initialPayment ? initialPayment.id : undefined,
      fornecedor: fornecedor.trim(),
      valor: parsedValor,
      dataVencimento: dataVencimento || null,
      situacao,
      categoria: categoria.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
    });

    if (res && !res.success && res.duplicate) {
      setDuplicateWarning(res.error || 'Já existe um lançamento cadastrado com estes mesmos dados.');
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 id="modal-title" className="text-base font-bold text-slate-900">
              {initialPayment ? 'Editar Pagamento' : 'Novo Pagamento de Fornecedor'}
            </h2>
            <p className="text-xs text-slate-500">
              {initialPayment
                ? 'Atualize ou complete os dados cadastrais deste fornecedor.'
                : 'Cadastre os dados da fatura ou boleto para controle financeiro.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Alerta de Duplicidade */}
          {duplicateWarning && (
            <div className="bg-rose-50 border border-rose-300 rounded-lg p-3 text-xs text-rose-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Lançamento Duplicado:</span> {duplicateWarning}
              </div>
            </div>
          )}

          {/* Indicador de Validação em Tempo Real */}
          {validation.isIncomplete ? (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Aviso de completude:</span> Você pode salvar este lançamento mesmo com campos vazios, e ele será identificado como{' '}
                  <strong className="underline">incompleto</strong>.
                  <ul className="mt-1 list-disc list-inside space-y-0.5 text-amber-800">
                    {validation.missingFields.map((f) => (
                      <li key={f.key}>{f.label} não informado(a)</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Registro 100% completo:</strong> Todos os 4 campos essenciais foram preenchidos corretamente.
              </span>
            </div>
          )}

          {/* 1. Nome do Fornecedor */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do Fornecedor <span className="text-amber-600">*</span>
            </label>
            <input
              type="text"
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              placeholder="Ex: Sigma Distribuidora Fictícia Ltda"
              className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-hidden focus:ring-2 transition-colors ${
                !fornecedor.trim()
                  ? 'border-amber-300 focus:ring-amber-400'
                  : 'border-slate-300 focus:ring-indigo-500'
              }`}
            />
            {!fornecedor.trim() && (
              <p className="mt-1 text-[11px] text-amber-700">
                Campo vazio: será registrado como "Fornecedor não informado".
              </p>
            )}
          </div>

          {/* Linha dupla: Valor e Vencimento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 2. Valor do Pagamento */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor do Pagamento (R$) <span className="text-amber-600">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorStr}
                  onChange={(e) => setValorStr(e.target.value)}
                  placeholder="0,00"
                  className={`w-full pl-9 pr-3 py-2 text-sm font-mono tabular-nums bg-white border rounded-lg focus:outline-hidden focus:ring-2 transition-colors ${
                    parsedValor === null || parsedValor <= 0
                      ? 'border-amber-300 focus:ring-amber-400'
                      : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                />
              </div>
              {(parsedValor === null || parsedValor <= 0) && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Sem valor: constará como "Não informado".
                </p>
              )}
            </div>

            {/* 3. Data de Vencimento */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data de Vencimento <span className="text-amber-600">*</span>
              </label>
              <input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className={`w-full px-3 py-2 text-sm font-mono bg-white border rounded-lg focus:outline-hidden focus:ring-2 transition-colors ${
                  !dataVencimento
                    ? 'border-amber-300 focus:ring-amber-400'
                    : 'border-slate-300 focus:ring-indigo-500'
                }`}
              />
              {!dataVencimento && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Sem vencimento: constará como "Não informada".
                </p>
              )}
            </div>
          </div>

          {/* 4. Situação do Pagamento */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Situação do Pagamento <span className="text-amber-600">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { value: 'pendente', label: 'Pendente' },
                { value: 'agendado', label: 'Agendado' },
                { value: 'pago', label: 'Pago' },
                { value: 'vencido', label: 'Em atraso' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setSituacao(opt.value as PaymentStatus)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all text-center ${
                    situacao === opt.value
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Ou deixe em branco para sinalizar status não definido:</span>
              <button
                type="button"
                onClick={() => setSituacao('indefinida')}
                className={`text-[11px] underline ${
                  situacao === 'indefinida' ? 'text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Definir como Não Definida
              </button>
            </div>
          </div>

          {/* Campos Opcionais de Apoio */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Categoria / Centro de Custo (Opcional)
              </label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ex: Tecnologia, Logística, Manutenção, etc."
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Observações / Nº da Nota Fiscal / Boleto (Opcional)
              </label>
              <textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: NF 1204 - boleto bancário banco Santander"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* Rodapé e Botões de Submissão */}
          <div className="pt-4 border-t border-slate-200">
            {showDeleteConfirm ? (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-900">Confirmar exclusão deste lançamento?</span>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      O registro será removido permanentemente da planilha ativa.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (initialPayment?.id && onDelete) {
                        onDelete(initialPayment.id);
                        onClose();
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sim, excluir</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  {initialPayment && onDelete && (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                      title="Excluir este lançamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir lançamento</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
                  >
                    {initialPayment ? 'Atualizar Pagamento' : 'Salvar Pagamento'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
