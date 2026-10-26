# ADR-006 — Convites e disponibilidade

- Status: adotado na Implementação 04, atualizado pelas decisões finais de produto.
- Base inicial: main `dd5c086`; ajustes derivados de `feat/maintenance-availability` em `f3c88c5`.
- Referências: PRD MVP 1.0, ADR-004/005 e decisões finais do responsável.

## Domínio, público e permissões

A janela pertence a `(congregationId, occurrenceId, availabilityRevision)` e tem versão própria. A transação relê cadastro e ocorrência. Respostas são `yes`, `no`, `maybe`; `unanswered` é ausência de manifestação, nunca recusa. Guardar somente a última resposta válida por membro/revisão, sem justificativa, presença, ranking, histórico de participação ou designação automática.

Na modalidade aberta, todos os membros ativos elegíveis podem receber convite e responder. Na designada, somente designados atualmente ativos respondem, mesmo quando administradores/responsáveis. As permissões de participar e consultar calendário continuam no domínio de manutenção. Responder não é obrigatório para comparecer. Administradores e responsáveis ativos vinculados podem consultar totais, encerrar antecipadamente e reabrir janelas. Depois do encerramento, a exceção `yes -> no` comunica indisponibilidade e gera evento operacional, sem reabrir a janela.

Convites são necessidades de entrega em eventos, não mensagens. São revalidados por revisão, janela, prazo, público e geração de elegibilidade do destinatário. Retirada e reinclusão geram outra identidade de convite: a resposta anterior não é recuperada. Nova necessidade de convite só é produzida quando elegível e com janela aberta. Reabertura emite necessidades para quem ainda não respondeu. Uma resposta de outro membro não invalida convites pendentes.

## Reagendamento e prazo independentes

O administrador fornece duas escolhas independentes: `preserve`/`reconfirm` para respostas e `keep`/`replace` para prazo. `MaintenanceUseCases.reschedule` exige a escolha de prazo e a versão esperada da janela (`null` somente quando ausente), além da versão da ocorrência. O evento de reagendamento registra ambas as decisões. Não há cálculo automático, inclusive de cinco dias.

`keep` conserva exatamente o prazo existente; sem janela não há prazo a manter e o comando é rejeitado. `replace` exige instante UTC explícito, podendo configurar a janela ausente. Uma alteração somente de prazo não modifica identidade ou revisão de respostas da ocorrência. Mudanças de prazo invalidam jobs/convites anteriores por geração e agendam o comando substituto atomicamente. Conflito na janela ou falha posterior reverte também a remarcação da ocorrência.

`preserve` mantém as respostas válidas; `reconfirm` cria a janela da nova revisão com o prazo escolhido e sem respostas atuais. As revisões anteriores são temporárias até o término da manutenção, não um histórico permanente por pessoa. A mudança de data não implica reconfirmação. Alterar prazo não presume reabertura de janela já encerrada: mantém-se o fluxo explícito de reabrir. O domínio anterior não distingue encerramento manual e por prazo; a atualização expira a janela antes de substituir a data para não depender de o job já ter sido executado. Se for desejada reabertura como efeito do novo prazo, essa combinação precisa de confirmação explícita de produto; não é inferida nesta entrega.

O limite é exclusivo: `now >= deadline` fecha logicamente a janela. O servidor futuro deve executar comandos duráveis de encerramento, registrados na mesma transação de criação/substituição/reabertura, independente do celular. Jobs antigos são no-op; entrega antecipada não pode ser consumida definitivamente pelo worker. Não existe worker real nesta entrega.

## Retenção final e descarte

Convites, respostas e dados individuais de disponibilidade são temporários e devem ser eliminados após conclusão técnica ou cancelamento, em TODAS as revisões. Isso substitui as ressalvas de retenção/reinclusão da versão inicial deste ADR. O contrato `AvailabilityRetention.discardOccurrence` exige marcador não pessoal, remoção de janelas/convites, eventos individuais (incluindo identificadores nos IDs dos eventos), jobs e projeções de entrega na mesma transação. Repetições são idempotentes; recibos terminais conflitantes são rejeitados. O marcador impede respostas, reconfiguração ou reconstituição por comandos offline antigos e deve ser verificado também pelo armazenamento condicional.

O cancelamento real chama obrigatoriamente esse contrato, inclusive se a revisão atual não tem janela. `refreshIn` também reconcilia cancelamentos. O adaptador em memória testa o descarte lógico/contratual, não prova eliminação em armazenamento real. Apenas histórico técnico/operacional minimizado pode permanecer; valores antigos de respostas não são copiados para eventos.

O adaptador futuro deve propagar descarte para caches e dispositivos na próxima sincronização, rejeitar uploads tardios e não restaurar dados pessoais de uma cópia offline antiga. Revogação/limpeza imediata em celular desconectado não é garantida. Backups, réplicas, exportações, logs e filas de mensagens exigem política de expiração e supressão ao restaurar; o marcador deve sobreviver à restauração. Prazos físicos de expurgo dependem do backend e não são inventados aqui.

## História técnica e controle anual

