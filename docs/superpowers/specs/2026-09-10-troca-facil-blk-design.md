# Design Doc: Troca Fácil BLK (Avaliação de Aparelhos)

## 1. Visão Geral
Reformular integralmente a experiência de avaliação de aparelhos no fluxo `/avaliacao` (e suporte ao subdomínio `https://trocafacil.blkstore.com.br/avaliacao` ou raiz `trocafacil.blkstore.com.br`), transformando-o em um funil de micro-etapas (estilo quiz interativo / Typeform mobile), altamente refinado, minimalista, moderno no ecossistema Apple / BLK STORE, com auto-advance e zero atrito para o cliente.

## 2. Requisitos e Diretrizes de Design
- **Visual Refinado & Mobile-Friendly**:
  - Estética Apple Minimalista com cartões suaves (`border-[#e5e5e7]`, cantos arredondados `rounded-3xl`, sombras sutis, tipografia clara `font-display`).
  - Progress bar fina e elegante no topo indicando o progresso da jornada.
  - No mobile, experiência em tela cheia com layout centrado e botões de toque generosos (mínimo 52px de altura).
- **Preservação do Seletor Rico de Modelo**:
  - A pedido do cliente ("*2 imagem tela para escolher o modelo, do nosso modelo esta mais bonito, vamos manter o nosso*"), mantemos a busca inteligente e visualização em tempo real do aparelho com imagem oficial, ano, tela, botões de capacidade (GB/TB) e bolinhas das cores oficiais da Apple.
- **Micro-Decisões com Auto-Advance**:
  - Para as perguntas objetivas de Sim/Não/Não sei e Conservação, ao tocar em uma opção ela recebe feedback visual imediato e avança automaticamente após 180ms.
  - Botão "Voltar" sempre presente e visível na parte inferior esquerda.
- **Suporte Multi-Domínio**:
  - Ao carregar a aplicação, se o `window.location.hostname` contiver `trocafacil`, o roteador exibe diretamente a tela de avaliação (mesmo se o usuário acessar a raiz `/`), com cabeçalho "TROCA FÁCIL BLK" e foco total no funil.
  - Rota `/avaliacao` e `/troca` funcionam idênticas em qualquer domínio.

## 3. As 16 Etapas Detalhadas

1. **Início (Identificação)**:
   - Header: "TROCA FÁCIL BLK"
   - Título: "Venda ou troque seu iPhone **com segurança**"
   - Subtítulo: "Receba uma pré-avaliação rápida da equipe BLK STORE e descubra quanto o seu aparelho pode valer hoje."
   - Alerta com ícone de escudo: "Esta é uma **pré-avaliação online**. O valor final será confirmado após a conferência presencial do aparelho na loja."
   - Card "Vamos começar":
     - Campo: Primeiro nome (com ícone)
     - Campo: WhatsApp para receber a proposta (com máscara automática `(99) 99999-9999`)
     - Aviso de privacidade sem spam
     - Botão "Receber minha pré-avaliação →"

2. **Modelo Atual (Nosso Seletor Superior)**:
   - Título: "Prazer, {nome}! Qual é o seu iPhone?"
   - Subtítulo: "Selecione o modelo que você tem hoje."
   - Pílulas de seleção rápida de modelos populares + campo de busca/digitação livre.
   - Card dinâmico com render do iPhone, especificações (Ano, Tela).
   - Seletor de Armazenamento (128GB, 256GB, 512GB, 1TB...).
   - Seletor de Cor com as paletas oficiais da Apple e visualizador em tempo real.
   - Botões: Voltar | Continuar →.

3. **Origem da Compra**:
   - Título: "Onde você comprou esse {modelo}?"
   - Subtítulo: "Se foi com a gente, sua troca já começa com uma condição melhor."
   - Opções:
     - BLK STORE
     - Outra loja física da cidade
     - Loja de departamento / Marketplace (Ex.: Mercado Livre, Amazon, Shopee, Magazine Luiza, etc.)
     - Outro
   - Auto-advance ao selecionar + Voltar.

4. **Saúde da Bateria**:
   - Título: "Como está a saúde da bateria?"
   - Subtítulo: "Veja em Ajustes > Bateria > Saúde da bateria."
   - Indicador em destaque (ex.: "90%") com status contextual ("Bateria ótima", "Bateria boa", "Manutenção recomendada").
   - Slider interativo de 50% a 100%.
   - Botões: Voltar | Continuar →.

