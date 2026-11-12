/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, Menu, LayoutDashboard, BarChart3, Sparkles, FileText, BrainCircuit, AlertTriangle, ShieldCheck } from 'lucide-react';

export type ActiveTabType =
  | 'todos'
  | 'relatorios'
  | 'prioridades'
  | 'extracao'
  | 'analise'
  | 'incompletos'
  | 'auditoria';

interface HeaderProps {
  onOpenNewPayment: () => void;
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
  incompleteCount: number;
  urgentCount?: number;
  onToggleMobileMenu?: () => void;
}

const MODULE_TITLES: Record<
  ActiveTabType,
  { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }
> = {
  todos: {
    title: 'Painel Financeiro',
    subtitle: 'Acompanhamento operacional de pagamentos e fornecedores',
    icon: LayoutDashboard,
  },
  relatorios: {
    title: 'Relatórios Financeiros',
    subtitle: 'Indicadores gerenciais, gráficos e evolução mensal de caixa',
    icon: BarChart3,
  },
  prioridades: {
    title: 'Assistente de Prioridades',
    subtitle: 'Identificação inteligente de pagamentos críticos e em atraso',
    icon: Sparkles,
  },
  extracao: {
    title: 'Extrair Nota Fiscal',
    subtitle: 'Digitalização e captura automática de dados de faturas',
    icon: FileText,
  },
  analise: {
    title: 'Análise Inteligente',
    subtitle: 'Diagnóstico de consistência contábil e sugestões de fluxo',
    icon: BrainCircuit,
  },
  incompletos: {
    title: 'Registros Incompletos',
    subtitle: 'Auditoria de campos obrigatórios e dados pendentes de preenchimento',
    icon: AlertTriangle,
  },
  auditoria: {
    title: 'Auditoria de Dados',
    subtitle: 'Conferência técnica, backups e integridade de registros',
    icon: ShieldCheck,
  },
};

export const Header: React.FC<HeaderProps> = ({
  onOpenNewPayment,
  activeTab,
  onToggleMobileMenu,
}) => {
  const currentModule = MODULE_TITLES[activeTab] || MODULE_TITLES.todos;
  const ModuleIcon = currentModule.icon;

  return (
    <>
      {/* 1. Mobile Topbar (Dark Navy #172554) */}
      <header className="lg:hidden sticky top-0 z-30 bg-[#172554] text-white border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Abrir menu lateral"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#4F46E5] flex items-center justify-center text-white font-bold text-xs shadow-xs">
              OA
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              Organiza AI
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenNewPayment}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#4F46E5] hover:bg-indigo-600 rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo</span>
        </button>
      </header>

      {/* 2. Desktop Topbar Limpo (Sem excesso de links horizontais) */}
      <header className="hidden lg:flex sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-[#E2E8F0] px-6 lg:px-8 py-3.5 items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5] shrink-0">
            <ModuleIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                Módulo
              </span>
              <span className="text-slate-300">/</span>
              <h2 className="text-sm font-bold text-[#172033] tracking-tight truncate">
                {currentModule.title}
              </h2>
            </div>
            <p className="text-xs text-[#64748B] truncate">
              {currentModule.subtitle}
            </p>
          </div>
        </div>

        {/* Ação rápida secundária na barra superior desktop */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenNewPayment}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#4F46E5] hover:bg-indigo-600 rounded-lg transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Pagamento</span>
          </button>
        </div>
      </header>
    </>
  );
};
