/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PaymentRecord } from '../types/payment';

export const STORAGE_KEY = 'organiza_ai_pagamentos_v1';

export interface BackupPayload {
  versao: string;
  geradoEm: string;
  chaveArmazenamento: string;
  totalRegistros: number;
  pagamentos: PaymentRecord[];
}

/**
 * Retorna os dados crus atuais armazenados na chave do localStorage
 */
export function getStoredPaymentsRaw(): PaymentRecord[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Erro ao ler diretamente o localStorage:', err);
  }
  return null;
}

/**
 * Gera e baixa uma cópia de segurança completa em formato JSON
 * preservando IDs, valores nulos e todos os campos sem qualquer alteração.
 */
export function downloadPaymentsBackup(payments: PaymentRecord[]): {
  success: boolean;
  totalExportados: number;
  filename: string;
  payload: BackupPayload;
} {
  // Tenta ler diretamente do localStorage para fidelidade 100% à chave armazenada
  let recordsToExport = payments;
  const storedRaw = getStoredPaymentsRaw();
  if (storedRaw && storedRaw.length > 0) {
    recordsToExport = storedRaw;
  }

  const payload: BackupPayload = {
    versao: '1.0',
    geradoEm: new Date().toISOString(),
    chaveArmazenamento: STORAGE_KEY,
    totalRegistros: recordsToExport.length,
    pagamentos: recordsToExport,
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
  const filename = `organiza_ai_backup_seguranca_${dateStr}_${timeStr}.json`;

  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    success: true,
    totalExportados: recordsToExport.length,
    filename,
    payload,
  };
}

/**
 * Valida e restaura um arquivo de backup JSON na chave do localStorage
 */
export function restorePaymentsBackup(
  backupJson: string
): { success: boolean; pagamentos?: PaymentRecord[]; message: string } {
  try {
    const parsed = JSON.parse(backupJson);
    let list: PaymentRecord[] = [];

    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && Array.isArray(parsed.pagamentos)) {
      list = parsed.pagamentos;
    } else {
      return {
        success: false,
        message: 'Estrutura do arquivo inválida. O arquivo JSON deve conter a lista de pagamentos.',
      };
    }

    // Validação básica dos registros
    if (list.length === 0) {
      return {
        success: false,
        message: 'O arquivo de backup não contém nenhum registro de pagamento.',
      };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return {
      success: true,
      pagamentos: list,
      message: `${list.length} registros restaurados com sucesso na chave '${STORAGE_KEY}'.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Erro ao processar o arquivo de backup: ${err?.message || 'JSON inválido'}`,
    };
  }
}
