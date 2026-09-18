# 🚛 WhatsApp Guincho Bot

<p align="center">
  <strong>Automação Inteligente de Agendamentos e Gestão de Transportes de Veículos</strong><br>
  Integrado com <strong>WhatsApp Web</strong>, <strong>Google Sheets API v4</strong> e <strong>Google Gemini AI</strong>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Google%20Gemini-3.6%20Flash-4285F4?style=flat-square&logo=google&logoColor=white" alt="Gemini">
  <img src="https://img.shields.io/badge/Google%20Sheets-API%20v4-34A853?style=flat-square&logo=googlesheets&logoColor=white" alt="Google Sheets">
  <img src="https://img.shields.io/badge/WhatsApp-whatsapp--web.js-25D366?style=flat-square&logo=whatsapp&logoColor=white" alt="WhatsApp">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License">
</p>

---

## 📑 Sumário

- [Visão Geral](#-visão-geral)
- [O Que o Código Faz (Fluxo Operacional)](#-o-que-o-código-faz-fluxo-operacional)
- [Modelo de Linguagem Utilizado (LLM)](#-modelo-de-linguagem-utilizado-llm)
- [Regras de Negócio e Concessionárias](#-regras-de-negócio-e-concessionárias)
- [Estrutura da Planilha Google Sheets](#-estrutura-da-planilha-google-sheets)
- [Otimizações e Resiliência (Cotas da API)](#-otimizações-e-resiliência-cotas-da-api)
- [Estrutura de Diretórios](#-estrutura-de-diretórios)
- [Instalação e Configuração](#-instalação-e-configuração)
- [Execução e Atalhos (Segundo Plano)](#-execução-e-atalhos-segundo-plano)
- [Segurança de Dados](#-segurança-de-dados)

---

## 📌 Visão Geral

O **WhatsApp Guincho Bot** atua como operador autônomo conectado a grupos operacionais de logística e remoção de veículos. Ele monitora solicitações de transporte enviadas pelas concessionárias, interpreta mensagens estruturadas ou informais (com auxílio de Inteligência Artificial), evita duplicidades, formata e preenche automaticamente a planilha oficial de controle no Google Sheets, além de responder no grupo confirmando o agendamento.

```mermaid
flowchart LR
    A[Mensagem no WhatsApp] --> B{Parser Regex}
    B -- Padrão Reconhecido --> D[Deduplicação & Validação]
    B -- Não Padronizado --> C[Google Gemini 3.6 Flash]
    C --> D
    D --> E[Google Sheets API v4]
    E --> F[Confirmação no WhatsApp]
```

---

## 📋 O Que o Código Faz (Fluxo Operacional)

1. **Conexão e Sessão Persistente**:
   - Conecta ao WhatsApp Web via `whatsapp-web.js` com Puppeteer/Chromium headless.
   - Utiliza autenticação persistente (`LocalAuth`), dispensando leitura de QR Code após a primeira conexão.

2. **Cálculo Automático do Ciclo de Faturamento**:
   - As concessionárias operam no ciclo financeiro do **dia 24 do mês anterior até o dia 23 do mês atual**.
   - Exemplos:
     - Viagens de **24/08 a 23/09** $\rightarrow$ Aba **`SETEMBRO 2026`**
     - Viagens de **24/09 a 23/10** $\rightarrow$ Aba **`OUTUBRO 2026`**
     - Viagens de **24/10 a 23/11** $\rightarrow$ Aba **`NOVEMBRO 2026`**
   - O bot localiza dinamicamente a aba correspondente na planilha.

3. **Varredura Ativa do Histórico ao Iniciar**:
   - Realiza uma rolagem ativa no chat do WhatsApp Web para recuperar todas as mensagens postadas desde o início do ciclo vigente.
   - Analisa cada agendamento histórico, compara com as linhas existentes da planilha e cadastra qualquer viagem pendente.
   - Respostas no grupo são desativadas durante a varredura inicial para evitar mensagens desnecessárias.

4. **Interpretação Híbrida de Mensagens**:
   - **Camada 1 (Parser Regex)**: Extrai dados imediatos em mensagens formatadas (`VEICULO`, `COR`, `CHASSI/PLACA`, `DE / COLETA`, `PARA / ENTREGA`, `DEPARTAMENTO`, `AGENDAR PARA`), tolerando ausência de pontuação ou formatações de negrito/itálico do WhatsApp.
   - **Camada 2 (Google Gemini AI)**: Acionado automaticamente caso o texto seja livre ou informal, retornando os campos estruturados em JSON.

5. **Gravação e Formatação Padronizada no Google Sheets**:
   - Preenche exclusivamente as colunas operacionais (**A até H**).
   - Preserva intactas as fórmulas financeiras (Coluna K `=I{row}/J{row}`) e o status da Coluna L (`" NÃO FATURADO"`).
   - Aplica formatação visual: Coluna A em verde suave (`#99cc00`), centralizado, com bordas pretas nas colunas operacionais.

6. **Notificação em Tempo Real**:
   - Para novas mensagens recebidas no grupo, envia confirmação formal contendo modelo, chassi/placa, origem, destino e faturamento.

---

## 🤖 Modelo de Linguagem Utilizado (LLM)

O sistema utiliza a biblioteca oficial do Google: **`@google/genai`**.

- **Modelo Primário**: `gemini-3.6-flash`
- **Modelo de Contingência (Fallback)**: `gemini-3.5-flash`
- **Modo de Saída**: `responseMimeType: 'application/json'` com Schema determinístico via `Type.OBJECT`.
- **Temperatura**: Baixa (determinística) para garantir fidelidade absoluta em chassis, placas e nomes de responsáveis.

### Esquema do Objeto JSON Processado:
```json
{
  "isAgendamento": true,
  "veiculo": "TIGGO 7 SPORT",
  "cor": "CINZA ESCURO",
  "chassiPlaca": "95PEFL31DVB099954",
  "freioEletronico": "NÃO",
  "departamento": "NOVOS",
  "veiculoImobilizado": "NÃO",
  "origem": "MOGI MIRIM",
  "responsavelEntrega": "FABIANA",
  "destino": "XIAN SAO JOAO DA BOA VISTA",
  "responsavelRecebimento": "ADRIANO",
  "transporte": "PLATAFORMA",
  "agendarPara": "31/08/2026",
  "faturarPara": "XIAN SJBV"
}
```

---

## 🏢 Regras de Negócio e Concessionárias

Quando o campo de faturamento não for explicitamente declarado na mensagem, o bot resolve a concessionária responsável pela Nota Fiscal através de mapeamento geográfico e operacional:

| Concessionária / Entidade | Palavras-Chave de Mapeamento |
| :--- | :--- |
| **KENTO MM** | Kento Mogi Mirim, Toyota Mogi Mirim |
| **KENTO SJBV** | Kento São João da Boa Vista, Toyota São João |
| **XIAN MM** | Xian Mogi Mirim, Caoa Chery Mogi Mirim |
| **XIAN SJBV** | Xian São João da Boa Vista, Caoa Chery São João |
| **HONDA MM** | Honda Mogi Mirim, Dueto Honda, Loja Honda Kodyve |
| **HYMAX MG** | Hymax Poços de Caldas, Hymax Pouso Alegre, Sul de Minas |
| **CODIVE CPS / HZ CAMPINAS**| Codive Campinas, Hazul Campinas |
| **HAZUL ITAPIRA** | Hazul Itapira |
| **50% HYMAX - 50% CODIVE** | Transferências diretas entre Hymax e Codive |

---

## 📊 Estrutura da Planilha Google Sheets

A planilha corporativa segue o padrão **"CONTROLE DE TRANSPORTE CEGONHA E PLATAFORMA"**:

| Coluna | Cabeçalho | Gerenciado Por | Descrição / Formato |
| :---: | :--- | :---: | :--- |
| **A** | `DATA` | **Bot** | Fundo verde suave (`#99cc00`), centralizado, `dd/MM/yyyy` |
| **B** | `DEPARTAMENTO` | **Bot** | `NOVOS`, `SEMI NOVOS`, `FUNILARIA`, `MECANICA` |
| **C** | `CARRO` | **Bot** | Modelo do veículo (ex.: `TIGGO 7 PRO`) |
| **D** | `PLACAS/ CHASSIS` | **Bot** | Chassi ou placa do automóvel |
| **E** | `LOCAL DE COLETA` | **Bot** | Endereço ou concessionária de origem |
| **F** | `LOCAL DE ENTREGA` | **Bot** | Endereço ou concessionária de destino |
| **G** | `VEICULO TRANSPORTE`| **Bot** | `PLATAFORMA` ou `CEGONHA` |
| **H** | `NOTA FISCAL` | **Bot** | Concessionária faturada |
| **I** | `CUSTO DA VIAGEM` | *Operação* | Lançamento manual do valor total da viagem (R$) |
| **J** | `VEICULOS POR VIAGEM` | *Operação* | Quantidade de carros transportados na viagem |
| **K** | `CUSTO UNITARIO POR VIAGEM` | *Fórmula* | Fórmula `=I{row}/J{row}` mantida intacta pelo bot |
| **L** | `Faturado/Não Faturado` | *Status* | Valor fixo `" NÃO FATURADO"` em azul escuro e negrito |

---

## ⚡ Otimizações e Resiliência (Cotas da API)

Para operar de forma contínua sem interrupções por limites do Google Sheets (cota padrão de 60 leituras/min):

- **Cache de Metadados**: Mapeamento de abas e IDs de ciclo carregados uma única vez na inicialização.
- **Cache de Linhas em Memória (TTL 60s)**: Verificações de duplicidade consultam a memória local e atualizam em tempo real a cada novo cadastro.
- **Pacing na Varredura Histórica**: Intervalo de segurança (600ms) entre mensagens do histórico para estabilidade de rede e cotas de requisição.
- **Backoff Exponencial**: Retentativas automáticas em chamadas de rede com oscilação transitória.

---

## 📁 Estrutura de Diretórios

```text
whatsapp-guincho-bot/
├── .env.example               # Modelo de variáveis de ambiente
├── .gitignore                 # Exclusão estrita de chaves, logs e sessões
├── package.json               # Dependências e scripts de execução
├── README.md                  # Documentação completa do projeto
│
├── iniciar-bot.bat            # Inicia o bot com janela de terminal visível
├── iniciar-segundo-plano.vbs  # Inicia o bot em segundo plano (sem janela)
├── parar-bot.bat              # Encerra o processo do bot com segurança
├── ver-status.bat             # Verifica se o bot está ativo e exibe os últimos logs
├── enviar-para-github.bat     # Sincroniza e envia código para o GitHub
│
└── src/
    ├── index.js               # Entry point do sistema e ciclo de vida
    ├── whatsapp.js            # Cliente WhatsApp Web, listeners e histórico
    ├── parser.js              # Parser Regex e resolução de concessionárias
    ├── gemini.js              # Integração com Google Gemini 3.6 Flash
    ├── sheets.js              # Integração Google Sheets v4, cache e layout
    ├── logger.js              # Logs coloridos e gravação contínua em arquivo
    ├── distance.js            # Módulo de cálculo de rotas e distâncias
    ├── start-bg.js            # Inicializador desacoplado de segundo plano
    ├── status.js              # Verificador de processos ativos via WMIC
    ├── stop.js                # Finalizador de processos do bot
    ├── find-group.js          # Utilitário interativo para busca de grupos
    └── list-groups.js         # Listagem de IDs de grupos da conta
```

---

## 🚀 Instalação e Configuração

### Pré-requisitos
- [Node.js](https://nodejs.org/) versão 18 ou superior.
- Credenciais da Google Cloud Platform com a **Google Sheets API** ativada e Service Account criada.
- Chave de API do [Google AI Studio](https://aistudio.google.com/).

### 1. Clonar o Repositório
```bash
git clone https://github.com/DiogoCavenaghi123/whatsapp-guincho-bot.git
cd whatsapp-guincho-bot
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente (`.env`)
Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```
Edite o arquivo `.env` com suas credenciais:
```env
# ID do grupo no WhatsApp (exemplo: 120363038885543019@g.us)
WHATSAPP_GROUP_ID=SEU_GROUP_ID_AQUI

# ID da Planilha do Google Sheets (extraído da URL)
GOOGLE_SHEET_ID=SEU_SPREADSHEET_ID_AQUI

# Nome padrão da aba de agendamentos
GOOGLE_SHEET_TAB=Agendamentos

# Caminho da credencial da Service Account do Google
GOOGLE_CREDENTIALS_PATH=./credentials.json

# Chave de API do Google Gemini
GEMINI_API_KEY=SUA_CHAVE_GEMINI_AQUI

# Configuração de frete (opcional)
VALOR_POR_KM=7.00
CALCULAR_IDA_E_VOLTA=true
```

### 4. Compartilhar a Planilha
Abra a sua planilha no Google Sheets, clique em **Compartilhar** e adicione o e-mail da sua Service Account (encontrado dentro do arquivo `credentials.json`, campo `client_email`) como **Editor**.

---

## 🖥️ Execução e Atalhos (Segundo Plano)

O projeto conta com rotinas prontas para operação facilitada no Windows:

| Ação | Como Executar | Descrição |
| :--- | :--- | :--- |
| **Iniciar (Visível)** | Duplo clique em `iniciar-bot.bat` ou `npm start` | Abre o terminal e exibe os logs em tempo real |
| **Iniciar (Segundo Plano)** | Duplo clique em `iniciar-segundo-plano.vbs` ou `npm run start:bg` | Roda silenciosamente sem ocupar janela no Windows |
| **Verificar Status** | Duplo clique em `ver-status.bat` ou `npm run status` | Informa se o bot está rodando e exibe os 15 logs mais recentes |
| **Parar Bot** | Duplo clique em `parar-bot.bat` ou `npm run stop` | Finaliza com segurança os processos ativos |
| **Atualizar GitHub** | Duplo clique em `enviar-para-github.bat` | Faz o commit e envia todas as alterações para o repositório |

---

## 🔒 Segurança de Dados

O arquivo `.gitignore` foi configurado rigorosamente para garantir que informações sensíveis nunca sejam enviadas ao GitHub:
- `.env` e chaves de API.
- Arquivos de credenciais de Service Account (`credentials*.json`, `*.pem`, `*.key`).
- Sessões autenticadas do WhatsApp (`.wwebjs_auth/`, `.wwebjs_cache/`).
- Logs locais de mensagens e arquivos de PID de processos (`logs/`, `.bot.pid`).
