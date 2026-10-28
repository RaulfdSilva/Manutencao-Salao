# Application

`members/` implementa casos de uso e portas necessárias à orquestração: transação, auditoria, retirada futura de atribuições, relógio e identificadores. Depende apenas de Domain e dos próprios contratos; não importa Infrastructure, Presentation ou SDKs. Não resolve autenticação. Nenhum adaptador de produção é fornecido. Ver ADR-002.

`maintenance/` orquestra aprovação, geração delimitada, ocorrências avulsas, consulta, configuração, equipes, reagendamento e cancelamento. Reutiliza a leitura de membros e o contrato de ator; eventos duráveis, CAS e unicidade devem compartilhar a transação no servidor. A porta da escala de áudio não assume formato do Hourglass. Ver ADR-005; não há transporte ou adaptadores reais.

`checklists/` coordena configuração de modelos, inicialização, preenchimento, pendências, conclusão e correções administrativas. Checklist/ocorrência, problemas, fato anual, recibos e descarte de disponibilidade compartilham a mesma transação contratual. Não implementa persistência nem sincronização offline. Ver ADR-007.

A entrega 06 acrescenta o provisionamento explícito de catálogo em `checklists/`, recebendo configuração interna imutável. Reutiliza modelos, unidade de trabalho e recibos; cria apenas modelos ausentes e preserva qualquer existente, sem imports de Infrastructure ou inicialização automática. Ver ADR-008.
