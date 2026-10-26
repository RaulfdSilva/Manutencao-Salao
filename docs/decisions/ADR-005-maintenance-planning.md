# ADR-005 — Planejamento de manutenções, recorrências e ocorrências

- **Status:** adotado na Implementação 03, com limites de domínio/aplicação e contratos.
- **Data:** 25 de outubro de 2026.
- **Base:** `main` remota em `46d5f33`, incluindo as entregas 01/02 e o PRD consolidado.
- **Referências:** PRD MVP 1.0, ADR-001 a ADR-004, solicitação Implementação 03 e resposta do responsável sobre a contagem dos fins de semana.

## Contexto

Precisamos planejar manutenções sem introduzir interface, banco, notificações reais, checklists, problemas, respostas de disponibilidade ou sincronização offline. Regra recorrente e ocorrência não podem compartilhar uma identidade mutável: uma exceção individual não deve alterar a série nem ser recriada por geração posterior.

## Decisões

### Categorias e calendário civil

As quatro categorias iniciais são `fortnightly`, `monthly`, `quarterly` e `semiannual`. As três últimas usam intervalos de 1, 3 e 6 meses civis, ancorados no mês de início da regra. Dia do mês, horário, fuso, início e término são configuração da regra, sem datas ou valores de uma congregação fixados na arquitetura. A estrutura tipada permite acrescentar categoria/estratégia por uma mudança explícita, sem um registro genérico de plugins antecipado.

O responsável confirmou que o sábado é a referência do fim de semana. `fortnightly` gera o primeiro e o terceiro sábados do mês, ou os domingos imediatamente seguintes, conforme o dia configurado. Um domingo no dia 1 pertence ao fim de semana iniciado no mês anterior e não é contado como o primeiro do mês. Isso não é uma repetição a cada 14 dias. A definição anterior pendente no PRD fica conciliada por esta decisão; o formato real do Hourglass permanece desconhecido.

Regras mensais exigem política explícita para dia inexistente: `skip` omite aquele mês; `last_day` usa o último dia válido, sem deslocar o dia original nos meses seguintes. Não escolher silenciosamente uma política da congregação. Início e término são inclusivos.

Datas são civis `YYYY-MM-DD`, horários `HH:mm` e fusos reconhecidos por `Intl`. A aritmética usa calendário gregoriano e operações UTC apenas para evitar dependência do fuso da máquina. Isso NÃO converte o horário local da manutenção em instante UTC. O futuro adaptador de agendamento deverá resolver horários inexistentes/ambíguos de horário de verão antes de executar lembretes ou comparar instantes; nenhuma biblioteca de fuso foi instalada nesta entrega.

### Aprovação, revisão e geração delimitada

**Revisão desta decisão após a auditoria:** a correção adota identidade estável de ciclo e histórico de configurações com `effectiveFrom` explícito. A chave baseada somente na data original, descrita na entrega inicial, é substituída pela chave `(congregationId, ruleId, cycleKey)`. A data original permanece como proveniência, não como proteção de unicidade.

O ciclo quinzenal é identificado pelo sábado de referência (`weekend:YYYY-MM-DD`); ciclos mensais/trimestrais/semestrais pelo mês programado (`month:YYYY-MM`). Categoria e `startsOn` original são imutáveis na mesma regra: mantêm a cadência e a ancoragem. Alterar a família/cadência requer outra regra, sem converter silenciosamente ciclos antigos. Horário, fuso, dia de execução, política de mês curto, término e padrões de configuração podem ser revisados.

Cada revisão aprovada preserva configuração completa, autor, instante, versão e vigência. Datas de vigência são não decrescentes, nunca anteriores ao início original; com a mesma vigência prevalece a revisão aprovada por último. A seleção usa a referência civil do ciclo: sábado nas quinzenais e dia 1 do mês programado nas demais. Uma vigência no meio do ciclo aplica-se ao próximo ciclo cuja referência seja igual ou posterior a ela. A configuração inicial também cobre seu primeiro ciclo parcial, respeitando `startsOn`. Não se usa a data remarcada nem o relógio da máquina para selecionar revisão.

