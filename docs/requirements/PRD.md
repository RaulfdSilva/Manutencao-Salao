# Manutencao-Salao — Documento de Requisitos do Produto (PRD) — MVP 1.0

- **Data:** 24 de outubro de 2026.
- **Status:** requisitos funcionais definidos. Alguns detalhes técnicos ainda precisam de validação.
- **Público inicial:** uma única congregação.
- **Área inicial:** manutenção de equipamentos de áudio.

Este é o PRD oficial do MVP, consolidado a partir do documento fornecido pelo responsável pelo projeto. Requisitos descritos não significam funcionalidades já implementadas. O estado atual e as divergências conhecidas estão nas notas ao final e no [ADR-003](../decisions/ADR-003-mvp-1-consolidation.md).

## 1. Objetivo do aplicativo

O Manutencao-Salao é um aplicativo móvel destinado a facilitar a programação, organização e execução das manutenções do Salão do Reino.

O administrador configura as datas das manutenções, os participantes elegíveis e os horários de notificações. A partir dessas configurações, o aplicativo automatiza convites, lembretes e avisos.

O sistema deverá funcionar mesmo sem conexão com a internet durante as manutenções.

### Princípios fundamentais

- Reduzir o trabalho administrativo repetitivo.
- Facilitar a colaboração voluntária entre os irmãos.
- Manter uma interface simples e acessível.
- Não registrar presenças, ausências ou frequência individual.
- Não criar rankings ou avaliações de participação.
- Não exigir atualizações constantes sobre o andamento de reparos.
- Não substituir a comunicação habitual entre os irmãos.

O aplicativo não deve ser utilizado como ferramenta de fiscalização dos voluntários.

## 2. Membros e permissões

Existirão três perfis:

- **Administrador:** gerencia membros, configura manutenções, calendário, modelos de checklist e notificações.
- **Responsável pela manutenção:** organiza equipes, acompanha as atividades e encerra manutenções.
- **Membro:** consulta a programação, informa disponibilidade e participa do preenchimento dos checklists conforme as permissões da manutenção.

### Cadastro

- Nome obrigatório.
- Telefone opcional.
- Um perfil por membro.
- Apenas administradores cadastram, editam, desativam ou reativam membros.
- A ativação de um dispositivo será separada do cadastro do membro.
- O primeiro administrador será provisionado de maneira segura.

### Privacidade

- Todos os membros podem visualizar os membros ativos e seus papéis.
- Telefones são visíveis apenas para administradores.
- Membros inativos são visíveis apenas para administradores.
- Desativar um membro remove suas designações futuras, preservando os registros técnicos.
- Dispositivos com acesso revogado não são reativados automaticamente.

## 3. Calendário de manutenções

O aplicativo terá quatro periodicidades:

- Quinzenal.
- Mensal.
- Trimestral.
- Semestral.

As manutenções quinzenais estarão relacionadas à escala da equipe de áudio, utilizando informações do Hourglass. O formato de importação ainda precisa ser definido.

**Esclarecimento aprovado na Implementação 03:** quinzenais usam o primeiro e o terceiro fins de semana do mês, contados pelo sábado, com execução configurável no sábado ou domingo seguinte. Domingo dia 1 pertence ao fim de semana iniciado no mês anterior. Não utilizar repetição fixa de 14 dias. Ver ADR-005.

### Programação

O calendário combinará:

- Recorrências automáticas.
- Datas específicas.
- Ajustes individuais em ocorrências.

O administrador define e aprova a programação. Depois disso, convites e lembretes são executados automaticamente.

**Revisão segura de séries — política aprovada após a auditoria da Implementação 03:** revisões exigem início de vigência explícito. Ocorrências já materializadas, inclusive futuras, canceladas ou remarcadas, permanecem intactas e não podem ser recriadas pela mesma regra para o mesmo ciclo. Ciclos ainda não materializados seguem a configuração aplicável à sua vigência. Alterações individuais usam os casos de uso da ocorrência. Essa proteção não impede manutenções avulsas ou de regras distintas na mesma data. A identidade civil do ciclo e a seleção de vigência estão definidas no ADR-005.

