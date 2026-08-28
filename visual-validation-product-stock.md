# Validação visual — estoque de produtos prontos

Os cards mostram as ações separadas **Produzir**, **Ajustar estoque** e **Registrar saída**. O modal **Registrar saída** foi capturado em desktop (1280×720) e mobile (390×844) com produto persistido, produto somente leitura, quantidade em unidades, motivo, observação e prévia com estoque atual, saída e saldo posterior. O dark mode permaneceu consistente; no mobile os campos reorganizaram-se verticalmente, o modal permaneceu contido e não houve overflow horizontal. A ação de confirmação ficou disponível para uma saída dentro do saldo exibido. O modal **Ajustar estoque** mantém os campos de quantidade disponível e estoque mínimo, com título e botão renomeados; a lógica de histórico é registrada no backend como delta manual.

## Captura específica do modal Ajustar estoque

O modal **Ajustar estoque** foi capturado no estado final em desktop (1280×720) e mobile (390×844). O título e o botão aparecem renomeados, os campos **Quantidade disponível (un)** e **Estoque mínimo (un)** permanecem legíveis e o layout mobile empilha os controles sem overflow horizontal. As capturas usaram o produto disponível no ambiente de validação; nenhuma operação foi confirmada e nenhum saldo foi alterado.