5. **iPhone Desejado para Troca**:
   - Título: "E pra qual iPhone você quer trocar?"
   - Subtítulo: "Pode ser um modelo mais novo ou mais antigo — aceitamos os dois."
   - Grade elegante com todos os modelos disponíveis (iPhone 17 Pro Max, 17 Pro, 17, Air, 17e, 16 Pro Max, 16 Pro, 16 Plus, 16, 16e, 15 Pro Max, 15 Pro, 15, 14 Pro Max, 14, 13 Pro Max, 13, 12 Pro Max...).
   - Opção inclusa: "Quero apenas vender meu aparelho (sem troca)".
   - Auto-advance ao tocar no modelo + Voltar.

6. **Diagnóstico: Face ID**:
   - Título: "Face ID funciona?"
   - Subtítulo: "Só marcar — Sim, Não ou Não sei."
   - Opções: Sim | Não | Não sei.

7. **Diagnóstico: Tela Original**:
   - Título: "Tela original?"
   - Opções: Sim | Não | Não sei.

8. **Diagnóstico: Bateria Original**:
   - Título: "Bateria original?"
   - Opções: Sim | Não | Não sei.

9. **Diagnóstico: Câmeras**:
   - Título: "Câmeras funcionando?"
   - Opções: Sim | Não | Não sei.

10. **Diagnóstico: Áudio**:
    - Título: "Áudio funcionando?"
    - Opções: Sim | Não | Não sei.

11. **Diagnóstico: Conector de Carga**:
    - Título: "Conector de carga funcionando?"
    - Opções: Sim | Não | Não sei.

12. **Diagnóstico: Aberto Anteriormente**:
    - Título: "Aparelho já foi aberto?"
    - Opções: Sim | Não | Não sei.

13. **Acessórios: Caixa**:
    - Título: "Tem caixa?"
    - Opções: Sim | Não | Não sei.

14. **Visual e Conservação**:
    - Título: "Como está o visual dele?"
    - Subtítulo: "Seja sincero — a conferência é presencial."
    - Opções:
      - Parece novo, sem marcas
      - Pouquíssimas marcas de uso
      - Marcas normais do dia a dia
      - Riscos ou amassados visíveis
      - Tela ou tampa com trinco

15. **Fotos do Aparelho**:
    - Título: "Agora as fotos"
    - Subtítulo: "Com a frente e a traseira você já pode enviar — as outras aceleram sua pré-avaliação."
    - 5 slots dedicados com upload/preview:
      - Foto da frente
      - Foto da traseira
      - Foto das laterais (opcional)
      - Foto da saúde da bateria (opcional)
      - Foto da tela ligada (opcional)
    - Botões: Voltar | Continuar →.

16. **Resumo & Envio**:
    - Título: "Última olhada antes de enviar"
    - Subtítulo: "Confere se está tudo certinho."
    - Tabela de resumo com Nome, WhatsApp, Modelo + Capacidade, Onde comprou, Cor, Bateria, Quer trocar por, Estado e Quantidade de fotos.
    - Botão "Enviar para avaliação BLK":
      - Grava no banco de dados via tRPC (`evaluations`).
      - Salva no histórico local de segurança.
      - Abre o WhatsApp do atendente com a mensagem perfeitamente formatada com todos os dados técnicos e respostas.

## 4. Estrutura de Dados e Backend
- Atualização do schema da tabela `evaluations` no MySQL / Drizzle:
  - `purchaseLocation`: onde comprou o aparelho.
  - `targetModel`: para qual iPhone quer trocar.
  - `faceId`: funcionamento do Face ID.
  - `screenOriginal`: tela original.
  - `batteryOriginal`: bateria original.
  - `camerasOk`: funcionamento de câmeras.
  - `audioOk`: áudio funcionando.
  - `chargingPortOk`: conector de carga.
  - `openedBefore`: aparelho já foi aberto.
  - `hasBox`: se tem caixa.
  - `visualCondition`: estado visual detalhado.
- Atualização do endpoint tRPC `submitEvaluation` em `api/shop.ts` e visualização completa no componente `AdminEvaluations.tsx` do painel administrativo.
