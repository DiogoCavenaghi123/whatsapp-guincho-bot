================================================================================
          WHATSAPP GUINCHO BOT - SISTEMA INTELIGENTE DE AGENDAMENTO
================================================================================
Versão: 1.0.0
Tecnologias: Node.js, WhatsApp-Web.js, Google Sheets API, Google Gemini AI, OSRM

--------------------------------------------------------------------------------
1. VISÃO GERAL DO SISTEMA
--------------------------------------------------------------------------------
O WhatsApp Guincho Bot é uma solução automatizada para empresas de guincho,
concessionárias e frotistas. O bot se conecta ao WhatsApp via WhatsApp Web,
monitora um grupo específico em tempo real, identifica pedidos de transporte e:

  1. Extrai dados completos do veículo, trajeto, contatos e faturamento.
  2. Utiliza mecanismos híbridos:
     - Parser Regex: Rápido e tolerante para mensagens estruturadas/formatadas.
     - Google Gemini AI: Interpreta mensagens livres, informais ou em áudio transcrito.
  3. Calcula a rota rodoviária real, distância em KM e tempo de viagem via OSRM/Gemini.
  4. Aplica a precificação automática (ex: R$ 7,00/km com ida e volta).
  5. Insere os dados em uma planilha centralizada do Google Sheets (18 colunas).
  6. Responde no grupo do WhatsApp citando o pedido com o resumo e cotação oficial.
  7. Varredura de Histórico: Ao iniciar, analisa mensagens recentes perdidas enquanto
     estava offline para manter a planilha sempre em dia.
  8. Anti-duplicidade: Impede o recadastro do mesmo chassi/veículo na mesma data.

--------------------------------------------------------------------------------
2. ESTRUTURA DO PROJETO
--------------------------------------------------------------------------------
whatsapp-guincho-bot/
  ├── package.json          # Dependências e comandos de execução
  ├── .gitignore            # Proteção contra envio de chaves/sessões ao GitHub
  ├── .env.example          # Modelo de configuração de variáveis
  ├── .env                  # Configurações locais (NÃO ENVIAR AO GITHUB)
  ├── credentials.json      # Chave da Conta de Serviço Google (NÃO ENVIAR AO GITHUB)
  ├── README.txt            # Documentação completa em texto plano
  ├── README.md             # Documentação com formatação Markdown
  └── src/
      ├── index.js          # Ponto de entrada (Entrypoint) do sistema
      ├── whatsapp.js       # Conexão, listeners de mensagens e varredura
      ├── parser.js         # Extração com expressões regulares e mapeamento da planilha
      ├── gemini.js         # Inteligência Artificial com saída estruturada em JSON
      ├── distance.js       # Cálculo de rota rodoviária e precificação de frete
      ├── sheets.js         # Integração e escrita com a Google Sheets API v4
      ├── logger.js         # Padronização de logs visuais no console
      ├── find-group.js     # Utilitário para descobrir o ID do grupo alvo
      └── list-groups.js    # Utilitário para listar todos os grupos da conta

