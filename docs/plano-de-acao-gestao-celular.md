# Plano de ação — Gestão Celular + Loja Online (Lojinha do Celular)

Atualizado em 10/10/2026. Baseado no que foi **verificado no código dos dois projetos** e na especificação pública do ERP
(`https://api.gestaocelular.com.br/api/docs-json`). Itens marcados como **(a confirmar)** dependem de teste real.

---

## 1. A tese: por que isso é uma vantagem do Gestão Celular

Hoje o ERP já entrega, por API pública, quase tudo que uma loja online precisa: **catálogo com estoque por unidade**
(`/api/storefront/{slug}/catalog`), **dados da empresa e das unidades** (nome, logo, cor, telefone), **pré-avaliação de aparelho**
(`/api/trade-in/public/{slug}/...`), **agendamento** (`/api/storefront/{slug}/appointments`) e **CRM com WhatsApp**
(Evolution API). A Lojinha do Celular já prova que isso funciona: o site puxa o catálogo do ERP e o Troca Fácil alimenta o
atendimento.

A oportunidade: **transformar a Lojinha na implementação de referência de um módulo "Loja Online" do Gestão Celular.**
Qualquer cliente do ERP conecta o slug da empresa e ganha, sem programador:

- vitrine com estoque real e por unidade;
- Troca Fácil (compra e troca de seminovos) com motor de avaliação;
- atendimento por WhatsApp e agendamento de visita;
- e o **ciclo que ninguém mais tem**: *cliente avalia o aparelho → loja compra → entra no estoque do ERP → aparece na vitrine*.

O ERP já vende complementos pelo Asaas (existe o "addon WhatsApp"), então "Loja Online" cabe como **addon ou plano superior**.

---

## 2. Estado atual (verificado)

### ERP (`old_gestao`)
| Ponto | Situação | Impacto |
|---|---|---|
| Tokens de API | A aba existe, mas é um **placeholder desativado**; não há modelo, serviço nem guard | Integração só por e-mail/senha de usuário (5 logins/min); sem escopo, sem revogação |
| `GET /api/storefront/{slug}` | Devolve **erro 500** em produção para o slug da Lojinha (`/catalog` funciona) | Endpoint de dados da vitrine quebrado **(causa a confirmar nos logs)** |
| `POST /api/tools/imei/consultar` | **Sem `@Permissions`** | Qualquer usuário autenticado consulta IMEI |
| Swagger do trade-in e entrada de seminovo | Corpos e respostas **vazios** | Quem integra precisa adivinhar formatos |
| Busca de cliente por CPF | Existe, mas só via listagem completa (muitos dados pessoais) | Integração lê mais dado pessoal do que precisa |
| Trade-in próprio do ERP | Tabela de preços, **deduções** (fixas/percentuais, grupos exclusivos), bônus de crédito, modo estimativa, validade da proposta | Existe um motor paralelo ao nosso: definir quem manda em quê |
| Webhooks | Módulo existe | Eventos de **estoque e preço** **(a confirmar)** |

### Site (`lojinhadocelular`)
| Ponto | Situação |
|---|---|
| Preso à Lojinha | ~149 menções a "Lojinha" em 38 arquivos, ~591 a Jardim/Guia Lopes, ~81 telefones/domínios fixos, slug do ERP como padrão |
| Primeiro acesso | Admin inicial com **senha padrão** |
| Banco | Tabelas criadas/alteradas ao subir o servidor; **sem migrações versionadas** |
| Teste automático | 1 teste consulta o ERP **real** e falha quando o estoque muda |
| Trabalho pendente | ~50 arquivos **não commitados** (Evolution, painel v2, relatórios, entrada no ERP, fidelidade, motor corrigido) |
| Já feito nesta etapa | Painel admin v2 completo, Evolution (mensagens ao cliente), entrada de seminovo no ERP (com consulta de IMEI), fidelidade por CPF, motor de preço corrigido, iCloud eliminatório |

---

## 3. Princípios

