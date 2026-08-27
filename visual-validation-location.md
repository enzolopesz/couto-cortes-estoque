# Validação visual — remoção de localização física

Após a remoção de localização do módulo, foram capturadas as rotas `/estoque/filamentos` e `/estoque/produtos` em viewport desktop (1280×720) e mobile (390×844).

A tela de Filamentos exibe apenas Filamento, Estoque, Custo e Status na tabela; os filtros e o estado vazio não exibem localização. A tela de Produtos prontos exibe busca, categoria, saldo, mínimo, status e ações, sem localização. Nos breakpoints móveis, os cards, filtros e botões permanecem dentro da viewport, sem overflow horizontal visível.

A validação de formulários foi feita pela checagem do bundle renderizado e pelos contratos atualizados; os modais continuam com rolagem interna e sem campos de localização.

## Validação direta dos modais

Foram abertos por modo de pré-visualização de desenvolvimento os modais de novo filamento (`/estoque/filamentos?novo=1`), novo produto (`/estoque/produtos?preview=product`), configuração de estoque (`?preview=inventory`) e registro de produção (`?preview=production`) em 1280×720 e 390×844.

As capturas confirmaram que nenhum dos quatro fluxos exibe localização, prateleira ou caixa. No celular, os modais usam limite de altura com rolagem interna, os campos permanecem dentro da largura disponível e os botões continuam acessíveis. O modal de produção mantém sua própria área de rolagem para os campos inferiores.
