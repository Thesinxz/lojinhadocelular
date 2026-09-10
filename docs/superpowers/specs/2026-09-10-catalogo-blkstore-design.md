# Especificação de Design — Catálogo & Vitrine da Lojinha do Celular (Estilo BLK Store)

**Data:** 10 de Setembro de 2026  
**Status:** Aprovado para Implementação  
**Autor:** Antigravity & Marlon  

---

## 1. Visão Geral & Objetivo

Transformar a experiência inicial da **Lojinha do Celular** em uma vitrine premium inspirada na **BLK Store** (https://blkstore.com.br/), adotando uma estética Dark Mode refinada no estilo Apple, com vídeo cinematográfico no Hero, prova social em tempo real, busca ágil, filtros por pílulas (*chips*), cards de produtos otimizados com foco em preço Pix e parcelamento, e fechamento de vendas direto no WhatsApp.

---

## 2. Identidade Visual & Tema

- **Tema Base:** Dark Mode sofisticado.
  - Fundo principal: `#0a0a0a` (preto profundo).
  - Superfícies de cards e seções secundárias: `#121212`, `#18181b` e `#242427`.
  - Textos: `#ffffff` (títulos e destaques de alto contraste) e `#a1a1aa` / `#71717a` (legendas, especificações e textos de apoio).
  - Bordas: finas e translúcidas (`border-white/10` ou `border-white/15`).
  - Acabamento: cantos bem arredondados (`rounded-2xl` e `rounded-full`) e efeito de vidro fosco (`backdrop-blur-md`).
  - Cores de Acento:
    - Verde WhatsApp (`#25D366`) para o botão de compra e floating chat.
    - Destaques de desconto Pix e bateria saudável (`emerald-400`, `amber-400`).

---

## 3. Estrutura da Página Inicial (Storefront Integrada)

A página inicial (`/`) passa a funcionar como a própria vitrine principal da loja, organizada nas seguintes seções:

### 3.1. Cabeçalho (Header)
- Barra de navegação fixa no topo com efeito vidro escuro (`bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10`).
- Logo oficial da Lojinha do Celular adaptado para fundo escuro.
- Links rápidos:
  - Vitrine (`#vitrine`)
  - Avaliar Aparelho (`/avaliacao`)
  - Assistência Técnica (`#servicos`)
  - Nossas Unidades (`#unidades`)
- Botão direto de WhatsApp (*Falar no WhatsApp*) com ícone oficial.

### 3.2. Hero Section com Vídeo de Fundo
- **Vídeo em Loop:**
  - Elemento `<video>` em tela cheia com atributos `autoPlay`, `muted`, `loop`, `playsInline` e `poster="/hero-poster.jpg"`.
  - Arquivo local padrão em `public/hero.mp4` que pode ser facilmente substituído pelo vídeo proprietário da Lojinha do Celular.
  - Camada de sobreposição com gradiente preto suave (`bg-gradient-to-b from-black/70 via-black/40 to-[#0a0a0a]`) garantindo leitura nítida.
- **Chamada Comercial:**
  - Título display forte: *"Seu próximo iPhone está aqui."*
  - Subtítulo: *"iPhones lacrados e seminovos com 1 ano de garantia, pronta entrega e assistência técnica em Jardim e Guia Lopes."*
- **3 Botões de Conversão Imediata:**
  1. `Ver vitrine ↓` (botão branco estilo BLK, rola suavemente para `#vitrine`).
  2. `Falar no WhatsApp` (botão verde `#25D366` com ícone de mensagem).
  3. `Avaliar meu iPhone` (botão translúcido com borda suave, direcionando para `/avaliacao`).

### 3.3. Faixa de Prova Social (Marquee de Clientes)
- Título sutil em caixa alta: *"Quem confia e já faz parte da família Lojinha do Celular ❤️"*.
- Carrossel horizontal em loop contínuo (*infinite marquee*):
  - Avatar circular do cliente.
  - Nome do cliente.
  - Aparelho adquirido (ex: *Lucas M. — iPhone 15 Pro Max 256GB*, *Mariana S. — iPhone 13 128GB*, *Carlos E. — iPhone 14 Pro*).

### 3.4. Barra de Vitrine & Filtros (`#vitrine`)
- **Campo de Busca:** Input arredondado (`rounded-full`) com fundo escuro sutil, borda fina e ícone de lupa, filtrando instantaneamente por nome, marca, capacidade ou cor.
- **Seletor de Ordenação:** Menu elegante para ordenar por:
  - *Menor preço*
  - *Maior preço*
  - *Novidades / Lançamentos*
- **Pílulas de Categorias (Chips):**
  - Botões pílula com rolagem horizontal suave no mobile:
    - *Todos*
    - *iPhones Lacrados*
    - *iPhones Seminovos*
    - *Xiaomi & Android*
    - *Acessórios*
  - Estado ativo: destaque com contraste nítido (fundo branco com texto escuro ou verde acentuado).

### 3.5. Grid de Produtos (Cards no Padrão BLK Store)
- Grid com 2 colunas no celular e 3 a 4 colunas em telas médias e grandes.
- **Estrutura do Card:**
  - Card com fundo escuro (`bg-[#141414] border border-white/10 hover:border-white/20 rounded-2xl p-3 sm:p-4`).
  - Foto do produto em destaque com proporção quadrada (`aspect-square`), fundo neutro suave, zoom sutil no hover.
  - **Badges no topo da foto:**
    - Condição: `✨ Lacrado` ou `🔄 Seminovo`.
    - Saúde da bateria (para seminovos): `🔋 100%` ou `🔋 90%+`.
    - Garantia: `🛡️ 1 Ano`.
  - **Identificação do Modelo:** Marca em letras maiúsculas discretas, nome do modelo em destaque.
  - **Swatches de Cores:** Mini-esferas representando as cores disponíveis do modelo.
  - **Bloco de Preço:**
    - Preço à vista no Pix com selo de desconto.
    - Simulação de parcelas no cartão: *"ou 12x de R$ ... no cartão"*.
  - **Ação:** Clique no card navega para os detalhes completos do aparelho.

---

## 4. Página de Detalhes do Produto (`/produto/:id`)

- Layout dark premium mantendo a identidade visual da vitrine.
- **Apresentação Visual:**
  - Foto em alta definição em container com cantos suaves.
  - Badges de procedência (*Lacrado*, *Seminovo Revisado*, *Garantia de 1 Ano*).
- **Seleção Dinâmica:**
  - Seletor de capacidade (*128GB*, *256GB*, *512GB*, *1TB*).
  - Seletor de cores com indicação visual.
  - Informação de saúde da bateria para modelos seminovos.
- **Simulador de Parcelas:**
  - Tabela clara exibindo opções de 1x até 12x (ou 18x) no cartão.
- **Botão Principal de WhatsApp:**
  - Botão largo de alta conversão: *"Comprar pelo WhatsApp"*.
  - Gera link oficial do WhatsApp com mensagem pré-formatada contendo todos os dados selecionados pelo cliente:
    `"Olá! Vi na vitrine da Lojinha do Celular o [Modelo] [Capacidade] [Cor] ([Condição] - [Preço]) e gostaria de fechar o pedido!"`

---

## 5. Rodapé (Footer)

- Fundo escuro coeso com o restante da página (`bg-[#050505] border-t border-white/10`).
- Informações institucionais da Lojinha do Celular:
  - Horários de atendimento.
  - Endereços completos de Jardim-MS e Guia Lopes da Laguna.
  - Links de navegação e redes sociais (Instagram, WhatsApp).
  - CNPJ e notas de garantia.

---

## 6. Dados e Catálogo para o MVP

- Carregamento de dados híbrido:
  - Suporte total aos produtos existentes no banco de dados da loja via tRPC (`shop.products`).
  - Conjunto complementar de modelos consagrados da Apple (iPhone 13, 14, 15, 16, versões Pro e Pro Max, lacrados e seminovos) com imagens em alta resolução, garantindo que a vitrine fique completa, atraente e pronta para testes e vendas imediatamente.

---

## 7. Estratégia de Verificação

1. **Testes Visuais e de Responsividade:**
   - Conferir renderização correta em resoluções mobile (375px a 430px) e desktop (1024px a 1920px).
   - Testar o comportamento do vídeo do Hero (autoplay, muted, poster fallback).
2. **Testes Funcionais:**
   - Busca em tempo real e filtros por categoria.
   - Ordenação por preço e novidades.
   - Navegação do card para a página de detalhes.
   - Geração correta do link do WhatsApp com os dados do produto selecionado.
3. **Verificação de Build e Lint:**
   - Executar `pnpm check` para validação TypeScript.
   - Executar `pnpm lint` e `pnpm test` para garantir integridade da base de código.
