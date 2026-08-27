# Couto & Cortês — Painel de Estoque

## Escopo entregue

Esta etapa implementa um painel administrativo privado e independente para controle de filamentos. O site público de referência não é importado nem alterado por este projeto. A interface usa fundo azul-marinho quase preto, acentos azul elétrico e roxo, tipografia Space Grotesk para a operação e IBM Plex Mono para valores técnicos, mantendo uma linguagem de fabricação digital.

## Tabelas criadas

| Tabela | Finalidade | Isolamento |
|---|---|---|
| `users` | Usuários autenticados do scaffold, com `id`, `openId`, nome, e-mail, papel e timestamps. | Sessão do usuário autenticado. O proprietário do projeto é promovido automaticamente a `admin` pelo fluxo OAuth existente. |
| `filaments` | Cadastro de matéria-prima com material, cor, marca, diâmetro, unidade base, peso por rolo/unidade, saldo, mínimo, custo, status, observação, proprietário e timestamps. | Todas as queries e mutações exigem autenticação e filtram simultaneamente por `id` e `ownerId`. |

### Nota sobre RLS

O projeto foi inicializado no stack full-stack provisionado, que usa MySQL/TiDB via Drizzle e não oferece a política RLS nativa do Supabase/PostgreSQL. Por isso, a proteção equivalente foi aplicada no servidor: nenhum procedimento de estoque é público, cada registro recebe o `ownerId` da sessão e toda leitura, edição ou exclusão usa a condição combinada `filament.id = input.id AND filament.ownerId = ctx.user.id`. O cliente não pode escolher o proprietário do registro. Essa estratégia deve ser mantida em qualquer novo procedimento do módulo.

## Rotas

| Rota | Acesso | Descrição |
|---|---|---|
| `/` | Público | Entrada mínima independente para o painel. |
| `/estoque/login` | Público | Tela de autenticação segura via OAuth do projeto. Após autenticação, redireciona para `/estoque`. |
| `/estoque` | Protegida | Dashboard com itens cadastrados, saldo separado em peso/unidades, itens abaixo do mínimo, inventário recente e estado vazio. |
| `/estoque/filamentos` | Protegida | CRUD completo com busca, filtros por material, marca, cor e status, filtro de estoque baixo, edição e exclusão confirmada. |

**Movimentações** está disponível em `/estoque/movimentacoes` e **Produtos prontos** em `/estoque/produtos`. **Configurações** permanece como módulo futuro.

## Primeiro usuário administrador

1. Abra `/estoque/login` no ambiente do projeto.
2. Entre usando a conta autorizada no fluxo seguro de autenticação.
3. O callback cria ou atualiza o usuário na tabela `users`.
4. A conta proprietária configurada no projeto (`OWNER_OPEN_ID`) recebe automaticamente o papel `admin` durante o primeiro login.
5. Depois do redirecionamento para `/estoque`, use **Novo filamento** para iniciar o inventário.

O módulo de estoque está protegido para usuários autenticados e os dados são isolados por usuário. Caso a operação precise restringir o acesso somente ao papel `admin`, o próximo passo é trocar os procedimentos de `protectedProcedure` por `adminProcedure` e manter a mesma estratégia de escopo.

## Notificações de estoque mínimo

Ao cadastrar um filamento já no limite, ou ao editar um filamento que esteja no limite ou abaixo dele, o servidor tenta enviar uma notificação ao proprietário do projeto através do canal operacional integrado. O alerta persistente também aparece no dashboard e o usuário recebe um aviso quando o canal externo não confirmar a entrega; assim, uma falha temporária de notificação não oculta o problema operacional.

A condição visual de baixo estoque é `currentWeight <= minimumWeight`.

## Validação realizada

A suíte Vitest cobre o bloqueio de leitura sem autenticação e a rejeição de peso atual acima do peso inicial, além do teste existente de logout. O build de produção e a checagem TypeScript foram executados com sucesso. Também foram verificadas as telas de entrada, dashboard e filamentos em desktop e viewport móvel.

## Etapa 2 — Movimentações de estoque

A tabela `stock_movements` foi criada com `id` UUID textual, `filamentId`, `type`, `quantityGrams`, `previousWeightGrams`, `resultingWeightGrams`, `description`, `createdBy` e `createdAt`. Como a base existente usa IDs numéricos para `filaments` e `users`, os relacionamentos mantêm esses IDs para preservar a integridade do projeto; o identificador da movimentação permanece UUID.

| Função | Finalidade |
|---|---|
| `listStockMovementsByOwner(ownerId)` | Lista o histórico mais recente primeiro, juntando filamento e usuário e filtrando pelo proprietário. |
| `createStockMovement(input)` | Executa em transação a leitura do saldo, cálculo do resultado, atualização otimista do filamento e inserção do evento auditável. |
| `movements.list` | Procedimento tRPC protegido para consulta do histórico. |
| `movements.create` | Procedimento tRPC protegido para entrada, consumo, perda, ajuste, reserva e liberação de reserva. |