1. **ERP é a fonte da verdade** de estoque, clientes e documentos fiscais. **O site é a fonte** do funil de atendimento e da experiência.
2. **Menor privilégio:** a integração só pode o que precisa (ler cliente, dar entrada de seminovo, ler catálogo). Nunca administrador.
3. **Dado pessoal mínimo:** CPF e endereço passam, **não ficam** no site. Respostas do ERP para o site devem trazer só o necessário.
4. **Nada de ação irreversível automática:** entrada no estoque e NF-e são sempre confirmadas por uma pessoa.
5. **Configuração, não código:** uma loja nova não deve exigir programador.
6. **Produção primeiro:** migrações aditivas, testes antes de publicar, sem alterar dados de produção.

---

## 4. Arquitetura alvo

```
 Cliente da loja ──▶ Site (Loja Online) ──────────────┐
                      │  vitrine · Troca Fácil · painel │  slug da empresa
                      │                                 ▼
                      ├── público ──────────▶ ERP: catálogo · trade-in · agenda · marca/unidades
                      ├── token (escopos) ──▶ ERP: fidelidade · entrada de seminovo · IMEI
                      └── Evolution ────────▶ WhatsApp (mesma instância do CRM do ERP)
   ERP ── webhooks (estoque/preço) ──▶ Site atualiza na hora
```

- **Marca vem do ERP:** nome fantasia, logo, cor primária, telefone e unidades já são públicos. Configurar uma loja nova passa a ser
  **informar o slug** e ajustar o que o ERP não tem (textos, regras de preço).
- **Implantação:** começar com **uma instalação por loja** (modelo pronto para Coolify/Docker). Só evoluir para sistema único
  (multi-loja no mesmo servidor) se houver demanda comprovada.
- **Preço da avaliação (decidido):** o **site faz a pré-avaliação** (motor de preço, regras e calibração ficam aqui); o **ERP faz a conferência
  na loja** (entrada do aparelho, cliente, NF-e, contrato). **Não há sincronização de tabelas de preço** entre os dois: cada um cuida de uma etapa.
- **WhatsApp (decidido):** o site usa a **mesma instância da Evolution** do CRM do ERP. O site só **envia**; o ERP continua recebendo os eventos
  pelo webhook dele, então as mensagens do site devem aparecer na conversa do CRM **(a confirmar no teste real)**.

---

## 5. Plano por fases

Legenda de esforço: **P** ≈ 1–2 dias · **M** ≈ 3–5 dias · **G** ≈ 1–2 semanas. Responsável: **Codex-ERP** (pedido em `docs/codex/erp-api-tokens.md`), **Claude-site** (este repositório), **Você** (decisão/ação no ERP ou servidor).

### Fase 0 — Fundação e higiene (esta semana)
| # | Entrega | Quem | Esf. | Aceite |
|---|---|---|---|---|
| 0.1 | **Commitar o trabalho pendente em commits por assunto** (motor, Troca Fácil, painel, Evolution, ERP, fidelidade) e abrir PR | Claude-site | P | `git status` limpo; PR com lista de validações |
| 0.2 | **Primeiro teste real** do fluxo com usuário de serviço **VENDEDOR** (checklist na seção 9) | Você + Claude | P | Resultado de cada item registrado; ajustes de formato se preciso |
| 0.3 | Trocar o teste que consulta o ERP real por um com **dados fixos** | Claude-site | P | `pnpm test` verde sem rede |
| 0.4 | **Backup do banco** antes de publicar (as tabelas novas e colunas são criadas sozinhas no 1º acesso) | Você | P | Backup restaurável confirmado |
| 0.5 | Publicar e configurar `ERP_SERVICE_*`, **Evolution (a mesma instância do CRM do ERP)** e números das unidades no servidor | Você | P | "Testar login" verde na tela Integração ERP; mensagem de teste aparece também no CRM do ERP |

