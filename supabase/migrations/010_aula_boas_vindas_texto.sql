-- Texto de boas-vindas da aula 1 (PT-PT)

UPDATE content_modules
SET description = 'Parabéns por dares o passo mais importante para o futuro do teu filho! Ao entrares no Método Onda Prodígio, decides tirá-lo da conformidade e pavimentar o caminho dele para o sucesso. Estás prestes a ver como a frustração perante os cadernos desaparece para dar lugar a um líder seguro, focado e com uma agilidade mental surpreendente.'
WHERE title = 'Boas-vindas ☀️'
  AND parent_id IS NOT NULL;
