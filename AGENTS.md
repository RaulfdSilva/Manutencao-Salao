# Orientações para agentes

## Escopo e preservação

1. Ler README, PRD, ARCHITECTURE, CONTRIBUTING, SECURITY e ADRs relevantes antes de modificar funcionalidades; ler instruções locais adicionais.
2. Preservar decisões arquiteturais; propor novo ADR antes de alterá-las.
3. Atualizar documentação quando mudar comportamento, requisitos ou configuração.
4. Escrever testes para regras de negócio implementadas; não inventar regras para produzir testes.
5. Executar `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test` e a validação de build pertinente antes de concluir.
6. Nunca afirmar que testes passaram sem executar e observar os resultados; distinguir falhas, skips e verificações não executadas.
7. Informar limitações do ambiente, inclusive ausência de emuladores, dispositivos ou credenciais.
8. Não introduzir dependências sem justificar necessidade e compatibilidade com Expo.
9. Não adicionar funcionalidades fora do escopo. O PRD oficial descreve o destino do MVP, não autoriza implementar todos os módulos. Cada tarefa deve ter escopo explícito; a consolidação do PRD não autoriza alterações funcionais.
10. Ao finalizar, apresentar resumo, arquivos alterados, testes e pendências, além de branch, commit e estado da publicação.

## Padrões

Identificadores técnicos em inglês e interface em pt-BR. TypeScript strict; evitar `any`, casts sem validação e supressões sem justificativa. SRP, separação de responsabilidades, inversão de dependências, DRY, KISS e YAGNI. Funções com nomes descritivos; erros tratados explicitamente, nunca silenciados. Componentes React sem regras de negócio. Validar dados externos na fronteira com Zod. Injetar portas quando necessárias. Comentários explicam decisões não óbvias.

Domain não depende de outras camadas; Application depende de Domain; Infrastructure implementa contratos internos; Presentation consome casos de uso. Composição de adaptadores ocorre em um ponto explícito quando necessário. Evitar ciclos e serviços globais. O ESLint verifica as fronteiras atuais; atualizar as regras ao criar composição ou aliases.

Preservar trabalho local, não reescrever histórico, não forçar push nem fazer merge automático em main. Usar Conventional Commits e branches de tarefa. Cada tarefa na nuvem já é isolada: reutilizar o checkout, sem criar worktree salvo solicitação explícita. Não registrar segredos, tokens ou dados pessoais. Nunca inventar procedimentos técnicos oficiais.

## Referência de produto — MVP 1.0

`docs/requirements/PRD.md` é a fonte oficial. `docs/requirements/archive/` contém histórico; não tratar RFs antigos ou ADRs parcialmente superados como requisitos vigentes. Consultar ADR-003 para a mudança de privacidade/consulta e o backend ainda indefinido. Não confundir os requisitos novos com o comportamento já implementado.

O MVP atende uma congregação e somente áudio. Não introduzir controle de presença, ausência, frequência, rankings, avaliações individuais, chamados avulsos, estado de reparo em andamento ou restauração de ocorrência cancelada. Auditoria técnica e respostas de disponibilidade não podem ser convertidas em fiscalização de voluntários.

Offline é obrigatório no MVP: considerar operações individuais, deduplicação, preservação de problemas e revisão de conflitos desde a modelagem, sem escolher bibliotecas ou backend por antecipação. Não prometer revogação instantânea em dispositivos desconectados; o servidor revalida permissões ao sincronizar. Não inventar itens oficiais de checklist nem o formato de exportação do Hourglass. A Implementação 03 confirmou primeiro/terceiro fins de semana com sábado como referência; domingo dia 1 pertence ao mês anterior. Ver ADR-005, incluindo configuração de sábado/domingo, política de mês curto e limite de geração.

## Contrato de membros — entrega 02

Consultar ADR-004. Manter `version` nos registros restaurados e nas projeções; não atribuir uma versão padrão a registros legados sem decisão de migração. Todas as escritas existentes exigem `expectedVersion`, inclusive mudanças de papel e situação. Não reintroduzir `save` irrestrito: `saveIfVersion` deve comparar e gravar atomicamente no armazenamento. A verificação inicial da aplicação e a fila do adaptador de testes não substituem essa garantia nem a proteção concorrente do último administrador.

## Contrato de manutenções — entrega 03

Ler ADR-005. Regra recorrente e ocorrência são agregados distintos; não recalcular identidade pela data remarcada. Geração exige intervalo limitado, unicidade por congregação/regra/ciclo estável (`cycleKey`) e retorno do existente sem sobrescrever cancelamentos/exceções. Revisões exigem `effectiveFrom` explícito e histórico de configurações; selecionar pela referência civil do ciclo, manter categoria/ancoragem e nunca reidentificar ciclo por dia de execução. Reidratação exige histórico e origem completos; não inferir silenciosamente campos legados. Mudanças exigem versão esperada e CAS; eventos de auditoria/outbox compartilham a transação. Não tratar `MemberActor` como autenticação. Horário civil com fuso não equivale a instante UTC; a resolução de DST ainda pertence ao adaptador futuro. Não implementar envio de avisos, respostas de disponibilidade ou Hourglass a partir dos contratos sem nova autorização.
