/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, ArrowRight, Trash2, AlertTriangle } from 'lucide-react';
import { Header, ActiveTabType } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MetricCards } from './components/MetricCards';
import { IncompleteAlertBanner } from './components/IncompleteAlertBanner';
import { PaymentFilters, CompletenessFilter } from './components/PaymentFilters';
import { PaymentTable } from './components/PaymentTable';
import { PaymentModal } from './components/PaymentModal';
import { AuditPanel } from './components/AuditPanel';
import { IntelligentAnalysis } from './components/IntelligentAnalysis';
import { InvoiceExtractor } from './components/InvoiceExtractor';
import { FinancialPrioritiesAssistant } from './components/FinancialPrioritiesAssistant';
import { FinancialReports } from './components/FinancialReports';
import { PaymentRecord, PaymentStatus, validatePaymentRecord } from './types/payment';
import { INITIAL_PAYMENTS } from './data/initialPayments';
import { findDuplicatePayment } from './utils/duplicateDetector';
import { analyzeFinancialPriorities } from './utils/financialPriorities';
import { downloadPaymentsBackup } from './utils/backupManager';
import { formatCurrencyBRL, formatDateBR } from './utils/formatters';
import {
  checkDeduplicationStatus,
  executeAuthorizedAtlasCleanup,
  executeRemoveSingleAtlasDuplicate,
  TARGET_SINGLE_DUPLICATE_ID,
  DeduplicationExecutionResult,
  SingleDeduplicationResult,
} from './utils/cleanDeduplication';

export interface SavePaymentResponse {
  success: boolean;
  duplicate?: boolean;
  existingPayment?: PaymentRecord;
  payment?: PaymentRecord;
  error?: string;
}

const STORAGE_KEY = 'organiza_ai_pagamentos_v1';

