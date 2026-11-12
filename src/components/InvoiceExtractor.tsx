/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  FileText,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Plus,
  Bot,
  Cpu,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Check,
  RotateCcw,
  Building2,
  Calendar,
  Layers,
  CreditCard,
  Hash,
  X,
} from 'lucide-react';
import {
  extractInvoiceData,
  ExtractedInvoiceData,
  CandidateValue,
  CandidateDueDate,
} from '../utils/invoiceExtractor';
import { PaymentRecord, PaymentStatus } from '../types/payment';
import { formatCurrencyBRL, formatDateBR } from '../utils/formatters';
import {
  findDuplicatePayment,
  extractInvoiceNumber,
  DuplicateCheckResult,
} from '../utils/duplicateDetector';
import { SavePaymentResponse } from '../App';

interface InvoiceExtractorProps {
  existingPayments?: PaymentRecord[];
  onAddPayment: (payment: Partial<PaymentRecord>) => SavePaymentResponse | void;
  onNavigateToTab: (tab: 'todos' | 'analise' | 'incompletos' | 'auditoria') => void;
}

// 4 CENÁRIOS DE TESTE OBRIGATÓRIOS (100% FICTÍCIOS)
export const TEST_SCENARIOS = [
  {
    id: 'cenario-1',
    badge: 'Cenário 1',
    title: 'Valor e vencimento únicos',
    description: 'Documento padrão com valor total e prazo de vencimento definidos.',
    text: `DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA - DANFE
Nº da Nota: 84920 - Série: 1
Emitente: Ômega Papéis e Embalagens Fictícia Ltda
CNPJ: 00.123.456/0001-99
Data de Emissão: 28/10/2026

DADOS DE COBRANÇA
Fatura / Duplicata Nº 84920/01
Data de Vencimento: 12/11/2026
Valor da Nota: R$ 2.450,00

DETALHAMENTO DOS ITENS
- 50 caixas de papelão ondulado reforçado 60x40x40 (Subtotal: R$ 2.450,00)
Base de Cálculo ICMS: R$ 2.450,00 | Valor ICMS: R$ 441,00
Total da NF: R$ 2.450,00
Total a Pagar: R$ 2.450,00`,
  },
  {
    id: 'cenario-2',
    badge: 'Cenário 2',
    title: 'Sem valor e sem vencimento',
    description: 'Ordem de serviço sem valores monetários e sem data limite para quitação.',
    text: `ORDEM DE SERVIÇO E AUTORIZAÇÃO DE FORNECIMENTO
Razão Social: Nexus Manutenção Industrial Fictícia Ltda
CNPJ: 44.555.666/0001-33
Data de Abertura: 29/10/2026

SERVIÇOS PRESTADOS:
- Vistoria técnica preventiva em compressores de ar do galpão B
- Lubrificação de esteiras rolantes e troca de filtros de retenção

CONDIÇÕES CONTRATUAIS:
- Faturamento posterior mediante relatório de horas trabalhadas da equipe
- Valor e data de vencimento a definir após homologação da medição técnica`,
  },
  {
    id: 'cenario-3',
    badge: 'Cenário 3',
    title: 'Valores divergentes (R$ 2.800 vs R$ 3.200)',
    description: 'Documento com valores de cobrança conflitantes (exige conferência humana).',
    text: `DOCUMENTO DE FATURAMENTO E COBRANÇA DE SERVIÇOS
Emitente: Orion Tecnologia & Soluções Fictícia S.A.
CNPJ: 11.222.333/0001-88
Data de Emissão: 27/10/2026

DEMONSTRATIVO DE FATURA / COBRANÇA:
Documento Fiscal nº 10934
Data de Vencimento: 18/11/2026

QUADRO DE VALORES:
- Valor da Fatura de Serviços: R$ 2.800,00
- Adicional de licenças extraordinárias: R$ 400,00
- Total a Pagar no Boleto Bancário: R$ 3.200,00
(Atenção setor financeiro: conferir se a cobrança é de R$ 2.800,00 ou R$ 3.200,00)`,
  },
  {
    id: 'cenario-4',
    badge: 'Cenário 4',
    title: 'Datas divergentes (15/11 vs 20/11)',
    description: 'Documento apresentando duas datas de vencimento conflitantes.',
    text: `NOTA FISCAL E DUPLICATA DE FORNECIMENTO
Razão Social: Vanguarda Comércio e Distribuição Fictícia Ltda
CNPJ: 77.888.999/0001-22
Valor Total dos Produtos: R$ 1.950,00
Total a Pagar: R$ 1.950,00

INFORMAÇÕES DE VENCIMENTO DO PAGAMENTO:
- Vencimento constante no corpo da Fatura: 15/11/2026
- Vencimento impresso no Boleto Bancário anexado: 20/11/2026
(Conferir com o fornecedor qual é a data limite válida para quitação sem juros)`,
  },
];

const CATEGORIAS_PADRAO = [
  'Nota Fiscal / Fatura',
  'Materiais de Escritório',
  'Tecnologia',
  'Logística',
  'Serviços Gerais',
  'Consultoria',
  'Infraestrutura',
  'Outros',
];

/**
 * Avalia de forma conservadora se o documento apresenta evidências explícitas
 * de que ainda aguarda faturamento posterior, medição técnica ou homologação contratual.
 */
function shouldSuggestIndefinida(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  return (
    lower.includes('faturamento posterior') ||
    lower.includes('faturar posteriormente') ||
    lower.includes('medição técnica') ||
    lower.includes('medicao tecnica') ||
    lower.includes('homologação da medição') ||
    lower.includes('homologacao da medicao') ||
    lower.includes('aguardando medição') ||
    lower.includes('aguardando medicao') ||
    lower.includes('a definir após homologação') ||
    lower.includes('a definir apos homologacao') ||
    (lower.includes('ordem de serviço') && (lower.includes('a definir') || lower.includes('posterior')))
  );
}