### Alteração de data

Ao remarcar uma manutenção, o sistema deverá:

1. Atualizar a ocorrência.
2. Recalcular os lembretes futuros.
3. Invalidar os agendamentos antigos.
4. Avisar os envolvidos.
5. Perguntar ao administrador se deseja manter as respostas de disponibilidade ou solicitar nova confirmação.
6. Exigir a escolha explícita de manter o prazo de respostas ou definir outro, independente da escolha das respostas. Não recalcular automaticamente.

Quando houver mudança de dia, o aplicativo recomendará uma nova confirmação.

### Cancelamento

O cancelamento de uma ocorrência será definitivo na primeira versão.

- A ocorrência cancelada deixa de estar ativa.
- Seus lembretes futuros são invalidados.
- Os envolvidos recebem um aviso.
- As demais ocorrências recorrentes não são afetadas automaticamente.
- O registro técnico do cancelamento é preservado.

Não haverá função de restauração. Caso seja necessário, o administrador criará uma nova manutenção pelo fluxo padrão.

## 4. Modalidades de participação

Cada manutenção poderá utilizar uma das duas modalidades.

### Participação aberta

Todos os membros ativos elegíveis podem colaborar, mesmo que não tenham respondido ao convite.

Não existe obrigação de selecionar individualmente cada participante.

Qualquer membro ativo poderá preencher o checklist de uma manutenção aberta.

### Equipe designada

O administrador ou responsável seleciona os participantes.

Somente os membros designados, além dos administradores e responsáveis autorizados, poderão preencher o checklist.

### Quantidade de participantes

O sistema poderá trabalhar com:

- Quantidade mínima recomendada.
- Quantidade desejada.

Esses valores são instrumentos de planejamento, não limites obrigatórios.

Se houver menos participantes que o mínimo recomendado, o aplicativo emitirá um alerta, sem cancelar automaticamente a manutenção.

## 5. Disponibilidade

As respostas disponíveis serão:

- Posso participar.
- Talvez.
- Não posso participar.
- Sem resposta.

A ausência de resposta não deve ser interpretada como recusa.

**Esclarecimentos aprovados na Implementação 04:** em participação aberta todos os membros ativos elegíveis podem receber convite e responder, sem obrigação de resposta para participar. Em equipe designada somente designados atualmente ativos recebem convite de participação e registram respostas, inclusive quando administradores ou responsáveis. As permissões existentes de consulta do calendário e organização da equipe permanecem. Responder Sim não cria designação automática.

O membro poderá alterar sua resposta. Se alguém designado deixar de estar disponível, o responsável receberá um aviso para reorganizar a equipe.

### Prazos

- Antecedência dos convites configurável por categoria.
- Prazo de resposta sugerido: cinco dias antes da manutenção.
- Possibilidade de ajustar o prazo em uma ocorrência.
- Possibilidade de encerrar antecipadamente ou reabrir as respostas.

A janela encerra automaticamente no prazo, independentemente de abrir o aplicativo. Administradores e responsáveis autorizados daquela manutenção podem encerrar antecipadamente ou reabrir. Exceção aprovada: depois do fechamento, quem havia respondido Sim pode alterar para Não e gerar evento para alertar o responsável, sem justificativa ou interpretação negativa.

Respostas acompanham `availabilityRevision`: preservar mantém validade; reconfirmar retira a validade atual das respostas anteriores, mantendo as revisões anteriores somente até o descarte obrigatório no término/cancelamento. Membros inativos, designações retiradas e ocorrências canceladas não autorizam novas respostas. Eventos representam necessidades de convite, respostas, indisponibilidade após prazo, encerramento/reabertura e mudanças de elegibilidade/reconfirmação; não significam envio de notificação.