Geração utiliza o histórico para obter a configuração aplicável a cada ciclo. Uma data de vigência sozinha não impede duplicações: inserção única por ciclo continua obrigatória, mesmo ao revisar retroativamente um período já materializado. O existente vence integralmente, inclusive quando futuro, cancelado ou remarcado; ajustes exigem os casos de uso individuais. Fontes guardam `cycleKey`, `slotDate`, `weekendStart` e `ruleVersion` da configuração efetivamente usada. Ciclos omitidos por `skip` não ficam reservados; uma revisão aplicável pode materializá-los se ainda não houver registro.

O contrato de armazenamento deve manter origem/ciclo imutáveis em atualizações, serializar revisão e geração pela mesma regra/congregação e gravar dados/eventos na mesma transação. Não há restrição global por data: regras diferentes e ocorrências avulsas podem coincidir. Reidratação exige os novos campos e histórico, sem inferir identidade de datas remarcadas ou preencher registros legados silenciosamente. Não existe banco para migrar nesta entrega; um armazenamento externo legado precisaria de conversão explícita e análise de colisões antes da integração.

`RecurrenceRule` contém identidade, versão e histórico validado de revisões aprovadas; cada revisão contém configuração, vigência, aprovador, instante e versão. Criação/revisão é exclusiva de administrador ativo; a revisão reapresenta a configuração completa e registra nova aprovação. Não há rascunho ou aprovação automática por agendador. Revisões não alteram ocorrências existentes.

A geração exige um intervalo inclusivo com no máximo 366 dias, sem relógio global ou geração infinita. Esse é um limite técnico de lote, não uma restrição de produto: horizontes maiores podem ser divididos em lotes. A função de calendário é determinística para regra/intervalo iguais.

Cada ocorrência gerada conserva origem completa: regra, ciclo, versão de configuração, data original e sábado de referência quando aplicável. A chave única vigente é `(congregationId, ruleId, cycleKey)`, independente de datas de execução ou de vigência. `insertGeneratedIfAbsent` deve garantir unicidade atomicamente no armazenamento e devolver o registro existente intacto, inclusive cancelado ou remarcado. Identificadores são fornecidos por gerador confiável; tentativas repetidas podem consumir identificadores não utilizados, mas não criar registros ou eventos duplicados. Nenhum formato de UUID ou banco foi imposto.

O intervalo de geração filtra as datas projetadas pela configuração aplicável. Para cada ciclo candidato devolve o existente mesmo que sua data original/atual esteja fora do intervalo; a consulta `list` filtra pela data atual. Se a revisão omitir um ciclo (por término ou `skip`), a geração não o retorna, mas não exclui o registro: consultas individuais e `list` continuam acessíveis. Uma ocorrência cancelada não é restaurada por regeneração. Ocorrências avulsas são criadas por administrador sem referência de série e podem representar datas específicas/exceções.

### Configuração e participação

A regra contém padrões da categoria/série, copiados para cada ocorrência. Administradores podem ajustar configurações por ocorrência; uma revisão da regra não sobrescreve esses ajustes. `minimum` e `desired` são opcionais, inteiros não negativos; se ambos existirem, mínimo não pode superar o desejado. São referências de planejamento: abaixo do mínimo gera indicação, nunca cancelamento; ultrapassar o desejado não bloqueia designações.

Em participação aberta, qualquer membro ativo da congregação é elegível, sem resposta ou designação obrigatória. A entidade proíbe uma lista obrigatória de designados nesse modo. Não há estado de presença ou adesão individual criado aqui.