`MaintenanceTechnicalSnapshot` é uma projeção explícita sem ator, equipe, responsáveis, convites, respostas ou contagens individuais. Os casos de uso registram criação e alterações efetivas na transação. A origem estável, ocorrência, categoria, agenda civil/fuso, versão e instante observado permitem manter fatos operacionais por ocorrência. O armazenamento deve preservar a primeira agenda e aplicar versões de forma idempotente; várias edições não são várias manutenções.

`AnnualMaintenanceRecord`/`AnnualMaintenanceHistory` preveem primeira e última agenda, estado programada/concluída/cancelada, instantes terminais e versão de origem. Não há painel, classificação por pessoa nem algoritmo de contabilização anual. Registros legados sem fatos de criação exigirão migração explícita: não inferir primeira agenda pela data remarcada. A escolha do ano em uma remarcação entre anos não está definida: preservar as datas permite decidir isso depois sem inventar uma política de contagem.

## Incompatibilidades e integração futura

A entidade atual só possui `scheduled`/`cancelled`: NÃO se acrescenta uma conclusão fictícia. `TechnicalCompletionReceipt`, `AvailabilityCompletionIntegration` e `completionDisposalRequest` modelam a ligação futura: o servidor deve verificar e persistir uma conclusão técnica real, atualizar o fato operacional e descartar disponibilidade na mesma transação. A função de conversão de recibo não conclui nem autentica uma manutenção.

Os eventos e snapshots originais de manutenção do ADR-005 incluem identificadores de atores/equipes; não servem diretamente como histórico anual ou como arquivo permanente da disponibilidade. A nova projeção minimizada os separa. O futuro adaptador de retenção deve eliminar/minimizar os payloads pessoais e suas chaves em outbox/auditoria, preservando apenas o fato técnico necessário. A situação/identidade histórica das ocorrências não é reescrita para simular uma migração de privacidade. Essa integração de armazenamento continua pendente, explicitamente incompatível com arquivar para sempre os snapshots integrais anteriores.

Unicidade, CAS, fatos técnicos, eventos, jobs, reagendamento e descarte compartilham a mesma transação serializada por congregação. Os hooks de ciclo de vida são obrigatórios, não opcionais ou de melhor esforço. O adaptador de testes não é autenticação, persistência ou prova de segurança em produção. Backend, conclusão real, armazenamento e agendador durável ainda precisam de implementação própria. Não há UI, push/central, offline real, Hourglass, checklists ou pendências nesta entrega.

## Correção da auditoria final — público e disponibilidade na mesma transação

A auditoria reproduziu quatro falhas ao chamar os casos de uso completos: resposta anterior reaparecia após reinclusão, convite retirado voltava a ser válido, nova designação não gerava necessidade de convite e troca aberta/designada/aberta recuperava respostas. Os testes antigos chamavam `refresh` separadamente e não cobriam a integração ausente.

`MaintenanceUnitOfWork.lifecycle.availabilityAudienceChanged` passa a ser obrigatório. `assignTeam` e `configure` o chamam após gravação condicional, fato técnico e evento de manutenção, antes de concluir a transação, quando mudarem a modalidade ou os identificadores designados. O adaptador deve ligá-lo a `AvailabilityUseCases.refreshIn` com a MESMA unidade de trabalho, congregação, ocorrência e revisão atuais. Não chamar `refresh`, que abre outra transação, nem enfileirar somente uma leitura do estado final.

Cada retirada é observada e remove a resposta do planejamento; reinclusão ganha outra geração de convite, sem recuperar resposta. Membros que continuam elegíveis mantêm respostas e gerações existentes. Mudanças apenas de quantidade/responsáveis não mudam o público de respostas e não disparam o hook. No-ops não duplicam eventos. Uma janela ausente não é criada pelo hook; janela fechada reconcilia sem emitir convite ou reabrir; nova necessidade depende da elegibilidade, revisão e abertura atuais. Cancelamento continua bloqueando alterações; marcador terminal impede recriar disponibilidade mesmo ao processar dados operacionais antigos.

Permissões e versão da ocorrência são verificadas antes dos efeitos. A reconciliação lê a versão atual da janela no contexto serializado e usa CAS. Falha nesse CAS ou nos eventos reverte ocorrência, versões, histórico técnico e ambos os fluxos de eventos. A fila do adaptador de testes demonstra a orquestração, não a atomicidade de um banco real. Mudanças futuras de cadastro de membros e retirada de atribuições também precisam compartilhar essa fronteira no servidor.

### Pendência obrigatória antes de produção — minimização terminal

Ocorrências canceladas/encerradas ainda podem conter `assignedMemberIds`, `responsibleMemberIds` e referências de pessoas, inclusive nas consultas integrais `get`/`list`. A correção transacional não elimina esses campos nem dados operacionais necessários de ocorrências ativas. Antes de produção, implementar e testar a minimização de identificadores nas saídas de ocorrências terminais, snapshots, eventos e suas chaves, projeções, logs e armazenamento futuro; aplicar também a cópias offline, backups e restaurações. Manter somente os fatos técnicos/operacionais necessários, sem métricas por pessoa. Isso é requisito de liberação, não melhoria opcional. Não existe conclusão técnica fictícia, migração de privacidade ou exclusão física validada nesta entrega.
