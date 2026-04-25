-- =========================================================
-- SEED INICIAL — 16 produtos da Volta à Ilha
-- Rodar APÓS schema.sql no SQL Editor do Supabase
-- =========================================================
-- Idempotente: usa ON CONFLICT (slug) DO UPDATE.
-- Pode rodar várias vezes sem duplicar. Edita os existentes.
-- =========================================================

-- ===================== PASSEIOS =====================

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'volta-a-ilha', 'passeio', 'Volta à Ilha',
    'O passeio mais famoso. Piscinas naturais, banco de areia e pôr do sol mágico.',
    350.00, 100.00, 'per_person', NULL, NULL,
    20, ARRAY['09:30'],
    NULL, 0.50, 5, false,
    '[
        {"title":"Roteiro e Horários","body_html":"<ul><li>Saída: 09:30 da Terceira Praia.</li><li>Paradas: Piscinas Naturais de Garapuá e Moreré, Boipeba (almoço) e Cairu.</li><li>Duração média: 6 a 7 horas.</li></ul>"},
        {"title":"O que está incluso","body_html":"<p>✔️ Lancha rápida com tripulação credenciada.<br>✔️ Guia local durante todo o passeio.<br>✔️ Paradas em piscinas naturais e banco de areia.</p>"},
        {"title":"O que levar","body_html":"<p>🎒 Protetor solar e repelente.<br>🩱 Roupas de banho e toalha.<br>💧 Dinheiro para almoço em Boipeba e despesas extras.</p>"},
        {"title":"Formas de Pagamento","body_html":"<p>✔️ <strong>Sinal pelo site:</strong> R$ 100 para garantir a reserva.<br>✔️ <strong>Restante:</strong> R$ 250 no embarque.</p>"}
    ]'::jsonb,
    NULL, 10
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'garapua-4x4', 'passeio', 'Garapuá 4X4',
    'Travessia terrestre 4x4 até a Vila de Garapuá, com piscinas naturais e praia paradisíaca.',
    130.00, 30.00, 'per_person', NULL, NULL,
    20, ARRAY[]::TEXT[],
    NULL, 0.50, 5, false,
    '[
        {"title":"Roteiro e Horários","body_html":"<ul><li>Trajeto terrestre 4x4 saindo de Morro de São Paulo.</li><li>Capacidade: até 10 passageiros por veículo (vários veículos disponíveis).</li><li>Horário a combinar com a operação.</li></ul>"},
        {"title":"Formas de Pagamento","body_html":"<p>✔️ <strong>Sinal:</strong> R$ 30 · <strong>Restante:</strong> R$ 100 no embarque.</p>"}
    ]'::jsonb,
    NULL, 20
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'gamboa-full', 'passeio', 'Gamboa Full',
    'Experiência completa em Gamboa: argila medicinal, piscinas e almoço à beira-mar.',
    260.00, 80.00, 'per_person', NULL, NULL,
    20, ARRAY[]::TEXT[],
    NULL, 0.50, 5, false,
    '[
        {"title":"Roteiro e Horários","body_html":"<ul><li>Saída matinal conforme maré.</li><li>Duração: dia inteiro, com almoço incluso.</li><li>Operado em caminhão militar (até 20 passageiros, várias saídas/dia).</li></ul>"},
        {"title":"Formas de Pagamento","body_html":"<p>✔️ <strong>Sinal:</strong> R$ 80 · <strong>Restante:</strong> R$ 180 no embarque.</p>"}
    ]'::jsonb,
    'ticket-card-img--hotels', 30
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'gamboa-convencional', 'passeio', 'Gamboa Convencional',
    'Versão essencial do passeio a Gamboa, com argila e tempo livre na praia.',
    100.00, 20.00, 'per_person', NULL, NULL,
    50, ARRAY[]::TEXT[],
    NULL, 0.50, 5, false,
    '[
        {"title":"Roteiro e Horários","body_html":"<ul><li>Saída em grupo, conforme maré.</li><li>Operado em escunas.</li><li>Meia-diária.</li></ul>"},
        {"title":"Formas de Pagamento","body_html":"<p>✔️ <strong>Sinal:</strong> R$ 20 · <strong>Restante:</strong> R$ 80 no embarque.</p>"}
    ]'::jsonb,
    'ticket-card-img--terminal', 40
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'quadriciclo', 'passeio', 'Quadriciclo',
    'Trilhas off-road pelas praias e pela mata atlântica. Adrenalina garantida.',
    700.00, 200.00, 'per_vehicle', 2, 5.00,
    20, ARRAY[]::TEXT[],
    NULL, NULL, NULL, true,
    '[
        {"title":"Requisitos","body_html":"<p>⚠️ <strong>Obrigatório apresentar CNH</strong> válida para pilotar.</p>"},
        {"title":"Formas de Pagamento","body_html":"<p>✔️ <strong>Valor por veículo:</strong> R$ 700 (até 2 pessoas).<br>✔️ <strong>Sinal:</strong> R$ 200 · <strong>Restante:</strong> R$ 500 no local.<br>✔️ <strong>Seguro:</strong> R$ 5 por pessoa.</p>"}
    ]'::jsonb,
    'ticket-card-img--airport', 50
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'buggy', 'passeio', 'Buggy',
    'Volta à ilha terrestre de buggy passando pelos principais mirantes e praias.',
    700.00, 200.00, 'per_vehicle', 4, 5.00,
    16, ARRAY[]::TEXT[],
    NULL, 0.50, 5, false,
    '[
        {"title":"Formas de Pagamento","body_html":"<p>✔️ <strong>Valor por veículo:</strong> R$ 700 (até 4 pessoas).<br>✔️ <strong>Sinal:</strong> R$ 200 · <strong>Restante:</strong> R$ 500 no local.<br>✔️ <strong>Seguro:</strong> R$ 5 por pessoa.</p>"}
    ]'::jsonb,
    'ticket-card-img--catamaran', 60
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

