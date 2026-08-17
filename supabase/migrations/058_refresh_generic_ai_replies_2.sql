-- Refresh respostas IA genéricas restantes (estudo, leitura, resistência).

UPDATE comments AS reply
SET content = CASE
    WHEN parent.content ~* '(ouvir|áudio|audio|dormir|acordad|vezes|minutos|noite|ao dia)'
        THEN E'Olá!\n\nSobre o áudio do método: o essencial é uma sessão por dia — os 7 minutos diários já estimulam o cérebro. Se quiseres potenciar, podes usar a versão completa de 11 minutos.\n\nQuanto a dormir ou acordado: funciona nos dois casos. Muitas mães deixam tocar à noite, enquanto adormece, porque é quando o cérebro está mais receptivo. Mas também podes pôr durante o dia, com actividades tranquilas — não precisa de estar concentrado a ouvir; o importante é a exposição regular.\n\nAltifalante ou auriculares, como for mais prático em casa. O que conta é a consistência, não repetir várias vezes no mesmo dia.\n\nCom carinho,\nAngela Campos'
    WHEN parent.content ~* '(sess|leitura|foco|comportamento|altera|mudan|concentr|ler|lê|caderno|escola|estudo|aula|particip|resist|escrev|dificuldade|filho|filha|menin)'
        THEN E'Agradeço a tua mensagem.\n\nSobre foco, leitura e comportamento escolar: cada criança tem o seu ritmo — não há um número fixo de sessões igual para todos.\n\nCom o áudio diário (7 ou 11 minutos), muitas famílias notam mais calma e atenção nas primeiras 2–3 semanas. Mudanças mais visíveis na leitura, escrita e participação em aula costumam consolidar-se entre a 4.ª e a 6.ª semana, com rotina consistente.\n\nPara a resistência ao estudo, mantém o ambiente calmo, celebra pequenos progressos e não transformes a leitura numa luta. O método trabalha o cérebro em paralelo — observa sinais subtis ao longo das semanas.\n\nSe quiseres, diz-nos a idade e há quanto tempo usam o método para te orientarmos melhor.\n\nEstamos aqui para te apoiar.\n\nCom carinho,\nAngela Campos'
    ELSE reply.content
END
FROM comments AS parent
WHERE reply.is_ai = true
  AND reply.parent_id = parent.id
  AND reply.content ILIKE '%muitas famílias passam exactamente pelo mesmo%';