export default function App() {
  // Estado principal de pagamentos (com persistência em LocalStorage)
  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Falha ao ler dados salvos, usando demonstração inicial.', e);
    }
    return INITIAL_PAYMENTS;
  });

  // Salva no localStorage quando pagamentos mudam
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payments));
    } catch (e) {
      console.warn('Falha ao salvar pagamentos no localStorage.', e);
    }
  }, [payments]);

  // Executa conferência e limpeza controlada das duplicidades autorizadas da Atlas
  useEffect(() => {
    const status = checkDeduplicationStatus(payments);
    if (status.hasTargetDuplicates && status.preservedFound) {
      const result = executeAuthorizedAtlasCleanup(payments);
      if (result.success) {
        setPayments(result.cleanPayments);
      }
    }

    // Limpeza controlada do registro duplicado remanescente pay-1793408678020
    const singleRes = executeRemoveSingleAtlasDuplicate(payments, TARGET_SINGLE_DUPLICATE_ID);
    if (singleRes.success && singleRes.targetFound) {
      setPayments(singleRes.cleanPayments);
    }
  }, []);

  const handleExecuteAtlasCleanup = (): DeduplicationExecutionResult => {
    const result = executeAuthorizedAtlasCleanup(payments);
    if (result.success) {
      setPayments(result.cleanPayments);
    }
    return result;
  };

  const handleRemoveSingleDuplicate = (): SingleDeduplicationResult => {
    const res = executeRemoveSingleAtlasDuplicate(payments, TARGET_SINGLE_DUPLICATE_ID);
    if (res.success && res.targetFound) {
      setPayments(res.cleanPayments);
    }
    return res;
  };

  // Controle de navegação e abas
  const [activeTab, setActiveTab] = useState<ActiveTabType>('todos');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filtros de busca e visualização
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'todas'>('todas');
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilter>('todos');
  const [sortBy, setSortBy] = useState<'dataVencimento' | 'valor' | 'fornecedor' | 'completeness'>('completeness');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal de cadastro / edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);

  // Sincroniza filtro rápido quando clica na aba "Registros Incompletos"
  useEffect(() => {
    if (activeTab === 'incompletos') {
      setCompletenessFilter('incompletos');
    } else if (activeTab === 'todos' && completenessFilter === 'incompletos') {
      // mantém caso o usuário tenha escolhido manualmente
    }
  }, [activeTab]);

  // Contagem de incompletos total
  const incompleteCount = useMemo(() => {
    return payments.filter((p) => validatePaymentRecord(p).isIncomplete).length;
  }, [payments]);

  // Análise dinâmica do Assistente de Prioridades Financeiras
  const prioritiesReport = useMemo(() => {
    return analyzeFinancialPriorities(payments);
  }, [payments]);

  // Contagem de alertas urgentes para destaque visual no topo
  const urgentCount = useMemo(() => {
    return (
      prioritiesReport.categorias.atrasados.quantidade +
      prioritiesReport.categorias.venceHoje.quantidade
    );
  }, [prioritiesReport]);

  // Filtragem e ordenação dos dados
  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      // 1. Busca textual (nome do fornecedor, observações, categoria)
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const fornecedorMatch = payment.fornecedor.toLowerCase().includes(query);
        const obsMatch = payment.observacoes?.toLowerCase().includes(query);
        const catMatch = payment.categoria?.toLowerCase().includes(query);
        if (!fornecedorMatch && !obsMatch && !catMatch) {
          return false;
        }
      }

      // 2. Filtro por situação
      if (statusFilter !== 'todas') {
        if (payment.situacao !== statusFilter) {
          return false;
        }
      }

      // 3. Filtro por integridade / completude
      if (completenessFilter === 'incompletos') {
        const validation = validatePaymentRecord(payment);
        if (!validation.isIncomplete) return false;
      } else if (completenessFilter === 'completos') {
        const validation = validatePaymentRecord(payment);
        if (validation.isIncomplete) return false;
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'completeness') {
        const valA = validatePaymentRecord(a).isIncomplete ? 1 : 0;
        const valB = validatePaymentRecord(b).isIncomplete ? 1 : 0;
        comparison = valB - valA; // Incompletos primeiro por padrão
      } else if (sortBy === 'valor') {
        const vA = a.valor ?? -1;
        const vB = b.valor ?? -1;
        comparison = vA - vB;
      } else if (sortBy === 'dataVencimento') {
        const dateA = a.dataVencimento || '9999-99-99';
        const dateB = b.dataVencimento || '9999-99-99';
        comparison = dateA.localeCompare(dateB);
      } else if (sortBy === 'fornecedor') {
        comparison = a.fornecedor.localeCompare(b.fornecedor);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [payments, searchTerm, statusFilter, completenessFilter, sortBy, sortOrder]);

  // Handlers
  const handleOpenNewPayment = () => {
    setEditingPayment(null);
    setIsModalOpen(true);
  };

  const handleEditPayment = (payment: PaymentRecord) => {
    setEditingPayment(payment);
    setIsModalOpen(true);
  };

  // Modal de confirmação in-app para exclusão de lançamentos
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentRecord | null>(null);

  const handleRequestDeletePayment = (id: string) => {
    const target = payments.find((p) => p.id === id);
    if (target) {
      setPaymentToDelete(target);
    }
  };

  const handleConfirmDelete = () => {
    if (paymentToDelete) {
      const idToRemove = paymentToDelete.id;
      setPayments((prev) => prev.filter((p) => p.id !== idToRemove));
      setPaymentToDelete(null);
      if (editingPayment?.id === idToRemove) {
        setIsModalOpen(false);
        setEditingPayment(null);
      }
    }
  };

  const handleDeleteDirectly = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
    if (editingPayment?.id === id) {
      setIsModalOpen(false);
      setEditingPayment(null);
    }
  };

  const handleToggleStatus = (id: string, newStatus: PaymentStatus) => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              situacao: newStatus,
              atualizadoEm: new Date().toISOString(),
            }
          : p
      )
    );
  };

  const handleSavePayment = (paymentData: Partial<PaymentRecord>): SavePaymentResponse => {
    const now = new Date().toISOString();

    if (paymentData.id) {
      // Atualização
      const dup = findDuplicatePayment(payments, paymentData, paymentData.id);
      if (dup.isDuplicate && dup.existingPayment) {
        return {
          success: false,
          duplicate: true,
          existingPayment: dup.existingPayment,
          error: dup.summary,
        };
      }

      setPayments((prev) =>
        prev.map((p) =>
          p.id === paymentData.id
            ? {
                ...p,
                fornecedor: paymentData.fornecedor ?? p.fornecedor,
                valor: paymentData.valor !== undefined ? paymentData.valor : p.valor,
                dataVencimento:
                  paymentData.dataVencimento !== undefined
                    ? paymentData.dataVencimento
                    : p.dataVencimento,
                situacao: paymentData.situacao ?? p.situacao,
                categoria: paymentData.categoria,
                observacoes: paymentData.observacoes,
                numeroNota: paymentData.numeroNota ?? p.numeroNota,
                atualizadoEm: now,
              }
            : p
        )
      );
      return { success: true };
    } else {
      // Novo registro: verificação rigorosa de duplicidade
      const dup = findDuplicatePayment(payments, paymentData);
      if (dup.isDuplicate && dup.existingPayment) {
        return {
          success: false,
          duplicate: true,
          existingPayment: dup.existingPayment,
          error: dup.summary,
        };
      }

      const newPayment: PaymentRecord = {
        id: `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        fornecedor: paymentData.fornecedor ?? '',
        valor: paymentData.valor !== undefined ? paymentData.valor : null,
        dataVencimento: paymentData.dataVencimento || null,
        situacao: paymentData.situacao ?? 'indefinida',
        categoria: paymentData.categoria,
        observacoes: paymentData.observacoes,
        numeroNota: paymentData.numeroNota,
        criadoEm: now,
        atualizadoEm: now,
      };

      setPayments((prev) => [newPayment, ...prev]);
      return { success: true, payment: newPayment };
    }
  };

  const handleResetDemoData = () => {
    if (window.confirm('Deseja restaurar os registros de exemplo fictícios iniciais?')) {
      setPayments(INITIAL_PAYMENTS);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Exportação para formato CSV compatível com Excel brasileiro
  const handleExportCSV = () => {
    const headers = [
      'Fornecedor',
      'Valor (R$)',
      'Data de Vencimento',
      'Situação',
      'Integridade do Registro',
      'Campos Ausentes',
      'Categoria',
      'Observações',
    ];

    const rows = filteredPayments.map((p) => {
      const validation = validatePaymentRecord(p);
      const missingStr = validation.missingFields.map((f) => f.label).join(' | ');

      return [
        `"${p.fornecedor.replace(/"/g, '""')}"`,
        p.valor !== null && !isNaN(p.valor) ? p.valor.toFixed(2).replace('.', ',') : '"Não informado"',
        p.dataVencimento || '"Não informada"',
        `"${p.situacao}"`,
        validation.isIncomplete ? '"Incompleto"' : '"Completo"',
        `"${missingStr}"`,
        `"${(p.categoria || '').replace(/"/g, '""')}"`,
        `"${(p.observacoes || '').replace(/"/g, '""')}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `organiza_ai_pagamentos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col lg:flex-row font-sans text-[#172033]">
      {/* Menu Lateral Azul-Marinho (#172554) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewPayment={handleOpenNewPayment}
        incompleteCount={incompleteCount}
        urgentCount={urgentCount}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Área de Conteúdo Principal (Clara) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra Superior Responsiva */}
        <Header
          onOpenNewPayment={handleOpenNewPayment}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          incompleteCount={incompleteCount}
          urgentCount={urgentCount}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        />

        {/* Conteúdo Principal */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {/* Contexto Mobile (Cabeçalho principal no Header.tsx) */}
          <div className="lg:hidden">
            <h1 className="text-base font-bold text-[#172033]">
              {activeTab === 'relatorios'
                ? 'Relatórios Financeiros'
                : activeTab === 'prioridades'
                ? 'Assistente de Prioridades'
                : activeTab === 'extracao'
                ? 'Extrair Nota Fiscal'
                : activeTab === 'analise'
                ? 'Análise Inteligente'
                : activeTab === 'auditoria'
                ? 'Auditoria de Campos'
                : activeTab === 'incompletos'
                ? 'Registros Incompletos'
                : 'Painel Financeiro'}
            </h1>
          </div>

        {/* 1. Cartões Métricos Principais */}
        <MetricCards
          payments={payments}
          onSelectIncompleteFilter={() => {
            setActiveTab('todos');
            setCompletenessFilter('incompletos');
          }}
        />

        {/* 2. Banner de Destaque para Informações Ausentes (Sem inventar dados) */}
        <IncompleteAlertBanner
          payments={payments}
          onFilterIncomplete={() => {
            setActiveTab('todos');
            setCompletenessFilter('incompletos');
          }}
          onOpenAudit={() => setActiveTab('auditoria')}
          isFilterActive={completenessFilter === 'incompletos'}
          onClearFilter={() => setCompletenessFilter('todos')}
        />

        {/* Visualização de Abas: Painel Tabela vs Relatórios vs Prioridades vs Extrair NF vs Análise vs Auditoria */}
        {activeTab === 'relatorios' ? (
          <FinancialReports
            payments={payments}
            onEditPayment={handleEditPayment}
            onNavigateToTab={setActiveTab}
          />
        ) : activeTab === 'prioridades' ? (
          <FinancialPrioritiesAssistant
            payments={payments}
            onEditPayment={handleEditPayment}
            onToggleStatus={handleToggleStatus}
            onNavigateToTab={setActiveTab}
          />
        ) : activeTab === 'extracao' ? (
          <InvoiceExtractor
            existingPayments={payments}
            onAddPayment={handleSavePayment}
            onNavigateToTab={setActiveTab}
          />
        ) : activeTab === 'analise' ? (
          <IntelligentAnalysis
            payments={payments}
            onEditPayment={handleEditPayment}
            onNavigateToTab={setActiveTab}
          />
        ) : activeTab === 'auditoria' ? (
          <AuditPanel
            payments={payments}
            onEditPayment={handleEditPayment}
            onFilterIncomplete={() => {
              setActiveTab('todos');
              setCompletenessFilter('incompletos');
            }}
            onRestorePayments={(restored) => setPayments(restored)}
            onExecuteAtlasCleanup={handleExecuteAtlasCleanup}
            onRemoveSingleDuplicate={handleRemoveSingleDuplicate}
          />
        ) : (
          <div className="space-y-4">
            {/* Widget Inteligente: Resumo de Prioridades e Urgências */}
            <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-[#4F46E5] flex items-center justify-center shrink-0 shadow-2xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#172033]">
                      Assistente de Prioridades
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[#4F46E5]">
                      Radar Ativo
                    </span>
                    {urgentCount > 0 && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold animate-pulse">
                        {urgentCount} {urgentCount === 1 ? 'urgência' : 'urgências'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Monitoramento contínuo de vencimentos críticos, prazos e integridade de caixa
                  </p>
                </div>
              </div>

              {/* Indicadores Visuais de Criticidade em Pílulas */}
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    prioritiesReport.categorias.atrasados.quantidade > 0
                      ? 'bg-rose-50 border-rose-200 text-rose-800 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                  title={`${prioritiesReport.categorias.atrasados.quantidade} pagamento(s) em atraso`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${prioritiesReport.categorias.atrasados.quantidade > 0 ? 'bg-rose-500' : 'bg-slate-400'}`} />
                  <span>
                    <strong className="font-bold tabular-nums">{prioritiesReport.categorias.atrasados.quantidade}</strong> em atraso
                  </span>
                </div>

                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    prioritiesReport.categorias.venceHoje.quantidade > 0
                      ? 'bg-amber-50 border-amber-200 text-amber-900 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                  title={`${prioritiesReport.categorias.venceHoje.quantidade} pagamento(s) vencem hoje`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${prioritiesReport.categorias.venceHoje.quantidade > 0 ? 'bg-amber-500' : 'bg-slate-400'}`} />
                  <span>
                    <strong className="font-bold tabular-nums">{prioritiesReport.categorias.venceHoje.quantidade}</strong> hoje
                  </span>
                </div>

                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    prioritiesReport.categorias.proximos7Dias.quantidade > 0
                      ? 'bg-sky-50 border-sky-200 text-sky-900 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                  title={`${prioritiesReport.categorias.proximos7Dias.quantidade} pagamento(s) nos próximos 7 dias`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${prioritiesReport.categorias.proximos7Dias.quantidade > 0 ? 'bg-sky-500' : 'bg-slate-400'}`} />
                  <span>
                    <strong className="font-bold tabular-nums">{prioritiesReport.categorias.proximos7Dias.quantidade}</strong> em 7 dias
                  </span>
                </div>

                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    prioritiesReport.categorias.incompletos.quantidade > 0
                      ? 'bg-amber-50/70 border-amber-200 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                  title={`${prioritiesReport.categorias.incompletos.quantidade} registro(s) incompleto(s)`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${prioritiesReport.categorias.incompletos.quantidade > 0 ? 'bg-amber-400' : 'bg-slate-400'}`} />
                  <span>
                    <strong className="font-bold tabular-nums">{prioritiesReport.categorias.incompletos.quantidade}</strong> incompletos
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('prioridades')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#4F46E5] hover:bg-indigo-600 transition-colors shadow-2xs shrink-0 ml-auto lg:ml-0"
                >
                  <span>Abrir Assistente</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Filtros e Ordenação */}
            <PaymentFilters
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              completenessFilter={completenessFilter}
              setCompletenessFilter={setCompletenessFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              onExportCSV={handleExportCSV}
              onDownloadBackup={() => downloadPaymentsBackup(payments)}
              onResetDemoData={handleResetDemoData}
              totalFilteredCount={filteredPayments.length}
            />

            {/* Tabela de Lançamentos */}
            <PaymentTable
              payments={filteredPayments}
              onEditPayment={handleEditPayment}
              onDeletePayment={handleRequestDeletePayment}
              onToggleStatus={handleToggleStatus}
              onOpenNewPayment={handleOpenNewPayment}
            />
          </div>
        )}
      </main>

      {/* Modal para Adicionar ou Editar Pagamento */}
      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPayment(null);
        }}
        onSave={handleSavePayment}
        onDelete={handleDeleteDirectly}
        initialPayment={editingPayment}
      />

      {/* Modal de Confirmação In-App para Exclusão de Lançamento */}
      {paymentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-fadeIn"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
          >
            <div className="p-6">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 id="delete-confirm-title" className="text-base font-bold text-slate-900">
                    Confirmar Exclusão de Lançamento
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Deseja realmente remover este lançamento da sua planilha ativa de pagamentos? Esta ação não pode ser desfeita.
                  </p>

                  <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 shrink-0">Fornecedor:</span>
                      <span className="font-semibold text-slate-800 text-right truncate">
                        {paymentToDelete.fornecedor || 'Fornecedor não informado'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 shrink-0">Valor:</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        {formatCurrencyBRL(paymentToDelete.valor)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 shrink-0">Vencimento:</span>
                      <span className="font-semibold text-slate-800">
                        {formatDateBR(paymentToDelete.dataVencimento)}
                      </span>
                    </div>
                    {paymentToDelete.categoria && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 shrink-0">Categoria:</span>
                        <span className="text-slate-700">{paymentToDelete.categoria}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentToDelete(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sim, excluir lançamento</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé institucional quieto sem telemetria inventada */}
      <footer className="border-t border-[#E2E8F0] bg-white py-6 mt-12 text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#172033]">Organiza AI</span>
            <span>·</span>
            <span>Assistente Administrativo & Financeiro</span>
          </div>
          <div className="text-[#64748B] text-center sm:text-right">
            Identidade visual híbrida · Fundo claro #F1F5F9 · Navegação azul-marinho #172554
          </div>
        </div>
      </footer>
    </div>
  </div>
  );
}