export const InvoiceExtractor: React.FC<InvoiceExtractorProps> = ({
  existingPayments = [],
  onAddPayment,
  onNavigateToTab,
}) => {
  const [invoiceText, setInvoiceText] = useState<string>('');
  const [hasExtracted, setHasExtracted] = useState<boolean>(false);
  const [extractedData, setExtractedData] = useState<ExtractedInvoiceData | null>(null);

  // Modo de extração: 'gemini' (IA generativa via backend) ou 'rules' (regras locais)
  const [extractionMode, setExtractionMode] = useState<'gemini' | 'rules'>('gemini');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [extractedVia, setExtractedVia] = useState<string>('');
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);

  // Campos editáveis reorganizados nos 3 Grupos Visuais de Conferência
  // Grupo A: Identificação do Documento
  const [editNumeroNota, setEditNumeroNota] = useState<string>('');
  const [editFornecedor, setEditFornecedor] = useState<string>('');

  // Grupo B: Condições Financeiras
  const [editValorStr, setEditValorStr] = useState<string>('');
  const [editVencimento, setEditVencimento] = useState<string>('');
  const [editSituacao, setEditSituacao] = useState<PaymentStatus>('pendente');

  // Grupo C: Classificação Gerencial
  const [editCategoria, setEditCategoria] = useState<string>('Nota Fiscal / Fatura');
  const [editObservacoes, setEditObservacoes] = useState<string>('');

  // Rastreamento explícito de resolução humana de divergências
  const [valorSelectedFromDivergence, setValorSelectedFromDivergence] = useState<number | null>(null);
  const [isValorManualResolution, setIsValorManualResolution] = useState<boolean>(false);

  const [vencimentoSelectedFromDivergence, setVencimentoSelectedFromDivergence] = useState<string | null>(null);
  const [isVencimentoManualResolution, setIsVencimentoManualResolution] = useState<boolean>(false);

  // Mensagem de bloqueio de divergência pendente
  const [divergenceValidationError, setDivergenceValidationError] = useState<string | null>(null);

  // Feedback de confirmação
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Proteção contra múltiplos cliques, reenvio e duplicidade
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [savedPayment, setSavedPayment] = useState<PaymentRecord | null>(null);
  const [duplicateDetected, setDuplicateDetected] = useState<DuplicateCheckResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Lógica de cálculo de resolução das divergências
  const isValorResolved = Boolean(
    !extractedData?.temDivergenciaValor ||
    valorSelectedFromDivergence !== null ||
    (isValorManualResolution && editValorStr.trim() !== '')
  );

  const isVencimentoResolved = Boolean(
    !extractedData?.temDivergenciaVencimento ||
    vencimentoSelectedFromDivergence !== null ||
    (isVencimentoManualResolution && editVencimento.trim() !== '')
  );

  const isValorDivergenceUnresolved = Boolean(
    extractedData?.temDivergenciaValor && !isValorResolved
  );

  const isVencimentoDivergenceUnresolved = Boolean(
    extractedData?.temDivergenciaVencimento && !isVencimentoResolved
  );

  const hasUnresolvedDivergence = Boolean(
    isValorDivergenceUnresolved || isVencimentoDivergenceUnresolved
  );

  // Ação de extração usando o modo selecionado
  const handleExtract = async () => {
    if (!invoiceText.trim()) return;

    setIsLoading(true);
    setApiErrorMessage(null);
    setSuccessMessage(null);
    setValorSelectedFromDivergence(null);
    setIsValorManualResolution(false);
    setVencimentoSelectedFromDivergence(null);
    setIsVencimentoManualResolution(false);
    setDivergenceValidationError(null);
    setIsSaved(false);
    setSavedPayment(null);
    setDuplicateDetected(null);
    setSaveError(null);
    setIsSubmitting(false);
    isSubmittingRef.current = false;

    if (extractionMode === 'gemini') {
      try {
        const response = await fetch('/api/extrair-nota-gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: invoiceText }),
        });

        const result = await response.json();

        if (result.success && result.data) {
          const data: ExtractedInvoiceData = {
            fornecedor: result.data.fornecedor,
            valor: result.data.valor,
            temDivergenciaValor: Boolean(result.data.temDivergenciaValor),
            valoresCandidatos: result.data.valoresCandidatos || [],
            dataVencimento: result.data.dataVencimento,
            temDivergenciaVencimento: Boolean(result.data.temDivergenciaVencimento),
            vencimentosCandidatos: result.data.vencimentosCandidatos || [],
            numeroNota: result.data.numeroNota,
            observacoes: result.data.observacoes,
          };

          setExtractedData(data);
          setExtractedVia(`Gemini AI (${result.modelUsed || 'Flash'})`);
          setHasExtracted(true);

          // Grupo A
          setEditNumeroNota(data.numeroNota || '');
          setEditFornecedor(data.fornecedor || '');

          // Grupo B (Preserva editValorStr === '' quando null ou divergência)
          setEditValorStr(data.temDivergenciaValor ? '' : data.valor !== null ? String(data.valor) : '');
          setEditVencimento(data.temDivergenciaVencimento ? '' : data.dataVencimento || '');
          setEditSituacao(shouldSuggestIndefinida(invoiceText) ? 'indefinida' : 'pendente');

          // Grupo C
          setEditCategoria('Nota Fiscal / Fatura');
          let obs = '';
          if (data.numeroNota) obs = `NF nº ${data.numeroNota}`;
          if (data.temDivergenciaValor) {
            obs += obs ? ' · Divergência de valores detectada' : 'Divergência de valores detectada';
          }
          if (data.temDivergenciaVencimento) {
            obs += obs ? ' · Divergência de vencimento detectada' : 'Divergência de vencimento detectada';
          }
          if (data.observacoes) {
            obs += ` · ${data.observacoes}`;
          }
          setEditObservacoes(obs);
          setIsLoading(false);
          return;
        } else {
          throw new Error(result.message || 'Falha ao processar com Gemini.');
        }
      } catch (err: any) {
        console.warn('Erro ao consultar Gemini, caindo para regras:', err);
        setApiErrorMessage(err?.message || 'Falha ao conectar com o modelo Gemini.');
        setIsLoading(false);
        return;
      }
    }

    // Modo por Regras Locais Determinísticas
    executeRulesExtraction();
    setIsLoading(false);
  };

  const executeRulesExtraction = () => {
    const result = extractInvoiceData(invoiceText);
    setExtractedData(result);
    setExtractedVia('Regras Automáticas Locais');
    setHasExtracted(true);
    setApiErrorMessage(null);
    setValorSelectedFromDivergence(null);
    setIsValorManualResolution(false);
    setVencimentoSelectedFromDivergence(null);
    setIsVencimentoManualResolution(false);
    setDivergenceValidationError(null);
    setIsSaved(false);
    setSavedPayment(null);
    setDuplicateDetected(null);
    setSaveError(null);
    setIsSubmitting(false);
    isSubmittingRef.current = false;

    // Grupo A
    setEditNumeroNota(result.numeroNota || '');
    setEditFornecedor(result.fornecedor || '');

    // Grupo B (Preserva editValorStr === '' quando null ou divergência)
    setEditValorStr(result.temDivergenciaValor ? '' : result.valor !== null ? String(result.valor) : '');
    setEditVencimento(result.temDivergenciaVencimento ? '' : result.dataVencimento || '');
    setEditSituacao(shouldSuggestIndefinida(invoiceText) ? 'indefinida' : 'pendente');

    // Grupo C
    setEditCategoria('Nota Fiscal / Fatura');
    let obs = '';
    if (result.numeroNota) {
      obs = `NF nº ${result.numeroNota}`;
    }
    if (result.temDivergenciaValor) {
      obs += obs ? ' · Divergência de valores identificada' : 'Divergência de valores identificada';
    }
    if (result.temDivergenciaVencimento) {
      obs += obs ? ' · Divergência de vencimento identificada' : 'Divergência de vencimento identificada';
    }
    setEditObservacoes(obs);
  };

  // Iniciar nova extração / cadastrar novo documento
  const handleStartNewExtraction = () => {
    setInvoiceText('');
    setHasExtracted(false);
    setExtractedData(null);
    setSuccessMessage(null);
    setApiErrorMessage(null);
    setDivergenceValidationError(null);
    setEditNumeroNota('');
    setEditFornecedor('');
    setEditValorStr('');
    setEditVencimento('');
    setEditSituacao('pendente');
    setEditCategoria('Nota Fiscal / Fatura');
    setEditObservacoes('');
    setValorSelectedFromDivergence(null);
    setIsValorManualResolution(false);
    setVencimentoSelectedFromDivergence(null);
    setIsVencimentoManualResolution(false);
    setIsSaved(false);
    setSavedPayment(null);
    setDuplicateDetected(null);
    setSaveError(null);
    setIsSubmitting(false);
    isSubmittingRef.current = false;
  };

  // Carregar cenário de teste
  const handleLoadScenario = (text: string) => {
    setInvoiceText(text);
    setHasExtracted(false);
    setExtractedData(null);
    setSuccessMessage(null);
    setApiErrorMessage(null);
    setDivergenceValidationError(null);
    setEditNumeroNota('');
    setEditFornecedor('');
    setEditValorStr('');
    setEditVencimento('');
    setEditSituacao(shouldSuggestIndefinida(text) ? 'indefinida' : 'pendente');
    setEditCategoria('Nota Fiscal / Fatura');
    setEditObservacoes('');
    setValorSelectedFromDivergence(null);
    setIsValorManualResolution(false);
    setVencimentoSelectedFromDivergence(null);
    setIsVencimentoManualResolution(false);
    setIsSaved(false);
    setSavedPayment(null);
    setDuplicateDetected(null);
    setSaveError(null);
    setIsSubmitting(false);
    isSubmittingRef.current = false;
  };

  // Limpar área de texto
  const handleClear = () => {
    setInvoiceText('');
    setHasExtracted(false);
    setExtractedData(null);
    setSuccessMessage(null);
    setApiErrorMessage(null);
    setDivergenceValidationError(null);
    setEditNumeroNota('');
    setEditFornecedor('');
    setEditValorStr('');
    setEditVencimento('');
    setEditSituacao('pendente');
    setEditCategoria('Nota Fiscal / Fatura');
    setEditObservacoes('');
    setValorSelectedFromDivergence(null);
    setIsValorManualResolution(false);
    setVencimentoSelectedFromDivergence(null);
    setIsVencimentoManualResolution(false);
    setIsSaved(false);
    setSavedPayment(null);
    setDuplicateDetected(null);
    setSaveError(null);
    setIsSubmitting(false);
    isSubmittingRef.current = false;
  };

  // Selecionar valor candidato em caso de divergência
  const handleSelectCandidateValue = (candidate: CandidateValue) => {
    setEditValorStr(String(candidate.valor));
    setValorSelectedFromDivergence(candidate.valor);
    setIsValorManualResolution(false);
    setDivergenceValidationError(null);
    if (duplicateDetected) setDuplicateDetected(null);
    const note = `Valor conferido: ${formatCurrencyBRL(candidate.valor)} (${candidate.rotulo})`;
    setEditObservacoes((prev) => {
      const cleanPrev = prev.replace(/\s*·\s*Valor (?:conferido|ajustado)[^·]+/g, '').trim();
      return cleanPrev ? `${cleanPrev} · ${note}` : note;
    });
  };

  // Selecionar vencimento candidato em caso de divergência
  const handleSelectCandidateDueDate = (candidate: CandidateDueDate) => {
    setEditVencimento(candidate.data);
    setVencimentoSelectedFromDivergence(candidate.data);
    setIsVencimentoManualResolution(false);
    setDivergenceValidationError(null);
    if (duplicateDetected) setDuplicateDetected(null);
    const note = `Vencimento conferido: ${formatDateBR(candidate.data)} (${candidate.rotulo})`;
    setEditObservacoes((prev) => {
      const cleanPrev = prev.replace(/\s*·\s*Vencimento (?:conferido|ajustado)[^·]+/g, '').trim();
      return cleanPrev ? `${cleanPrev} · ${note}` : note;
    });
  };

  // Confirmar e adicionar ao cadastro do Organiza AI com proteção contra cliques repetidos, duplicidade e divergências pendentes
  const handleConfirmAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Mutex síncrono e verificação imediata: bloqueia cliques repetidos/rápidos
    if (isSubmittingRef.current || isSubmitting || isSaved) {
      return;
    }

    // 2. Validação rigorosa: bloqueia salvamento caso haja divergência não resolvida
    if (isValorDivergenceUnresolved && isVencimentoDivergenceUnresolved) {
      setDivergenceValidationError(
        'Existem divergências de valor e de vencimento pendentes de conferência. Selecione os dados válidos nos quadros de candidatos antes de salvar.'
      );
      return;
    }

    if (isValorDivergenceUnresolved) {
      setDivergenceValidationError(
        'Existe uma divergência de valores conflitantes. Selecione o valor legítimo da cobrança ou informe manualmente antes de salvar.'
      );
      return;
    }

    if (isVencimentoDivergenceUnresolved) {
      setDivergenceValidationError(
        'Existem datas de vencimento conflitantes. Selecione a data correta no quadro de candidatos antes de salvar.'
      );
      return;
    }

    setDivergenceValidationError(null);
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setDuplicateDetected(null);
    setSaveError(null);

    const parsedVal = editValorStr.trim() === '' ? null : parseFloat(editValorStr.replace(',', '.'));

    const candidateData: Partial<PaymentRecord> = {
      fornecedor: editFornecedor.trim(),
      valor: parsedVal,
      dataVencimento: editVencimento.trim() || null,
      situacao: editSituacao,
      observacoes: editObservacoes.trim() || undefined,
      categoria: editCategoria.trim() || 'Nota Fiscal / Fatura',
      numeroNota:
        editNumeroNota.trim() ||
        extractedData?.numeroNota ||
        extractInvoiceNumber(editObservacoes) ||
        extractInvoiceNumber(invoiceText) ||
        undefined,
    };

    // 3. Verificação prévia de duplicidade antes de salvar
    if (existingPayments && existingPayments.length > 0) {
      const dupCheck = findDuplicatePayment(existingPayments, candidateData);
      if (dupCheck.isDuplicate && dupCheck.existingPayment) {
        setDuplicateDetected(dupCheck);
        setIsSubmitting(false);
        isSubmittingRef.current = false;
        return;
      }
    }

    try {
      // Simulação de tempo de persistência (250ms) para exibição nítida do estado "Salvando..."
      await new Promise((resolve) => setTimeout(resolve, 250));

      const res = onAddPayment(candidateData);

      if (res && !res.success && res.duplicate && res.existingPayment) {
        setDuplicateDetected({
          isDuplicate: true,
          existingPayment: res.existingPayment,
          matchedReasons: ['Lançamento já localizado no cadastro operacional'],
          summary: res.error || 'Este lançamento já se encontra cadastrado.',
        });
        setIsSubmitting(false);
        isSubmittingRef.current = false;
        return;
      }

      if (res && !res.success && res.error) {
        setSaveError(res.error);
        setIsSubmitting(false);
        isSubmittingRef.current = false;
        return;
      }

      // 4. Sucesso: bloqueia confirmações subsequentes da mesma extração
      setIsSaved(true);
      const savedRecord: PaymentRecord = res?.payment || {
        id: `pay-${Date.now()}`,
        fornecedor: candidateData.fornecedor || 'Fornecedor não informado',
        valor: candidateData.valor ?? null,
        dataVencimento: candidateData.dataVencimento ?? null,
        situacao: candidateData.situacao ?? 'indefinida',
        numeroNota: candidateData.numeroNota,
        observacoes: candidateData.observacoes,
        categoria: candidateData.categoria,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      setSavedPayment(savedRecord);
      setSuccessMessage(
        `Lançamento de "${savedRecord.fornecedor}" no valor de ${
          savedRecord.valor !== null ? formatCurrencyBRL(savedRecord.valor) : 'valor a definir'
        } adicionado com sucesso!`
      );
    } catch (err: any) {
      console.error('Erro ao adicionar lançamento:', err);
      setSaveError(
        err?.message || 'Falha ao salvar pagamento. O registro não foi duplicado. Tente novamente.'
      );
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  // Quantidade de linhas para feedback no input
  const lineCount = invoiceText ? invoiceText.split('\n').length : 0;

  return (
    <div className="space-y-6">
      {/* 1. Header Card: Identidade Visual e Protocolo Anti-Divergência */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5] shrink-0 mt-0.5">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-[#172554]">
                  Extração Inteligente de Documentos Fiscais
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Protocolo Anti-Divergência</span>
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
                O Organiza AI processa o conteúdo da nota fiscal ou fatura sem inventar dados. Se houver <strong>divergência entre valores ou prazos de vencimento</strong>, o sistema bloqueia o salvamento automático até que ocorra uma conferência humana explícita.
              </p>
            </div>
          </div>
        </div>

        {/* Barra de Seleção de Motor de Extração */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Motor de Extração:</span>
            <div className="inline-flex p-1 bg-slate-100/90 rounded-lg border border-slate-200/60 text-xs">
              <button
                type="button"
                onClick={() => setExtractionMode('gemini')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                  extractionMode === 'gemini'
                    ? 'bg-white text-[#172554] shadow-xs font-bold border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-[#4F46E5]" />
                <span>Gemini AI (Interpretação Semântica)</span>
              </button>
              <button
                type="button"
                onClick={() => setExtractionMode('rules')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                  extractionMode === 'rules'
                    ? 'bg-white text-[#172554] shadow-xs font-bold border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-slate-600" />
                <span>Regras Locais (Determinístico)</span>
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            {extractionMode === 'gemini' ? (
              <span className="text-emerald-700 font-medium inline-flex items-center gap-1 bg-emerald-50/70 border border-emerald-200/60 px-2 py-0.5 rounded">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Conexão segura via proxy backend
              </span>
            ) : (
              <span className="text-slate-600 font-medium inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded">
                <Cpu className="w-3.5 h-3.5 text-slate-500" /> Execução 100% no navegador (offline)
              </span>
            )}
          </div>
        </div>

        {/* Cenários de Teste Disponíveis */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Cenários de Teste Rápidos (Fictícios):
            </span>
            <span className="text-[11px] text-slate-400">
              Clique em um cartão para carregar o documento
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {TEST_SCENARIOS.map((scen) => (
              <button
                key={scen.id}
                type="button"
                onClick={() => handleLoadScenario(scen.text)}
                className="p-3 bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/80 rounded-lg text-left transition-all flex flex-col justify-between group hover:border-indigo-300 cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#4F46E5] uppercase tracking-wide">
                      {scen.badge}
                    </span>
                    <span className="text-[10px] text-slate-400 group-hover:text-indigo-600 font-medium flex items-center gap-0.5">
                      <span>Usar</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                  <h4 className="mt-1 text-xs font-bold text-[#172554] leading-tight group-hover:text-[#4F46E5] transition-colors">
                    {scen.title}
                  </h4>
                  <p className="mt-1 text-[11px] text-slate-500 leading-snug line-clamp-2">
                    {scen.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Área de Entrada de Texto do Documento */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
              <span>Conteúdo da Nota Fiscal ou Fatura</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cole abaixo o texto copiado de um PDF, DANFE, boleto bancário ou e-mail de faturamento.
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {invoiceText && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono">
                  {invoiceText.length} caracteres · {lineCount} {lineCount === 1 ? 'linha' : 'linhas'}
                </span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 transition-colors font-medium cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpar</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          <textarea
            id="invoice-textarea"
            rows={7}
            value={invoiceText}
            onChange={(e) => {
              setInvoiceText(e.target.value);
              setSuccessMessage(null);
              setApiErrorMessage(null);
              setDivergenceValidationError(null);
            }}
            placeholder="Exemplo de conteúdo esperado:&#10;DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA - DANFE&#10;Nº da Nota: 84920 - Emitente: Empresa Alpha Ltda&#10;Data de Vencimento: 15/11/2026 - Total a Pagar: R$ 2.450,00..."
            className="w-full p-3.5 text-xs sm:text-sm font-mono bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-y leading-relaxed"
          />
        </div>

        {/* Mensagem de Erro de Conexão com Opção de Fallback Local */}
        {apiErrorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{apiErrorMessage}</span>
            </div>
            <button
              type="button"
              onClick={executeRulesExtraction}
              className="px-3 py-1 bg-white border border-rose-300 text-rose-900 font-semibold rounded-md hover:bg-rose-100 transition-colors shrink-0 cursor-pointer"
            >
              Processar com Regras Locais
            </button>
          </div>
        )}

        {/* Barra de Ação de Extração */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Nenhum lançamento é salvo automaticamente. Você sempre confere os campos antes de confirmar.</span>
          </div>

          <button
            type="button"
            disabled={!invoiceText.trim() || isLoading}
            onClick={handleExtract}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-all shadow-xs w-full sm:w-auto ${
              !invoiceText.trim() || isLoading
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-[#4F46E5] text-white hover:bg-indigo-700 cursor-pointer active:scale-98'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando documento fiscal...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  Extrair com {extractionMode === 'gemini' ? 'Gemini AI' : 'Regras Locais'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Feedback de Confirmação e Sucesso */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm text-emerald-950 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5 sm:mt-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-emerald-900">{successMessage}</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Os dados foram validados e inseridos no acervo contábil ativo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab('todos')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
          >
            <span>Ver no Painel Financeiro</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. ÁREA DE CONFERÊNCIA HUMANA OBRIGATÓRIA (ORGANIZADA EM 3 GRUPOS VISUAIS) */}
      {hasExtracted && extractedData && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Cabeçalho do Bloco de Conferência com Badges Dinâmicos de Divergência */}
          <div className="px-5 sm:px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-[#172554]">
                  Resultado da Extração · Conferência Humana Obrigatória
                </h3>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
                  {extractedVia}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Revise os campos identificados nos grupos abaixo antes de efetivar o lançamento.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {hasUnresolvedDivergence ? (
                <span className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-2xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Divergência Pendente de Conferência</span>
                </span>
              ) : (extractedData.temDivergenciaValor || extractedData.temDivergenciaVencimento) ? (
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Divergências Resolvidas</span>
                </span>
              ) : (!editFornecedor || editValorStr.trim() === '' || !editVencimento) ? (
                <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Campos Ausentes</span>
                </span>
              ) : (
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pronto para Conferência</span>
                </span>
              )}
            </div>
          </div>

          {/* Síntese Rápida dos Indicadores Extraídos */}
          <div className="px-5 sm:px-6 py-3 bg-[#F1F5F9]/60 border-b border-slate-200/80 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. Número da NF */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Nº Documento:</span>
              {extractedData.numeroNota ? (
                <span className="font-mono font-bold text-[#172554] bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                  NF {extractedData.numeroNota}
                </span>
              ) : (
                <span className="text-slate-400 italic">Não identificado</span>
              )}
            </div>

            {/* 2. Fornecedor */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Fornecedor:</span>
              {extractedData.fornecedor ? (
                <span className="text-emerald-700 font-medium truncate flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">{extractedData.fornecedor}</span>
                </span>
              ) : (
                <span className="text-amber-800 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                  Não informado
                </span>
              )}
            </div>

            {/* 3. Valor Total */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Valor Total:</span>
              {extractedData.temDivergenciaValor ? (
                isValorResolved ? (
                  <span className="text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[11px] flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Resolvido ({formatCurrencyBRL(parseFloat(editValorStr.replace(',', '.')))})</span>
                  </span>
                ) : (
                  <span className="text-rose-900 font-bold bg-rose-50 border border-rose-300 px-1.5 py-0.5 rounded text-[11px] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                    <span>Divergência</span>
                  </span>
                )
              ) : editValorStr.trim() !== '' ? (
                <span className="text-emerald-700 font-medium font-mono">
                  {formatCurrencyBRL(parseFloat(editValorStr.replace(',', '.')))}
                </span>
              ) : (
                <span className="text-amber-800 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                  Não informado
                </span>
              )}
            </div>

            {/* 4. Vencimento */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Vencimento:</span>
              {extractedData.temDivergenciaVencimento ? (
                isVencimentoResolved ? (
                  <span className="text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[11px] flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Resolvido ({formatDateBR(editVencimento)})</span>
                  </span>
                ) : (
                  <span className="text-rose-900 font-bold bg-rose-50 border border-rose-300 px-1.5 py-0.5 rounded text-[11px] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                    <span>Divergência</span>
                  </span>
                )
              ) : editVencimento ? (
                <span className="text-emerald-700 font-medium font-mono">
                  {formatDateBR(editVencimento)}
                </span>
              ) : (
                <span className="text-amber-800 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                  Não informado
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleConfirmAndAdd} className="p-5 sm:p-6 space-y-6">
            {/* PAINEL DE DIVERGÊNCIA DE VALOR (SE HOUVER) */}
            {extractedData.temDivergenciaValor && (
              <div
                className={`border-2 rounded-xl p-4 sm:p-5 space-y-3 shadow-2xs transition-all ${
                  isValorResolved
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : 'bg-rose-50/80 border-rose-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isValorResolved
                        ? 'bg-emerald-200 text-emerald-800'
                        : 'bg-rose-200 text-rose-800'
                    }`}
                  >
                    {isValorResolved ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4
                        className={`text-sm font-bold ${
                          isValorResolved ? 'text-emerald-950' : 'text-rose-950'
                        }`}
                      >
                        {isValorResolved
                          ? 'Divergência de Valores Resolvida'
                          : 'Divergência de Valores Detectada (Conferência Obrigatória)'}
                      </h4>
                      {isValorResolved && (
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-200/90 px-2 py-0.5 rounded">
                          Valor Selecionado: {formatCurrencyBRL(parseFloat(editValorStr.replace(',', '.')))}
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-0.5 text-xs leading-relaxed ${
                        isValorResolved ? 'text-emerald-800' : 'text-rose-800'
                      }`}
                    >
                      {isValorResolved
                        ? 'Você conferiu e definiu o valor aplicável. Caso queira alterar, clique em outro candidato ou digite abaixo:'
                        : 'O documento apresenta mais de um valor monetário que pode representar o total da cobrança. O sistema não escolheu nenhum automaticamente. Clique no valor correto abaixo para selecioná-lo:'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {extractedData.valoresCandidatos.map((c, idx) => {
                    const isSelected =
                      valorSelectedFromDivergence === c.valor ||
                      (editValorStr.trim() !== '' && parseFloat(editValorStr.replace(',', '.')) === c.valor);
                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleSelectCandidateValue(c)}
                        className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-100/90 border-emerald-600 ring-2 ring-emerald-500 shadow-2xs'
                            : 'bg-white border-rose-200 hover:border-rose-400 hover:bg-rose-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">
                            {c.rotulo}
                          </span>
                          {isSelected && (
                            <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 bg-emerald-200 px-2 py-0.5 rounded">
                              <Check className="w-3 h-3" /> Selecionado
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-lg font-bold font-mono tabular-nums text-slate-900">
                          {formatCurrencyBRL(c.valor)}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 italic line-clamp-2">
                          Contexto no texto: "{c.contexto}"
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PAINEL DE DIVERGÊNCIA DE VENCIMENTO (SE HOUVER) */}
            {extractedData.temDivergenciaVencimento && (
              <div
                className={`border-2 rounded-xl p-4 sm:p-5 space-y-3 shadow-2xs transition-all ${
                  isVencimentoResolved
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : 'bg-rose-50/80 border-rose-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isVencimentoResolved
                        ? 'bg-emerald-200 text-emerald-800'
                        : 'bg-rose-200 text-rose-800'
                    }`}
                  >
                    {isVencimentoResolved ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4
                        className={`text-sm font-bold ${
                          isVencimentoResolved ? 'text-emerald-950' : 'text-rose-950'
                        }`}
                      >
                        {isVencimentoResolved
                          ? 'Divergência de Prazos Resolvida'
                          : 'Divergência de Vencimento Detectada (Conferência Obrigatória)'}
                      </h4>
                      {isVencimentoResolved && (
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-200/90 px-2 py-0.5 rounded">
                          Vencimento Selecionado: {formatDateBR(editVencimento)}
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-0.5 text-xs leading-relaxed ${
                        isVencimentoResolved ? 'text-emerald-800' : 'text-rose-800'
                      }`}
                    >
                      {isVencimentoResolved
                        ? 'Você conferiu e definiu a data válida. Caso queira alterar, clique em outro candidato ou escolha no calendário abaixo:'
                        : 'O documento apresenta duas ou mais datas conflitantes de vencimento. O sistema não escolheu nenhuma automaticamente. Clique na data correta para selecioná-la:'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {extractedData.vencimentosCandidatos.map((c, idx) => {
                    const isSelected =
                      vencimentoSelectedFromDivergence === c.data ||
                      editVencimento === c.data;
                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleSelectCandidateDueDate(c)}
                        className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-100/90 border-emerald-600 ring-2 ring-emerald-500 shadow-2xs'
                            : 'bg-white border-rose-200 hover:border-rose-400 hover:bg-rose-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">
                            {c.rotulo}
                          </span>
                          {isSelected && (
                            <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 bg-emerald-200 px-2 py-0.5 rounded">
                              <Check className="w-3 h-3" /> Selecionado
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-lg font-bold font-mono tabular-nums text-slate-900">
                          {formatDateBR(c.data)}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 italic line-clamp-2">
                          Contexto no texto: "{c.contexto}"
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* OS TRÊS GRUPOS VISUAIS DE CONFERÊNCIA EXECUTIVA */}
            <div className="space-y-5">
              {/* GRUPO A: IDENTIFICAÇÃO DO DOCUMENTO */}
              <div className="bg-slate-50/60 rounded-xl border border-slate-200/90 p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/80">
                  <div className="w-7 h-7 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5] shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#172554] tracking-tight">
                      A. Identificação do Documento
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Dados fiscais de controle e razão social do credor
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  {/* Número da Nota Fiscal */}
                  <div className="sm:col-span-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="edit-numero-nota" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-slate-400" />
                        <span>Número da NF / Fatura</span>
                      </label>
                      {editNumeroNota ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                          Identificado
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400">
                          Opcional
                        </span>
                      )}
                    </div>
                    <input
                      id="edit-numero-nota"
                      type="text"
                      disabled={isSaved}
                      value={editNumeroNota}
                      onChange={(e) => {
                        setEditNumeroNota(e.target.value);
                        if (duplicateDetected) setDuplicateDetected(null);
                      }}
                      placeholder="Ex: 84920, 10934..."
                      className={`w-full px-3 py-2 text-xs sm:text-sm font-mono bg-white border rounded-lg focus:outline-hidden focus:ring-2 transition-all ${
                        isSaved
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
                          : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
                      }`}
                    />
                  </div>

                  {/* Nome do Fornecedor */}
                  <div className="sm:col-span-8">
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="edit-fornecedor" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Fornecedor / Razão Social</span>
                      </label>
                      {!editFornecedor.trim() ? (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span>Não informado</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                          Preenchido
                        </span>
                      )}
                    </div>
                    <input
                      id="edit-fornecedor"
                      type="text"
                      disabled={isSaved}
                      value={editFornecedor}
                      onChange={(e) => {
                        setEditFornecedor(e.target.value);
                        if (duplicateDetected) setDuplicateDetected(null);
                      }}
                      placeholder="Razão social ou nome fantasia da empresa emitente..."
                      className={`w-full px-3 py-2 text-xs sm:text-sm bg-white border rounded-lg focus:outline-hidden focus:ring-2 transition-all ${
                        isSaved
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
                          : !editFornecedor.trim()
                          ? 'border-amber-300 bg-amber-50/10 focus:ring-amber-200 focus:border-amber-500'
                          : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* GRUPO B: CONDIÇÕES FINANCEIRAS */}
              <div className="bg-slate-50/60 rounded-xl border border-slate-200/90 p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/80">
                  <div className="w-7 h-7 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5] shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#172554] tracking-tight">
                      B. Condições Financeiras
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Valores monetários, data limite de quitação e situação do fluxo de caixa
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Valor Total da Cobrança */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="edit-valor" className="text-xs font-bold text-slate-700">
                        Valor da Cobrança (R$)
                      </label>
                      {extractedData.temDivergenciaValor ? (
                        isValorResolved ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Divergência Resolvida</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-100 border border-rose-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                            <span>Divergência Pendente</span>
                          </span>
                        )
                      ) : !editValorStr.trim() ? (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.2 rounded">
                          Não informado
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                          Definido
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      {editValorStr.trim() !== '' && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                          R$
                        </span>
                      )}
                      <input
                        id="edit-valor"
                        type="text"
                        inputMode="decimal"
                        disabled={isSaved}
                        value={editValorStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (/^[0-9]*[.,]?[0-9]*$/.test(val) || val === '') {
                            setEditValorStr(val);
                            setDivergenceValidationError(null);
                            if (duplicateDetected) setDuplicateDetected(null);
                            if (extractedData?.temDivergenciaValor) {
                              if (val.trim() !== '') {
                                setIsValorManualResolution(true);
                                setValorSelectedFromDivergence(null);
                                const parsed = parseFloat(val.replace(',', '.'));
                                if (!isNaN(parsed)) {
                                  const note = `Valor ajustado manualmente: ${formatCurrencyBRL(parsed)}`;
                                  setEditObservacoes((prev) => {
                                    const cleanPrev = prev.replace(/\s*·\s*Valor (?:conferido|ajustado)[^·]+/g, '').trim();
                                    return cleanPrev ? `${cleanPrev} · ${note}` : note;
                                  });
                                }
                              } else {
                                setIsValorManualResolution(false);
                                setValorSelectedFromDivergence(null);
                              }
                            }
                          }
                        }}
                        placeholder="Não informado (clique para definir)"
                        className={`w-full ${
                          editValorStr.trim() !== '' ? 'pl-9' : 'pl-3.5'
                        } pr-3 py-2 text-xs sm:text-sm font-mono tabular-nums bg-white border rounded-lg focus:outline-hidden focus:ring-2 transition-all ${
                          isSaved
                            ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
                            : extractedData.temDivergenciaValor && !isValorResolved
                            ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-200 focus:border-rose-500'
                            : !editValorStr.trim()
                            ? 'border-amber-300 bg-amber-50/10 focus:ring-amber-200 focus:border-amber-500'
                            : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
                        }`}
                      />
                    </div>
                    {extractedData.temDivergenciaValor && !isValorResolved && (
                      <p className="mt-1 text-[11px] text-rose-700 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0 text-rose-600" />
                        <span>Selecione um candidato acima para liberar o salvamento.</span>
                      </p>
                    )}
                  </div>

                  {/* Data de Vencimento */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="edit-vencimento" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Data de Vencimento</span>
                      </label>
                      {extractedData.temDivergenciaVencimento ? (
                        isVencimentoResolved ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Divergência Resolvida</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-100 border border-rose-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                            <span>Divergência Pendente</span>
                          </span>
                        )
                      ) : !editVencimento ? (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.2 rounded">
                          Não informado
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                          Definido
                        </span>
                      )}
                    </div>
                    <input
                      id="edit-vencimento"
                      type="date"
                      disabled={isSaved}
                      value={editVencimento}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditVencimento(val);
                        setDivergenceValidationError(null);
                        if (duplicateDetected) setDuplicateDetected(null);
                        if (extractedData?.temDivergenciaVencimento) {
                          if (val.trim() !== '') {
                            setIsVencimentoManualResolution(true);
                            setVencimentoSelectedFromDivergence(null);
                            const note = `Vencimento ajustado manualmente: ${formatDateBR(val)}`;
                            setEditObservacoes((prev) => {
                              const cleanPrev = prev.replace(/\s*·\s*Vencimento (?:conferido|ajustado)[^·]+/g, '').trim();
                              return cleanPrev ? `${cleanPrev} · ${note}` : note;
                            });
                          } else {
                            setIsVencimentoManualResolution(false);
                            setVencimentoSelectedFromDivergence(null);
                          }
                        }
                      }}
                      className={`w-full px-3 py-2 text-xs sm:text-sm font-mono bg-white border rounded-lg focus:outline-hidden focus:ring-2 transition-all ${
                        isSaved
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
                          : extractedData.temDivergenciaVencimento && !isVencimentoResolved
                          ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-200 focus:border-rose-500'
                          : !editVencimento
                          ? 'border-amber-300 bg-amber-50/10 focus:ring-amber-200 focus:border-amber-500'
                          : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
                      }`}
                    />
                    {extractedData.temDivergenciaVencimento && !isVencimentoResolved && (
                      <p className="mt-1 text-[11px] text-rose-700 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0 text-rose-600" />
                        <span>Selecione uma data acima para liberar o salvamento.</span>
                      </p>
                    )}
                  </div>

                  {/* Situação Inicial do Pagamento */}
                  <div>
                    <label htmlFor="edit-situacao" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Situação do Pagamento
                    </label>
                    <select
                      id="edit-situacao"
                      disabled={isSaved}
                      value={editSituacao}
                      onChange={(e) => setEditSituacao(e.target.value as PaymentStatus)}
                      className={`w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all ${
                        isSaved ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="pendente">Pendente (Aguardando quitação)</option>
                      <option value="agendado">Agendado no banco</option>
                      <option value="pago">Já Quitado / Pago</option>
                      <option value="vencido">Em atraso</option>
                      <option value="indefinida">Não definida (Aguardando faturamento / medição)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* GRUPO C: CLASSIFICAÇÃO GERENCIAL */}
              <div className="bg-slate-50/60 rounded-xl border border-slate-200/90 p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/80">
                  <div className="w-7 h-7 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5] shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#172554] tracking-tight">
                      C. Classificação Gerencial
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Categoria de despesa e justificativas para trilha de auditoria
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  {/* Categoria */}
                  <div className="sm:col-span-4">
                    <label htmlFor="edit-categoria" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Categoria Contábil
                    </label>
                    <select
                      id="edit-categoria"
                      disabled={isSaved}
                      value={editCategoria}
                      onChange={(e) => setEditCategoria(e.target.value)}
                      className={`w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all ${
                        isSaved ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                      }`}
                    >
                      {CATEGORIAS_PADRAO.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Observações e Justificativas */}
                  <div className="sm:col-span-8">
                    <label htmlFor="edit-observacoes" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Observações e Justificativas de Auditoria
                    </label>
                    <input
                      id="edit-observacoes"
                      type="text"
                      disabled={isSaved}
                      value={editObservacoes}
                      onChange={(e) => {
                        setEditObservacoes(e.target.value);
                        if (duplicateDetected) setDuplicateDetected(null);
                      }}
                      placeholder="Ex: NF 10934 · Licenças extraordinárias conferidas com o fornecedor..."
                      className={`w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all ${
                        isSaved ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Alerta de Validação de Divergência Pendente */}
            {divergenceValidationError && (
              <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 text-xs text-rose-950 flex items-start gap-3 shadow-xs animate-in fade-in duration-150">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Conferência Humana Obrigatória:</span>
                  <p className="leading-relaxed">{divergenceValidationError}</p>
                </div>
              </div>
            )}

            {/* Alerta de Lançamento Duplicado Detectado */}
            {duplicateDetected && (
              <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 sm:p-5 shadow-xs animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700 shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-sm font-bold text-rose-900">
                        Proteção Anti-Duplicidade Ativa: Lançamento Já Cadastrado!
                      </h4>
                      <span className="text-[11px] font-bold text-rose-800 bg-rose-200/80 px-2.5 py-0.5 rounded-full">
                        Bloqueio de Duplicidade
                      </span>
                    </div>
                    <p className="text-xs text-rose-800 font-medium leading-relaxed">
                      {duplicateDetected.summary}
                    </p>

                    {/* Razões da correspondência */}
                    {duplicateDetected.matchedReasons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {duplicateDetected.matchedReasons.map((reason, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white border border-rose-300 text-rose-900 px-2 py-0.5 rounded"
                          >
                            <Check className="w-3 h-3 text-rose-600" />
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Detalhes do registro existente no banco operacional */}
                    {duplicateDetected.existingPayment && (
                      <div className="mt-3 bg-white border border-rose-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
                        <div className="font-bold text-slate-900 flex items-center justify-between">
                          <span>Registro Correspondente no Sistema:</span>
                          <span className="font-mono text-[10px] text-slate-400">
                            ID: {duplicateDetected.existingPayment.id}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-1 text-slate-600">
                          <div>
                            <span className="font-semibold text-slate-700">Fornecedor:</span>{' '}
                            {duplicateDetected.existingPayment.fornecedor || 'Não informado'}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-700">Valor:</span>{' '}
                            {formatCurrencyBRL(duplicateDetected.existingPayment.valor)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-700">Vencimento:</span>{' '}
                            {formatDateBR(duplicateDetected.existingPayment.dataVencimento)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-700">Situação:</span>{' '}
                            <span className="capitalize">{duplicateDetected.existingPayment.situacao}</span>
                          </div>
                          {duplicateDetected.existingPayment.observacoes && (
                            <div className="sm:col-span-2 text-slate-500 text-[11px] truncate">
                              <span className="font-semibold text-slate-700">Obs / Doc:</span>{' '}
                              {duplicateDetected.existingPayment.observacoes}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Ações de navegação e resolução */}
                    <div className="pt-2 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onNavigateToTab('todos')}
                        className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <span>Ver na Tabela Operacional</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDuplicateDetected(null)}
                        className="px-3.5 py-1.5 bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Ajustar dados deste formulário
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Alerta de Erro de Salvamento */}
            {saveError && (
              <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-xs text-rose-900 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{saveError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSaveError(null)}
                  className="px-3 py-1 bg-white border border-rose-300 text-rose-800 rounded font-semibold hover:bg-rose-100 transition-colors shrink-0 cursor-pointer"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {/* Card de Confirmação e Sucesso com Ações */}
            {isSaved && savedPayment && (
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-5 shadow-xs animate-in fade-in duration-200">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-sm font-bold text-emerald-900">
                        Lançamento Cadastrado com Sucesso!
                      </h4>
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-200/80 px-2.5 py-0.5 rounded-full">
                        Gravado no Organiza AI
                      </span>
                    </div>
                    <p className="text-xs text-emerald-900 font-medium leading-relaxed">
                      O pagamento de <strong>{savedPayment.fornecedor}</strong> no valor de{' '}
                      <strong>{formatCurrencyBRL(savedPayment.valor)}</strong> (vencimento em{' '}
                      <strong>{formatDateBR(savedPayment.dataVencimento)}</strong>) foi registrado.
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      O formulário desta extração foi bloqueado contra novos envios para impedir lançamentos duplicados acidentais.
                    </p>

                    <div className="pt-2 flex items-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onNavigateToTab('todos')}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <span>Ver Lançamentos na Tabela Operacional</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleStartNewExtraction}
                        className="px-4 py-2 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-bold text-xs rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Cadastrar Novo Documento</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Aviso de Confirmação Obrigatória */}
            {!isSaved && (
              <div className="pt-2 text-xs text-slate-500 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Conferência contábil ativa: este lançamento somente será gravado na base do Organiza AI após você clicar no botão de confirmação.
                </span>
              </div>
            )}

            {/* Botões de Ação com Proteção contra Cliques Repetidos e Trava de Divergência */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={isSaved ? handleStartNewExtraction : () => setHasExtracted(false)}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSaved ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Nova Extração</span>
                  </>
                ) : (
                  <span>Cancelar Extração</span>
                )}
              </button>

              <button
                type="submit"
                disabled={isSubmitting || isSaved || Boolean(duplicateDetected) || hasUnresolvedDivergence}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold rounded-lg transition-all shadow-xs ${
                  isSaved
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-not-allowed opacity-90'
                    : duplicateDetected
                    ? 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed'
                    : hasUnresolvedDivergence
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 cursor-not-allowed font-bold'
                    : isSubmitting
                    ? 'bg-emerald-700 text-white opacity-85 cursor-wait'
                    : 'text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer active:scale-98'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Salvando lançamento...</span>
                  </>
                ) : isSaved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Lançamento Já Cadastrado</span>
                  </>
                ) : duplicateDetected ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Duplicidade Identificada</span>
                  </>
                ) : hasUnresolvedDivergence ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span>
                      {isValorDivergenceUnresolved && isVencimentoDivergenceUnresolved
                        ? 'Resolver Divergências para Salvar'
                        : isValorDivergenceUnresolved
                        ? 'Selecionar Valor para Salvar'
                        : 'Selecionar Vencimento para Salvar'}
                    </span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Confirmar e Adicionar Lançamento</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
