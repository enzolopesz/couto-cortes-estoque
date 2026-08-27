# Couto & Cortês — Painel de Estoque

## Escopo entregue

Esta etapa implementa um painel administrativo privado e independente para controle de filamentos. O site público de referência não é importado nem alterado por este projeto. A interface usa fundo azul-marinho quase preto, acentos azul elétrico e roxo, tipografia Space Grotesk para a operação e IBM Plex Mono para valores técnicos, mantendo uma linguagem de fabricação digital.

## Tabelas criadas

| Tabela | Finalidade | Isolamento |
|---|---|---|
| `users` | Usuários autenticados do scaffold, com `id`, `openId`, nome, e-mail, papel e timestamps. | Sessão do usuário autenticado. O proprietário do projeto é promovido automaticamente a `admin` pelo fluxo OAuth existente. |
| `filaments` | Cadastro de matéria-prima com material, cor, marca, diâmetro, pesos, mínimo, custo, localização, status, observação, proprietário e timestamps. | Todas as queries e mutações exigem autenticação e filtram simultaneamente por `id` e `ownerId`. |

### Nota sobre RLS

O projeto foi inicializado no stack full-stack provisionado, que usa MySQL/TiDB via Drizzle e não oferece a política RLS nativa do Supabase/PostgreSQL. Por isso, a proteção equivalente foi aplicada no servidor: nenhum procedimento de estoque é público, cada registro recebe o `ownerId` da sessão e toda leitura, edição ou exclusão usa a condição combinada `filament.id = input.id AND filament.ownerId = ctx.user.id`. O cliente não pode escolher o proprietário do registro. Essa estratégia deve ser mantida em qualquer novo procedimento do módulo.

## Rotas

| Rota | Acesso | Descrição |
|---|---|---|
| `/` | Público | Entrada mínima independente para o painel. |
| `/estoque/login` | Público | Tela de autenticação segura via OAuth do projeto. Após autenticação, redireciona para `/estoque`. |
| `/estoque` | Protegida | Dashboard com total de rolos, peso disponível, itens abaixo do mínimo, inventário recente e estado vazio. |
| `/estoque/filamentos` | Protegida | CRUD completo com busca, filtros por material, marca, cor e status, filtro de estoque baixo, edição e exclusão confirmada. |

Os itens **Movimentações**, **Produtos prontos** e **Configurações** aparecem como “Em breve” e não executam funcionalidades nesta etapa.

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
