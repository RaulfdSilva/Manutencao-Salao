# Manutenção Salão

Aplicativo móvel para organizar manutenções de uma única congregação, com escopo inicial em equipamentos de áudio. O MVP 1.0 exige preenchimento colaborativo offline, sem controle de presença, frequência ou avaliação dos voluntários. **Estágio: bootstrap, entregas 01/02 de membros, entrega 03 do planejamento de manutenções e entrega 04 de convites/disponibilidade, sem integração de produção.** A única tela é uma indicação estática de inicialização.

## Requisitos e implementação

O [PRD oficial](docs/requirements/PRD.md) define o produto pretendido; esta branch contém a base, o domínio de membros, o planejamento de manutenções e convites/disponibilidade. A entrega 02 permite consulta da equipe ativa por membros ativos autorizados, omitindo telefone e cadastros inativos para não administradores. Alterações de perfil, papel e situação exigem a versão esperada, com erro explícito de conflito e contrato de gravação condicional. O domínio de recorrências/ocorrências de manutenção está implementado com contratos de eventos e persistência. Revisões de séries exigem vigência explícita e preservam ciclos já materializados por uma identidade independente do dia de execução; calendário visual, offline, checklists, pendências e envio de notificações permanecem não implementados. Tema escuro e quatro abas são requisitos futuros, não o estado da tela inicial.

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

`src/domain/availability` e `src/application/availability` implementam janelas por ocorrência/revisão, última resposta, consultas e eventos, com adaptador somente em testes. O administrador configura um prazo UTC explícito; o administrador pode encerrar antecipadamente, e administrador/responsável vinculado pode reabrir com prazo futuro. No prazo exato, respostas ordinárias já são recusadas mesmo se o worker atrasar. A exceção `yes -> no` gera aviso operacional por evento. `Sim` não designa equipe e ausência de resposta não significa recusa.

O fechamento automático é contratado por comandos duráveis de servidor (`closeDue`), registrados atomicamente na configuração/reabertura; ainda não existe executor real. `refreshIn` deve participar da transação real de membros/designações/cancelamento, e `invitationIsCurrent` permite revalidar eventos antes da entrega futura. Nenhuma notificação é enviada. Reconfirmação exige configuração explícita da janela da nova revisão e preserva a revisão técnica anterior. Ver ADR-006 e suas pendências.
