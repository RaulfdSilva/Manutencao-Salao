# Manutenção Salão

Aplicativo móvel para organizar manutenções de uma única congregação, inicialmente em equipamentos de áudio, sem controle de presença ou avaliação dos voluntários. **Estágio: módulos 01–06 e interface navegável de demonstração (entrega 07), sem integração de produção.** As quatro abas usam dados fictícios e somente para leitura; offline, autenticação, backend e persistência real continuam pendentes.

## Requisitos e implementação

O [PRD oficial](docs/requirements/PRD.md) define o produto pretendido; esta branch contém a base, o domínio de membros, o planejamento de manutenções, convites/disponibilidade, checklists, pendências e conclusão técnica. A entrega 02 permite consulta da equipe ativa por membros ativos autorizados, omitindo telefone e cadastros inativos para não administradores. Alterações de perfil, papel e situação exigem a versão esperada, com erro explícito de conflito e contrato de gravação condicional. O domínio de recorrências/ocorrências de manutenção está implementado com contratos de eventos e persistência. Revisões de séries exigem vigência explícita e preservam ciclos já materializados por uma identidade independente do dia de execução; calendário visual, offline e envio de notificações permanecem não implementados. A entrega 07 apresenta tema escuro, quatro abas e detalhes navegáveis com dados de demonstração; isso não representa integração dos casos de uso a dados persistidos.

O backend e a autenticação segura ainda precisam de decisão. Suporte completo a múltiplas congregações e áreas além do áudio estão fora do MVP. As referências a congregação nos contratos existentes não significam suporte completo a várias congregações.

## Desenvolvimento

- Node.js 24.19.0 (ver `.nvmrc`), npm 11 e Git.
- Expo SDK 58, React Native e React conforme versões recomendadas pelo Expo.
- Android/iOS: dispositivo compatível com o SDK ou emulador com ferramentas nativas. iOS Simulator exige macOS. A validação web não substitui teste nativo.

```sh
npm ci
npm start
# alternativa de desenvolvimento no navegador
npm run web
```

Não são necessárias credenciais ou `.env` para iniciar. `.env.example` contém nomes públicos de uma alternativa Supabase considerada no bootstrap; o backend definitivo continua em aberto. Não criar autenticação simulada nem inserir chaves privilegiadas no aplicativo.

```sh
npm run lint
npm run format:check
npm run typecheck
npm test
npx expo install --check
npm run export:web
```

`npm run format` aplica formatação; `npm run test:watch` permite desenvolvimento contínuo. Vitest usa Node para testes TypeScript. Os testes de bootstrap verificam o runner e a configuração Expo com Zod; os testes de membros e manutenções verificam domínio e casos de uso, incluindo geração delimitada, permissões, eventos e concorrência. A entrega 04 valida convites por elegibilidade, última resposta, prazo, reabertura, exceção de indisponibilidade, reconfirmação, totais, CAS e rollback. Não há testes de UI ou banco. A CI executa as verificações acima; build nativo e testes em dispositivo ficam para um ambiente com SDKs nativos.

## Estrutura

```text
app/                       rotas e layout Expo Router
src/domain/                entidades, regras e contratos de membros/manutenções
src/application/           casos de uso e portas de membros/manutenções
src/infrastructure/        adaptadores e integrações futuras
src/presentation/          componentes de interface
tests/                     testes de infraestrutura, membros e manutenções
docs/                     requisitos, arquitetura, segurança e decisões
.github/workflows/ci.yml    verificações automatizadas
```

A organização em camadas foi mantida; domínio e aplicação contêm as regras e os contratos de membros e planejamento de manutenções, sem adaptadores de produção. O domínio permanece independente das tecnologias externas.

## Documentação