-- ===================== ATIVIDADES =====================

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'mergulho-cilindro', 'atividade', 'Mergulho com Cilindro',
    'Explore a vida marinha exuberante de Morro de São Paulo com segurança.',
    180.00, NULL, 'per_person', NULL, NULL,
    4, ARRAY['08:00','13:00'],
    NULL, NULL, NULL, false,
    '[
        {"title":"Roteiro e Horários","body_html":"<ul><li>Saída conforme maré · Ponto: Primeira Praia.</li><li>30 a 40 minutos submerso.</li></ul>"}
    ]'::jsonb,
    'ticket-card-img--catamaran', 100
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'cavalgada', 'atividade', 'Cavalgada',
    'Passeio a cavalo pela costa e pela mata atlântica.',
    150.00, NULL, 'per_person', NULL, NULL,
    4, ARRAY[]::TEXT[],
    6, NULL, NULL, false,
    '[
        {"title":"Detalhes","body_html":"<p>Duração: ~1h30 · Nível: iniciante · Guia experiente.</p><p>🧒 Crianças a partir de 6 anos (com acompanhante).</p>"}
    ]'::jsonb,
    'ticket-card-img--hotels', 110
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'tiroleza', 'atividade', 'Tiroleza',
    'Descida de tiroleza com vista para a Segunda Praia.',
    80.00, NULL, 'per_person', NULL, NULL,
    100, ARRAY[]::TEXT[],
    6, NULL, NULL, false,
    '[
        {"title":"Detalhes","body_html":"<p>Equipamento completo · Instrutor credenciado.</p><p>🧒 Idade mínima: 6 anos.</p>"}
    ]'::jsonb,
    'ticket-card-img--airport', 120
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'banana-boat', 'atividade', 'Banana Boat',
    'Diversão em grupo na Segunda Praia.',
    60.00, NULL, 'per_person', NULL, NULL,
    20, ARRAY[]::TEXT[],
    6, NULL, NULL, false,
    '[
        {"title":"Detalhes","body_html":"<p>Duração: ~20 min · Saídas conforme condição do mar.</p><p>🧒 A partir de 6 anos.</p>"}
    ]'::jsonb,
    'ticket-card-img--catamaran', 130
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'bike-aquatica', 'atividade', 'Bike Aquática',
    'Pedale sobre o mar em uma bicicleta especial, vista panorâmica da costa.',
    70.00, NULL, 'per_person', NULL, NULL,
    4, ARRAY[]::TEXT[],
    NULL, NULL, NULL, false,
    '[
        {"title":"Detalhes","body_html":"<p>Aluguel por hora · Equipamento de flutuação incluso.</p>"}
    ]'::jsonb,
    'ticket-card-img--terminal', 140
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'aluguel-bicicleta', 'atividade', 'Aluguel de Bicicleta',
    'Aluguel de bicicletas para explorar as vilas e trilhas da ilha.',
    50.00, NULL, 'per_person', NULL, NULL,
    8, ARRAY[]::TEXT[],
    NULL, NULL, NULL, false,
    '[
        {"title":"Detalhes","body_html":"<p>Aluguel por dia · Cadeado incluso.</p>"}
    ]'::jsonb,
    'ticket-card-img--hotels', 150
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

