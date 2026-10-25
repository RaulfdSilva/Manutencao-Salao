# Application

`members/` implementa casos de uso e portas necessárias à orquestração: transação, auditoria, retirada futura de atribuições, relógio e identificadores. Depende apenas de Domain e dos próprios contratos; não importa Infrastructure, Presentation ou SDKs. Não resolve autenticação. Nenhum adaptador de produção é fornecido. Ver ADR-002.