- [Orientações para agentes](AGENTS.md)
- [PRD oficial — MVP 1.0](docs/requirements/PRD.md)
- [Arquitetura](docs/architecture/ARCHITECTURE.md)
- [Contribuição e padrões](docs/development/CONTRIBUTING.md)
- [Segurança](docs/security/SECURITY.md)
- [ADR-001](docs/decisions/ADR-001-architecture.md)
- [ADR-002 — domínio de membros](docs/decisions/ADR-002-member-domain.md)
- [ADR-003 — consolidação do MVP 1.0](docs/decisions/ADR-003-mvp-1-consolidation.md)
- [ADR-004 — consulta da equipe e concorrência otimista](docs/decisions/ADR-004-member-access-concurrency.md)
- [ADR-005 — planejamento de manutenções](docs/decisions/ADR-005-maintenance-planning.md)
- [ADR-006 — convites e disponibilidade](docs/decisions/ADR-006-maintenance-availability.md)

Use Conventional Commits. Alterações seguem branches de tarefa e Pull Requests, sem merge automático em `main`.

## Convites e disponibilidade — entrega 04

`src/domain/availability` e `src/application/availability` implementam janelas por ocorrência/revisão, última resposta, consultas e eventos, com adaptador somente em testes. O administrador configura um prazo UTC explícito; administrador ou responsável vinculado pode encerrar antecipadamente e reabrir com prazo futuro. No prazo exato, respostas ordinárias já são recusadas mesmo se o worker atrasar. A exceção `yes -> no` gera aviso operacional por evento. `Sim` não designa equipe e ausência de resposta não significa recusa.

O fechamento automático é contratado por comandos duráveis de servidor (`closeDue`), registrados atomicamente na configuração/reabertura; ainda não existe executor real. `refreshIn` deve participar da transação real de membros/designações/cancelamento, e `invitationIsCurrent` permite revalidar eventos antes da entrega futura. Nenhuma notificação é enviada. Reagendamento exige escolhas explícitas e independentes para respostas e prazo. Reconfirmação usa o prazo escolhido para a nova revisão; anteriores permanecem temporárias até o descarte no término/cancelamento. Reinclusão exige nova necessidade de convite, sem recuperar resposta ou obrigar manifestação para comparecer. Ver ADR-006.

Os ajustes finais da entrega 04 adicionam contratos de descarte em todas as revisões e histórico técnico minimizado por manutenção para futuro controle anual. O cancelamento chama o descarte na mesma transação; o adaptador de testes demonstra o contrato, sem banco real. A entrega 05 implementa a conclusão técnica no domínio/aplicação e integra o recibo real ao descarte transacional; ainda não há banco, tela ou painel anual. Backups, sincronização pendente e snapshots antigos exigem integração de retenção descrita no ADR-006.

A correção de integração de equipes torna obrigatório reconciliar disponibilidade na mesma transação de `assignTeam`/`configure` ao mudar o público. Retiradas/reinclusões não recuperam respostas ou convites antigos; membros continuamente elegíveis são preservados. Testes usam os casos de uso reais, sem refresh manual compensatório. A minimização de identificadores em ocorrências terminais e suas representações continua obrigatória antes de produção; ver ADR-006 e Segurança. Não há conclusão fictícia ou exclusão física validada.

## Checklists e conclusão técnica — entrega 05

`src/domain/checklists` e `src/application/checklists` contêm modelos versionados por periodicidade, snapshots por ocorrência, verificações por par tarefa/categoria, pendências independentes e correções administrativas. Na entrega 05 não havia catálogo oficial incluído. A entrega 06 adiciona a transcrição fornecida pelo responsável, com revisão de 2026; a fotografia original não foi conferida. Os dados anteriores de teste continuam sintéticos.

Somente administrador altera modelos; administrador ou responsável vinculado acrescenta tarefas ocasionais, conclui a manutenção e resolve pendências. O preenchimento segue a modalidade e a elegibilidade atual. Não há executor identificado, atribuição de tarefas, reserva ou presença. Problemas exigem descrição; fotos são apenas referências contratuais futuras. Corrigir o resultado nunca apaga um problema real.