A operação rejeita saldo resultante negativo, quantidade inválida, ajuste sem novo peso real e tentativas concorrentes que tenham alterado o saldo entre a leitura e a atualização. Restrições `CHECK` no banco reforçam quantidades positivas e saldos não negativos. Movimentações não possuem exclusão na interface.

A página `/estoque/movimentacoes` contém busca por filamento, marca, cor e descrição, filtros por tipo, filamento e período, histórico responsivo e modal com prévia do saldo. Ao concluir uma operação, são invalidados o histórico, a lista de filamentos e o resumo do dashboard sem recarregar a página. Perdas usam destaque vermelho e cada tipo possui badge e ícone próprios.

## Como testar entrada e consumo

Primeiro, cadastre um item em `/estoque/filamentos` e escolha a unidade base. Para um filamento, use **Peso** e, se quiser movimentar por rolo, informe 1.000 g em peso por rolo. Para um item contado, use **Unidade** e informe saldos inteiros. Em seguida, abra `/estoque/movimentacoes`, selecione **Nova movimentação**, escolha o rolo, selecione **Entrada**, informe 500 g e confirme. O saldo deve passar de 1.000 g para 1.500 g e o histórico deve registrar a operação.

Depois, repita o fluxo selecionando **Consumo em impressão** e informando 200 g. O saldo deve passar de 1.500 g para 1.300 g. Para verificar a proteção, tente consumir mais do que o saldo disponível: a confirmação deve ser bloqueada na prévia e a API também rejeita a operação. O dashboard e a lista de filamentos devem refletir o novo saldo automaticamente.

### Estratégia de acesso

O stack provisionado usa MySQL/TiDB, portanto não possui RLS nativo do Supabase. O equivalente aplicado no servidor exige sessão autenticada, grava `createdBy` a partir da sessão e lista movimentos somente quando o filamento relacionado pertence ao `ownerId` autenticado. A movimentação não é exposta por procedimento público e não pode ser excluída pela interface.


## Etapa 3 — Unidades de medida compatíveis

A tabela `filaments` agora possui `baseUnit` (`weight` ou `unit`) e `weightPerUnit` em gramas. Os filamentos existentes foram preservados e permanecem controlados por peso, com base padrão em gramas. A tabela `stock_movements` ganhou `inputUnit`, `inputQuantity`, `quantityBase`, `previousBalance` e `resultingBalance`; as colunas legadas em gramas continuam disponíveis para compatibilidade com o histórico anterior.

Para itens de peso, o modal permite `g` e `kg`; `rolo` aparece somente quando `weightPerUnit` está configurado. As conversões são `1 kg = 1.000 g` e `1 rolo = peso por unidade`. Para itens de unidade, somente `un` é aceito e a quantidade precisa ser inteira. O backend repete todas as regras de compatibilidade e rejeita operações incompatíveis antes da escrita transacional.

O dashboard, a listagem de filamentos e o histórico exibem a unidade base apropriada. O resumo do dashboard separa o total em gramas do total em unidades para não somar grandezas diferentes. A prévia do modal mostra a quantidade convertida e o saldo resultante na unidade mais amigável.

A migração aplicada é `drizzle/0003_spotty_psylocke.sql`. Ela adiciona colunas sem remover dados; o backfill do histórico copia os valores legados para os campos genéricos de saldo e quantidade. O fluxo de leitura também normaliza registros legados caso encontre uma linha ainda não preenchida. A validação final passou com **15 testes**, checagem TypeScript e build de produção. O CRUD rejeita saldos fracionados para itens por unidade; ajustes fracionados também são recusados antes de qualquer `update` ou `insert`.


## Produtos internos e produção

A etapa atual usa exclusivamente a tabela `inventory_products`; não existe consulta, alteração ou duplicação da tabela pública `products`. Cada produto interno possui `name`, `category`, `image_url`, `sku`, `active` e `external_product_id` opcional, reservado para futura sincronização. O estoque unitário fica em `product_inventory`, com `quantity_available` e `minimum_quantity`. As produções ficam em `production_records`; não há localização física nesta versão.

A rota protegida `/estoque/produtos` oferece criação, edição, exclusão, busca, filtro por categoria, configuração de estoque em unidades inteiras e registro de produção. A confirmação executa uma transação que valida o material, baixa o filamento, cria a movimentação automática de consumo, registra a produção e aumenta o estoque do produto pronto. O dashboard mostra produtos prontos e produções recentes.

### Roteiro de teste

Cadastre um produto interno, por exemplo “Suporte de parede”, e configure estoque mínimo `2 un`. Depois selecione **Registrar produção**, escolha o produto, um filamento com saldo de `1.000 g`, informe `3` em quantidade produzida, `120` em consumo por unidade e `g` como unidade. A prévia deve mostrar `0 un → 3 un` no produto e `1.000 g → 640 g` no material. Ao confirmar, devem ser criados o registro de produção e o consumo, o estoque pronto deve subir para `3 un` e o filamento deve baixar para `640 g`. Qualquer saldo insuficiente ou unidade incompatível deve abortar toda a transação.
