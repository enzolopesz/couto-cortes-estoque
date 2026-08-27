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
- [x] Requisito histórico substituído: Movimentações e Produtos prontos foram implementados nas etapas seguintes
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

## Nova etapa: produtos prontos e produção

- [x] Mapear a tabela de catálogo `products` sem alterar dados comerciais ou funcionamento público
- [x] Criar tabela complementar `product_inventory` com estoque mínimo, saldo em unidades e localização
- [x] Criar tabela complementar `production_records` com produto, material, consumo, unidade e usuário
- [x] Implementar isolamento por usuário para inventário, produção e operações protegidas
- [x] Implementar transação atômica que baixa material, cria consumo, registra produção e aumenta produto pronto
- [x] Requisito substituído: cadastro interno independente em `inventory_products`, sem acesso ao catálogo público
- [x] Ativar menu Produtos prontos e criar rota protegida /estoque/produtos
- [x] Criar listagem com imagem, nome, categoria, saldo, mínimo, localização, status, busca e filtro
- [x] Criar configuração de estoque mínimo e localização sem editar dados comerciais
- [x] Criar modal Registrar produção com unidade compatível, total consumido e prévia dos dois saldos
- [x] Permitir produção apenas com quantidade inteira positiva em unidades
- [x] Respeitar conversões g, kg, rolo e un do material selecionado
- [x] Atualizar dashboard com total de produtos, alertas e últimas produções
- [x] Atualizar telas automaticamente após produção sem recarregar
- [x] Corrigir overflow horizontal e manter dropdowns/menus/calendários no dark mode
- [x] Adicionar testes de transação, saldo negativo, isolamento, unidade e preservação do catálogo
- [x] Documentar o roteiro de teste: produzir 3 peças consumindo 120 g por peça de um filamento com 1.000 g

## Nova etapa: produtos internos independentes

- [x] Criar tabela `inventory_products` sem usar o nome `products`
- [x] Adicionar name, category, image_url, sku/code, active, external_product_id e timestamps
- [x] Ajustar `product_inventory` para referenciar `inventory_products`
- [x] Ajustar `production_records` para referenciar `inventory_products`
- [x] Preservar a separação completa do catálogo público sem consultas ou alterações
- [x] Implementar CRUD protegido de produtos internos
- [x] Implementar estoque de produtos prontos sempre em unidades inteiras
- [x] Integrar produção ao produto interno e ao filamento em transação atômica
- [x] Adicionar busca, filtro, foto opcional, SKU e configuração de mínimo/localização
- [x] Atualizar dashboard e telas após produção sem recarregar
- [x] Adicionar testes de CRUD, isolamento, unidades inteiras, transação e não acesso ao catálogo público
- [x] Atualizar documentação com o modelo independente e roteiro de teste de produção

## Revisão pós-implementação de produtos internos

- [x] Marcar o requisito de integração com catálogo público como substituído pelo cadastro interno independente, sem considerá-lo entregue
- [x] Verificar sucesso do update de product_inventory dentro da transação e forçar rollback se nenhuma linha for atualizada
- [x] Invalidar products.summary após produção para atualizar o dashboard sem refresh
- [x] Adicionar testes reais de CRUD, isolamento por usuário, rollback transacional e independência do catálogo público
- [x] Validar estados mobile/desktop e modais de Produtos prontos sem overflow horizontal

## Revisão final de produtos internos

- [x] Adicionar teste transacional real de createProduction com driver controlado e rollback quando o update final falhar
- [x] Adicionar teste de produção com material insuficiente que não execute escritas
- [x] Adicionar testes de isolamento por usuário em list, update, inventoryUpdate e produce

## Cobertura final de produtos internos

- [x] Adicionar testes reais de CRUD de produtos internos cobrindo create, list, update e remove com sucesso
- [x] Adicionar testes de isolamento por usuário para list, update, inventoryUpdate e produce com ownerId distinto
- [x] Validar explicitamente os modais de cadastro, estoque e produção em desktop e mobile sem overflow
- [x] Validar visualmente com os modais abertos os fluxos de cadastro, estoque e produção em desktop e mobile; manter pendente até haver evidência direta

## Ajuste de escopo: remover localização física

- [x] Remover localização/prateleira/caixa dos formulários de filamentos e produtos internos
- [x] Remover localização das tabelas, cards, detalhes, filtros e dashboard
- [x] Remover localização dos contratos tRPC, helpers e operações de estoque
- [x] Avaliar uso atual de product_inventory.storageLocation e remover a coluna se sem uso relevante
- [x] Criar e aplicar migração não destrutiva para remover a coluna sem afetar saldos ou históricos
- [x] Atualizar testes e documentação para refletir que não existe recurso de localização nesta versão
- [x] Validar TypeScript, testes, build, desktop e mobile
- [x] Validar visualmente em desktop e mobile Filamentos e Produtos prontos após remover localização, incluindo formulários, modais, cards e tabela
- [x] Abrir e validar diretamente os modais de cadastro de filamento, cadastro de produto, configuração de estoque e produção em desktop e mobile após remover localização

## Ajuste: tipo de controle e unidade de medida em filamentos

- [x] Separar Tipo de controle e Unidade de medida no formulário de filamentos
- [x] Suportar Peso, Quantidade e Comprimento com unidades compatíveis g/kg, un e m
- [x] Manter peso persistido internamente em gramas e converter entradas em kg
- [x] Preservar e interpretar corretamente os cadastros existentes
- [x] Atualizar labels, validações, testes e documentação, com mudanças mínimas de compatibilidade nas telas dependentes
- [x] Validar formulário em desktop/mobile e salvar checkpoint do ajuste
- [x] Validar visualmente o modal Novo filamento em desktop e mobile nos estados kg, Quantidade/un e Comprimento/m, confirmando labels dinâmicos e ausência de overflow
- [ ] Salvar novo checkpoint após concluir a validação visual completa deste ajuste