A conclusão permite itens sem preenchimento e pendências abertas, sela o checklist, torna a ocorrência `completed`, registra o fato anual e descarta disponibilidade na mesma transação contratual. Correções posteriores são administrativas, preservam antes/depois, data e natureza, sem reabrir nem contar outra conclusão. Versões e recibos de comandos protegem contra sobrescrita e repetição. Os testes usam adaptadores em memória; não comprovam transações, exclusão física ou segurança de produção. Ver [ADR-007](docs/decisions/ADR-007-checklists-technical-completion.md).

Cancelamento é exclusivo do administrador e só é permitido antes de qualquer trabalho técnico. Checklist vazio não bloqueia; primeira verificação preenchida ou problema registrado bloqueiam definitivamente, mesmo após limpar o resultado. Trabalho interrompido pode ser concluído por administrador/responsável autorizado, mantendo pendências abertas. O histórico técnico e o cancelamento compartilham a transação contratual; ver correção nos ADRs 005/007.

## Catálogo de áudio — entrega 06

A [matriz transcrita](docs/catalogs/audio-maintenance-matrix-2026.md) possui 15 tarefas, 9 categorias e 50 verificações independentes (6 quinzenais, 15 mensais, 12 trimestrais, 17 semestrais). A configuração JSON versionada fica em `src/infrastructure/catalogs`, validada com Zod e convertida para os modelos existentes. Não acumula frequências automaticamente.

`ChecklistUseCases.provisionInitialCatalog` é explícito, exige administrador ativo e cria somente modelos ausentes numa transação com evento/recibo. Preserva integralmente revisões administrativas e snapshots existentes. Imports não inicializam dados; sem servidor/banco real, só há execução do contrato nos testes. Ver [ADR-008](docs/decisions/ADR-008-official-audio-catalog.md) para origem, limitações e evolução por área.

## Interface e navegação — entrega 07

Execute `npm ci` e `npm run web` para abrir a interface no navegador; `npm start` permite usar dispositivo compatível com Expo SDK 58, com acesso de rede ao servidor. Veja o [roteiro de revisão](docs/development/UI-REVIEW.md) para Android, rotas, estados de demonstração e testes de navegador.

Abas: Início, Manutenções, Pendências e Equipe. Detalhes de manutenção agrupam o catálogo oficial por equipamento. Os exemplos de datas, resultados, problemas e membros são fictícios, sem gravações, contas ou sessão simulada. O Início permite explorar estados Sem dados e Carregando. Não há controles de presença, distribuição de tarefas ou operações que anunciem salvamento inexistente.

`app/` compõe o Router e injeta uma fonte de leitura isolada de Presentation; os repositórios de domínio permanecem intactos. Componentes próprios, tema escuro, áreas seguras e rótulos acessíveis não exigem biblioteca de UI. `@types/react-dom` foi acrescentado apenas para testes com TypeScript strict. Testes web e exportação Android não substituem validação em aparelho, acessibilidade nativa ou segurança de produção. Ver [ADR-009](docs/decisions/ADR-009-demo-navigation-ui.md).

## Prévia pública — entrega 08

A configuração de GitHub Pages está em `.github/workflows/pages-preview.yml`, independente da CI e limitada à main (push ou disparo manual). A publicação exige merge manual e **Settings > Pages > Build and deployment > Source: GitHub Actions**. O site não é publicado pelo simples push da branch de desenvolvimento.

URL esperada após o primeiro deploy bem-sucedido: **https://raulfdsilva.github.io/Manutencao-Salao/**. Abra no navegador do celular, sem Expo Go ou computador local. Veja o [guia pelo celular](docs/deployment/GITHUB-PAGES.md) para configurar, acompanhar o workflow, encontrar a URL e investigar falhas.

O build público usa exportação static, prefixo oficial do Expo SDK 58, parâmetros dos exemplos e diretórios com index.html, sem fallback SPA. Apenas os dados fictícios existentes são usados, sem gravações/segredos. Não conectar a prévia a futuros registros privados. Desenvolvimento normal na raiz permanece disponível. Ver [ADR-010](docs/decisions/ADR-010-github-pages-preview.md).
