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

Separar requisitos pretendidos, comportamento implementado e verificações executadas. Uma atualização documental não muda permissões ou testes existentes. A entrega 02 adequou a consulta da equipe; preservar os testes de telefone, inativos e restrições administrativas. Toda mutação de membro deve receber a versão lida pelo solicitante e usar a escrita condicional do repositório. Não recuperar conflito automaticamente reenviando os mesmos dados com uma versão nova.

Não acrescentar funcionalidades fora do PRD, métricas de frequência ou fiscalização. Planejar cenários offline, repetição de operações, conflitos e revalidação de autorização nas entregas pertinentes. O backend continua a definir; alterações estruturais exigem ADR antes de introduzir dependências. Checklist oficial e Hourglass precisam de fontes reais, sem conteúdo ou formatos inventados.

## Testes de disponibilidade

Preservar os testes de modalidades, prazo exato, exceção Sim para Não, reconfirmação e convites obsoletos. Simular falhas de eventos/jobs, CAS e rollback da reconciliação na unidade de trabalho compartilhada. Adaptadores reais precisarão passar testes equivalentes com concorrência entre processos e agendamento independente do aplicativo. Não usar a fila de testes como implementação do servidor. Ver ADR-006.

Nos ajustes finais da entrega 04, revisar a matriz preservar/reconfirmar × manter/substituir prazo, versões de ambos os agregados e rollback conjunto. Hooks de ciclo de vida e histórico técnico são obrigatórios; adaptadores não podem ignorar descarte ou copiar payloads pessoais para o arquivo anual. Os exemplos de cancelamento em memória testam contratos, nunca exclusão física ou conclusão técnica real.

Regressões de mudanças de equipe/modalidade devem usar `assignTeam`/`configure` e o hook real de reconciliação na mesma unidade de trabalho. Não chamar `refresh` manualmente para fazer passar essas regressões. Testar retirada/reinclusão, preservação dos continuamente elegíveis, falha de CAS/outbox, conflitos e rollback conjunto. A minimização de identificadores em ocorrências terminais é requisito antes de produção e exige testes dos adaptadores reais.