-- ===================== PASSAGENS — IDA =====================

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'ida-terminal', 'passagem_ida', 'Terminal SSA ➔ Morro',
    'Semi-Terrestre: travessia marítima + van + lancha.',
    165.00, NULL, 'per_person', NULL, NULL,
    50, ARRAY['06:30','09:30','12:30','15:30'],
    NULL, 0.50, 5, false,
    '[
        {"title":"Roteiro e Horários","body_html":"<ul><li>Embarque: Terminal Marítimo de Salvador (Mercado Modelo).</li><li>Saídas: 06:30, 09:30, 12:30, 15:30.</li><li>Duração: ~3h30min.</li></ul>"}
    ]'::jsonb,
    'ticket-card-img--terminal', 200
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'ida-hoteis', 'passagem_ida', 'Hotéis Salvador ➔ Morro',
    'Semi-Terrestre com retirada na porta do hotel.',
    180.00, NULL, 'per_person', NULL, NULL,
    50, ARRAY['05:30','08:30','11:30','14:30'],
    NULL, 0.50, 5, false,
    '[
        {"title":"Roteiro e Horários","body_html":"<ul><li>Retirada: hotéis de Salvador (conforme região atendida).</li><li>Saídas: 05:30, 08:30, 11:30, 14:30.</li></ul>"}
    ]'::jsonb,
    'ticket-card-img--hotels', 210
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'ida-aeroporto', 'passagem_ida', 'Aeroporto SSA ➔ Morro',
    'Semi-Terrestre oficial do Aeroporto + opção madrugada Via BR.',
    205.00, NULL, 'per_person', NULL, NULL,
    50, ARRAY['03:30','05:15','08:15','11:15','14:40'],
    NULL, 0.50, 5, false,
    '[
        {"title":"Roteiro e Horários","body_html":"<ul><li>Semi-Terrestre: 05:15, 08:15, 11:15, 14:40 — <strong>R$ 205</strong>.</li><li>Madrugada Via BR: 03:30 — <strong>R$ 210</strong>.</li><li>Retirada no desembarque do Aeroporto de Salvador.</li></ul>"}
    ]'::jsonb,
    'ticket-card-img--airport', 220
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'ida-catamara', 'passagem_ida', 'Catamarã ➔ Morro',
    'Travessia marítima direta do Terminal de Salvador.',
    149.00, NULL, 'per_person', NULL, NULL,
    20, ARRAY['09:00','10:30','14:30'],
    NULL, 0.50, 5, false,
    '[
        {"title":"Roteiro e Horários","body_html":"<ul><li>09:00 — <strong>R$ 172,51</strong>.</li><li>10:30 — <strong>R$ 149,61</strong>.</li><li>14:30 — <strong>R$ 172,51</strong>.</li><li>Embarque no Terminal Marítimo (Mercado Modelo).</li></ul>"}
    ]'::jsonb,
    'ticket-card-img--catamaran', 230
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