### Painel de disponibilidade

O responsável visualizará:

- Quantidade de respostas positivas.
- Quantidade de respostas negativas.
- Quantidade de respostas "Talvez".
- Quantidade de membros sem resposta.

Essas informações servem exclusivamente para organizar a manutenção, não para avaliar os irmãos.

## 6. Checklists

O aplicativo utilizará como referência inicial a matriz de manutenção fornecida pela organização.

A matriz contém tarefas distribuídas por periodicidade e por categorias de equipamentos, incluindo microfones, reprodutores de áudio, mesa de som, equalizadores, amplificadores, sonofletores, caixas acústicas, cabos e conexões.

Os itens exatos deverão ser transcritos e conferidos com uma fonte legível antes de implementar o catálogo definitivo.

### Tarefas adicionais

Existirão dois tipos:

- **Ocasionais:** adicionadas somente à manutenção atual.
- **Recorrentes:** incorporadas ao modelo das próximas manutenções daquela periodicidade.

A alteração dos modelos recorrentes será controlada pelo administrador.

### Resultados de uma tarefa

- Concluída sem problema.
- Problema encontrado.
- Não se aplica.

Uma tarefa não será considerada concluída apenas porque alguém abriu o checklist.

### Preenchimento colaborativo

Vários irmãos autorizados poderão preencher a mesma manutenção, inclusive sem internet.

O sistema sincronizará as alterações quando a conexão retornar.

Administradores e responsáveis poderão encerrar a manutenção.

## 7. Pendências

As pendências serão utilizadas para registrar problemas identificados durante a execução dos checklists.

Problemas descobertos fora das manutenções poderão continuar sendo comunicados diretamente no grupo dos irmãos, sem necessidade de criar chamados no aplicativo.

### Cadastro de pendência

- Descrição obrigatória.
- Foto opcional.
- Vínculo automático com a manutenção e a tarefa de origem.

### Estados

Existirão somente dois estados:

- **Pendente:** problema registrado que ainda precisa ser resolvido.
- **Concluída:** problema resolvido.

Haverá um botão **Marcar como concluída**.

Após a conclusão, o problema sairá da lista de pendências abertas, mas permanecerá no histórico técnico.

Não haverá:

- Estado "Em andamento".
- Atribuição obrigatória de reparadores.
- Cobrança de atualizações.
- Controle de produtividade individual.

A permissão exata para marcar uma pendência como concluída ainda precisa de confirmação.

## 8. Notificações

O aplicativo utilizará dois canais:

1. Notificações push no celular.
2. Central interna de avisos.

Os avisos permanecerão acessíveis na central, mesmo quando o usuário não permitir notificações push.

### Configuração

O administrador definirá os horários de envio por categoria de manutenção, com possibilidade de ajustes individuais por ocorrência.

O horário de silêncio será único para toda a congregação, também configurado pelo administrador.

Sugestão inicial: das 22h às 7h.

### Tipos de avisos

- Convites para informar disponibilidade.
- Lembretes de resposta.
- Designações.
- Lembretes de manutenção próxima.
- Mudanças de data e horário.
- Cancelamentos.
- Alertas administrativos para responsáveis.

### Prioridade

Avisos comuns respeitam o horário de silêncio.

Cancelamentos e remarcações registrados quando faltarem até 24 horas para a manutenção gerarão push prioritário imediato, respeitando as permissões e limitações do sistema operacional.

Os avisos importantes aparecerão imediatamente na central interna.

### Agrupamento inteligente

Lembretes comuns coincidentes poderão ser reunidos em um único push.

Designações, cancelamentos e remarcações permanecerão separados.

Cada aviso continuará individualmente acessível na central.

### Automação

O envio deverá funcionar no servidor, independentemente de o aplicativo estar aberto.

O sistema deverá evitar:

- Notificações duplicadas.
- Lembretes de resposta enviados após o membro responder.
- Avisos relativos a manutenções canceladas.
- Lembretes que perderam a validade enquanto aguardavam o fim do horário de silêncio.

## 9. Funcionamento offline

O modo offline é obrigatório desde a primeira versão.

Os membros poderão, sem internet:

- Consultar manutenções previamente sincronizadas.
- Consultar e preencher checklists.
- Registrar problemas.
- Adicionar fotos aos registros.
- Criar tarefas ocasionais.
- Marcar pendências como concluídas, quando autorizados.

As alterações ficarão armazenadas localmente e serão sincronizadas automaticamente quando a conexão retornar.

O aplicativo mostrará claramente:

- Dados sincronizados.
- Alterações aguardando envio.
- Conflitos que precisam de revisão.

O primeiro acesso e a ativação de um dispositivo exigirão internet.

### Sincronização colaborativa

As alterações deverão ser sincronizadas individualmente, sem substituir o checklist inteiro pela cópia de um único celular.

Regras essenciais:

- Alterações em tarefas diferentes são combinadas automaticamente.
- Duas conclusões da mesma tarefa não criam duplicações.
- Problemas registrados são preservados independentemente da conclusão da tarefa.
- Registros diferentes de problemas são preservados.
- Resultados incompatíveis são sinalizados para revisão.
- O servidor revalida as permissões ao receber operações realizadas offline.

## 10. Interface e navegação

O aplicativo utilizará tema escuro moderno, com cartões horizontais, boa legibilidade e cores discretas para representar estados.

Terá quatro abas principais:

- **Início:** próxima manutenção, pendências abertas e atividades próximas do membro.
- **Manutenções:** calendário, lista de ocorrências, disponibilidade e checklists.
- **Pendências:** problemas registrados e botão para marcar como concluídos.
- **Equipe:** membros ativos e seus papéis, respeitando as restrições de privacidade.

A experiência deverá minimizar formulários longos e ações desnecessárias.

## 11. Arquitetura e qualidade

O projeto já utiliza React Native com Expo, TypeScript, Expo Router, Vitest e Zod.

A implementação deverá manter separação entre:

- Domínio.
- Aplicação.
- Infraestrutura.
- Apresentação.

As regras de negócio devem ser testáveis sem depender das telas.

A arquitetura deverá considerar desde o início:

- Persistência local.
- Sincronização offline.
- Autenticação e autorização.
- Banco de dados central.
- Agendamento de notificações no servidor.
- Tratamento de operações duplicadas.
- Auditoria de alterações administrativas.
- Proteção de dados dos membros.

A tecnologia definitiva do backend ainda será definida.

## 12. Fora do escopo do MVP

Não implementar inicialmente:

- Suporte completo a várias congregações.
- Novas áreas de manutenção além do áudio.
- Inventário obrigatório de equipamentos individuais.
- Restauração de manutenções canceladas.
- Controle de presença ou ausência.
- Rankings ou avaliações de voluntários.
- Acompanhamento de reparos "em andamento".
- Designação obrigatória de responsáveis por pendências.
- Chamados avulsos para problemas fora das manutenções.
- Horário de silêncio individual por membro.

Esses itens não devem ser adicionados pelo Codex sem uma nova decisão de produto.

## 13. Pontos que ainda exigem validação

Antes da implementação completa, será necessário:

1. Conferir e transcrever integralmente o checklist da organização.
2. Definir como obter ou importar a escala quinzenal do Hourglass.
3. Definir o backend, a autenticação e a ativação segura dos dispositivos.
4. Confirmar quem poderá marcar pendências como concluídas.
5. Definir limites e armazenamento de fotografias offline.
6. Detalhar o tratamento de conflitos e o encerramento de checklists compartilhados.

## 14. Ordem recomendada de implementação

