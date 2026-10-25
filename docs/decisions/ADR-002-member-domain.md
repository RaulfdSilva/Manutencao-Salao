# ADR-002 — Domínio e casos de uso de membros

- Status: adotado na entrega 01; política de consulta da decisão 4 parcialmente superada pelo [ADR-003](ADR-003-mvp-1-consolidation.md)
- Data: 2026-10-24
- Base: regras aprovadas na solicitação Implementação 01; complementa ADR-001

## Contexto

Precisamos validar cadastro, papéis, situações e preservação de histórico antes de escolher persistência ou autenticação. A entrega não autoriza telas, banco, migrações ou um sistema de tarefas artificial. A conta autenticada, os dispositivos e o cadastro de membro são conceitos distintos.

## Decisões

1. `Member` é imutável, tem identidade e congregação estáveis, um papel e uma situação. Criação é ativa; restauração valida registros persistidos. Identificadores são opacos no domínio; o futuro servidor deve usar geração e unicidade seguras, preferencialmente UUID. Não se utiliza telefone como identidade.
2. Nome é obrigatório após trim, sem impor sobrenome, alfabeto ou limite arbitrário. Telefone é texto opcional normalizado, sem presumir país, validade real da linha ou unicidade. Validação de transporte com Zod pertence à futura fronteira; Domain não importa Zod. Limites e formato telefônico ficam pendentes de aprovação.
3. `MemberUseCases` reúne operações coesas do módulo: create, get, list, update, changeRole, deactivate e reactivate. Separar classes por operação só será necessário se a evolução justificar. Relógio e geração de identificadores são injetados, sem estado global.
4. Cadastro exige administrador ativo. Como política conservadora, as outras escritas e a listagem também exigem administrador ativo; demais membros ativos consultam apenas o próprio cadastro, sem telefone. Não há autoedição especial. Esta política pode ser ampliada por decisão explícita, sem mudar a entidade.
5. O papel vem do cadastro atual carregado dentro da unidade de trabalho, nunca de um papel declarado no comando. `MemberActor` deve vir de resolução de sessão no servidor; não é prova de identidade nem autenticação simulada.
6. Saídas são projeções próprias. Telefone é omitido por completo para quem não é administrador ativo. A resposta de autodesativação/rebaixamento usa a permissão posterior à mudança. Registros internos do domínio não são DTOs públicos.
7. Não existe método de exclusão. Desativação mantém identidade e chama obrigatoriamente `FutureAssignments.releaseForMember`, que deverá retirar atribuições futuras e auditar cada retirada, preservando execuções passadas. O módulo de tarefas ainda definirá quais estados e horários constituem atribuição futura; o contrato fornece um instante de corte, não implementa calendário ou tarefas.
8. Reativar torna o membro ativo, sem restaurar atribuições ou executar qualquer reautorização de dispositivos. Elegibilidade do cadastro não equivale a sessão válida. A autenticação futura deverá respeitar revogações explícitas e bloquear membros inativos.
9. Desativar ou rebaixar o último administrador ativo é proibido. Contagem considera apenas a congregação e membros ativos. A verificação pertence à aplicação, pois envolve mais de uma entidade; sua garantia concorrente dependerá da transação do servidor.
10. `MemberTransactions` exige serialização por congregação e atomicidade de leitura do ator, verificação do último administrador, persistência, retirada e auditoria. Todos os caminhos de escrita do futuro servidor, inclusive integrações administrativas, devem respeitar essa fronteira. Um futuro adaptador deverá usar lock/transação apropriados, não apenas mutex em memória. Operações sem mudança não repetem efeitos.
11. Auditoria registra ator, congregação, alvo, ação, instante e estados de papel/situação anteriores/posteriores; não duplica nomes e telefones. Não é um histórico completo dos valores pessoais editados. Falhas não são silenciadas; falhas de armazenamento/integração propagam-se sem conversão em sucesso. O futuro transporte deve mapear erros técnicos sem expor informações sensíveis.
12. Não existe bypass para o primeiro administrador nos casos de uso. O procedimento inicial seguro, controlado e auditável depende do responsável técnico e de entrega separada.

## Alternativas e consequências

Repositórios separados para membro, tarefas e auditoria, sem uma transação comum, permitiriam desativação parcial. A unidade de trabalho explicita o requisito sem escolher um banco ou inventar tarefas. O custo é exigir um adaptador servidor capaz de cumprir o contrato; callbacks com chamadas remotas de melhor esforço não bastam. Se tarefas vierem a ser um serviço externo, será necessário novo ADR sobre consistência, possivelmente outbox e processamento idempotente, antes de relaxar a atomicidade.

Entidades mutáveis facilitariam alterações locais, mas aumentariam o risco de modificar identidade e snapshots usados na auditoria. Novas instâncias imutáveis simplificam testes e preservam os estados anteriores.

Reutilizar registros de domínio nas respostas seria mais curto, mas vazaria telefone. Projeções explícitas preservam a política de visibilidade. Duplicar políticas no servidor não pode ser evitado confiando no cliente: a implementação autoritativa deverá executar no servidor, respeitando os mesmos contratos e testes.

## Validação e limites

Vitest verifica invariantes, autorização local, projeções, transições, idempotência, contratos de efeitos, propagação de falhas e interleaving serializado no adaptador de testes. Esse adaptador existe apenas em `tests/` e simula rollback; não comprova atomicidade PostgreSQL, RLS, resolução de identidade, revogação de sessões, execução de tarefas ou preservação de histórico em um banco real.

Antes da integração: escolher autenticação e procedimento inicial, implementar/testar transações e auditoria no servidor, definir atribuições futuras, paginação e conflitos de edição obsoleta, validar dados externos com Zod e aplicar privacidade no banco/API. As pendências de dependências do bootstrap continuam registradas em SECURITY.md. Nenhuma segurança de produção é declarada concluída.

## Evolução após o PRD oficial do MVP 1.0

O texto acima preserva a decisão histórica que orientou a entrega 01. O PRD oficial agora permite que membros com acesso autorizado consultem todos os membros ativos e seus papéis; telefone e cadastros inativos continuam restritos a administradores. Portanto, a restrição de consulta/listagem da decisão 4 não é a política futura do produto. A restrição de escrita permanece. O código e os testes da entrega 01 ainda reproduzem a política anterior e deverão ser adequados em tarefa funcional separada. O ADR-003 registra também offline obrigatório e o backend ainda em aberto.