-- ===================== PASSAGENS — VOLTA =====================

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'volta-terminal', 'passagem_volta', 'Morro ➔ Terminal SSA',
    'Retorno Semi-Terrestre para o Terminal de Salvador.',
    145.00, NULL, 'per_person', NULL, NULL,
    50, ARRAY['06:20','09:20','12:20','15:20'],
    NULL, 0.50, 5, false,
    '[
        {"title":"Roteiro e Horários","body_html":"<ul><li>Saídas: 06:20, 09:20, 12:20, 15:20.</li><li>Apresentação: Píer Principal de Morro de SP (30min antes).</li><li>Desembarque: Terminal Marítimo (Mercado Modelo).</li></ul>"}
    ]'::jsonb,
    'ticket-card-img--terminal', 300
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'volta-hoteis', 'passagem_volta', 'Morro ➔ Hotéis Salvador',
    'Retorno Semi-Terrestre com desembarque nos hotéis.',
    160.00, NULL, 'per_person', NULL, NULL,
    50, ARRAY['06:20','09:20','12:20','15:20'],
    NULL, 0.50, 5, false,
    '[
        {"title":"Roteiro e Horários","body_html":"<ul><li>Saídas: 06:20, 09:20, 12:20, 15:20.</li><li>Desembarque na rede hoteleira atendida de Salvador.</li></ul>"}
    ]'::jsonb,
    'ticket-card-img--hotels', 310
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'volta-aeroporto', 'passagem_volta', 'Morro ➔ Aeroporto SSA',
    'Retorno Semi-Terrestre conectado diretamente ao Aeroporto.',
    185.00, NULL, 'per_person', NULL, NULL,
    50, ARRAY['06:20','09:20','12:20','15:20'],
    NULL, 0.50, 5, false,
    '[
        {"title":"Roteiro e Horários","body_html":"<ul><li>Saídas: 06:20, 09:20, 12:20, 15:20.</li><li>Duração: ~4h · planeje voo com margem de segurança.</li></ul>"}
    ]'::jsonb,
    'ticket-card-img--airport', 320
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO products (slug, type, name, description, price_full, price_deposit,
    pricing_mode, vehicle_capacity, insurance_per_pax, capacity, departure_times,
    child_min_age, child_discount, infant_max_age, requires_cnh,
    accordion_data, bg_gradient, sort_order)
VALUES (
    'volta-catamara', 'passagem_volta', 'Catamarã ➔ Terminal SSA',
    'Retorno marítimo direto para Salvador.',
    138.00, NULL, 'per_person', NULL, NULL,
    20, ARRAY['11:30','13:30','15:00'],
    NULL, 0.50, 5, false,
    '[
        {"title":"Roteiro e Horários","body_html":"<ul><li>11:30 — <strong>R$ 158,71</strong>.</li><li>13:30 — <strong>R$ 138,71</strong>.</li><li>15:00 — <strong>R$ 158,71</strong>.</li><li>Desembarque no Terminal Marítimo (Mercado Modelo).</li></ul>"}
    ]'::jsonb,
    'ticket-card-img--catamaran', 330
)
ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description,
    price_full=EXCLUDED.price_full, price_deposit=EXCLUDED.price_deposit,
    pricing_mode=EXCLUDED.pricing_mode, vehicle_capacity=EXCLUDED.vehicle_capacity,
    insurance_per_pax=EXCLUDED.insurance_per_pax,
    capacity=EXCLUDED.capacity, departure_times=EXCLUDED.departure_times,
    child_min_age=EXCLUDED.child_min_age, child_discount=EXCLUDED.child_discount,
    infant_max_age=EXCLUDED.infant_max_age, requires_cnh=EXCLUDED.requires_cnh,
    accordion_data=EXCLUDED.accordion_data, bg_gradient=EXCLUDED.bg_gradient,
    sort_order=EXCLUDED.sort_order, updated_at=now();