1. Entidades, perfis, permissões e testes de domínio.
2. Calendário, recorrências e cancelamentos.
3. Modelos de checklist, resultados e pendências.
4. Persistência offline e sincronização colaborativa.
5. Disponibilidade, convites e designações.
6. Notificações automáticas e central de avisos.
7. Integração, testes em aparelhos reais e piloto na congregação.

**Critério de aceite do MVP:** a congregação consegue programar uma manutenção, convidar irmãos, preencher o checklist colaborativamente mesmo sem internet, registrar e concluir problemas e receber lembretes automáticos, sem controle de presença ou acompanhamento individual de participação.

---

## Notas de consolidação e estado da implementação

Estas notas registram a conciliação com o histórico do projeto; não acrescentam funcionalidades ao MVP nem substituem decisões pendentes do responsável.

- **Fonte oficial:** as seções 1 a 14 consolidam o PRD fornecido pelo responsável em 24 de outubro de 2026. O [PRD anterior](archive/PRD-pre-MVP-1.0.md) foi preservado somente para consulta histórica; seus RF-01 a RF-24 eram uma decomposição proposta e não devem concorrer com este documento como fonte vigente.
- **Estado atual:** existem o bootstrap, as entregas 01/02 de membros, a entrega 03 do domínio/casos de uso de planejamento de manutenções e a entrega 04 de convites/disponibilidade. Ainda não existem autenticação, backend, persistência local, sincronização, calendário visual, checklists, envio de notificações ou telas funcionais do MVP. A tela estática atual não representa o tema ou a navegação definitivos.
- **Adequação de membros — entrega 02:** `get` e `list` permitem consulta da equipe ativa por membros ativos autorizados; administradores ativos também consultam inativos e telefones. Não administradores recebem respostas sem a propriedade `phone`; consulta de inativo por não administrador retorna o mesmo erro de cadastro inexistente. Solicitantes inativos continuam sem acesso. A divergência registrada na consolidação documental foi resolvida em código/testes, sem implementar autenticação; ver [ADR-004](../decisions/ADR-004-member-access-concurrency.md).
- **Regras anteriores complementares preservadas:** permanecem as decisões aprovadas de um papel por membro, estados `active`/`inactive`, identificador imutável, proteção do último administrador ativo, cadastro separado da identidade de acesso, ausência de login por e-mail e senha, ativação com token temporário de uso único e reativação que restaura elegibilidade sem reautorizar dispositivos explicitamente revogados. A consulta da equipe não concede acesso a membros ou dispositivos com acesso revogado.
- **Recorrência conciliada na entrega 03:** o responsável confirmou primeiro/terceiro fins de semana com sábado de referência e possibilidade de execução no sábado ou domingo. Domingo dia 1 pertence ao mês anterior. O contrato da escala de áudio não pressupõe o formato ou API do Hourglass; essa integração permanece pendente. Ver [ADR-005](../decisions/ADR-005-maintenance-planning.md).
- **Backend em aberto:** Supabase/PostgreSQL permanece uma alternativa histórica, não uma escolha definitiva. Os nomes presentes em `.env.example` são vestígios da preparação inicial e não tornam a integração obrigatória.
- **Sem fiscalização:** disponibilidade, designação, autoria técnica e conclusão de tarefa não equivalem a comprovação de presença. Auditoria e sincronização não devem ser reaproveitadas para frequência, ranking ou avaliação individual.
- **Limites da consolidação original:** somente documentação foi alterada naquela tarefa. A entrega 02 posterior corrigiu exclusivamente domínio, casos de uso, contratos e testes de membros. O PRD define o destino do produto e a ordem recomendada, não autoriza implementar todas as funcionalidades em uma única tarefa. Cada entrega exige escopo próprio e evidências de validação.

## Entrega 02 — concorrência cadastral e critérios locais

