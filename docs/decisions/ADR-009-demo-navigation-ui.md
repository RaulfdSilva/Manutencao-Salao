# ADR-009 — Interface navegável de demonstração

- Status: adotado na Implementação 07, base main `f0b3c9c`.
- Referências: PRD MVP 1.0 e ADRs 001, 003, 005–008.

A apresentação passa a ter quatro abas Expo Router (Início, Manutenções, Pendências, Equipe) e rotas de detalhes. Tema escuro, componentes React Native próprios, áreas seguras, alvos de toque e textos de status acessíveis. Não se adiciona biblioteca de componentes.

`app/_layout` é o ponto explícito de composição: carrega a configuração oficial aprovada em Infrastructure e injeta uma fonte de demonstração na apresentação. Presentation não importa Infrastructure, repositórios ou adaptadores de testes do domínio. A fonte fornece DTOs somente de leitura, sem portas de escrita; não provisiona modelos nem cria registros de negócio. Seu contrato assíncrono permite substituição posterior por adaptador autorizado real. O contexto React mantém apenas dados/estado visual, não sessão, permissões ou estado persistido.

Todos os exemplos são identificados como demonstração. Não existe usuário autenticado, papel selecionável, login fictício, salvamento simulado, presença ou distribuição de verificações. Catálogo e nomes técnicos vêm da entrega 06; resultados, ocorrências e problemas são exemplos claramente fictícios. Checklists são agrupados por categoria de equipamento, preservando cada par independente, sem composição cumulativa de periodicidades.

A projeção da equipe elimina inativos e não contém telefone. Isso é proteção da apresentação, não prova de autorização: o futuro servidor deverá entregar somente DTOs autorizados e revalidar operações. A minimização de dados pessoais terminais continua pendente de produção, conforme ADR-006. Estados vazios/carregamento/erro são visíveis; controles de cenário alteram só a visualização da demonstração.

Vitest verifica projeções/formatadores/contratos e componentes usando React Native Web com React DOM no ambiente Node, sem nova biblioteca de testes. Chromium verifica rotas e interações reais da exportação web em tamanhos móveis. Exportação Android sem emulador valida bundle, não execução nativa, acessibilidade TalkBack ou desempenho. Nenhuma tela é declarada pronta para produção.
