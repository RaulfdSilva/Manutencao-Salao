# ADR-004 — Consulta da equipe e concorrência otimista de membros

- **Status:** adotado na Implementação 02, limitada a domínio, aplicação, contratos, testes e documentação.
- **Referências:** PRD oficial MVP 1.0, seção 2; auditoria do módulo; ADR-002 e ADR-003.
- **Evolução:** implementa a consulta aprovada pelo ADR-003 e substitui os contratos de gravação sem versão da entrega 01. Backend permanece em aberto.

## Contexto

A auditoria reproduziu duas divergências: membros ativos não conseguiam consultar a equipe prevista no PRD e uma edição formada sobre dados antigos conseguia sobrescrever uma edição mais recente. Serializar transações não detecta por si só formulários desatualizados.

Não há autorização para banco, migrações, autenticação, interfaces ou notificações. A solução precisa ser implementável posteriormente em armazenamento real, sem apresentar testes em memória como prova de segurança de produção.

## Decisões

### Consulta

`get` e `list` exigem solicitante ativo com identidade fornecida futuramente por servidor confiável. Administradores ativos consultam registros ativos/inativos e telefone. Outros papéis consultam somente registros ativos da sua congregação, com `phone` omitido da resposta. Um registro inativo consultado por não administrador retorna `MEMBER_NOT_FOUND`, igual a um identificador inexistente/inacessível; não revelar a existência pela resposta. Cadastro, edição, troca de papel, desativação e reativação continuam restritos a administradores ativos.

### Versão e API de alteração

Cada `MemberRecord` tem `version` inteira segura positiva. Criação começa em 1, ignorando qualquer versão externa; restauração exige versão explícita. Mudanças efetivas de nome, telefone, papel ou situação produzem nova instância imutável com incremento de exatamente 1, preservando identidade/congregação. Overflow é rejeitado. Uma normalização sem mudança retorna a instância original, sem incremento.

Todas as quatro mutações exigem versão esperada como último argumento:

```text
update(actor, memberId, profile, expectedVersion)
changeRole(actor, memberId, role, expectedVersion)
deactivate(actor, memberId, expectedVersion)
reactivate(actor, memberId, expectedVersion)
```

A versão está nas respostas de consulta/mutação e nos estados de auditoria. Não é segredo nem autorização. A aplicação resolve autorização e alvo antes de validar a versão esperada; uma versão inválida gera `MemberError(INVALID_VERSION)`. Versão válida mas diferente da atual gera `MemberOperationError(MEMBER_VERSION_CONFLICT)`, inclusive em no-ops. Com a versão atual, no-ops não gravam nem auditam.

### Gravação condicional obrigatória

`save` irrestrito é substituído por `saveIfVersion(member, expectedVersion): Promise<boolean>`. O adaptador deve comparar identificador, congregação e versão persistida e gravar a versão seguinte em uma operação condicional atômica. O registro de saída deve ter versão `expectedVersion + 1`. Se não houver correspondência, retornar falso sem alterar nada. Erros técnicos não são falsos conflitos: propagam-se como falhas do adaptador.

Uma implementação futura poderia usar uma instrução de atualização com predicado de identificador/congregação/versão e avaliar o número de linhas afetadas, ou mecanismo equivalente do backend escolhido. Ler a versão e depois fazer uma escrita irrestrita viola o contrato. Esta decisão define semântica, não instala banco nem fornece migração.

A aplicação também compara a versão no início para rejeitar rapidamente dados obsoletos, mas sempre usa a operação condicional na escrita. Se ela retornar falso, não executar retirada de designações nem auditoria. Se efeitos posteriores falharem, a unidade de trabalho deve reverter a gravação, a versão, designações e auditoria. A futura implementação deve respeitar o mesmo limite transacional.

### Invariantes entre registros e escopo

Uma versão por registro não impede duas alterações em administradores diferentes de deixarem a congregação sem administrador. A serialização apropriada por congregação, incluindo leitura do ator e contagem, permanece obrigatória no servidor. CAS não substitui essa proteção. Tampouco substitui sessão, dispositivo autorizado, validação de dados externos ou revalidação de operações offline.

Ao reativar, não restaurar designações nem dispositivos revogados. Nenhum módulo de tarefas ou dispositivos foi criado. Semanas, calendário e notificações não são afetados por esta entrega.

## Alternativas e consequências

Uma comparação apenas em memória deixaria espaço para gravações concorrentes que não passam pelo mesmo processo. O contrato de escrita condicional transfere a garantia ao armazenamento, com resultado explícito verificável pela aplicação.

Atualização parcial de campos reduziria alguns sobrescritos, mas não resolveria conflitos no mesmo campo. Escolhemos versão do registro para detectar também alterações de papel/situação entre a consulta e o envio. A consequência é exigir recarga/revisão mesmo quando outro administrador alterou um campo diferente. Mesclagem automática não é implementada.

Usar `updatedAt` exigiria definir precisão e sincronização de relógio. Um contador é independente do relógio e torna a causalidade explícita. A persistência deverá preservar o contador, em vez de reconstruí-lo a cada leitura.

Uma requisição repetida com versão antiga retorna conflito mesmo se a primeira tiver sido aplicada. Não há idempotência de transporte com repetição da resposta nesta entrega. O futuro cliente deve reler e revisar; não reaplicar o formulário antigo automaticamente com a versão recém-obtida. Deduplicação por identificador de operação e recuperação de respostas perdidas exigem decisão própria quando houver API/sincronização.

## Testes e limites

Testes cobrem consulta por papéis, proteção de telefone/inativos, solicitantes inativos, regressão do formulário obsoleto, duas edições com a mesma versão, versões ausentes/inválidas, no-ops, alterações de papel/situação, recusa da gravação condicional após a leitura e rollback após falha de auditoria. O adaptador exclusivo de testes compara versões na própria operação de armazenamento, e seus testes exercitam duas escritas derivadas da mesma versão sem a verificação prévia da aplicação.

Ainda faltam testes de conformidade do adaptador real, concorrência entre processos, transações, RLS/autorização e sessões. O procedimento do primeiro administrador continua separado. Registros legados precisarão de decisão explícita de migração se houver persistência; não existe banco atual para migrar. Nenhuma segurança de produção ou sincronização offline foi declarada pronta.