O registro de membro possui `version`, inteiro seguro positivo iniciado em 1. Cada mudança efetiva de perfil, papel ou situação incrementa a versão exatamente uma vez; identidade e congregação permanecem estáveis. Restauração exige a versão persistida; dados ausentes ou inválidos são rejeitados, sem adotar um valor padrão silenciosamente.

`update`, `changeRole`, `deactivate` e `reactivate` exigem `expectedVersion`, após o argumento de perfil/papel quando existente. Somente administradores ativos podem executá-los. Versão inválida gera `MemberError(INVALID_VERSION)`; versão válida mas desatualizada gera `MemberOperationError(MEMBER_VERSION_CONFLICT)`. A checagem ocorre após autorização e antes de qualquer efeito, inclusive quando o conteúdo enviado já é o atual.

O repositório só oferece `saveIfVersion(member, expectedVersion)`: o futuro armazenamento deve comparar identificador, congregação e versão e gravar a versão seguinte em uma operação condicional atômica. O retorno falso impede auditoria e retirada de designações. A transação deve manter autorização, proteção do último administrador, gravação, retirada e auditoria consistentes; controle por registro não substitui a proteção do conjunto de administradores.

Operações sem mudança com a versão atual não incrementam versão nem repetem efeitos. Uma repetição com a versão anterior não é sucesso idempotente: retorna conflito. Recuperação da resposta perdida e deduplicação por identificador de operação são decisões futuras, sem enfraquecer esse contrato. O cliente futuro deve reler e revisar a alteração após conflito, sem reaplicar automaticamente o formulário antigo com uma versão nova.

Critérios unitários: equipe ativa visível aos papéis autorizados; telefone/inativos protegidos; solicitante inativo negado; duas edições da mesma versão não se sobrepõem; formulário desatualizado não restaura nome antigo; conflitos de gravação condicional não produzem efeitos; rollback de falha posterior restaura versão e estado no adaptador de testes. A prova em banco, sessões e dispositivos continua fora desta entrega.

## Entrega 03 — planejamento de manutenções

Implementados domínio, contratos e casos de uso para aprovar/revisar regras recorrentes, gerar ocorrências por intervalo, criar datas específicas, consultar programação/elegibilidade, ajustar configurações individuais, designar equipe, reagendar e cancelar. Categoria/horário/fuso/padrões são configuração da regra; quantidades e responsáveis podem ser ajustados por ocorrência. Não há geração infinita ou alteração automática de ocorrências existentes ao revisar uma regra. Revisões guardam configuração completa e vigência explícita, preservando categoria e ancoragem. O calendário seleciona a revisão pela referência civil de cada ciclo, inclusive para geração de períodos anteriores; uma vigência no meio do ciclo vale para o próximo ciclo aplicável. Ver ADR-005.

A geração é determinística por regra/intervalo e exige no máximo 366 dias inclusivos por lote. Ciclos têm unicidade por congregação/regra/`cycleKey`, que deve ser preservada no armazenamento real. A chave independe da data de execução: sábado de referência nas quinzenais e mês programado nas demais. Repetição retorna o existente, mesmo remarcado ou cancelado. Regras mensais/trimestrais/semestrais usam meses civis ancorados no mês de início, com escolha explícita entre omitir mês sem o dia e usar seu último dia.

Administradores ativos aprovam/revisam regras e criam/geram/configuram/reagendam/cancelam ocorrências. Administradores ou responsáveis ativos explicitamente autorizados organizam equipe designada. Membros ativos consultam e verificam elegibilidade, sem que isso registre presença ou resposta de disponibilidade. Mínimo/desejado são referências opcionais não negativas; mínimo maior que desejado é configuração inválida, mas equipe maior que o desejado é permitida. Quantidade insuficiente não cancela a ocorrência.

