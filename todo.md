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
- [x] Salvar novo checkpoint após concluir a validação visual completa deste ajuste

## Nova etapa: ficha técnica com múltiplos materiais por produto

- [x] Criar tabela relacional `product_materials` sem adicionar materiais como colunas em produtos
- [x] Relacionar ficha técnica a `inventory_products` e `filaments`, com escopo por owner
- [x] Persistir quantidade_base na unidade interna compatível: g, m ou un
- [x] Adicionar estoque inicial e estoque mínimo inteiros no modal Novo produto interno
- [x] Permitir múltiplas linhas de materiais, inclusão, exclusão e selects dependentes
- [x] Salvar e editar a ficha técnica sem alterar saldos de filamentos
- [x] Manter produção fora do escopo e não alterar catálogo público
- [x] Adicionar validações, testes e documentação
- [x] Validar dark mode, responsividade, TypeScript, testes e build; salvar checkpoint
- [x] Validar novamente em desktop e mobile o modal final limpo; composição preenchida coberta por testes, sem criar dados artificiais na sessão
- [x] Salvar um novo checkpoint após concluir esta etapa da ficha técnica com múltiplos materiais
- [x] Validação visual/funcional com dados persistidos delegada ao usuário, sem criação de dados artificiais
- [x] Usuário validará pela interface real a ficha técnica preenchida com os filamentos persistidos, sem criação de dados artificiais nesta sessão

## Correção: produção baseada na ficha técnica completa

- [x] Remover do modal de produção material, consumo e unidade editáveis
- [x] Carregar automaticamente todos os materiais de product_materials ao selecionar o produto
- [x] Exibir prévia de consumo total, saldo atual e saldo após para todos os materiais
- [x] Bloquear a confirmação se qualquer material estiver sem saldo suficiente
- [x] Tornar a produção multi-material atômica, baixando todos os materiais e registrando o histórico
- [x] Preservar conversões, isolamento, catálogo público e não alterar saldos durante testes
- [x] Atualizar testes, documentação, responsividade e validação técnica; executar build final e salvar checkpoint

## Ajuste: estoque de produtos prontos

- [x] Renomear o botão e modal de estoque para Ajustar estoque
- [x] Registrar histórico de ajuste manual com saldo anterior, novo saldo, delta, usuário e data/hora
- [x] Criar modal separado de Registrar saída com produto somente leitura, quantidade, motivo e observação
- [x] Validar saída inteira, positiva e limitada ao estoque disponível
- [x] Baixar produto pronto por delta em transação e registrar histórico sem alterar filamentos
- [x] Preservar produção e ficha técnica sem mudanças de lógica
- [x] Atualizar testes, documentação, responsividade e validação técnica; salvar checkpoint
- [x] Validar visualmente Ajustar estoque e Registrar saída em desktop e mobile, incluindo prévia e ausência de overflow
- [x] Invalidar também products.summary após ajuste manual de estoque
- [x] Capturar o modal Ajustar estoque em desktop e mobile no estado final
- [x] Reexecutar validações finais e salvar checkpoint desta etapa

## Passe de correções e acabamento do módulo de estoque

- [x] Corrigir overflow horizontal do modal Novo produto interno e reorganizar linhas de materiais
- [x] Impedir materiais duplicados na ficha técnica no frontend, backend e banco
- [x] Exibir indicador visual neutro ou correspondente à cor cadastrada do filamento
- [x] Renomear somente o botão visual para Estoque, mantendo o modal Ajustar estoque
- [x] Remover UUIDs das descrições amigáveis de movimentações
- [x] Centralizar saídas de produtos prontos no histórico geral de Movimentações
- [x] Agrupar produções recentes por evento e manter detalhes de materiais rastreáveis
- [x] Corrigir unidades, formatação e alertas de estoque baixo nas telas
- [x] Separar grandezas incompatíveis no card Saldo controlado do dashboard
- [x] Melhorar a prévia de insuficiência sem alterar o bloqueio existente
- [x] Preservar dados, históricos, ficha técnica, produção e conversões; não criar dados artificiais
- [x] Executar regressões, validação visual e salvar checkpoint final

## Nova solicitação: scrollbar e upload de imagens de produtos

- [x] Personalizar visualmente a scrollbar vertical global e áreas com overflow, com suporte Chromium e scrollbar-color/scrollbar-width
- [x] Implementar upload real de imagens de Produtos prontos no cadastro e edição usando o storage existente
- [x] Validar MIME, extensões aceitas, limite de 5 MB, preview, troca, remoção e estados de carregamento sem base64
- [x] Exibir imagens enviadas nos cards sem alterar estoque, ficha técnica, produção ou movimentações
- [x] Preservar URLs legadas de imagem e evitar referências quebradas durante edição/exclusão
- [x] Executar testes, build e validação visual desktop/mobile; não criar dados artificiais; salvar checkpoint

## Nova etapa: acompanhamento de produção por impressora

- [x] Criar cadastro protegido de impressoras com nome, modelo e status ativo/inativo
- [x] Garantir uma única produção RUNNING por impressora e status livre/produzindo derivado
- [x] Criar tela Acompanhamento com card por impressora, tempo decorrido e ações manuais
- [x] Implementar início de produção com produto, quantidade, ficha técnica e estimativa
- [x] Reservar materiais ao iniciar usando saldo disponível e transação atômica
- [x] Impedir reservas parciais e condições de corrida no backend
- [x] Implementar finalização proporcional à quantidade produzida, consumo, liberação e estoque acabado
- [x] Implementar cancelamento com liberação integral das reservas sem consumo ou produção acabada
- [x] Criar histórico de production runs com usuários, timestamps, duração e status
- [x] Calcular estimativa pelas últimas cinco produções válidas por produto/impressora e fallback por produto
- [x] Integrar movimentações de materiais e produtos ao production run sem expor IDs técnicos
- [x] Adicionar métricas de produção em andamento ao dashboard sem redesign geral
- [x] Preservar produções antigas, saldos e dados existentes; não criar dados artificiais
- [x] Executar migrações, testes, build e validação visual desktop/mobile; salvar checkpoint

## Correção bloqueante: erro em Acompanhamento

- [x] Normalizar impressoras/produções em camelCase, snake_case e relações opcionais antes da renderização
- [x] Impedir cálculo de tempo quando startedAt/started_at não existir ou for inválido
- [x] Cobrir estados sem impressoras, impressoras livres, produção sem produto/estimativa e histórico vazio
- [x] Adicionar testes da normalização defensiva sem criar dados no banco
- [x] Validar /estoque/acompanhamento, console, TypeScript e testes; salvar checkpoint da correção

## Ajuste: Iniciar produção a partir do card

- [x] Corrigir o layout das ações do card sem sobreposição ou overflow, com empilhamento adequado no mobile
- [x] Passar automaticamente o produto do card para o modal de início e mantê-lo somente leitura nesse fluxo
- [x] Exibir apenas impressoras ativas e livres, sem produção RUNNING, no seletor de início
- [x] Preservar ficha técnica automática, reserva no início e aumento de produto somente na finalização
- [x] Adicionar testes do fluxo de pré-seleção e filtros de impressoras sem criar dados reais
- [x] Executar TypeScript, Vitest, build e validação visual desktop/mobile; salvar checkpoint
