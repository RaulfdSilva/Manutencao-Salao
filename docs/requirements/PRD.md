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

### Programação

O calendário combinará:

- Recorrências automáticas.
- Datas específicas.
- Ajustes individuais em ocorrências.

O administrador define e aprova a programação. Depois disso, convites e lembretes são executados automaticamente.

### Alteração de data

Ao remarcar uma manutenção, o sistema deverá:

1. Atualizar a ocorrência.
2. Recalcular os lembretes futuros.
3. Invalidar os agendamentos antigos.
4. Avisar os envolvidos.
5. Perguntar ao administrador se deseja manter as respostas de disponibilidade ou solicitar nova confirmação.

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

O membro poderá alterar sua resposta. Se alguém designado deixar de estar disponível, o responsável receberá um aviso para reorganizar a equipe.

### Prazos

- Antecedência dos convites configurável por categoria.
- Prazo de resposta sugerido: cinco dias antes da manutenção.
- Possibilidade de ajustar o prazo em uma ocorrência.
- Possibilidade de encerrar antecipadamente ou reabrir as respostas.

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
- **Estado atual:** existem o bootstrap e as entregas 01/02 de domínio/casos de uso de membros. Ainda não existem autenticação, backend, persistência local, sincronização, calendário, tarefas, notificações ou telas funcionais do MVP. A tela estática atual não representa o tema ou a navegação definitivos.
- **Adequação de membros — entrega 02:** `get` e `list` permitem consulta da equipe ativa por membros ativos autorizados; administradores ativos também consultam inativos e telefones. Não administradores recebem respostas sem a propriedade `phone`; consulta de inativo por não administrador retorna o mesmo erro de cadastro inexistente. Solicitantes inativos continuam sem acesso. A divergência registrada na consolidação documental foi resolvida em código/testes, sem implementar autenticação; ver [ADR-004](../decisions/ADR-004-member-access-concurrency.md).
- **Regras anteriores complementares preservadas:** permanecem as decisões aprovadas de um papel por membro, estados `active`/`inactive`, identificador imutável, proteção do último administrador ativo, cadastro separado da identidade de acesso, ausência de login por e-mail e senha, ativação com token temporário de uso único e reativação que restaura elegibilidade sem reautorizar dispositivos explicitamente revogados. A consulta da equipe não concede acesso a membros ou dispositivos com acesso revogado.
- **Recorrência a conciliar:** o PRD anterior especificava primeiro e terceiro fim de semana para as quinzenais. O novo texto confirma vínculo com a escala do Hourglass, sem explicitar essa restrição. Confirmar se ela permanece antes de implementar o cálculo; não assumir nem intervalo fixo de 14 dias, nem a retirada automática da regra anterior.
- **Backend em aberto:** Supabase/PostgreSQL permanece uma alternativa histórica, não uma escolha definitiva. Os nomes presentes em `.env.example` são vestígios da preparação inicial e não tornam a integração obrigatória.
- **Sem fiscalização:** disponibilidade, designação, autoria técnica e conclusão de tarefa não equivalem a comprovação de presença. Auditoria e sincronização não devem ser reaproveitadas para frequência, ranking ou avaliação individual.
- **Limites da consolidação original:** somente documentação foi alterada naquela tarefa. A entrega 02 posterior corrigiu exclusivamente domínio, casos de uso, contratos e testes de membros. O PRD define o destino do produto e a ordem recomendada, não autoriza implementar todas as funcionalidades em uma única tarefa. Cada entrega exige escopo próprio e evidências de validação.

## Entrega 02 — concorrência cadastral e critérios locais

O registro de membro possui `version`, inteiro seguro positivo iniciado em 1. Cada mudança efetiva de perfil, papel ou situação incrementa a versão exatamente uma vez; identidade e congregação permanecem estáveis. Restauração exige a versão persistida; dados ausentes ou inválidos são rejeitados, sem adotar um valor padrão silenciosamente.

`update`, `changeRole`, `deactivate` e `reactivate` exigem `expectedVersion`, após o argumento de perfil/papel quando existente. Somente administradores ativos podem executá-los. Versão inválida gera `MemberError(INVALID_VERSION)`; versão válida mas desatualizada gera `MemberOperationError(MEMBER_VERSION_CONFLICT)`. A checagem ocorre após autorização e antes de qualquer efeito, inclusive quando o conteúdo enviado já é o atual.

O repositório só oferece `saveIfVersion(member, expectedVersion)`: o futuro armazenamento deve comparar identificador, congregação e versão e gravar a versão seguinte em uma operação condicional atômica. O retorno falso impede auditoria e retirada de designações. A transação deve manter autorização, proteção do último administrador, gravação, retirada e auditoria consistentes; controle por registro não substitui a proteção do conjunto de administradores.

Operações sem mudança com a versão atual não incrementam versão nem repetem efeitos. Uma repetição com a versão anterior não é sucesso idempotente: retorna conflito. Recuperação da resposta perdida e deduplicação por identificador de operação são decisões futuras, sem enfraquecer esse contrato. O cliente futuro deve reler e revisar a alteração após conflito, sem reaplicar automaticamente o formulário antigo com uma versão nova.

Critérios unitários: equipe ativa visível aos papéis autorizados; telefone/inativos protegidos; solicitante inativo negado; duas edições da mesma versão não se sobrepõem; formulário desatualizado não restaura nome antigo; conflitos de gravação condicional não produzem efeitos; rollback de falha posterior restaura versão e estado no adaptador de testes. A prova em banco, sessões e dispositivos continua fora desta entrega.
