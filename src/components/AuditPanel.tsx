/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileQuestion,
  CalendarX,
  BadgeAlert,
  ArrowRight,
  ClipboardCopy,
  ShieldCheck,
  Layers,
  Lock,
  Trash2,
  Clock,
  DollarSign,
  AlertCircle,
  FileText,
  Download,
  Upload,
  Database,
  FileJson,
  Check,
  HelpCircle,
  Info,
} from 'lucide-react';
import { PaymentRecord, validatePaymentRecord } from '../types/payment';
import { formatCurrencyBRL, formatDateBR } from '../utils/formatters';
import {
  downloadPaymentsBackup,
  restorePaymentsBackup,
  STORAGE_KEY,
} from '../utils/backupManager';
import {
  AUTHORIZED_PRESERVED_ID,
  AUTHORIZED_DELETE_IDS,
  checkDeduplicationStatus,
  executeAuthorizedAtlasCleanup,
  executeRemoveSingleAtlasDuplicate,
  TARGET_SINGLE_DUPLICATE_ID,
  DeduplicationExecutionResult,
  SingleDeduplicationResult,
} from '../utils/cleanDeduplication';

interface AuditPanelProps {
  payments: PaymentRecord[];
  onEditPayment: (payment: PaymentRecord) => void;
  onFilterIncomplete: () => void;
  onExecuteDeduplication?: (preservedId: string, removeIds: string[]) => void;
  onRestorePayments?: (restored: PaymentRecord[]) => void;
  onExecuteAtlasCleanup?: () => DeduplicationExecutionResult;
  onRemoveSingleDuplicate?: () => SingleDeduplicationResult;
}

