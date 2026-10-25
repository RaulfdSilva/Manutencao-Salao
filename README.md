# Manutenção Salão

Aplicativo móvel para organizar manutenções de uma única congregação, com escopo inicial em equipamentos de áudio. O MVP 1.0 exige preenchimento colaborativo offline, sem controle de presença, frequência ou avaliação dos voluntários. **Estágio: bootstrap e entrega 01 do domínio de membros, sem integração de produção.** A única tela é uma indicação estática de inicialização.

## Requisitos e implementação

O [PRD oficial](docs/requirements/PRD.md) define o produto pretendido; esta branch contém apenas a base e o domínio de membros. A consulta da equipe ativa por todos os membros ainda exige alteração dos casos de uso e testes, que hoje adotam acesso mais restrito. Offline, calendário, checklists, pendências e notificações permanecem não implementados. Tema escuro e quatro abas são requisitos futuros, não o estado da tela inicial.

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

`npm run format` aplica formatação; `npm run test:watch` permite desenvolvimento contínuo. Vitest usa Node para testes TypeScript. Os testes de bootstrap verificam o runner e a configuração Expo com Zod; os testes de membros verificam domínio e casos de uso. Não há testes de UI ou banco. A CI executa as verificações acima; build nativo e testes em dispositivo ficam para um ambiente com SDKs nativos.

## Estrutura

```text
app/                       rotas e layout Expo Router
src/domain/                entidades, regras e contratos de membros
src/application/           casos de uso e portas de membros
src/infrastructure/        adaptadores e integrações futuras
src/presentation/          componentes de interface
tests/                     testes de infraestrutura e membros
docs/                     requisitos, arquitetura, segurança e decisões
.github/workflows/ci.yml    verificações automatizadas
```

A organização em camadas foi mantida; domínio e aplicação contêm as regras e os contratos de membros, sem adaptadores de produção. O domínio permanece independente das tecnologias externas.

## Documentação

- [Orientações para agentes](AGENTS.md)
- [PRD oficial — MVP 1.0](docs/requirements/PRD.md)
- [Arquitetura](docs/architecture/ARCHITECTURE.md)
- [Contribuição e padrões](docs/development/CONTRIBUTING.md)
- [Segurança](docs/security/SECURITY.md)
- [ADR-001](docs/decisions/ADR-001-architecture.md)
- [ADR-002 — domínio de membros](docs/decisions/ADR-002-member-domain.md)
- [ADR-003 — consolidação do MVP 1.0](docs/decisions/ADR-003-mvp-1-consolidation.md)

Use Conventional Commits. Alterações seguem branches de tarefa e Pull Requests, sem merge automático em `main`.
