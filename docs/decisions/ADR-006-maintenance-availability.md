# ADR-006 — Convites e disponibilidade

- Status: adotado na Implementação 04, limitado a domínio, aplicação e contratos.
- Base: main `dd5c086`, PRD MVP 1.0 e instruções da entrega 04.

## Decisões

Uma janela de disponibilidade pertence a `(congregationId, occurrenceId, availabilityRevision)`. Seu contador de versão é próprio; não se grava a ocorrência para responder. A aplicação relê membro e ocorrência na transação. Respostas são `yes`, `no`, `maybe`; `unanswered` é projeção da ausência, nunca recusa. Cada membro tem somente a última resposta de planejamento nessa revisão. Não há justificativas, presença, classificação individual, consulta de histórico por pessoa ou designação automática.

Convites são necessidades de entrega em eventos, não mensagens enviadas. Na modalidade aberta o público é composto pelos membros ativos da congregação; na designada, somente designados atualmente ativos. Administrador ou responsável não designado pode administrar/consultar mas não responder nessa modalidade. O convite não é credencial. Consumidores devem revalidar revisão, cancelamento, janela e elegibilidade antes de entregar; um evento antigo não concede acesso.

O administrador configura prazo como instante UTC explícito, sem converter silenciosamente data civil/fuso nem impor cinco dias. O limite é exclusivo: `now >= deadline` fecha logicamente a janela em qualquer operação. Um comando durável de encerramento, registrado atomicamente na criação/reabertura, permite processamento pelo servidor independente do celular. Seu identificador inclui revisão e geração da janela: jobs antigos após reabertura são no-op. Não existe worker, timer no cliente ou agendador real nesta entrega. O futuro servidor deve executar e repetir esses comandos (sem consumir definitivamente jobs entregues antes do prazo), garantindo observabilidade/atrasos; a guarda de prazo continua válida mesmo se o worker atrasar.

Administradores e responsáveis vinculados podem reabrir com novo prazo futuro explícito, conforme autorização desta entrega. O fechamento antecipado fica administrativo; delegação ao responsável não está explícita no PRD e permanece pendente de confirmação. Depois do fechamento, somente `yes -> no` é permitido, sem justificativa, e produz evento operacional específico. A janela não reabre com essa resposta. Repetições com a versão atual sem alteração são no-op; versão antiga é conflito.

`preserve` conserva a revisão e as respostas. `reconfirm` usa outra janela/revisão, inicialmente sem respostas atuais; registros anteriores permanecem técnicos e não são expostos em relatórios individuais. É necessário configurar explicitamente a janela da nova revisão: não presumir novo prazo nem reabertura automática. A reconfirmação já é sinalizada pelo evento transacional de reagendamento da entrega 03 e também pela configuração da nova revisão.

Convites guardam geração de elegibilidade por destinatário; remoção/reinclusão cria outra geração, sem invalidar convites de outros membros por uma resposta não relacionada. A verificação `invitationIsCurrent` permite ao consumidor descartar eventos antigos. Reabertura gera novas necessidades para quem ainda não respondeu, vinculadas à nova geração de janela.

O agregado guarda público reconciliado para emitir convites novos/retiradas sem duplicações. Retiradas descartam sua resposta do planejamento atual, conservando apenas os registros técnicos autorizados da revisão anterior. Não se recupera automaticamente resposta invalidada em uma nova inclusão; um eventual fluxo de recuperação depende da decisão pendente. Isso impede reutilizar uma designação retirada como convite permanente. Não se cria uma trilha individual de cada valor editado: eventos de resposta indicam membro/revisão/versão, sem replicar valores anteriores. A retenção e minimização finais dos registros técnicos precisam ser aprovadas antes de produção. A decisão de recuperar respostas após reinclusão permanece pendente; por proteção, a entrega não faz restauração automática.

Armazenamento exige criação única, CAS, transação comum com eventos e comandos de prazo, e serialização por congregação compartilhada com membros/manutenções. O servidor deve executar a reconciliação de elegibilidade na mesma transação das mudanças de membro/designação/cancelamento; a porta aceita a unidade de trabalho compartilhada, sem compor duas transações independentes. Não é instalado adaptador de produção. Leituras e respostas revalidam o estado atual mesmo se a projeção estiver atrasada. Cancelamento invalida convites e bloqueia respostas, preservando a janela para fins técnicos.

Totais consideram apenas o público atualmente elegível e respostas da revisão atual. O indicador `below_minimum` compara confirmações `yes` com o mínimo, sem cancelar a ocorrência. Planejamento completo é exclusivo de administrador/responsável vinculado; o membro recebe somente sua própria disponibilidade. Não se altera a consulta pública do calendário.

## Pendências e limites

Backend, identidade confiável, agendador durável/outbox e transações reais continuam pendentes. Não há push, central, UI, offline, Hourglass, checklists ou problemas. A fila dos testes não prova segurança de produção. Delegar fechamento antecipado ao responsável, recalcular prazo ao reagendar, antecedência automática por categoria, retenção técnica e eventual recuperação de resposta após uma nova inclusão exigem decisão de produto; nenhuma recuperação ou recálculo automático é autorizado aqui.