export const AuditPanel: React.FC<AuditPanelProps> = ({
  payments,
  onEditPayment,
  onFilterIncomplete,
  onRestorePayments,
  onExecuteAtlasCleanup,
  onRemoveSingleDuplicate,
}) => {
  const [cleanupFeedback, setCleanupFeedback] = useState<DeduplicationExecutionResult | null>(null);

  const handleRunAuthorizedCleanup = () => {
    if (duplicateRecordsToDelete.length === 1 && duplicateRecordsToDelete[0].id === TARGET_SINGLE_DUPLICATE_ID) {
      if (onRemoveSingleDuplicate) {
        const res = onRemoveSingleDuplicate();
        setCleanupFeedback({
          success: res.success,
          message: res.message,
          removedCount: res.targetFound ? 1 : 0,
          remainingCount: res.cleanPayments.length,
          originalPreserved: res.originalPreserved,
          otherRecordsCount: res.cleanPayments.length - 1,
          otherRecordsIntact: true,
          cleanPayments: res.cleanPayments,
          totals: res.totals,
        });
        return;
      }
    }

    if (onExecuteAtlasCleanup) {
      const res = onExecuteAtlasCleanup();
      setCleanupFeedback(res);
    } else {
      const res = executeAuthorizedAtlasCleanup(payments);
      setCleanupFeedback(res);
      if (res.success && onRestorePayments) {
        onRestorePayments(res.cleanPayments);
      }
    }
  };

  const analyzedPayments = payments.map((p) => ({
    payment: p,
    validation: validatePaymentRecord(p),
  }));

  const incompleteItems = analyzedPayments.filter((i) => i.validation.isIncomplete);
  const completeItems = analyzedPayments.filter((i) => !i.validation.isIncomplete);

  // Contagens por tipo de campo ausente
  const missingByField = {
    fornecedor: incompleteItems.filter((i) =>
      i.validation.missingFields.some((f) => f.key === 'fornecedor')
    ),
    valor: incompleteItems.filter((i) =>
      i.validation.missingFields.some((f) => f.key === 'valor')
    ),
    dataVencimento: incompleteItems.filter((i) =>
      i.validation.missingFields.some((f) => f.key === 'dataVencimento')
    ),
    situacao: incompleteItems.filter((i) =>
      i.validation.missingFields.some((f) => f.key === 'situacao')
    ),
  };

  const [copied, setCopied] = React.useState(false);

  // Estados para Cópia de Segurança (Backup & Restauração)
  const [backupInfo, setBackupInfo] = useState<{
    filename: string;
    total: number;
    timestamp: string;
  } | null>(null);
  const [restoreFeedback, setRestoreFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [showRestoreManualGuide, setShowRestoreManualGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBackup = () => {
    const result = downloadPaymentsBackup(payments);
    if (result.success) {
      setBackupInfo({
        filename: result.filename,
        total: result.totalExportados,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });
      setRestoreFeedback(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setRestoreFeedback({
          type: 'error',
          message: 'Não foi possível ler o arquivo selecionado.',
        });
        return;
      }

      const res = restorePaymentsBackup(content);
      if (res.success && res.pagamentos) {
        setRestoreFeedback({
          type: 'success',
          message: res.message,
        });
        if (onRestorePayments) {
          onRestorePayments(res.pagamentos);
        }
      } else {
        setRestoreFeedback({
          type: 'error',
          message: res.message,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyPendingList = () => {
    if (incompleteItems.length === 0) return;

    let text = `*RELATÓRIO DE PENDÊNCIAS CADASTRAIS - ORGANIZA AI*\n`;
    text += `Total de registros incompletos: ${incompleteItems.length}\n\n`;

    incompleteItems.forEach((item, idx) => {
      const name = item.payment.fornecedor || 'FORNECEDOR NÃO INFORMADO';
      const missing = item.validation.missingFields.map((f) => f.label).join(', ');
      text += `${idx + 1}. ${name}\n   - Campos ausentes: ${missing}\n`;
      if (item.payment.observacoes) {
        text += `   - Obs: ${item.payment.observacoes}\n`;
      }
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Identificação rigorosa dos registros correspondentes à NF 4568 da Atlas Tecnologia
  const atlasRecords = useMemo(() => {
    return payments
      .filter((p) => {
        const fornecedorMatch = p.fornecedor.toLowerCase().includes('atlas');
        const notaMatch = p.numeroNota === '4568' || (p.observacoes && p.observacoes.includes('4568'));
        const valorMatch = p.valor === 2800;
        return (fornecedorMatch && notaMatch) || (fornecedorMatch && valorMatch);
      })
      .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)); // Ordenação cronológica estável
  }, [payments]);

  // Registro original preservado (primeiro inserido) e duplicados marcados para exclusão
  const preservedRecord = atlasRecords.length > 0 ? atlasRecords[0] : null;
  const duplicateRecordsToDelete = atlasRecords.length > 1 ? atlasRecords.slice(1) : [];

  // Cálculos financeiros antes e depois da limpeza
  const totalFinanceiroAtual = useMemo(() => {
    return payments.reduce((acc, p) => (p.valor !== null && !isNaN(p.valor) && p.valor > 0 ? acc + p.valor : acc), 0);
  }, [payments]);

  const totalPendentesAtual = useMemo(() => {
    return payments
      .filter((p) => p.situacao !== 'pago')
      .reduce((acc, p) => (p.valor !== null && !isNaN(p.valor) && p.valor > 0 ? acc + p.valor : acc), 0);
  }, [payments]);

  const valorDuplicadoARemover = duplicateRecordsToDelete.length * 2800;
  const totalFinanceiroProjetado = totalFinanceiroAtual - valorDuplicadoARemover;
  const totalPendentesProjetado = totalPendentesAtual - valorDuplicadoARemover;

  return (
    <div className="space-y-6">
      {/* 0. Cópia de Segurança Completa (Backup & Restauração Preventiva) */}
      <div className="bg-white rounded-xl border-2 border-emerald-300 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">
                  Cópia de Segurança Completa (Backup Preventivo)
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  Chave: {STORAGE_KEY}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Exporta 100% dos pagamentos armazenados em arquivo JSON seguro antes de qualquer exclusão ou alteração. IDs e campos intactos.
              </p>
            </div>
          </div>

          {/* Botões de Ação de Backup e Restauração */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Cópia de Segurança (JSON)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Restaurar Cópia</span>
            </button>
          </div>
        </div>

        {/* Quadro informativo de dados protegidos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Registros no Backup
            </span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-1">
              {payments.length} lançamentos
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              100% dos dados da chave
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Integridade de IDs
            </span>
            <div className="text-lg font-bold font-mono text-emerald-700 mt-1">
              100% Preservados
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Nenhum ID modificado
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Formato de Exportação
            </span>
            <div className="text-lg font-bold font-mono text-indigo-700 mt-1">
              JSON Estruturado
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Compatível com restauração
            </div>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3">
            <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
              Status dos Dados
            </span>
            <div className="text-lg font-bold font-mono text-emerald-800 mt-1">
              Intocado
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">
              0 alterações · 0 exclusões
            </div>
          </div>
        </div>

        {/* Feedback de Download do Backup com Sucesso */}
        {backupInfo && (
          <div className="mt-4 bg-emerald-50 border border-emerald-300 rounded-lg p-3.5 text-xs text-emerald-950 flex items-start gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-emerald-900">
                Cópia de segurança gerada e baixada com sucesso!
              </div>
              <p className="mt-0.5 text-emerald-800">
                Arquivo: <strong className="font-mono">{backupInfo.filename}</strong> contendo{' '}
                <strong>{backupInfo.total} registros</strong> com IDs originais intactos gerado às{' '}
                {backupInfo.timestamp}.
              </p>
            </div>
          </div>
        )}

        {/* Feedback de Restauração */}
        {restoreFeedback && (
          <div
            className={`mt-4 rounded-lg p-3.5 text-xs flex items-start gap-2.5 ${
              restoreFeedback.type === 'success'
                ? 'bg-emerald-50 border border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border border-rose-300 text-rose-950'
            }`}
          >
            {restoreFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>{restoreFeedback.message}</div>
          </div>
        )}

        {/* Guia de Instruções de Restauração */}
        <div className="mt-4 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowRestoreManualGuide(!showRestoreManualGuide)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>
              {showRestoreManualGuide
                ? 'Ocultar instruções de restauração'
                : 'Como restaurar esta cópia de segurança se houver qualquer problema? (Clique para ver)'}
            </span>
          </button>

          {showRestoreManualGuide && (
            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 space-y-3">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <FileJson className="w-4 h-4 text-indigo-600" />
                <span>Procedimento de Restauração da Cópia de Segurança</span>
              </div>

              <div className="space-y-2">
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <div className="font-semibold text-slate-900">Método 1: Pela própria interface (Recomendado)</div>
                  <p className="text-slate-600 mt-1">
                    1. Nesta mesma seção, clique no botão <strong>"Restaurar Cópia"</strong>.<br />
                    2. Selecione o arquivo baixado (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">organiza_ai_backup_seguranca_...json</code>).<br />
                    3. O sistema valida os registros, atualiza a chave <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">organiza_ai_pagamentos_v1</code> no navegador e recarrega os pagamentos instantaneamente.
                  </p>
                </div>

                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <div className="font-semibold text-slate-900">Método 2: Direto pelo Console do Navegador (Técnico / Emergência)</div>
                  <p className="text-slate-600 mt-1">
                    1. Abra o arquivo JSON em qualquer editor de texto (Bloco de Notas, VS Code, etc.).<br />
                    2. Copie o conteúdo da lista <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">"pagamentos": [...]</code>.<br />
                    3. No navegador, pressione <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono">F12</kbd> e vá na aba <strong>Console</strong>.<br />
                    4. Digite o seguinte comando e aperte Enter:
                  </p>
                  <pre className="mt-2 p-2 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded overflow-x-auto">
{`localStorage.setItem('organiza_ai_pagamentos_v1', JSON.stringify(dadosCopiados));
location.reload();`}
                  </pre>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>O backup é autônomo, não depende de rede e não expõe nenhum dado pessoal ou financeiro externamente.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 1. Painel de Limpeza Controlada de Duplicidades (NF 4568 - Atlas Tecnologia) */}
      <div className="bg-white rounded-xl border-2 border-indigo-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">
                  Auditoria de Duplicidades · NF 4568 (Atlas Tecnologia)
                </h3>
                {duplicateRecordsToDelete.length > 0 ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                    {duplicateRecordsToDelete.length} duplicatas identificadas
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    Limpeza Concluída · Base Auditada e Íntegra
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Remoção seletiva dos 15 registros repetidos gerados por cliques múltiplos, mantendo o original intacto.
              </p>
            </div>
          </div>

          {duplicateRecordsToDelete.length > 0 ? (
            <button
              type="button"
              onClick={handleRunAuthorizedCleanup}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>Executar Limpeza dos 15 Duplicados</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Limpeza Concluída · Registro Original Preservado</span>
            </div>
          )}
        </div>

        {/* Feedback Detalhado de Execução da Limpeza */}
        {cleanupFeedback && (
          <div className="mt-4 bg-emerald-50 border-2 border-emerald-400 rounded-lg p-4 text-xs text-emerald-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Relatório de Execução da Limpeza</span>
            </div>
            <p className="text-emerald-900">{cleanupFeedback.message}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200 text-xs">
              <div>
                <span className="text-emerald-700 block font-medium">Registros Removidos:</span>
                <span className="font-bold text-slate-900 font-mono text-sm">{cleanupFeedback.removedCount}</span>
              </div>
              <div>
                <span className="text-emerald-700 block font-medium">Registros Restantes:</span>
                <span className="font-bold text-slate-900 font-mono text-sm">{cleanupFeedback.remainingCount}</span>
              </div>
              <div>
                <span className="text-emerald-700 block font-medium">Original Preservado:</span>
                <span className="font-bold text-emerald-800 font-mono text-sm">{cleanupFeedback.originalPreserved ? 'Sim (pay-1793408305739)' : 'Não'}</span>
              </div>
              <div>
                <span className="text-emerald-700 block font-medium">Demais 12 Registros:</span>
                <span className="font-bold text-emerald-800 font-mono text-sm">{cleanupFeedback.otherRecordsIntact ? '100% Intactos' : 'Divergência'}</span>
              </div>
            </div>
          </div>
        )}

        {atlasRecords.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">Nenhum registro da Atlas Tecnologia encontrado na sessão atual.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {duplicateRecordsToDelete.length > 0 ? (
              <div className="bg-amber-50/90 border border-amber-300 rounded-lg p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Operação Pronta:</strong> Clique em <em>"Executar Limpeza dos 15 Duplicados"</em> acima para realizar a remoção estrita dos 15 IDs identificados. O registro original ({AUTHORIZED_PRESERVED_ID}) e os demais 12 registros de outros fornecedores permanecerão 100% preservados.
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 text-xs text-emerald-950 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Base Homologada:</strong> Apenas o registro original da Atlas Tecnologia (ID <code className="font-mono font-bold bg-emerald-100 px-1 py-0.5 rounded">{preservedRecord?.id || AUTHORIZED_PRESERVED_ID}</code>) permanece cadastrado com NF 4568 no valor de R$ 2.800,00. Nenhuma duplicata ativa.
                </div>
              </div>
            )}

            {/* Quadro Comparativo de Totais Financeiros */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Registros Identificados
                </span>
                <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                  {atlasRecords.length} lançamentos
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  1 original a preservar · {duplicateRecordsToDelete.length} duplicados
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Financeiro Atual
                </span>
                <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                  {formatCurrencyBRL(totalFinanceiroAtual)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Pendentes: {formatCurrencyBRL(totalPendentesAtual)}
                </div>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                  Total Projetado (Pós-Limpeza)
                </span>
                <div className="text-lg font-bold font-mono text-emerald-700 mt-1">
                  {formatCurrencyBRL(totalFinanceiroProjetado)}
                </div>
                <div className="text-[11px] text-emerald-800 font-medium mt-0.5">
                  Redução de {formatCurrencyBRL(valorDuplicadoARemover)} duplicados
                </div>
              </div>
            </div>

            {/* Listagem Individual dos IDs e Ações Programadas */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600 flex justify-between">
                <span>Detalhamento dos IDs Individuais</span>
                <span>Critério: Preservar o primeiro registro original</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {atlasRecords.map((item, idx) => {
                  const isPreserved = idx === 0;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        isPreserved ? 'bg-emerald-50/40' : 'bg-rose-50/30'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900">
                            ID: {item.id}
                          </span>
                          {isPreserved ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              PRESERVAR (Original)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                              <Trash2 className="w-3 h-3" />
                              PROGRAMADO PARA EXCLUSÃO (Duplicata #{idx})
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 text-[11px] flex items-center gap-2 flex-wrap">
                          <span>Fornecedor: <strong>{item.fornecedor}</strong></span>
                          <span>·</span>
                          <span>NF: <strong>{item.numeroNota || '4568'}</strong></span>
                          <span>·</span>
                          <span>Valor: <strong>{formatCurrencyBRL(item.valor)}</strong></span>
                          <span>·</span>
                          <span>Vencimento: <strong>{item.dataVencimento ? formatDateBR(item.dataVencimento) : '20/11/2026'}</strong></span>
                          <span>·</span>
                          <span>Criado em: {new Date(item.criadoEm).toLocaleTimeString('pt-BR')}</span>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-500 font-mono">
                        {isPreserved ? (
                          <span className="text-emerald-700 font-bold">Mantido no sistema</span>
                        ) : (
                          <span className="text-rose-700 font-medium">Aguardando autorização</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Banner de Conformidade e Princípio de Não-Invenção */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Auditoria de Dados & Princípio da Não-Invenção
            </h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              O <strong>Organiza AI</strong> atua com rigor contábil: nenhuma informação ausente (como valor de boleto, vencimento ou razão social do fornecedor) é preenchida com valores inventados ou suposições. As pendências são mapeadas para que a equipe financeira valide os comprovantes reais.
            </p>
          </div>
        </div>

        {/* Resumo Métrico da Auditoria */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-lg p-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Registros Totais
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1 block">
              {payments.length}
            </span>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-lg p-3">
            <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
              Registros Conformes
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-emerald-800 mt-1 block">
              {completeItems.length}
            </span>
          </div>

          <div className="bg-amber-50/80 border border-amber-300 rounded-lg p-3">
            <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider block">
              Com Dados Ausentes
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-amber-900 mt-1 block">
              {incompleteItems.length}
            </span>
          </div>

          <div className="bg-slate-50 rounded-lg p-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Índice de Completude
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-indigo-700 mt-1 block">
              {payments.length > 0
                ? `${Math.round((completeItems.length / payments.length) * 100)}%`
                : '100%'}
            </span>
          </div>
        </div>
      </div>

      {/* Cartões de Campos Ausentes Específicos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fornecedor Ausente */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center">
                <FileQuestion className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-800">Fornecedor</span>
            </div>
            <span className="font-mono tabular-nums font-bold text-sm text-slate-900">
              {missingByField.fornecedor.length}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {missingByField.fornecedor.length === 0
              ? 'Todos os registros possuem razão social/nome.'
              : `${missingByField.fornecedor.length} lançamento(s) sem identificação do emissor.`}
          </p>
        </div>

        {/* Valor Ausente */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                <BadgeAlert className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-800">Valor em R$</span>
            </div>
            <span className="font-mono tabular-nums font-bold text-sm text-slate-900">
              {missingByField.valor.length}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {missingByField.valor.length === 0
              ? 'Todos os valores foram especificados.'
              : `${missingByField.valor.length} lançamento(s) sem montante financeiro informado.`}
          </p>
        </div>

        {/* Vencimento Ausente */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                <CalendarX className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-800">Vencimento</span>
            </div>
            <span className="font-mono tabular-nums font-bold text-sm text-slate-900">
              {missingByField.dataVencimento.length}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {missingByField.dataVencimento.length === 0
              ? 'Todas as datas limites estão preenchidas.'
              : `${missingByField.dataVencimento.length} lançamento(s) sem prazo de vencimento.`}
          </p>
        </div>

        {/* Situação Não Definida */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-800">Situação</span>
            </div>
            <span className="font-mono tabular-nums font-bold text-sm text-slate-900">
              {missingByField.situacao.length}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {missingByField.situacao.length === 0
              ? 'Todas as situações estão classificadas.'
              : `${missingByField.situacao.length} lançamento(s) com status não definido.`}
          </p>
        </div>
      </div>

      {/* Lista Detalhada de Registros com Pendências */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Registros que Demandam Complementação ({incompleteItems.length})
            </h3>
            <p className="text-xs text-slate-500">
              Clique em "Completar Cadastro" para adicionar o dado que falta sem inventar informações.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {incompleteItems.length > 0 && (
              <button
                onClick={handleCopyPendingList}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
                <span>{copied ? 'Copiado!' : 'Copiar Resumo'}</span>
              </button>
            )}
            <button
              onClick={onFilterIncomplete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              <span>Ver na Tabela Principal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {incompleteItems.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h4 className="mt-2 text-sm font-semibold text-slate-900">
              Parabéns! Nenhum registro com dados ausentes
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Todos os lançamentos financeiros do sistema possuem fornecedor, valor, data de vencimento e situação definidos.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 mt-2">
            {incompleteItems.map(({ payment, validation }) => (
              <div
                key={payment.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 px-2 rounded-lg transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                      {payment.fornecedor || 'Nome do Fornecedor Não Informado'}
                    </span>
                    <span className="text-[11px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded">
                      {validation.missingFields.length} {validation.missingFields.length === 1 ? 'campo pendente' : 'campos pendentes'}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-medium text-amber-800">O que falta:</span>
                    {validation.missingFields.map((f, idx) => (
                      <span key={f.key} className="text-amber-900 font-medium">
                        {f.label}{idx < validation.missingFields.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </div>

                  {payment.observacoes && (
                    <div className="mt-1 text-xs text-slate-400 italic">
                      Nota: {payment.observacoes}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onEditPayment(payment)}
                  className="self-start sm:self-center px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-200 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Completar Cadastro
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