--------------------------------------------------------------------------------
3. PRÉ-REQUISITOS
--------------------------------------------------------------------------------
- Node.js versão 18 ou superior instalado (https://nodejs.org)
- Conta Google com acesso ao Google Cloud Console e Google Sheets
- Chave gratuita da API do Google Gemini (Google AI Studio)
- Navegador Google Chrome instalado no computador servidor/host

--------------------------------------------------------------------------------
4. PASSO A PASSO DE INSTALAÇÃO E CONFIGURAÇÃO
--------------------------------------------------------------------------------

PASSO 4.1: Clonar o Repositório e Instalar Dependências
No terminal / prompt de comando, execute:
  cd whatsapp-guincho-bot
  npm install

PASSO 4.2: Criar e Configurar o Google Cloud (Google Sheets API)
1. Acesse: https://console.cloud.google.com/
2. Crie um novo projeto com o nome: whatsapp-guincho-bot
3. Ative a "Google Sheets API" na biblioteca de APIs:
   https://console.cloud.google.com/apis/library/sheets.googleapis.com
4. Vá em "APIs e Serviços" -> "Contas de serviço":
   - Crie uma conta de serviço com o nome "bot-guincho".
   - Clique na conta criada, vá na aba "Chaves" -> "Adicionar chave" -> "Criar nova chave (JSON)".
   - O arquivo JSON será baixado.
5. Renomeie o arquivo baixado para "credentials.json" e coloque na raiz da pasta
   do projeto (whatsapp-guincho-bot/credentials.json).

PASSO 4.3: Criar a Planilha no Google Sheets
1. Crie uma nova planilha no Google Sheets (ex: https://sheets.new).
2. Renomeie a primeira aba para "Agendamentos".
3. Clique em "Compartilhar" na planilha e adicione o e-mail da Conta de Serviço
   (presente no credentials.json em "client_email") com permissão de "Editor".
4. Copie o ID da planilha contido na URL:
   https://docs.google.com/spreadsheets/d/SEU_ID_AQUI/edit

PASSO 4.4: Obter a Chave da API do Gemini (Grátis)
1. Acesse: https://aistudio.google.com/app/apikey
2. Clique em "Create API key".
3. Copie a chave gerada.

PASSO 4.5: Configurar o Arquivo .env
Crie uma cópia do arquivo .env.example com o nome .env e preencha:

  WHATSAPP_GROUP_ID=            # Preenchido no Passo 4.6
  GOOGLE_SHEET_ID=SEU_ID_AQUI   # ID copiado da URL da planilha
  GOOGLE_SHEET_TAB=Agendamentos
  GOOGLE_CREDENTIALS_PATH=./credentials.json
  GEMINI_API_KEY=SUA_CHAVE_GEMINI
  VALOR_POR_KM=7.00
  CALCULAR_IDA_E_VOLTA=true

PASSO 4.6: Identificar o ID do Grupo do WhatsApp
1. No terminal, execute o utilitário:
   node src/find-group.js
2. Escaneie o QR Code exibido com o WhatsApp do seu celular.
3. No WhatsApp, envie a palavra "guincho" dentro do grupo de agendamento.
4. O terminal exibirá o ID do grupo (formato: 120363429894894610@g.us).
5. Copie esse ID e cole no campo WHATSAPP_GROUP_ID do seu arquivo .env.

--------------------------------------------------------------------------------
5. COMO EXECUTAR O SISTEMA
--------------------------------------------------------------------------------
Para iniciar o bot em modo de produção:
  npm start

O que o bot fará ao iniciar:
1. Conecta com a Google Sheets API e garante que todas as colunas existem.
2. Inicializa o motor do Google Gemini AI.
3. Conecta ao WhatsApp Web utilizando a sessão salva (pasta .wwebjs_auth/).
4. Executa a varredura automática das últimas 30 mensagens do grupo para
   recuperar agendamentos enviados enquanto esteve offline.
5. Inicia a escuta ativa em tempo real.

Para encerrar o bot a qualquer momento, aperte:
  Ctrl + C

--------------------------------------------------------------------------------
6. FORMATO DE MENSAGENS RECONHECIDAS
--------------------------------------------------------------------------------
O sistema é híbrido e aceita tanto mensagens estruturadas quanto texto informal:

EXEMPLO ESTRUTURADO (Formatado com rótulos):
  VEICULO: COROLLA CROSS XRE
  COR: CINZA GRANITO
  CHASSI / PLACA: 9BRBC30E5NP104822 / BRA2E19
  FREIO ELETRÔNICO: SIM
  DEPARTAMENTO: PÓS-VENDA
  VEÍCULO IMOBILIZADO: SIM
  ORIGEM: AUTOLINK POÇOS - AV. JOÃO PINHEIRO, 1200, POÇOS DE CALDAS/MG
  RESPONSÁVEL PELA ENTREGA: RICARDO MENDES
  DESTINO: KENTO MOGI - OFICINA
  RESPONSÁVEL PELO RECEBIMENTO: MÁRCIO SILVA
  DEPTO ENTREGA: OFICINA
  AGENDAR PARA: 18/09/2026
  FATURAR PARA: AUTOLINK MATRIZ

EXEMPLO INFORMAL (Processado pelo Gemini AI):
  "Opa, preciso de um guincho amanhã cedo para buscar um Kicks branco
   na Nova Via Motors em Andradas com o Marcelo e entregar aqui na Kento Mogi
   para o Fernando. Chassi 94DFAAP16TB032031, veículo rodando normal."

--------------------------------------------------------------------------------
7. COLUNAS DA PLANILHA (18 CAMPOS)
--------------------------------------------------------------------------------
A: Data/Hora Mensagem   | G: Veículo Imobilizado   | M: Agendar Para
B: Veículo              | H: Origem                | N: Faturar Para
C: Cor                  | I: Resp. Entrega         | O: Remetente
D: Chassi/Placa         | J: Destino               | P: Distância (Ida / Total)
E: Freio Eletrônico     | K: Resp. Recebimento     | Q: Tempo Estimado
F: Departamento         | L: Depto Entrega         | R: Valor Estimado (R$)

--------------------------------------------------------------------------------
8. SEGURANÇA E SUBIDA NO GITHUB
--------------------------------------------------------------------------------
O arquivo .gitignore já está configurado para PROTEGER seus dados sensíveis.
NUNCA commite nem suba para o GitHub os seguintes itens:
  - .env (contém chaves de API e IDs privados)
  - credentials.json (contém chave de acesso à nuvem do Google)
  - .wwebjs_auth/ (contém a sessão ativa de login do WhatsApp)