### Fase 1 — ERP profissional (Codex na pasta `old_gestao`)
| # | Entrega | Quem | Esf. | Aceite |
|---|---|---|---|---|
| 1.1 | ✅ **Implementado na branch `feat/api-tokens` do ERP (revisado, falta aplicar a migration e publicar)** — Tokens de API reais (hash, escopos permitidos, validade, revogação, tela na aba existente, modelo "Integração do site") | Codex-ERP | G | Token criado na tela autentica `GET /api/clientes`; escopo proibido é recusado; revogado deixa de valer |
| 1.2 | **`GET /api/clientes/fidelidade?cpf_cnpj=`** com resposta mínima (achou? nº de compras não canceladas, última compra) | Codex-ERP | P | Sem nome/telefone/endereço na resposta |
| 1.3 | `@Permissions('aquisicoes:criar')` em `tools/imei/consultar` | Codex-ERP | P | ADMIN, GERENTE e VENDEDOR continuam com acesso |
| 1.4 | **Investigar e corrigir o 500** de `GET /api/storefront/{slug}` | Codex-ERP (com logs) | P–M | Endpoint responde 200 para o slug da Lojinha |
| 1.5 | **Tipar no Swagger** as respostas de trade-in e `entrada-seminovo` | Codex-ERP | P | Swagger mostra DTOs, não corpo vazio |
| 1.6 | Relatório de **webhooks** (eventos/assinatura) e proposta de eventos de estoque/preço | Codex-ERP | P | Documento com a lista e o desenho |

### Fase 2 — Site pronto para token e seguro
| # | Entrega | Quem | Esf. | Aceite |
|---|---|---|---|---|
| 2.1 | ✅ **Feito:** suporte a **`ERP_API_TOKEN`** (e-mail/senha como alternativa) e uso do endpoint `GET /api/clientes/fidelidade` (com reserva para ERP sem o endpoint) | Claude-site | P | Fluxo completo com token; testes com ERP simulado. **Falta o teste real** depois que o ERP publicar os tokens |
| 2.2 | **Assistente de primeiro acesso**: acaba a senha de admin padrão; dono cria senha forte | Claude-site | M | Instalação nova não aceita login padrão |
| 2.3 | **Segredos de integração criptografados no banco** (token do ERP, chave da Evolution), mascarados e só-escrita no painel | Claude-site | M | Valor nunca volta para a tela; teste de criptografia |
| 2.4 | **Migrações versionadas** (substituir criação/alteração automática no start) | Claude-site | M | Subir versão nova aplica migrações em ordem; rollback documentado |
| 2.5 | Verificação de saúde (`/api/health`), logs sem dados pessoais, **CI** (lint + test + build a cada PR) | Claude-site | P | Pipeline verde obrigatório |

### Fase 3 — Controle do dono (agora) e multi-loja (adiado)
| # | Entrega | Quem | Esf. | Aceite |
|---|---|---|---|---|
| 3.1 | ⏸️ **ADIADO** — Marca e unidades vindas do ERP (nome, logo, cor, telefone, unidades) | Claude-site | G | Só entra se surgir comprador |
| 3.2 | ⏸️ **ADIADO** — Remover tudo que é fixo da Lojinha; unidades dinâmicas (1..N) | Claude-site | G | Só entra se surgir comprador |
| 3.3 | **Editor do Troca Fácil**: modelos aceitos, perguntas (com desconto em R$ ou % e opção eliminatória), fotos, textos, o que o cliente vê; rascunho/publicar e pré-visualização | Claude-site | G | Dono altera o fluxo sem programador |
| 3.4 | **Motor de preço configurável**: regras editáveis, simulador, histórico de preços com desfazer, edição em massa, campanhas com data | Claude-site | G | Simulador reproduz o cálculo do cliente |
| 3.5 | **Calibração com dados reais**: gravar a estimativa em cada avaliação e comparar estimado × oferecido × fechado | Claude-site | M | Relatório mostra o desvio por modelo |
| 3.6 | **Funil de abandono** do Troca Fácil por etapa | Claude-site | M | Painel mostra onde o cliente desiste |

