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
