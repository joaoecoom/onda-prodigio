-- Capas dos order bumps (paths absolutos a partir da raiz do site)

UPDATE products SET image_url = 'checkout9/assets/order-bump-tardes.png'
WHERE id = 'tardes-sem-brigas';

UPDATE products SET image_url = 'checkout9/assets/order-bump-truques.png'
WHERE id = 'caixa-super-truques';

UPDATE products SET image_url = 'checkout9/assets/order-bump-mentes.png'
WHERE id = 'grandes-mentes';
