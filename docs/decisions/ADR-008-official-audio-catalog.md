# ADR-008 — Catálogo de áudio e provisionamento inicial

- Status: adotado na Implementação 06.
- Base: main `9270473`, com as entregas 01–05 e a proteção de cancelamento.
- Referências: PRD, ADRs 005–007 e transcrição fornecida pelo responsável na Implementação 06.

## Decisão

A matriz é configuração JSON versionada em Infrastructure, validada com Zod na fronteira e convertida em definições internas imutáveis. Domain/Application não importam o arquivo, Zod ou Infrastructure. IDs de tarefa/equipamento são estáveis; código da matriz, descrições em português, área, versão e referência de origem são explícitos. As 15 tarefas e 9 categorias produzem 50 pares tarefa/equipamento: 6 quinzenais, 15 mensais, 12 trimestrais e 17 semestrais. Não existe acumulação automática entre periodicidades.

A fonte disponível nesta execução é a transcrição de trabalho do responsável, que confirma revisão em 2026. A referência histórica é 30/05/2026. Não alegar conferência visual da fotografia original nem acrescentar procedimentos/associações. Ver documento da matriz em `docs/catalogs/audio-maintenance-matrix-2026.md`.

O provisionamento é uma operação explícita de administrador ativo em `ChecklistUseCases`, com o mesmo contrato transacional, modelos `ChecklistTemplate`, recibos e armazenamento condicional existentes. Cria exclusivamente modelos ausentes, preserva integralmente qualquer existente e informa quais foram criados/preservados. Não compara descrições para decidir sobrescrever. Revisão administrativa posterior continua pelo caso de uso existente com expectedVersion. Checklists materializados não são atualizados pelo catálogo.

Todas as categorias, evento técnico mínimo e recibo são gravados na mesma transação; falha parcial ou recusa de inserção única faz rollback. Repetir o comando devolve seu recibo; outro comando também não muda modelos existentes. A autorização atual é revalidada em cada execução/replay. Uma futura revisão do arquivo não atualiza instalações: revisão de modelos existentes exige decisão administrativa explícita, não reexecução do inicializador.

Carregar/validar configuração não acessa armazenamento. Imports não criam modelos, membros, ocorrências, resultados, presenças ou contas. Sem banco/adaptador/composição confiável, o provisionamento só é executado em testes; não há script de seed fingindo persistência real. Eventos não enviam mensagens.

## Alternativas e limites

Evitar hardcode nos casos de uso, sistema paralelo de modelos e seed automático ao importar. Um bootstrap que sobrescreve modelos elimina decisões locais; um comando de inicialização separado por periodicidade permite estado parcial. A operação única reutiliza a unidade de trabalho e evita ambos.

A área `audio` consta na configuração e no recibo, sem implementar outras áreas. Os modelos atuais continuam identificados por congregação/periodicidade: o provisionador recusa outras áreas; suporte futuro exige decisão sobre identidade/migração dos modelos. Isso não é suporte multiarea pronto.

O servidor futuro deve obter o catálogo de fonte confiável, resolver a identidade, garantir unicidade/serialização com edições administrativas e atomicidade/outbox reais. Não aceitar arquivo arbitrário do cliente como catálogo oficial. Testes em memória não comprovam segurança/transações de produção. Permanecem pendentes fotografia original, backend, offline, fotos, interface, notificações e minimização pessoal terminal.
