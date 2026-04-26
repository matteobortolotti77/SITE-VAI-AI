-- =========================================================
-- SEED de fotos — atualiza photos[] para Volta à Ilha e Garapuá 4X4
-- Rodar no SQL Editor APÓS seed.sql
-- =========================================================

UPDATE products SET photos = ARRAY[
    './assets/volta_a_ilha_1.webp',
    './assets/volta_a_ilha_2.webp',
    './assets/volta_a_ilha_3.webp',
    './assets/volta_a_ilha_4.webp'
] WHERE slug = 'volta-a-ilha';

UPDATE products SET photos = ARRAY[
    './assets/Garapuá_1.webp',
    './assets/Garapuá_2.webp',
    './assets/Garapuá_3.webp',
    './assets/Garapuá_4.webp'
] WHERE slug = 'garapua-4x4';
