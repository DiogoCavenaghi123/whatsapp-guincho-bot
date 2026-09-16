# 🚛 WhatsApp Guincho Bot (Google Sheets + Gemini AI + Google Maps/OSRM)

> Sistema inteligente de automação de agendamentos e precificação de guincho integrado ao WhatsApp, Google Sheets e Inteligência Artificial.

---

## 📋 Visão Geral

O **WhatsApp Guincho Bot** conecta-se a um grupo específico do WhatsApp, escuta solicitações de transporte de veículos, interpreta os dados (usando Expressões Regulares ou o **Google Gemini AI**), calcula a distância rodoviária exata e o valor do frete, insere a solicitação em uma planilha centralizada do **Google Sheets** (18 colunas) e responde no grupo com a confirmação e cotação oficial.

---

## ⚡ Principais Funcionalidades

- **Monitoramento de Grupo Dedicado**: Fica ativo em segundo plano escutando apenas o grupo alvo de agendamentos.
- **Extração Híbrida Inteligente**:
  - *Parser Regex*: Rápido, sem custos e tolerante a formatações do WhatsApp (`*negrito*`, `_itálico_`, etc.).
  - *Google Gemini 3.6 / 2.5 Flash*: Interpreta textos livres, mensagens informais ou pedidos em linguagem natural.
- **Roteamento e Precificação Automática**:
  - Calcula a rota rodoviária real de rua a rua via OpenStreetMap/OSRM com fallback via Gemini.
  - Reconhece e normaliza apelidos regionais (ex: sabe que *Kento Mogi* é Mogi Mirim/SP e não Mogi das Cruzes).
  - Multiplica pela tabela de preços configurada (ex: R$ 7,00/km com ida e volta).
- **Planilha Centralizada no Google Sheets**:
  - Cabeçalhos criados automaticamente.
  - Registro de 18 colunas incluindo contatos de entrega/recebimento, faturamento, departamentos, KM e valores.
  - **Prevenção de Duplicidade**: Evita gravar o mesmo veículo duas vezes para a mesma data.
- **Varredura Automática de Histórico**:
  - Ao iniciar, recupera as últimas mensagens enviadas enquanto o bot esteve offline para não perder agendamentos.
- **Custo Zero de Operação**:
  - Opera dentro das cotas gratuitas do Google Sheets, Google AI Studio e OSRM.

---

## 📁 Estrutura do Projeto

```text
whatsapp-guincho-bot/
├── package.json          # Metadados e dependências
├── .gitignore            # Protege arquivos sensíveis (.env, credenciais, sessões)
├── .env.example          # Modelo de variáveis de ambiente
├── .env                  # Configurações locais (privado)
├── credentials.json      # Chave da Conta de Serviço do Google Cloud (privado)
├── README.txt            # Documentação em texto puro
├── README.md             # Documentação em Markdown para GitHub
└── src/
    ├── index.js          # Ponto de entrada do sistema
    ├── whatsapp.js       # Conexão, listeners em tempo real e varredura
    ├── parser.js         # Expressões regulares e mapeamento de colunas
    ├── gemini.js         # Integração com Google Gemini AI e JSON estruturado
    ├── distance.js       # Geocodificação, roteamento rodoviário e precificação
    ├── sheets.js         # Conexão e escrita no Google Sheets API v4
    ├── logger.js         # Logs coloridos no terminal
    ├── find-group.js     # Utilitário para descobrir o ID do grupo alvo
    └── list-groups.js    # Utilitário para listar grupos disponíveis
```

---

## 🛠️ Pré-requisitos

1. **Node.js 18+** instalado ([nodejs.org](https://nodejs.org))
2. **Google Chrome** instalado na máquina
3. Conta Google com acesso ao Google Cloud e Google Sheets
4. Chave gratuita da API do Gemini obtida no [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## 🚀 Instalação Passo a Passo

### 1. Clonar e Instalar Dependências
```bash
git clone https://github.com/SEU_USUARIO/whatsapp-guincho-bot.git
cd whatsapp-guincho-bot
npm install
```

### 2. Configurar a Google Sheets API
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um projeto (`whatsapp-guincho-bot`).
3. Ative a **Google Sheets API** na biblioteca.
4. Em **IAM e Admin** → **Contas de Serviço**, crie uma conta de serviço chamada `bot-guincho`.
5. Gere uma chave do tipo **JSON**, renomeie para `credentials.json` e mova para a raiz do projeto.
6. Crie uma planilha no [Google Sheets](https://sheets.new) com uma aba chamada `Agendamentos`.
7. Compartilhe a planilha com o e-mail da conta de serviço (`client_email` do JSON) como **Editor**.
8. Copie o ID da planilha contido na URL:
   `https://docs.google.com/spreadsheets/d/SEU_ID_AQUI/edit`

### 3. Obter Chave da API do Gemini
1. Acesse o [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Clique em **Create API Key**.
3. Copie a chave gerada.

### 4. Configurar o `.env`
Copie o template de variáveis:
```bash
cp .env.example .env
```
Preencha o arquivo `.env`:
```env
WHATSAPP_GROUP_ID=
GOOGLE_SHEET_ID=SEU_ID_DA_PLANILHA
GOOGLE_SHEET_TAB=Agendamentos
GOOGLE_CREDENTIALS_PATH=./credentials.json
GEMINI_API_KEY=SUA_CHAVE_GEMINI
VALOR_POR_KM=7.00
CALCULAR_IDA_E_VOLTA=true
```

### 5. Descobrir o ID do Grupo no WhatsApp
Execute o localizador interativo:
```bash
node src/find-group.js
```
- Escaneie o QR Code no celular.
- Envie a palavra `guincho` dentro do grupo desejado.
- O terminal exibirá o ID (ex: `120363429894894610@g.us`).
- Cole no campo `WHATSAPP_GROUP_ID` do `.env`.

---

## 🏁 Execução

Para iniciar o bot:
```bash
npm start
```

---

## 📊 Colunas na Planilha (Google Sheets)

| Coluna | Campo | Descrição |
| :---: | :--- | :--- |
| **A** | Data/Hora | Timestamp da mensagem |
| **B** | Veículo | Modelo do veículo |
| **C** | Cor | Cor do veículo |
| **D** | Chassi/Placa | Identificador do veículo |
| **E** | Freio Eletrônico | SIM ou NÃO |
| **F** | Departamento | Departamento solicitante |
| **G** | Veículo Imobilizado | SIM ou NÃO |
| **H** | Origem | Endereço ou cidade de coleta |
| **I** | Responsável Entrega | Contato no ponto de origem |
| **J** | Destino | Endereço ou concessionária de entrega |
| **K** | Responsável Recebimento | Contato no destino |
| **L** | Depto Entrega | Setor de entrega |
| **M** | Agendar Para | Data do agendamento |
| **N** | Faturar Para | Razão social ou filial a faturar |
| **O** | Remetente | Nome do usuário que enviou |
| **P** | Distância | Distância rodoviária de ida e total cobrada |
| **Q** | Tempo Estimado | Duração média da viagem |
| **R** | Valor Estimado | Valor total do frete em R$ |

---

## 🔒 Segurança para Subir no GitHub

O arquivo `.gitignore` já está configurado para **proteger suas senhas e credenciais**.

### ⚠️ NUNCA faça commit de:
- `.env`
- `credentials.json`
- `.wwebjs_auth/` (pasta de sessão do WhatsApp)
