
## Validação visual do passe de correções

As telas `/estoque`, `/estoque/filamentos`, `/estoque/movimentacoes` e `/estoque/produtos` foram capturadas em desktop (1280×720) e mobile (375×812). O dashboard exibe peso e comprimento em linhas separadas, os cards usam swatches coerentes com as cores cadastradas e a seção de produções recentes agrupa materiais pelo mesmo evento. O histórico geral mostra saídas de produtos prontos com nome do produto, motivo, delta e saldo, sem UUIDs. Os cards de produtos mantêm as ações Produzir, Estoque e Registrar saída, e as telas móveis não apresentam overflow horizontal visível. A captura final em 375×812 confirmou que as descrições de consumo aparecem como “Produção de N unidade(s)”, sem o UUID técnico, e continuam legíveis no fluxo vertical mobile.
