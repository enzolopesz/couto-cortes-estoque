# Project TODO

- [x] Preservar as páginas públicas existentes fora da área administrativa
- [x] Definir identidade visual do painel alinhada à Couto & Cortês
- [x] Criar tabela de filamentos com campos de estoque, custo, localização, status e timestamps
- [x] Configurar regras de acesso por usuário para os dados de filamentos
- [x] Implementar login, controle de sessão e rotas protegidas da área administrativa
- [x] Construir layout administrativo com navegação lateral fixa no desktop e responsiva no celular
- [x] Construir dashboard com cards de resumo e estados vazios
- [x] Implementar CRUD completo de filamentos
- [x] Implementar busca e filtros por material, marca, cor e status
- [x] Implementar indicador visual de estoque baixo com base no estoque mínimo
- [x] Implementar confirmação antes da exclusão de filamentos
- [x] Implementar notificação ao responsável quando o peso atingir ou ficar abaixo do estoque mínimo
- [x] Manter Movimentações e Produtos prontos como itens Em breve, sem implementação nesta etapa
- [x] Adicionar feedbacks de sucesso, erro e carregamento
- [x] Validar testes unitários, build, rotas protegidas e responsividade
- [x] Documentar tabelas criadas, rotas disponíveis e criação do primeiro usuário administrador

## Histórico de mudanças

- [x] Evolução solicitada: incluir notificações de estoque mínimo e reforçar experiência industrial/tecnológica elegante
- [x] Requisito original: somente base do painel, login e cadastro/CRUD de filamentos; sem vendas, pedidos, QR code ou financeiro

## Observações técnicas

- O site público de referência foi analisado e não será alterado por este projeto independente.
- Identidade observada: fundo azul-marinho quase preto, tipografia condensada/monoespaciada em caixa alta, acentos azul elétrico e roxo, detalhes de telemetria e linguagem de fabricação digital.
- A infraestrutura inicial do projeto usa autenticação Manus e banco MySQL/TiDB via Drizzle; a implementação deve respeitar as integrações já provisionadas e documentar qualquer adaptação necessária ao requisito de Supabase Auth/RLS.
- Notificações nesta etapa serão implementadas como alerta persistente no painel e feedback ao responsável, sem criar automações externas não solicitadas.

## Design System

- Fundo: #050914 / #0B1020
- Superfícies: #101827 / #141E30
- Texto principal: #F4F7FB
- Texto secundário: #8B98AD
- Acento primário: #168BFF
- Acento secundário: #7C5CFF
- Sucesso: #24D18A
- Alerta: #FFB547
- Erro: #FF6B7A
- Fontes: Space Grotesk para interface e IBM Plex Mono para telemetria/valores técnicos

## Revisão pós-validação

- [x] Documentar formalmente a estratégia de escopo por usuário no banco, pois o stack provisionado usa MySQL/TiDB e não oferece RLS nativo do Supabase
- [x] Adicionar filtros dedicados por marca e cor
- [x] Tratar o resultado/falha da notificação ao responsável e revisar a regra de disparo para itens que continuam abaixo do mínimo
- [x] Adicionar estados e toasts de erro para dashboard, listagem e mutações de filamentos
- [x] Criar documentação de entrega com tabelas, rotas e instruções para o primeiro administrador
- [x] Adicionar tratamento explícito de erro para a query de listagem de filamentos, evitando confundir falha de carga com estado vazio
- [x] Incidente: reiniciar o servidor de desenvolvimento e confirmar que o preview volta a responder

## Nova etapa: movimentações de estoque

- [x] Criar tabela stock_movements com histórico auditável e escopo por usuário
- [x] Aplicar migração e documentar a limitação/estratégia equivalente ao RLS no MySQL/TiDB provisionado
- [x] Implementar operação transacional para criar movimentação e atualizar saldo do filamento juntos
- [x] Validar entradas, consumos, perdas, ajustes, reservas e liberações sem permitir saldo negativo
- [x] Adicionar rota protegida /estoque/movimentacoes e remover o selo Em breve do menu
- [x] Construir histórico com busca, filtros por tipo/período/filamento e ordenação recente primeiro
- [x] Construir modal de nova movimentação com prévia clara do saldo resultante
- [x] Adicionar badges e ícones específicos por tipo, destacando perdas e saldo baixo
- [x] Atualizar dashboard, lista de filamentos e histórico após movimentações sem recarregar a página
- [x] Compactar os cards da visão geral em grade de três colunas no desktop
- [x] Adicionar testes para cálculo de saldo, validações e escopo de acesso
- [x] Atualizar documentação com tabelas, funções/RPCs e roteiro de teste de entrada e consumo

## Revisão dos testes de movimentações

- [x] Adicionar testes cobrindo o cálculo de saldo e o peso resultante para todos os tipos de movimentação
- [x] Adicionar teste da operação transacional garantindo histórico e atualização do filamento no mesmo fluxo
- [x] Adicionar teste que comprove rejeição de saldo negativo no backend durante a criação da movimentação
- [x] Adicionar teste do fluxo createStockMovement que rejeita saldo negativo antes de atualizar filamento ou inserir histórico
- [x] Tornar os testes transacionais determinísticos com reset explícito do cache do banco
- [x] Assegurar no teste negativo que update e insert não foram executados

## Correção visual urgente — selects dark mode

- [x] Substituir todos os selects nativos da área /estoque pelo componente Select customizado sem alterar lógica, banco ou rotas
- [x] Garantir dropdowns, opções, foco, hover, placeholder e ícones sem fundo branco no módulo de estoque

## Nova etapa: unidades de medida compatíveis

- [x] Adicionar unidade base de controle ao cadastro: Peso ou Unidade
- [x] Adicionar peso por unidade/rolo em gramas quando aplicável, sem perder dados existentes
- [x] Migrar filamentos existentes para unidade base Peso com saldo e pesos em gramas
- [x] Permitir g, kg e rolo apenas para itens de Peso, condicionando rolo ao peso por unidade
- [x] Permitir somente un e números inteiros para itens de Unidade
- [x] Converter toda entrada de movimentação para gramas quando o item for controlado por Peso
- [x] Armazenar e exibir saldo de itens de Unidade como números inteiros
- [x] Mostrar rótulo dinâmico, opções compatíveis, conversão para gramas e prévia amigável no modal
- [x] Rejeitar conversões incompatíveis e impedir saldo negativo no backend
- [x] Atualizar filtros, tabelas, cards e documentação para exibir a unidade adequada
- [x] Adicionar testes de conversão, compatibilidade, inteiros e preservação do histórico
- [x] Adicionar teste do fluxo transacional de item por unidade, aceitando un inteira e rejeitando frações e g

## Revisão de integridade das unidades

- [x] Validar no backend que ajuste de item baseUnit=unit aceite somente saldo inteiro e remover dependência de arredondamento silencioso
- [x] Garantir que saldos e movimentos de itens por unidade nunca persistam valores fracionários
- [x] Adicionar teste real de ajuste fracionado para item por unidade, comprovando zero escritas
- [x] Adicionar teste do backfill histórico preservando os novos campos genéricos

## Revisão final do CRUD e backfill

- [x] Validar no create/update de filamentos que itens baseUnit=unit usem saldos inicial, atual e mínimo inteiros
- [x] Adicionar teste executável que verifique a cópia dos valores legados para os campos genéricos do backfill
- [x] Adicionar teste executável do mapeamento real da migração, comprovando cópia de quantityGrams, previousWeightGrams e resultingWeightGrams
