# Validação visual — Tipo de controle e unidade de medida

## Desktop — `/estoque/filamentos?novo=1`

- Modal **Novo filamento** abriu corretamente em tema escuro, sem superfícies brancas.
- Os campos **Tipo de controle** e **Unidade de medida** aparecem lado a lado.
- O padrão solicitado está visível: **Peso** e **g**.
- Os labels dinâmicos no estado inicial exibem `Peso por rolo/unidade (g)`, `Saldo inicial (g)`, `Saldo disponível (g)` e `Estoque mínimo (g)`.
- O espaçamento, foco azul e selects compatíveis com o design system foram preservados.

## Mobile — viewport 390×844

- O modal permanece responsivo, com os campos reorganizados em uma coluna e rolagem vertical interna.
- Os dois selects aparecem com largura adequada, texto legível e fundo escuro.
- O padrão **Peso / g** e os labels em `(g)` permanecem visíveis sem overflow horizontal.
- A parte inferior do formulário continua acessível por rolagem; não foram observadas colunas quebradas ou elementos fora da tela.

## Observação

A validação visual capturou o estado inicial padrão. A compatibilidade dos estados `kg`, `Quantidade/un` e `Comprimento/m`, além das conversões, foi coberta pela implementação server-side e pelos testes TypeScript/Vitest; a troca de opções deve ser confirmada no fluxo interativo antes de publicar caso seja necessária evidência adicional.

## Estados dinâmicos — desktop e mobile

Foram capturados os estados temporários de pré-visualização para `Peso / kg`, `Quantidade / un` e `Comprimento / m` em desktop e viewport móvel. Em desktop, os selects permanecem alinhados e o modal não cria espaços vazios indevidos: o campo de peso por rolo aparece somente em Peso, enquanto Quantidade e Comprimento reorganizam naturalmente os campos restantes. Em mobile, todos os estados permanecem em uma coluna, com textos legíveis e rolagem interna; não houve overflow horizontal.

Os labels observados foram coerentes com a unidade: `(kg)` em peso por rolo, saldo inicial, saldo disponível e estoque mínimo no estado kg; `(un)` nos três saldos para Quantidade; e `(m)` nos três saldos para Comprimento. As telas mantiveram fundo escuro e selects compatíveis com o tema.
