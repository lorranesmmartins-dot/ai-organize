/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Search, Download, RotateCcw, FileJson } from 'lucide-react';
import { PaymentStatus } from '../types/payment';

export type CompletenessFilter = 'todos' | 'incompletos' | 'completos';

interface PaymentFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: PaymentStatus | 'todas';
  setStatusFilter: (status: PaymentStatus | 'todas') => void;
  completenessFilter: CompletenessFilter;
  setCompletenessFilter: (filter: CompletenessFilter) => void;
  sortBy: 'dataVencimento' | 'valor' | 'fornecedor' | 'completeness';
  setSortBy: (sort: 'dataVencimento' | 'valor' | 'fornecedor' | 'completeness') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
  onExportCSV: () => void;
  onDownloadBackup?: () => void;
  onResetDemoData: () => void;
  totalFilteredCount: number;
}

export const PaymentFilters: React.FC<PaymentFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  completenessFilter,
  setCompletenessFilter,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  onExportCSV,
  onDownloadBackup,
  onResetDemoData,
  totalFilteredCount,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs space-y-3.5">
      {/* Linha Superior: Busca e Ações Rápidas */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Campo de Busca Principal */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por fornecedor, NF, categoria ou notas..."
            className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-slate-600 px-1 py-0.5 rounded"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Ações: Exportar CSV (Único no Painel), Backup JSON e Restaurar */}
        <div className="flex items-center gap-2 self-end lg:self-auto shrink-0 flex-wrap">
          <button
            type="button"
            onClick={onExportCSV}
            title="Exportar registros filtrados para arquivo CSV compatível com Excel"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exportar CSV</span>
          </button>

          {onDownloadBackup && (
            <button
              type="button"
              onClick={onDownloadBackup}
              title="Baixar cópia de segurança completa em JSON da chave do sistema"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-800 bg-emerald-50/70 border border-emerald-200 hover:bg-emerald-100/70 rounded-lg transition-colors"
            >
              <FileJson className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Backup</span> <span>(JSON)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onResetDemoData}
            title="Restaurar dados de exemplo fictícios"
            className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Restaurar</span>
          </button>
        </div>
      </div>

      {/* Linha Inferior: Segmentação de Integridade, Filtros e Ordenação */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
        {/* Filtros de Integridade de Dados (Completude) em Segmented Control */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100/90 rounded-lg max-w-full">
          <button
            type="button"
            onClick={() => setCompletenessFilter('todos')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
              completenessFilter === 'todos'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos os Lançamentos
          </button>
          <button
            type="button"
            onClick={() => setCompletenessFilter('incompletos')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              completenessFilter === 'incompletos'
                ? 'bg-amber-100 text-amber-950 shadow-2xs font-bold'
                : 'text-amber-800 hover:text-amber-950'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Com Dados Ausentes</span>
          </button>
          <button
            type="button"
            onClick={() => setCompletenessFilter('completos')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
              completenessFilter === 'completos'
                ? 'bg-white text-emerald-800 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Apenas Completos
          </button>
        </div>

        {/* Filtro por Situação, Ordenação e Contagem de Registros */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-slate-600">Situação:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'todas')}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#4F46E5] focus:border-[#4F46E5]"
            >
              <option value="todas">Todas as situações</option>
              <option value="pendente">Pendente</option>
              <option value="agendado">Agendado</option>
              <option value="pago">Pago</option>
              <option value="vencido">Em atraso</option>
              <option value="indefinida">Não definida (ausente)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-slate-600">Ordenar:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#4F46E5] focus:border-[#4F46E5]"
            >
              <option value="completeness">Prioridade (Incompletos primeiro)</option>
              <option value="dataVencimento">Data de Vencimento</option>
              <option value="valor">Valor</option>
              <option value="fornecedor">Nome do Fornecedor</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
              title={sortOrder === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'}
            >
              {sortOrder === 'asc' ? '↑ Cresc.' : '↓ Decresc.'}
            </button>
          </div>

          <span className="text-xs font-mono tabular-nums text-slate-600 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 font-medium ml-1">
            {totalFilteredCount} {totalFilteredCount === 1 ? 'registro' : 'registros'}
          </span>
        </div>
      </div>
    </div>
  );
};