Em equipe designada, participantes designados, administradores e responsáveis explicitamente autorizados podem participar. `responsibleMemberIds` é configurado por administrador e referencia membros ativos com papel `maintenance_manager`. Administradores têm autoridade implícita; um responsável sem vínculo com a ocorrência não pode reorganizar sua equipe. Designações exigem membros ativos da mesma congregação e não têm limite de capacidade baseado no desejado.

Ao mudar explicitamente para participação aberta, a lista atual de designações é limpa, preservada no evento/snapshot anterior. Uma ocorrência cancelada não concede participação nem produz alerta de mínimo insuficiente. A situação atual do membro é revalidada; uma designação não concede acesso permanente a membro inativo.

### Reagendamento, disponibilidade e cancelamento

Reagendamento é exclusivo do administrador, mantém identificador e origem e afeta apenas uma ocorrência. O comando exige decisão `preserve` ou `reconfirm`. A revisão de disponibilidade começa em 1: preservar mantém a revisão; reconfirmar a incrementa. O futuro módulo de respostas deverá vincular respostas a essa revisão, mantendo respostas anteriores como histórico técnico em vez de apagá-las. Nenhuma resposta foi implementada ou removida nesta etapa.

Mudança de data civil retorna `reconfirmationRecommended: true`, sem substituir a escolha explícita do administrador. Alterar apenas o horário não obriga reconfirmação. Reagendamento idêntico com preservação é no-op; uma escolha explícita de reconfirmar pode gerar nova revisão mesmo no mesmo horário.

Cancelamento é definitivo, exclusivo do administrador e por ocorrência. Preserva todos os dados técnicos, configurações e designações históricas, apenas mudando a situação. Toda tentativa posterior de alteração, inclusive outro cancelamento com versão atual, é rejeitada com `OCCURRENCE_CANCELLED`. Não há restauração de manutenção; `restore` nas entidades significa somente reidratação de armazenamento e não é um caso de uso de recuperação de cancelamento.

### Permissões, eventos e consistência

Identidade é `MemberActor` resolvida futuramente por serviço confiável; papel e situação são lidos pelo contrato de membros, sem aceitar um papel declarado no comando. Membros ativos consultam programação e elegibilidade. Administradores aprovam/revisam regras, geram/criam/configuram/reagendam/cancelam ocorrências; administrador ou responsável autorizado organiza equipe designada. Encerramento de execução/checklist fica para entrega posterior.

Toda alteração de regra/ocorrência exige versão esperada. A entidade incrementa a versão; o repositório faz CAS por identificador/congregação/versão e confere o resultado. Conflito não produz evento. A geração exige também a versão da regra usada como referência. Repetir uma alteração com versão antiga retorna conflito, como no ADR-004; geração repetida usa a unicidade do ciclo e não altera o existente.

`MaintenancePlanningEvent` registra ator, data, versão, snapshot anterior/posterior e identificador estável por agregado/versão. É o contrato de auditoria técnica e outbox durável, não um envio de notificação. Reschedule/cancel e mudanças de configuração/equipe invalidam versões anteriores de lembretes. Consumidores futuros devem consultar a versão/situação atual no servidor antes de enviar, para rejeitar avisos obsoletos mesmo se a projeção de eventos estiver atrasada. Regra revisada não invalida automaticamente a programação de ocorrências já existentes.

Persistência, unicidade e eventos devem compartilhar a mesma transação serializada por congregação, incluindo leitura das permissões. Falha posterior reverte registros, versões e eventos. O adaptador de membros/desativação deverá compartilhar esse contexto ao retirar designações futuras; invocar dois callbacks com transações independentes não garante atomicidade. Nada disso é demonstrado em banco real pelo adaptador exclusivo de testes.

### Contrato futuro da escala de áudio

`AudioTeamSchedule.membersForWeekend` expressa uma consulta interna normalizada por congregação e sábado de referência, devolvendo identificadores internos de membros. Não presume arquivo CSV/JSON, campos, API, autenticação ou acesso disponível no Hourglass. O contrato não é chamado nem implementado nesta entrega; não há equipes fictícias em produção ou designação automática baseada em dados inventados.