### Fase 4 — Produto e lançamento (⏸️ em espera até haver interessado)
| # | Entrega | Quem | Esf. | Aceite |
|---|---|---|---|---|
| 4.1 | **Modelo de instalação** (Coolify/Docker) com variáveis claras e checklist de primeiro acesso | Claude-site | M | Instalação nova em < 30 min por alguém sem programar |
| 4.2 | Documentação: instalação, **permissões mínimas do ERP**, LGPD, backup, atualização de versão | Claude-site | M | Terceiro segue o guia sem ajuda |
| 4.3 | **Piloto: a própria Lojinha do Celular (`https://lojinhadocelular.com/`)**, já em produção; depois 1 loja externa | Você | M | Feedback registrado; defeitos corrigidos antes de oferecer a outra loja |
| 4.4 | Definir **embalagem comercial** (addon, plano, setup) e suporte | Você | M | Preço e escopo definidos |

### Fase 5 — Diferenciais que só o Gestão Celular tem
| # | Entrega | Esf. | Observação |
|---|---|---|---|
| 5.1 | **Estoque e preço em tempo real** pelos webhooks do ERP (sem esperar 45 s) | M | Depende de 1.6 |
| 5.2 | **Agendar visita** ao final do Troca Fácil (rota de agendamento do ERP) | P–M | Rota pública já existe |
| 5.3 | **Oportunidade no CRM** do ERP para avaliações em negociação (opcional, desligável) | M | Não gera estoque nem compra |
| 5.4 | **Margem real** (compra no Troca Fácil × venda no ERP) e giro de seminovos | M | Cruza avaliação e venda |
| 5.5 | **Histórico unificado no CRM**: conferir que o que o site envia aparece na conversa do ERP e definir quem responde ao cliente | P–M | Decisão tomada: mesma instância (ver Fase 0.5) |
| 5.6 | **Termo de compra assinado** (aquisição do ERP) a partir da troca concluída | M | Rotas de contrato/assinatura já existem |
| 5.7 | Outras marcas além de iPhone | G | Depois de validar o iPhone |

---

## 6. Ordem de execução e dependências

```
0.1 → 0.2 → 0.5            (agora: commit, teste real, publicar)
        │
        └─ resultado do 0.2 ajusta 2.1
1.1 + 1.2 (Codex-ERP) ───▶ 2.1 (site usa token e fidelidade)
1.3 · 1.4 · 1.5 · 1.6 ───▶ independentes, em paralelo ao site
2.2 → 2.3 → 2.4 → 2.5     (segurança e base técnica)
2.x concluído ───▶ 3.3–3.6 (controle do dono) ───▶ 5.x (diferenciais)
                     3.1–3.2 e 4.x ficam em espera até existir um comprador
```

Dois trilhos podem andar **em paralelo**: o Codex no ERP (Fase 1) e o site (Fases 0, 2 e 3).

---

## 7. Métricas de sucesso

| Métrica | Meta inicial |
|---|---|
| Tempo para uma loja nova entrar no ar | < 30 minutos, sem programador |
| Avaliações respondidas dentro do prazo (SLA) | ≥ 90% |
| Conclusão do Troca Fácil (começou → enviou) | Medir hoje e subir 15% em 60 dias |
| Divergência estimativa × valor fechado | Medir hoje e reduzir a cada mês |
| Entradas no ERP com IMEI/CPF inválido ou duplicado | 0 (barradas antes do envio) |
| Falhas de comunicação com o ERP | < 1% das chamadas, com alerta |

---

## 8. Riscos e decisões em aberto

| Risco | Mitigação |
|---|---|
| Formato real das respostas do ERP difere do lido (login, entrada, histórico) | Primeiro teste real (0.2); leitura tolerante já implementada; tipar Swagger (1.5) |
| Senha do usuário de serviço vazar | Papel VENDEDOR; migrar para token com escopo (1.1); revogar sem trocar senha |
| Aparelho roubado/impedido entrar no estoque | Consulta de IMEI e bloqueio já implementados; exigir resultado ANATEL quando o ERP não consulta |
| Divergência entre motor de preço do site e trade-in do ERP | Decidir dono de cada etapa (abaixo) |
| Migrar para multi-loja cedo demais | Começar por instalação por loja; reavaliar com o piloto |
| Mudar o ERP em produção | Migrações aditivas, um commit por tarefa, `AGENTS.md` do ERP, testes antes de publicar |

