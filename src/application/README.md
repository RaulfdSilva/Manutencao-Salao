# Application

`members/` implementa casos de uso e portas necessárias à orquestração: transação, auditoria, retirada futura de atribuições, relógio e identificadores. Depende apenas de Domain e dos próprios contratos; não importa Infrastructure, Presentation ou SDKs. Não resolve autenticação. Nenhum adaptador de produção é fornecido. Ver ADR-002.

`maintenance/` orquestra aprovação, geração delimitada, ocorrências avulsas, consulta, configuração, equipes, reagendamento e cancelamento. Reutiliza a leitura de membros e o contrato de ator; eventos duráveis, CAS e unicidade devem compartilhar a transação no servidor. A porta da escala de áudio não assume formato do Hourglass. Ver ADR-005; não há transporte ou adaptadores reais.
