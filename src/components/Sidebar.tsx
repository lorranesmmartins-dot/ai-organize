/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  BarChart3,
  Sparkles,
  FileText,
  BrainCircuit,
  AlertTriangle,
  ShieldCheck,
  Plus,
  X,
  CheckCircle2,
} from 'lucide-react';
import { ActiveTabType } from './Header';

interface SidebarProps {
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
  onOpenNewPayment: () => void;
  incompleteCount: number;
  urgentCount?: number;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

interface NavItem {
  id: ActiveTabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
  badgeType?: 'urgent' | 'warning';
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewPayment,
  incompleteCount,
  urgentCount,
  mobileOpen,
  setMobileOpen,
}) => {
  const navItems: NavItem[] = [
    {
      id: 'todos',
      label: 'Painel Financeiro',
      icon: LayoutDashboard,
    },
    {
      id: 'relatorios',
      label: 'Relatórios Financeiros',
      icon: BarChart3,
    },
    {
      id: 'prioridades',
      label: 'Assistente de Prioridades',
      icon: Sparkles,
      badgeCount: urgentCount && urgentCount > 0 ? urgentCount : undefined,
      badgeType: 'urgent',
    },
    {
      id: 'extracao',
      label: 'Extrair Nota Fiscal',
      icon: FileText,
    },
    {
      id: 'analise',
      label: 'Análise Inteligente',
      icon: BrainCircuit,
    },
    {
      id: 'incompletos',
      label: 'Registros Incompletos',
      icon: AlertTriangle,
      badgeCount: incompleteCount > 0 ? incompleteCount : undefined,
      badgeType: 'warning',
    },
    {
      id: 'auditoria',
      label: 'Auditoria de Campos',
      icon: ShieldCheck,
    },
  ];

  const handleSelectTab = (id: ActiveTabType) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  const content = (
    <div className="flex flex-col h-full bg-[#172554] text-white">
      {/* 1. Identidade e Logotipo Organiza AI */}
      <div className="p-5 flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white font-black text-sm tracking-wider shadow-md shadow-indigo-900/40">
            OA
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-tight">
              Organiza AI
            </h1>
            <span className="text-[11px] font-medium text-slate-400 block tracking-wide">
              Gestão Financeira
            </span>
          </div>
        </div>

        {/* Botão fechar para mobile */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Botão de Ação Primária: Novo Pagamento */}
      <div className="p-4 shrink-0">
        <button
          type="button"
          onClick={() => {
            onOpenNewPayment();
            setMobileOpen(false);
          }}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#4F46E5] hover:bg-indigo-600 active:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-950/50 hover:shadow-indigo-600/30 group"
        >
          <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
          <span>Novo Pagamento</span>
        </button>
      </div>

      {/* 3. Navegação Vertical com Ícones e Destaque */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Módulos do Sistema
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTab(item.id)}
              className={`relative w-full flex items-center justify-between pl-3.5 pr-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-[#4F46E5]/15 text-white font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {/* Barra indicadora discreta de 3px na borda esquerda do item ativo */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[#4F46E5] rounded-r-full shadow-[0_0_8px_rgba(79,70,229,0.7)]"
                />
              )}

              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {/* Badges de Alerta / Incompletos */}
              {item.badgeCount !== undefined && (
                <span
                  className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 tabular-nums ${
                    item.badgeType === 'urgent'
                      ? 'bg-rose-500 text-white'
                      : 'bg-amber-400 text-slate-950'
                  }`}
                  title={`${item.badgeCount} pendência(s)`}
                >
                  {item.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 4. Rodapé Estrutural com Indicador Positivo Verde-Azulado (#0D9488) */}
      <div className="p-4 border-t border-white/10 shrink-0 bg-[#0f172a]/40">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0D9488] ring-4 ring-teal-900/60 shrink-0 animate-pulse" />
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-200 block truncate">
              Base Operacional Ativa
            </span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[#0D9488]" />
              Dados validados
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Sidebar Desktop Fixa/Sticky */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:h-screen lg:sticky lg:top-0 shrink-0 z-20 border-r border-slate-800">
        {content}
      </aside>

      {/* Drawer Mobile com Backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop escurecido */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />

          {/* Painel lateral deslizante */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
