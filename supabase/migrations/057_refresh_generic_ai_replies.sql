-- One-off: substituir respostas IA genéricas antigas por respostas contextuais (offline).
-- Apenas afecta replies com o template legado exacto.

UPDATE comments AS reply
SET content = CASE
    WHEN parent.content ~* '(ouvir|áudio|audio|dormir|acordad|vezes|minutos|noite|ao dia)'
        THEN E'Olá!\n\nSobre o áudio do método: o essencial é uma sessão por dia — os 7 minutos diários já estimulam o cérebro. Se quiseres potenciar, podes usar a versão completa de 11 minutos.\n\nQuanto a dormir ou acordado: funciona nos dois casos. Muitas mães deixam tocar à noite, enquanto adormece, porque é quando o cérebro está mais receptivo. Mas também podes pôr durante o dia, com actividades tranquilas — não precisa de estar concentrado a ouvir; o importante é a exposição regular.\n\nAltifalante ou auriculares, como for mais prático em casa. O que conta é a consistência, não repetir várias vezes no mesmo dia.\n\nCom carinho,\nAngela Campos'
    WHEN parent.content ~* '(sess|leitura|foco|comportamento|altera|mudan|concentr|ler|caderno|escola|notar|resultado|semana)'
        THEN E'Que boa pergunta — obrigada por a partilhares connosco 🌊\n\nSobre quando notar mudanças no foco e na leitura: cada criança tem o seu ritmo, por isso não há um número exacto de sessões igual para todos.\n\nNa prática, muitas famílias referem mais calma e atenção já nas primeiras 2–3 semanas de rotina diária. Alterações mais evidentes na leitura e na concentração costumam consolidar-se entre a 4.ª e a 6.ª semana, desde que mantenhas os 7 minutos (ou 11 minutos) todos os dias.\n\nObserva o teu filho com carinho — pequenos sinais (menos resistência, mais curiosidade, menos dispersão) são muitas vezes os primeiros. Se quiseres, conta-nos a idade dele e há quanto tempo aplicam o método para te orientar melhor.\n\nUm abraço,\nAngela Campos'
    ELSE reply.content
END
FROM comments AS parent
WHERE reply.is_ai = true
  AND reply.parent_id = parent.id
  AND reply.content ILIKE '%muitas famílias passam exactamente pelo mesmo%'
  AND reply.content ILIKE '%continua a aplicar o método com calma%';
