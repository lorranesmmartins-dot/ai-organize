# Organiza AI (AI Organize)

> **Assistente administrativo e financeiro inteligente para organização, conferência contábil e controle rigoroso de pagamentos a fornecedores.**

O **Organiza AI** é uma solução completa projetada para otimizar o fluxo de contas a pagar de empresas, combinando inteligência artificial generativa com validações contábeis determinísticas, detecção de divergências e análise de prioridades de quitação.

---

## 📑 Sumário

- [Visão Geral e Objetivo](#visão-geral-e-objetivo)
- [Principais Funcionalidades](#principais-funcionalidades)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e Configuração](#instalação-e-configuração)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Armazenamento e Privacidade](#armazenamento-e-privacidade)
- [Avisos e Dados de Demonstração](#avisos-e-dados-de-demonstração)
- [Licença](#licença)

---

## 🎯 Visão Geral e Objetivo

O objetivo central do **Organiza AI** é mitigar riscos operacionais no setor financeiro, tais como:
- Pagamentos em duplicidade;
- Falta de identificação de fornecedores ou valores em boletos e faturas;
- Perda de prazos e incidência de juros por falta de visibilidade da data de vencimento;
- Divergências entre o valor faturado e o boleto de cobrança anexo.

A plataforma atua como um assistente consultivo: **nenhum dado é gravado automaticamente sem a conferência e validação ativa de um operador humano**.

---

## 🚀 Principais Funcionalidades

1. **Painel Financeiro Unificado:**
   - Métricas consolidadas em tempo real (total a pagar, valor pago, lançamentos pendentes, atrasados e dados incompletos).
   - Tabela dinâmica de lançamentos com ordenação, buscas textuais e filtros por situação e completude.
   - Modal interativo para edição e cadastro seguro com validação de campos obrigatórios.

2. **Assistente de Prioridades Financeiras:**
   - Classificação temporal inteligente: Atrasados, Vencendo Hoje, Próximos 7 Dias e Mais de 7 Dias.
   - Identificação imediata de registros incompletos com indicação clara do impacto financeiro pendente de confirmação.
   - Simulação de data de referência para análise de fluxo e previsibilidade de caixa.

3. **Extração de Notas Fiscais com IA e Conferência Humana Obrigatória:**
   - Inserção de texto de notas fiscais, DANFEs, ordens de serviço, boletos e recibos.
   - Processamento via **Google Gemini AI** no servidor seguro com identificação contextual de CNPJ, Razão Social, número da NF, valores e prazos.
   - **Prevenção de Alucinações:** Valores ou vencimentos conflitantes nunca são arbitrados pela IA; o sistema sinaliza divergências e exige a decisão humana.

4. **Regras Locais de Validação e Identificação de Divergências:**
   - Modo de contingência que funciona **100% offline**, através de heurísticas contábeis e expressões regulares locais.
   - Detecção automatizada de divergências monetárias e de vencimento entre diferentes seções do mesmo documento.

5. **Auditoria e Detecção de Duplicidades:**
   - Conferência contábil de integridade da base.
   - Varredura de duplicidades potenciais baseada em fornecedor, valor, vencimento e contexto da nota.

6. **Relatórios Financeiros:**
   - Visão analítica por categoria/centro de custo.
   - Distribuição de despesas por status de quitação.
   - Exportação em formato CSV compatível com planilhas e sistemas ERP.

7. **Backup e Restauração Segura (JSON):**
   - Download imediato de cópia integral da base ativa em formato JSON.
   - Restauração validada com proteção da estrutura e integridade dos registros.

---

## 🏗 Arquitetura do Sistema

O sistema é construído como uma aplicação full-stack modular:

```text
┌────────────────────────────────────────────────────────┐
│             Frontend (React 19 SPA + Vite)             │
│  - Interface de Usuário, Tabelas, Filtros e Modais    │
│  - Regras Locais de Contingência Contábil              │
│  - Armazenamento em localStorage do Navegador          │
└───────────────────────────┬────────────────────────────┘
                            │ Chamadas HTTP (/api/*)
┌───────────────────────────▼────────────────────────────┐
│              Backend (Express + Node.js)               │
│  - Servidor tsx integrado com Vite Middlewares/Static │
│  - Rota Segura: POST /api/extrair-nota-gemini          │
│  - SDK Oficial: @google/genai                          │
│  - Variável de Ambiente Segura: GEMINI_API_KEY         │
└────────────────────────────────────────────────────────┘
```

### Segurança da Chave de API
- A credencial `GEMINI_API_KEY` reside **estritamente no backend** (`server.ts`).
- Em hipótese alguma a chave é exposta ao navegador ou transmitida nas requisições do frontend.
- O arquivo `.env` que armazena a chave localmente é estritamente ignorado pelo Git (`.gitignore`).

---

## 🛠 Tecnologias Utilizadas

- **Frontend:**
  - [React](https://react.dev/) (v19)
  - [TypeScript](https://www.typescriptlang.org/)
  - [Vite](https://vitejs.dev/) (v8)
  - [Tailwind CSS](https://tailwindcss.com/) (v4 via `@tailwindcss/vite`)
  - [Lucide React](https://lucide.dev/) (Ícones)
- **Backend:**
  - [Node.js](https://nodejs.org/) com [Express](https://expressjs.com/) (v4)
  - [Google Gen AI TypeScript SDK](https://www.npmjs.com/package/@google/genai) (`@google/genai` v2)
  - [dotenv](https://www.npmjs.com/package/dotenv)
  - [tsx](https://github.com/privatenumber/tsx) (Executor TypeScript para Node.js)

---

## 📋 Pré-requisitos

Antes de iniciar, verifique se você possui instalado em sua máquina:
- **Node.js** (versão 20.19.0 ou superior, ou 22.12.0 ou superior);
- **npm** (gerenciador de pacotes incluso no Node.js).

---

## ⚙️ Instalação e Configuração

### 1. Clonar o repositório
```bash
git clone https://github.com/lorranesmmartins-dot/ai-organize.git
cd ai-organize
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
Copie o arquivo de exemplo `.env.example` para criar o seu `.env`:

```bash
cp .env.example .env
```

Abra o arquivo `.env` gerado e insira sua chave da API Google Gemini:

```env
GEMINI_API_KEY="sua_chave_gemini_aqui"
PORT=3000
```

> ⚠️ **Aviso Crítico de Segurança:**  
> A chave de API do Gemini **nunca deve ser enviada para repositórios públicos (GitHub/GitLab)**. Mantenha o arquivo `.env` sempre no `.gitignore`. Caso utilize a aplicação sem a chave informada, o sistema continuará operacional através do modo de **Regras Locais**.

---

## 🖥 Scripts Disponíveis

Todos os comandos devem ser executados a partir da raiz do projeto:

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor Express integrado ao Vite em modo de desenvolvimento (porta 3000). |
| `npm run build` | Compila o frontend React para produção gerando os arquivos estáticos na pasta `dist/`. |
| `npm start` | Inicia o servidor em modo de produção (servindo a API Express e os arquivos estáticos de `dist/`). |
| `npm run lint` | Executa a validação estática de tipos TypeScript via `tsc --noEmit`. |
| `npm run clean` | Remove as pastas de build e artefatos compilados (`dist/`). |
| `npm run preview` | Permite visualizar localmente o build estático gerado. |

---

## 🔒 Armazenamento e Privacidade

- **Armazenamento no Navegador:** Os registros financeiros são armazenados localmente no navegador do usuário via `localStorage` (sob a chave `organiza_ai_pagamentos_v1`).
- **Sem Telemetria ou Rastreamento:** A aplicação não envia dados contábeis a servidores externos de analytics ou telemetria.
- **Responsabilidade de Backup:** Como os dados ficam armazenados no navegador do cliente, é recomendável utilizar regularmente a funcionalidade de **Backup de Segurança (JSON)** localizada no painel principal para exportar e resguardar seus registros.

---

## ⚠️ Avisos e Dados de Demonstração

- **Dados 100% Fictícios:** Todos os nomes de fornecedores, CNPJs, números de faturas, datas e valores pré-cadastrados ou presentes nos cenários de teste são estritamente fictícios e criados com propósito didático e de demonstração.
- **Conferência Obrigatória:** O Organiza AI é uma ferramenta de apoio gerencial. A validação e o envio final de remessas e pagamentos devem sempre ser supervisionados e autorizados por profissionais habilitados do setor financeiro.

---

## 📄 Licença

Este projeto é distribuído sob os termos da **Licença Apache 2.0** (Apache License, Version 2.0).  
Consulte o arquivo [LICENSE](./LICENSE) para mais detalhes.