Reagendamento exige decisão explícita de preservar respostas ou reconfirmar, mantém identidade/origem e incrementa a revisão de disponibilidade apenas para reconfirmação. Trata-se de contrato para o futuro módulo de respostas, não armazenamento ou envio de respostas. Cancelamento é definitivo, afeta uma ocorrência, preserva dados técnicos e rejeita alterações posteriores. Eventos guardam estados anterior/posterior e invalidam versões antigas de lembretes; não há envio real.

Alterações exigem versão esperada e gravação condicional. Eventos, dados e unicidade devem compartilhar a transação no servidor, inclusive integração futura com retirada de designações por desativação de membros. Identidade confiável, adaptadores de banco/outbox, conversão de horário civil para UTC com DST, integração Hourglass e os demais módulos continuam pendentes. Ver ADR-005 para decisões, alternativas e limites.

## Entrega 04 — convites e disponibilidade

Domínio e aplicação implementam janela por ocorrência/revisão, última resposta válida, prazos explícitos, fechamento lógico, comandos duráveis de encerramento, reabertura, exceção Sim para Não, planejamento agregado e indicador de confirmações abaixo do mínimo. Eventos e jobs exigem persistência atômica com CAS no futuro servidor. A criação configura prazo pelo administrador; consultas agregadas e reabertura admitem responsável vinculado. O próprio membro consulta sua resposta.

Ainda não existem agendador real, backend, envio, UI ou sincronização. Reagendamento exige decisões independentes para preservar/reconfirmar respostas e manter/substituir prazo, sem cálculo automático. Administrador e responsável vinculado podem encerrar antecipadamente. Reinclusão não recupera respostas e gera nova necessidade de convite somente conforme elegibilidade e janela; não obriga responder para comparecer. Convites, respostas e disponibilidade individual são temporários e devem ser descartados no término/cancelamento em todas as revisões. Ver ADR-006.

### Decisões finais da entrega 04 — retenção e controle anual

Depois de conclusão técnica ou cancelamento, eliminar convites, respostas e dados individuais de disponibilidade. Preservar exclusivamente o histórico técnico/operacional necessário ao acompanhamento anual, sem presença ou métricas por pessoa. Considerar eventos com identificadores pessoais, sincronizações offline pendentes, cópias, logs e backups; não prometer limpeza instantânea de celular desconectado nem expurgo físico em banco inexistente.

Prever fatos por ocorrência para contabilizar manutenções programadas, concluídas e canceladas, com categoria, primeira/última agenda, situação e instantes técnicos terminais, sem armazenar respostas individuais. Não implementar o painel anual nesta etapa. A definição do ano de contabilização em remarcações entre anos ainda exige decisão; manter os fatos sem presumir um critério.

Conclusão técnica ainda não foi implementada: recibos e interfaces descrevem o ponto de integração futura, sem fabricar uma conclusão. No cancelamento disponível, a transação chama o contrato de descarte e mantém a projeção técnica minimizada. O servidor/banco futuro deverá implementar descarte físico, propagação offline, retenção/expiração em backups e supressão ao restaurar. Os snapshots antigos de auditoria com atores/equipes não podem ser arquivados integralmente como controle anual; ver incompatibilidades no ADR-006.

### Correção da integração de equipes — entrega 04

Alterar designados ou modalidade deve reconciliar disponibilidade na mesma transação, antes do commit, sem depender apenas de processamento posterior do estado final. Retirada invalida resposta e convite; reinclusão não recupera a resposta e pode gerar convite novo conforme janela e elegibilidade. Membros continuamente elegíveis preservam respostas/convites. Janela ausente, fechada ou descartada não é criada/reaberta por essa reconciliação.

A minimização de identificadores em ocorrências canceladas/encerradas, incluindo `assignedMemberIds`, `responsibleMemberIds`, snapshots, eventos, projeções e armazenamento futuro é pendência obrigatória para produção. Não apagar dados operacionais necessários de ocorrências ativas, criar conclusão fictícia ou afirmar exclusão física sem adaptadores reais. Ver ADR-006.
