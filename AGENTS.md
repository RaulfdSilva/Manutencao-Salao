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

## Disponibilidade — entrega 04

Ler ADR-006. Não confundir elegibilidade para participar com autorização para responder: equipe designada admite respostas somente de designados, inclusive para administradores/responsáveis. A janela pertence à ocorrência/revisão, possui versão própria e prazo UTC explícito. Revalidar cadastro, modalidade, designações, cancelamento e revisão na transação. Ausência de resposta é `unanswered`, nunca `no`. Não criar justificativas, designação por confirmação, presença, rankings ou histórico de participação. Preservar a exceção `yes -> no` após fechamento e o evento operacional correspondente. Relógio é injetado; prazo limita comandos mesmo sem execução do job.

`closeDue`, `refresh`/`refreshIn` e `invitationIsCurrent` são entradas exclusivas de servidor confiável/outbox, não endpoints anônimos. Contratos de CAS, eventos e agendamentos compartilham a transação; reconciliação deve compor a transação de membros/manutenções. Nenhuma fila em memória prova produção. Eventos não enviam mensagens; preservar invalidação por revisão, geração de janela e geração de convite. Reagendamento exige decisões independentes de respostas e prazo; nunca recalcular automaticamente. Administradores e responsáveis vinculados encerram/reabrem. Reinclusão não recupera resposta. Dados individuais de disponibilidade são temporários e descartados no término/cancelamento em todas as revisões, inclusive eventos e chaves pessoais. Preservar somente projeção técnica minimizada para controle anual; não implementar conclusão fictícia nem alegar exclusão física. Marcador terminal bloqueia replay offline. Os adaptadores futuros devem tratar caches, backups e restaurações. Ver ADR-006 para hooks transacionais obrigatórios e incompatibilidades dos snapshots antigos.

Correção da auditoria final: `assignTeam`/`configure` devem chamar o hook obrigatório `availabilityAudienceChanged` quando modalidade/designados mudarem. Vincular ao `refreshIn` com a mesma unidade de trabalho, nunca abrir transação separada ou depender só do estado final assíncrono. Regressões devem chamar os casos de uso reais sem compensação manual de refresh. Não invalidar quem continua elegível nem criar janela ausente/descartada. Antes da produção, minimizar identificadores (`assignedMemberIds`, `responsibleMemberIds`) em ocorrências terminais, saídas, snapshots, eventos, projeções e armazenamento futuro; não apagar informação operacional necessária de ocorrência ativa nem declarar exclusão física validada.

## Checklists e conclusão — entrega 05

Ler ADR-007. Modelos por periodicidade usam pares tarefa/categoria e snapshots por ocorrência; nunca inventar catálogo oficial. Na entrega 05, a matriz não havia sido conferida/importada; a entrega 06 inclui a transcrição fornecida, conforme ADR-008, sem conferência visual da fotografia. Não criar atribuição, reserva, bloqueio, check-in ou identidade do executor. Problemas técnicos independentes não desaparecem com correção de resultado; resolver exige administrador ativo ou responsável autorizado.

`completed` é terminal como `cancelled`, preservando diferenças do ciclo de vida. Conclusão autorizada sela checklist e registra fato anual/recibo e descarte de disponibilidade na mesma unidade de trabalho. Correção posterior só por administrador, com antes/depois, data e natureza, sem reabrir nem nova contagem anual. CAS/recibos, autorização atual e transação compartilhada são obrigatórios; testes em memória não comprovam backend, expurgo ou sincronização. Minimização de identificadores legados segue pendente obrigatória antes de produção.

Cancelamento só é permitido antes de trabalho técnico. Preservar o marcador irreversível `technicalWorkRecorded` do checklist e a consulta obrigatória `technicalWork.hasRecordedWork` (inclui qualquer problema). Não derivar ausência de trabalho apenas de unfilled atual, omitir a consulta, aceitar fato do cliente ou inferir false para dados legados. Cancelamento/preenchimento/problemas compartilham coordenação transacional inclusive para linhas ausentes; CAS isolados não bastam. Trabalho interrompido segue conclusão existente, sem resolver pendências automaticamente. Ver correção nos ADRs 005/007.

## Catálogo de áudio — entrega 06

Ler ADR-008 e `docs/catalogs/audio-maintenance-matrix-2026.md`. O catálogo é configuração versionada, validada na fronteira Infrastructure e injetada na aplicação. Não importar JSON/Infrastructure/Zod nas camadas internas. Preservar IDs, 15 tarefas, 9 categorias e associações aprovadas; não inventar procedimentos nem acumular periodicidades. A fonte desta entrega é a transcrição do responsável, revisão de 2026; não declarar a fotografia conferida.

Provisionamento exige administrador ativo, recibo idempotente e transação compartilhada com edições; cria somente modelos ausentes. Nunca sobrescrever um modelo existente, mesmo vazio ou versão 1, nem atualizar checklists materializados. Não inicializar ao importar ou executar seed sem adaptador real. Outra área não está implementada e exige evolução da identidade dos modelos atuais.

## Interface demonstrativa — entrega 07

Ler ADR-009 e `docs/development/UI-REVIEW.md`. Rotas apenas compõem/delegam telas; `app/_layout` injeta a fonte de leitura. Presentation não importa Infrastructure ou repositórios. Exemplos ficam em `presentation/demo` e não são dados de domínio persistidos. Usar nomes/tarefas do catálogo injetado, não inventar procedimentos. Preservar agrupamento por equipamento e identificação visível de demonstração.

Não transformar papéis fictícios em autenticação, introduzir salvamento simulado, distribuição de tarefas ou presença. Manter DTOs sem telefones/inativos, sem alegar autorização de produção. Antes de conectar dados reais, implementar autorização/validação e adaptar a composição em entrega aprovada. Testes SSR usam RN Web somente em Vitest; bundle Android usa RN nativo. Executar o smoke web opcional quando houver navegador disponível e relatar falta de emulador/aparelho.

## Prévia GitHub Pages — entrega 08

Ler ADR-010 e `docs/deployment/GITHUB-PAGES.md`. Workflow independente da CI, somente main por push/workflow_dispatch com guarda de ref nos jobs; nunca publicar branches/PRs automaticamente. Manter permissões por job e actions oficiais, sem PAT. Publicação real só pode ser afirmada após deploy observado; push da branch não é deploy.

Expo SDK 58 usa experiments.baseUrl no build público e saída static com generateStaticParams da fonte fictícia. Preparar diretórios index.html e .nojekyll; testar recursos, links diretos e recargas sob /Manutencao-Salao sem fallback de servidor. Não usar páginas falsas para mascarar rotas ausentes. A composição pública não pode receber informações reais; manter .env desabilitado, nenhuma credencial e campos mínimos. Integrações privadas futuras exigem separar/revisar essa prévia.
