/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PaymentRecord } from '../types/payment';

/**
 * Registros de exemplo com empresas 100% fictícias.
 * Inclui intencionalmente registros completos e incompletos para demonstrar
 * a identificação e destaque de informações ausentes.
 */
export const INITIAL_PAYMENTS: PaymentRecord[] = [
  {
    id: 'pay-001',
    fornecedor: 'Alpha Papelaria & Suprimentos Fictícia',
    valor: 1450.80,
    dataVencimento: '2026-11-10',
    situacao: 'pendente',
    categoria: 'Materiais de Escritório',
    observacoes: 'Boleto ref. NF 45812 - material de expediente trimestral',
    criadoEm: '2026-10-25T09:30:00Z',
    atualizadoEm: '2026-10-25T09:30:00Z',
  },
  {
    id: 'pay-002',
    fornecedor: 'Delta Nuvem & Infraestrutura TI Fictícia',
    valor: 4890.00,
    dataVencimento: '2026-11-05',
    situacao: 'agendado',
    categoria: 'Tecnologia',
    observacoes: 'Hospedagem de servidores e backup em nuvem',
    criadoEm: '2026-10-26T11:15:00Z',
    atualizadoEm: '2026-10-26T11:15:00Z',
  },
  {
    id: 'pay-003',
    fornecedor: 'Beta Transportes e Entregas Fictícia',
    valor: null, // DADO AUSENTE: Valor não informado!
    dataVencimento: '2026-11-18',
    situacao: 'pendente',
    categoria: 'Logística',
    observacoes: 'Aguardando envio do fechamento com a tabela de frete da quinzena',
    criadoEm: '2026-10-28T14:20:00Z',
    atualizadoEm: '2026-10-28T14:20:00Z',
  },
  {
    id: 'pay-004',
    fornecedor: 'Vértice Consultoria Contábil Fictícia',
    valor: 3200.00,
    dataVencimento: '2026-10-28',
    situacao: 'pago',
    categoria: 'Serviços Jurídicos e Contábeis',
    observacoes: 'Honorários mensais quitados via PIX',
    criadoEm: '2026-10-20T10:00:00Z',
    atualizadoEm: '2026-10-28T16:40:00Z',
  },
  {
    id: 'pay-005',
    fornecedor: 'Prisma Limpeza e Conservação Fictícia',
    valor: 1850.00,
    dataVencimento: null, // DADO AUSENTE: Data de vencimento não informada!
    situacao: 'pendente',
    categoria: 'Manutenção Predial',
    observacoes: 'Nota fiscal recebida por e-mail sem código de barras legível',
    criadoEm: '2026-10-29T08:50:00Z',
    atualizadoEm: '2026-10-29T08:50:00Z',
  },
  {
    id: 'pay-006',
    fornecedor: '', // DADO AUSENTE: Nome do fornecedor em branco!
    valor: 650.00,
    dataVencimento: '2026-11-15',
    situacao: 'pendente',
    categoria: 'Serviços Gerais',
    observacoes: 'Comprovante avulso encontrado na recepção - verificar emissor',
    criadoEm: '2026-10-30T13:10:00Z',
    atualizadoEm: '2026-10-30T13:10:00Z',
  },
  {
    id: 'pay-007',
    fornecedor: 'Zênite Equipamentos & Máquinas Fictícia',
    valor: 7600.00,
    dataVencimento: '2026-10-20',
    situacao: 'vencido',
    categoria: 'Equipamentos',
    observacoes: 'Parcela 2 de 5 - verificar com fornecedor cálculo de juros/multa',
    criadoEm: '2026-10-15T10:00:00Z',
    atualizadoEm: '2026-10-25T11:00:00Z',
  },
  {
    id: 'pay-008',
    fornecedor: 'Kroma Gráfica & Brindes Fictícia',
    valor: 920.00,
    dataVencimento: '2026-11-22',
    situacao: 'indefinida', // DADO AUSENTE: Situação do pagamento não selecionada!
    categoria: 'Marketing e Eventos',
    observacoes: 'Impressão de pastas e cartões para o congresso',
    criadoEm: '2026-10-30T14:40:00Z',
    atualizadoEm: '2026-10-30T14:40:00Z',
  },
];