## Alternativas e consequências

Intervalos fixos em dias não representam meses nem os fins de semana aprovados. Copiar a série inteira ao reagendar causaria alterações indevidas. Identidade baseada na data atual recriaria uma ocorrência após remarcação. Por isso, usamos calendário civil, origem imutável e unicidade do ciclo. Usar somente a data original também permitia duplicar ciclos após trocar sábado por domingo ou o dia mensal; por isso, essa parte da decisão inicial foi substituída após a auditoria. Uma data de vigência sem chave estável não resolveria o problema.

Reutilizar a versão da ocorrência para invalidar lembretes torna explícita a obsolescência após mudanças de destinatários/configuração, ao custo de exigir reavaliação dos lembretes por um consumidor futuro. Não introduzimos agendador ou protocolo de fila agora.

Manter disponibilidade e eventos por contrato evita construir os módulos seguintes antecipadamente. A consequência é que essa entrega não envia avisos, não guarda respostas e não prova que uma notificação ou reconfirmação chegou ao celular. Fotos, conflitos offline, encerramento compartilhado e pendências permanecem fora do escopo.

## Validação e limitações

Testes unitários cobrem categorias, datas inválidas, meses/anos/ano bissexto, primeiro/terceiro fim de semana e domingo dia 1, políticas de mês curto, geração por intervalos repetidos/sobrepostos, preservação de ocorrências remarcadas/canceladas, permissões, quantidades, equipes, revisão de disponibilidade, eventos, cancelamento definitivo, CAS, isolamento e rollback. As regressões de membros/bootstrap e da entrega inicial devem continuar passando. Testes da correção cobrem revisões das quatro categorias, vigência, histórico, preservação de futuros materializados, mudanças de mês/ano, ciclos omitidos, colisões legítimas de datas, concorrência, CAS e rollback parcial.

A autorização real, implementação do armazenamento condicional/único e da outbox, retirada de designações por desativação, resolução de DST, notificações, Hourglass, dispositivos e sincronização exigem adaptadores e testes próprios. A autoria dos eventos serve à auditoria técnica, sem controle de frequência, ranking ou avaliação dos voluntários. Não há declaração de segurança ou operação offline de produção concluída.

## Evolução na entrega 04

O ADR-006 implementa domínio/aplicação de convites e respostas sobre `availabilityRevision`, sem alterar os contratos de identidade/ciclos deste ADR. As referências acima à ausência de respostas descrevem o limite da entrega 03 original. Janela e respostas possuem agregado e versão próprios; os futuros adaptadores devem compartilhar a transação de elegibilidade com membros/manutenções. Eventos de reagendamento continuam registrando a escolha explícita de preservar/reconfirmar.

## Decisões finais da entrega 04

Reagendamento agora exige também uma escolha explícita de prazo, independente de preservar/reconfirmar respostas, com atualização transacional da janela. O cancelamento chama retenção de disponibilidade e registra projeção técnica sem membros para controle anual futuro. Os snapshots integrais de atores/equipes descritos na entrega 03 não devem ser tratados como arquivo anual permanente; a minimização de armazenamento está contratada no ADR-006. Nenhum estado completed ou encerramento técnico fictício foi adicionado. Identidade/ciclos, cancelamento definitivo e dados técnicos da ocorrência permanecem preservados.

## Evolução pela entrega 05 — ADR-007

As referências anteriores à ausência de conclusão/checklists descrevem a entrega 03. O ADR-007 introduz conclusão técnica real de domínio/aplicação: `scheduled -> completed`, terminal, sem reagendamento/cancelamento ou recriação do ciclo. Mantém identidade, origem e versões. O horário da conclusão pertence ao snapshot selado e ao fato anual transacional; não é inferido da agenda. Histórico de disponibilidades permanece temporário conforme ADR-006, nunca arquivo pessoal permanente.
