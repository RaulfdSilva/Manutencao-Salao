# Contribuição

Leia README, o PRD oficial em `docs/requirements/PRD.md`, ARCHITECTURE, SECURITY e ADRs antes de alterar o projeto. O diretório de requisitos arquivados é histórico, não uma fonte concorrente. ADRs parcialmente superados devem ser lidos junto do ADR que os substitui. Use a versão de Node de `.nvmrc`, `npm ci` e o lockfile versionado; atualizações de dependências devem ser deliberadas. Instale dependências nativas com `npx expo install` para compatibilidade com o SDK. Não misture gerenciadores de pacotes.

## Fluxo de trabalho

Crie uma branch por tarefa, preserve alterações existentes e use Conventional Commits, por exemplo `chore: bootstrap project infrastructure` ou `docs: clarify recurrence requirements`. Envie PR com problema, mudanças, validação e limitações. Não force pushes, reescreva `main` ou faça merge automático. A CI deve passar antes da revisão.

Antes da entrega execute:

```sh
npm run lint
npm run format:check
npm run typecheck
npm test
npx expo install --check
npm run export:web
```

Para formatação use `npm run format`. Testes não executados devem ser reportados como tal. Não afirmar sucesso apenas porque o comando iniciou. A CI executa os mesmos checks, mas sua execução remota só pode ser afirmada após observar o resultado.

## Clean Code

- SRP: uma responsabilidade clara por módulo, função ou componente.
- Separation of Concerns: separar regras, orquestração, acesso a serviços e UI.
- Dependency Inversion: casos de uso dependem de contratos internos, com adaptadores externos injetados quando necessários.
- DRY: compartilhar conhecimento realmente repetido; não abstrair coincidências.
- KISS e YAGNI: solução simples, sem funcionalidades, serviços ou camadas extras antecipadas.
- TypeScript strict: evitar `any`, casts não validados, `!` e supressões; tipar entradas como `unknown` e validar.
- Identificadores técnicos em inglês; textos de interface em pt-BR; nomes de função descritivos.
- Tratar erros explicitamente; não engolir falhas nem expor detalhes sensíveis ao usuário.
- Validar entradas externas com Zod, perto da fronteira; componentes sem lógica de negócio.
- Testar regras de negócio com entradas válidas, limites e falhas quando forem implementadas.
- Comentários explicam decisões não óbvias, não repetem o código.

Mudanças de comportamento exigem atualização da documentação e testes. Dependências novas precisam de justificativa e avaliação de compatibilidade, manutenção e segurança. Nunca registrar credenciais ou dados pessoais nos testes, logs ou commits.

## Entregas alinhadas ao MVP 1.0

Separar requisitos pretendidos, comportamento implementado e verificações executadas. Uma atualização documental não muda permissões ou testes existentes. Ao adequar a consulta da equipe, revisar os testes da política antiga, mantendo a proteção de telefone e inativos.

Não acrescentar funcionalidades fora do PRD, métricas de frequência ou fiscalização. Planejar cenários offline, repetição de operações, conflitos e revalidação de autorização nas entregas pertinentes. O backend continua a definir; alterações estruturais exigem ADR antes de introduzir dependências. Checklist oficial e Hourglass precisam de fontes reais, sem conteúdo ou formatos inventados.
