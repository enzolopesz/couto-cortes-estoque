# Validação visual da ficha técnica

O modal **Novo produto interno** foi verificado em desktop (1280×720) e mobile (390×844) com estoque inicial/mínimo e duas linhas de materiais. Em desktop, a seção **Materiais utilizados** mantém a composição em cards compactos, com select de filamento, quantidade, unidade e exclusão; o modal permanece limitado à altura da viewport e usa rolagem vertical. Em mobile, os campos da ficha técnica se reorganizam em coluna, o cabeçalho e o botão de adicionar permanecem utilizáveis e não houve overflow horizontal; a continuação das linhas fica acessível pela rolagem interna. As superfícies, bordas e textos permaneceram no dark mode industrial, sem fundo branco.

## Nota de validação

Durante uma tentativa adicional de preencher linhas sintéticas em uma conta sem filamentos, o modo de pré-visualização temporário entrou em atualização recursiva. O suporte temporário foi removido imediatamente; ele não faz parte do fluxo entregue, não grava dados e não permanece no código final. A captura mobile anterior confirmou a responsividade estrutural do modal vazio, enquanto a implementação final foi revalidada por TypeScript, testes e build.

## Estado final limpo

Após remover todo o código temporário, o modal foi reaberto em desktop e mobile. A seção **Materiais utilizados**, o botão de adição, os campos de estoque e a rolagem interna aparecem corretamente no dark mode. Não havia produto interno persistido nem filamentos disponíveis nesta sessão para uma captura preenchida com dados reais; por isso, não foram criados dados de demonstração nem inserções artificiais. A composição preenchida permanece coberta por validação de contrato, conversão e tipagem, e pode ser confirmada visualmente assim que houver um produto real com materiais cadastrados.