**Decisões tomadas (10/10/2026)**
- Preço: **site = pré-avaliação; ERP = conferência na loja**, sem sincronizar tabelas.
- WhatsApp: **mesma instância da Evolution** do CRM do ERP.
- Piloto: **`https://lojinhadocelular.com/`** (a própria Lojinha, que já está no ar).

**Mensagens automáticas: ERP × site (verificado no código do ERP)**
O ERP já avisa o cliente sozinho em: **aniversário, lembrete de retirada na prateleira, pós-venda (1 e 7 dias úteis), acompanhamento de orçamento e
SLA do CRM**. Nenhuma delas cobre as etapas do **Troca Fácil** (avaliação recebida, atendente definido, proposta, concluída, encerrada), que só existem
no site. Portanto **não há duplicidade**: as mensagens automáticas do site continuam ligadas. Ponto de atenção na instância compartilhada: quando o
cliente **responde** à mensagem do site, a resposta cai no CRM do ERP, e as **regras de automação do CRM** (gatilho "mensagem recebida") podem reagir a
ela. Conferir no teste real (Fase 0.5) e, se necessário, ajustar essas regras.

**Escopo (decidido em 10/10/2026)**
- **Agora o sistema é exclusivo da Lojinha do Celular.** Foi construído para ela e o foco é deixá-la estável, segura e com mais controle.
- **Vender a Loja Online/catálogo para outras empresas é uma possibilidade futura**, não uma meta atual. Por isso:
  - a **Fase 4 (produto e lançamento) fica em espera**;
  - o **white-label completo (3.1 e 3.2) fica adiado**: não vale investir semanas em multi-loja antes de existir um comprador;
  - mantemos uma regra barata para não encarecer o futuro: **não criar novos valores fixos da Lojinha**; o que for novo entra como configuração (painel/ambiente), não como texto escrito no código.

---

## 9. Checklist do primeiro teste real (Fase 0.2)

Faça com um aparelho e um cliente de **teste**, anotando o resultado de cada item:

1. **Login do usuário de serviço:** tela Integração ERP › "Testar login" (deve mostrar conectado e as duas unidades encontradas).
2. **Fidelidade:** abrir uma avaliação com origem "Lojinha do Celular" › card "Bônus de fidelidade" › CPF de um cliente seu que já comprou › "Conferir". Anotar o status e a nota.
3. **IMEI:** abrir uma troca concluída › "Dar entrada no ERP" com um IMEI de teste válido. Conferir a resposta da consulta (ANATEL consultada ou pedido de resultado manual).
4. **Entrada:** concluir a entrada **sem NF-e**, conferir o aparelho no estoque do ERP e depois **excluí-lo no ERP**.
5. **Recusas:** tentar um IMEI inválido e um duplicado; confirmar que o erro aparece e que dá para corrigir e tentar de novo.
6. **Mensagens:** enviar uma avaliação pelo Troca Fácil e conferir a mensagem automática ao cliente e o aviso à equipe (Evolution).
7. **Troca Fácil no celular:** passar pelo fluxo completo, inclusive a pergunta do iCloud respondendo "Não" (deve recusar) e "Não sei".

Qualquer divergência de formato: me enviar a resposta do ERP (sem o token) para ajustar a leitura.

---

## 10. Referências
- Pedido para o Codex no ERP: `docs/codex/erp-api-tokens.md`
- Especificação pública do ERP: `https://api.gestaocelular.com.br/api/docs-json`
- Variáveis de ambiente novas: `.env.example` (`ERP_SERVICE_*`, `ERP_UNIT_ID_*`, `EVOLUTION_*`)
