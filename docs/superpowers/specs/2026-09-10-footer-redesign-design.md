# Design Spec: Redesign do Rodapé (Apple Clean Flagship)

- **Data:** 2026-09-10
- **Projeto:** Lojinha do Celular
- **Objetivo:** Elevar o rodapé do site para padrão profissional de e-commerce de tecnologia de alto valor (estilo Apple Clean Flagship), organizando benefícios de compra, unidades físicas, formas de pagamento, credenciais legais e preservação total de indexação SEO.

---

## 1. Visão Geral e Motivação

O rodapé anterior apresentava problemas comuns em sites de menor orçamento:
- Ausência de delimitador visual claro e de barra de benefícios institucionais;
- Uso de emojis em pílulas genéricas (`🛡️`, `🇺🇸`);
- Informações de unidades físicas em listas de texto simples sem ênfase interativa;
- Parágrafo corrido de termos de busca no final, transmitindo aspecto de *keyword stuffing* desorganizado;
- Falta de selos de pagamento e segurança explícitos.

A nova versão adota o **Conceito Apple Clean Flagship**, com fundo claro suave (`bg-[#fafafc]` / `bg-white`), tipografia hierarquizada, ícones vetoriais em SVG monocromático, botões diretos de rota e contato para as lojas físicas de Jardim e Guia Lopes, selos de pagamento/segurança e uma gaveta retrátil suave para os termos de SEO local.

---

## 2. Estrutura de Componentes

O componente principal a ser modificado é:
- `src/components/Footer.tsx`

### 2.1 Barra Superior de Benefícios (Trust Bar)
- **Container:** `bg-[#fafafc] border-b border-neutral-100 py-6 px-4 sm:px-8`
- **Grid:** 4 colunas responsivas (`grid-cols-2 md:grid-cols-4 gap-6`)
- **Itens:**
  1. **Garantia até 1 Ano** (`ShieldCheck`): "Procedência verificada e nota fiscal"
  2. **Pronta Entrega** (`PackageCheck`): "Jardim, Guia Lopes & envio segurado MS"
  3. **Até 12x no Cartão** (`CreditCard`): "Ou desconto especial à vista no Pix"
  4. **Suporte Humanizado** (`MessageCircle`): "Atendimento direto com consultores"

### 2.2 Grid Principal (4 Colunas)
- **Container:** `max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10`
- **Coluna 1 (Identidade & Marca):**
  - Logo oficial `/images/logo-icon.png` (h-9 w-auto);
  - Tipografia: "LOJINHA DO CELULAR", subtítulo "iPhones & Acessórios Premium";
  - Micro-bio de autoridade (Apple Specialist, Android de ponta, assistência técnica);
  - Badges de selos vetorizados: "Procedência Garantida" e "Importação Direta EUA";
  - Ações sociais: Botões minimalistas para Instagram (`@lojinhadocelular`) e WhatsApp oficial.
- **Coluna 2 (Unidade Jardim / MS):**
  - Título com ponto pulsante verde (`bg-emerald-500`);
  - Endereço com link para Google Maps (`s.mapsJardim`);
  - Telefone formatado em destaque clicável (`(67) 99208-6012`);
  - Horários de funcionamento (Seg a Sex: 07h30 às 18h | Sáb: 07h30 às 12h).
- **Coluna 3 (Unidade Guia Lopes / MS):**
  - Título com ponto pulsante verde;
  - Endereço com link para Google Maps (`s.mapsGll`);
  - Telefone formatado em destaque clicável (`(67) 99820-6533`);
  - Horários de funcionamento.
- **Coluna 4 (Navegação & Departamentos):**
  - Links limpos com efeito hover:
    - Vitrine de Aparelhos (`/#vitrine`)
    - Avaliar meu iPhone (`https://trocafacil.lojinhadocelular.com` com badge "Troca")
    - Assistência Especializada (`/#servicos`)
    - Garantia & Procedência
    - Termos de Privacidade & LGPD (`/privacidade`)
    - Política de Cookies (`/privacidade#cookies`)

### 2.3 Barra de Pagamentos & Segurança
- **Container:** `border-t border-neutral-100 bg-[#fafafc] px-4 py-4`
- **Elementos:**
  - Pílulas minimalistas de pagamento: PIX à vista, Cartão até 12x, Visa, Mastercard, Elo;
  - Selo de segurança: SSL 256-bit Seguro com indicador verde;
  - CNPJ oficial: `61.874.839/0001-43`.

### 2.4 Gaveta Retrátil de SEO Local
- **Container:** `border-t border-neutral-100/80 bg-[#f9f9fb] px-4 py-3.5`
- **Comportamento:**
  - Linha inicial discreta com texto resumido e botão interativo: *"Ver cidades atendidas e termos de busca ▾"*;
  - Ao expandir (com transição suave de fade/collapse):
    - **Aparelhos:** iPhone Lacrado, iPhone Seminovo, Xiaomi, Redmi Note, POCO, Samsung Galaxy, iPad, Apple Watch;
    - **Assistência Técnica:** Troca de tela na hora, troca de bateria com saúde, reparo em placa, conector de carga;
    - **Cidades MS:** Jardim, Guia Lopes da Laguna, Bonito, Nioaque, Bela Vista, Porto Murtinho, Caracol, Maracaju.
  - Mantém todo o conteúdo textual indexável no DOM para os robôs do Google sem degradar a estética do usuário.

### 2.5 Sub-footer Inferior (Copyright & Jurisdição)
- **Container:** `border-t border-neutral-200/60 bg-white py-5 px-4 text-center text-xs text-neutral-400`
- Links centrais de conformidade legal (Privacidade, Cookies, LGPD, Avaliação);
- Copyright oficial: `© 2026 Lojinha do Celular. Todos os direitos reservados. CNPJ: 61.874.839/0001-43 • Telefone: (67) 99208-6012`.

---

## 3. Dados Dinâmicos e Integrações
- Continua consumindo `useShopSettings()` de `@/lib/shop` para endereços (`addressJardim`, `addressGll`), links de mapa (`mapsJardim`, `mapsGll`) e números de WhatsApp (`whatsappJardim`, `whatsappGll`).
- Utiliza a função utilitária `waLink(...)` para gerar links de WhatsApp com mensagens contextuais.

---

## 4. Plano de Verificação
1. **TypeScript & Linter:** Executar `pnpm check` e `pnpm lint` para garantir zero erros ou tipos quebrados.
2. **Build de Produção:** Executar `pnpm build` para validar empacotamento do Vite.
3. **Responsividade:** Testar layout em Mobile (< 640px), Tablet (640px-1024px) e Desktop (> 1024px).
4. **Interatividade:** Verificar abertura e fechamento suave da gaveta de SEO.
5. **Captura Visual:** Gerar screenshot final do rodapé integrado para validação visual.
