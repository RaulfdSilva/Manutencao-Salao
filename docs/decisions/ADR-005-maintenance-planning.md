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

`RecurrenceRule` contém configuração aprovada, aprovador, instante de aprovação e versão. Criação/revisão é exclusiva de administrador ativo; a revisão reapresenta a configuração completa e registra nova aprovação. Não há rascunho ou aprovação automática por agendador. Revisões não alteram ocorrências existentes.

A geração exige um intervalo inclusivo com no máximo 366 dias, sem relógio global ou geração infinita. Esse é um limite técnico de lote, não uma restrição de produto: horizontes maiores podem ser divididos em lotes. A função de calendário é determinística para regra/intervalo iguais.

Cada ocorrência gerada conserva `source.ruleId`, `source.slotDate` e o sábado de origem quando aplicável. A chave única é `(congregationId, ruleId, slotDate)`, NÃO a data atual após reagendamento. `insertGeneratedIfAbsent` deve garantir unicidade atomicamente no armazenamento e devolver o registro existente intacto, inclusive cancelado ou remarcado. Identificadores são fornecidos por gerador confiável; tentativas repetidas podem consumir identificadores não utilizados, mas não criar registros ou eventos duplicados. Nenhum formato de UUID ou banco foi imposto.

Geração sobre intervalo original devolve a ocorrência já existente mesmo que sua data atual esteja fora desse intervalo; a consulta `list` filtra pela data atual. Uma ocorrência cancelada não é restaurada por regeneração. Ocorrências avulsas são criadas por administrador sem referência de série e podem representar datas específicas/exceções.

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

Toda alteração de regra/ocorrência exige versão esperada. A entidade incrementa a versão; o repositório faz CAS por identificador/congregação/versão e confere o resultado. Conflito não produz evento. A geração exige também a versão da regra usada como referência. Repetir uma alteração com versão antiga retorna conflito, como no ADR-004; geração repetida usa a unicidade do slot e não altera o existente.

`MaintenancePlanningEvent` registra ator, data, versão, snapshot anterior/posterior e identificador estável por agregado/versão. É o contrato de auditoria técnica e outbox durável, não um envio de notificação. Reschedule/cancel e mudanças de configuração/equipe invalidam versões anteriores de lembretes. Consumidores futuros devem consultar a versão/situação atual no servidor antes de enviar, para rejeitar avisos obsoletos mesmo se a projeção de eventos estiver atrasada. Regra revisada não invalida automaticamente a programação de ocorrências já existentes.

Persistência, unicidade e eventos devem compartilhar a mesma transação serializada por congregação, incluindo leitura das permissões. Falha posterior reverte registros, versões e eventos. O adaptador de membros/desativação deverá compartilhar esse contexto ao retirar designações futuras; invocar dois callbacks com transações independentes não garante atomicidade. Nada disso é demonstrado em banco real pelo adaptador exclusivo de testes.

### Contrato futuro da escala de áudio

`AudioTeamSchedule.membersForWeekend` expressa uma consulta interna normalizada por congregação e sábado de referência, devolvendo identificadores internos de membros. Não presume arquivo CSV/JSON, campos, API, autenticação ou acesso disponível no Hourglass. O contrato não é chamado nem implementado nesta entrega; não há equipes fictícias em produção ou designação automática baseada em dados inventados.

## Alternativas e consequências

Intervalos fixos em dias não representam meses nem os fins de semana aprovados. Copiar a série inteira ao reagendar causaria alterações indevidas. Identidade baseada na data atual recriaria uma ocorrência após remarcação. Por isso, usamos calendário civil, origem imutável e unicidade do slot original.

Reutilizar a versão da ocorrência para invalidar lembretes torna explícita a obsolescência após mudanças de destinatários/configuração, ao custo de exigir reavaliação dos lembretes por um consumidor futuro. Não introduzimos agendador ou protocolo de fila agora.

Manter disponibilidade e eventos por contrato evita construir os módulos seguintes antecipadamente. A consequência é que essa entrega não envia avisos, não guarda respostas e não prova que uma notificação ou reconfirmação chegou ao celular. Fotos, conflitos offline, encerramento compartilhado e pendências permanecem fora do escopo.

## Validação e limitações

Testes unitários cobrem categorias, datas inválidas, meses/anos/ano bissexto, primeiro/terceiro fim de semana e domingo dia 1, políticas de mês curto, geração por intervalos repetidos/sobrepostos, preservação de ocorrências remarcadas/canceladas, permissões, quantidades, equipes, revisão de disponibilidade, eventos, cancelamento definitivo, CAS, isolamento e rollback. Os 104 testes anteriores de membros/bootstrap devem continuar passando.

A autorização real, implementação do armazenamento condicional/único e da outbox, retirada de designações por desativação, resolução de DST, notificações, Hourglass, dispositivos e sincronização exigem adaptadores e testes próprios. A autoria dos eventos serve à auditoria técnica, sem controle de frequência, ranking ou avaliação dos voluntários. Não há declaração de segurança ou operação offline de produção concluída.
