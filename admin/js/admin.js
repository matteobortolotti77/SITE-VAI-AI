// Painel admin — SPA vanilla, ES module nativo.
// Auth: Supabase JS SDK (CDN). API: fetch c/ JWT no header.
// Config (URLs/keys) em ./config.json — copiar de config.example.json.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const state = {
    supabase: null,
    apiBase: '',
    session: null,
    currentRoute: 'dashboard',
    reservasFilters: {
        status: '',
        from_date: '',
        to_date: '',
        q: '',
        page: 1,
        page_size: 20,
        sort: 'created_desc',
    },
};

const STATUS_LABELS = {
    pending_payment: 'Aguardando pgto',
    deposit_paid: 'Sinal pago',
    fully_paid: 'Pago integral',
    cancelled_noshow: 'No-show',
    cancelled_force_majeure: 'Cancelado (FM)',
    rescheduled: 'Reagendado',
};

const $ = (sel) => document.querySelector(sel);

// ---------- bootstrap ----------
async function bootstrap() {
    const cfg = await loadConfig();
    state.apiBase = cfg.apiBase.replace(/\/$/, '');
    state.supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
    });

    state.supabase.auth.onAuthStateChange((_event, session) => {
        state.session = session;
        renderAuth();
    });

    const { data } = await state.supabase.auth.getSession();
    state.session = data.session;
    renderAuth();

    wireLogin();
    wireShell();
    wireRouter();
}

async function loadConfig() {
    const res = await fetch('./config.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('config.json ausente — copie de config.example.json');
    return res.json();
}

// ---------- auth UI ----------
function renderAuth() {
    const logged = !!state.session;
    $('#login-screen').hidden = logged;
    $('#app-shell').hidden = !logged;
    if (logged) {
        $('#admin-email').textContent = state.session.user?.email || '';
        navigate(location.hash.slice(1) || 'dashboard');
    }
}

function wireLogin() {
    const form = $('#login-form');
    const errEl = $('#login-error');
    const submit = $('#login-submit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errEl.hidden = true;
        submit.disabled = true;
        submit.textContent = 'Entrando…';

        const email = $('#login-email').value.trim();
        const password = $('#login-password').value;

        const { error } = await state.supabase.auth.signInWithPassword({ email, password });

        submit.disabled = false;
        submit.textContent = 'Entrar';

        if (error) {
            errEl.textContent = error.message || 'Falha no login';
            errEl.hidden = false;
            return;
        }
        try {
            await api('/admin/ping');
        } catch (err) {
            await state.supabase.auth.signOut();
            errEl.textContent = err.status === 403
                ? 'Conta sem permissão de admin.'
                : `Erro: ${err.message}`;
            errEl.hidden = false;
        }
    });
}

function wireShell() {
    $('#logout-btn').addEventListener('click', async () => {
        await state.supabase.auth.signOut();
        location.hash = '';
    });
}

// ---------- router ----------
function wireRouter() {
    window.addEventListener('hashchange', () => {
        navigate(location.hash.slice(1) || 'dashboard');
    });
}

function navigate(route) {
    state.currentRoute = route;
    document.querySelectorAll('.sidebar-nav a').forEach((a) => {
        a.classList.toggle('active', a.dataset.route === route);
    });
    const titles = { dashboard: 'Dashboard', reservas: 'Reservas', produtos: 'Produtos', fornecedores: 'Fornecedores', envios: 'Envios diários' };
    $('#view-title').textContent = titles[route] || route;
    renderView(route);
}

function renderView(route) {
    const c = $('#view-container');
    c.replaceChildren();
    if (route === 'dashboard') return renderDashboard(c);
    if (route === 'reservas') return renderReservas(c);
    if (route === 'produtos') return renderProdutos(c);
    if (route === 'fornecedores') return renderFornecedores(c);
    if (route === 'envios') return renderEnvios(c);
    const p = document.createElement('p');
    p.className = 'placeholder';
    p.textContent = `View "${route}" — desconhecida.`;
    c.appendChild(p);
}

// ---------- Reservas view ----------
async function renderReservas(container) {
    const f = state.reservasFilters;
    container.innerHTML = `
        <div class="filters-bar">
            <input type="search" id="r-search" placeholder="Nome, WhatsApp, email…" value="${escapeAttr(f.q)}">
            <select id="r-status">
                <option value="">Todos status</option>
                ${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
            <input type="date" id="r-from" value="${f.from_date}" title="Data início">
            <input type="date" id="r-to" value="${f.to_date}" title="Data fim">
            <button id="r-apply">Filtrar</button>
            <button id="r-clear" class="ghost">Limpar</button>
        </div>
        <div id="r-list"><p class="placeholder">Carregando…</p></div>
        <div class="pagination" id="r-pagination" hidden></div>
    `;

    container.querySelector('#r-apply').addEventListener('click', () => {
        state.reservasFilters.q = container.querySelector('#r-search').value.trim();
        state.reservasFilters.status = container.querySelector('#r-status').value;
        state.reservasFilters.from_date = container.querySelector('#r-from').value;
        state.reservasFilters.to_date = container.querySelector('#r-to').value;
        state.reservasFilters.page = 1;
        loadReservas();
    });
    container.querySelector('#r-clear').addEventListener('click', () => {
        state.reservasFilters = { status: '', from_date: '', to_date: '', q: '', page: 1, page_size: 20, sort: 'created_desc' };
        renderReservas(container);
    });
    container.querySelector('#r-search').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') container.querySelector('#r-apply').click();
    });

    await loadReservas();
}

async function loadReservas() {
    const listEl = $('#r-list');
    const pagEl = $('#r-pagination');
    listEl.innerHTML = '<p class="placeholder">Carregando…</p>';

    const params = new URLSearchParams();
    const f = state.reservasFilters;
    if (f.status) params.set('status', f.status);
    if (f.from_date) params.set('from_date', f.from_date);
    if (f.to_date) params.set('to_date', f.to_date);
    if (f.q) params.set('q', f.q);
    params.set('page', f.page);
    params.set('page_size', f.page_size);
    params.set('sort', f.sort);

    let result;
    try {
        result = await api(`/admin/reservations?${params}`);
    } catch (err) {
        listEl.innerHTML = `<p class="placeholder" style="color:var(--color-danger)">Erro: ${escapeText(err.message)}</p>`;
        return;
    }

    if (!result.items.length) {
        listEl.innerHTML = '<p class="placeholder">Nenhuma reserva encontrada.</p>';
        pagEl.hidden = true;
        return;
    }

    const rows = result.items.map((r) => {
        const cust = r.customer || {};
        const prod = r.product || {};
        const prov = r.provider;
        const pax = r.qty_adults + r.qty_children + r.qty_infants;
        return `
            <tr data-id="${r.id}">
                <td>${formatDate(r.travel_date)}<br><span style="color:var(--color-text-muted);font-size:0.78rem">${escapeText(r.departure_time)}</span></td>
                <td>${escapeText(prod.name || '?')}<br><span style="color:var(--color-text-muted);font-size:0.78rem">${escapeText(prov ? prov.name : 'sem fornecedor')}</span></td>
                <td>${escapeText(cust.name || '?')}<br><span style="color:var(--color-text-muted);font-size:0.78rem">${escapeText(cust.whatsapp || '')}</span></td>
                <td>${pax} <span style="color:var(--color-text-muted);font-size:0.75rem">(${r.qty_adults}/${r.qty_children}/${r.qty_infants})</span></td>
                <td>R$ ${formatMoney(r.amount_total)}<br><span style="color:var(--color-text-muted);font-size:0.78rem">sinal R$ ${formatMoney(r.amount_deposit)}</span></td>
                <td style="color:var(--color-primary);font-weight:600">R$ ${formatMoney(r.commission_amount || 0)}</td>
                <td><span class="badge badge-${r.status}">${escapeText(STATUS_LABELS[r.status] || r.status)}</span></td>
                <td style="color:var(--color-text-muted);font-size:0.78rem">${formatDateTime(r.created_at)}</td>
            </tr>
        `;
    }).join('');

    const sortHeader = (label, ascKey, descKey) => {
        const isActive = f.sort === ascKey || f.sort === descKey;
        const arrow = f.sort === ascKey ? '▲' : f.sort === descKey ? '▼' : '⇅';
        const next = f.sort === descKey ? ascKey : descKey;
        return `<th class="sortable ${isActive ? 'sort-active' : ''}" data-sort="${next}">${label} <span style="opacity:${isActive ? 1 : 0.35};font-size:0.7rem">${arrow}</span></th>`;
    };

    listEl.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    ${sortHeader('Embarque', 'travel_asc', 'travel_desc')}
                    <th>Produto</th>
                    <th>Cliente</th>
                    <th>Pax</th>
                    ${sortHeader('Valor', 'amount_asc', 'amount_desc')}
                    ${sortHeader('Comissão', 'commission_asc', 'commission_desc')}
                    ${sortHeader('Status', 'status_asc', 'status_desc')}
                    ${sortHeader('Criada', 'created_asc', 'created_desc')}
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
    listEl.querySelectorAll('th.sortable').forEach((th) => {
        th.addEventListener('click', () => {
            state.reservasFilters.sort = th.dataset.sort;
            state.reservasFilters.page = 1;
            loadReservas();
        });
    });

    listEl.querySelectorAll('tbody tr').forEach((tr) => {
        tr.addEventListener('click', () => openReservaDrawer(tr.dataset.id));
    });

    const totalPages = Math.max(1, Math.ceil(result.total / result.page_size));
    pagEl.hidden = false;
    pagEl.innerHTML = `
        <div>${result.total} reserva${result.total === 1 ? '' : 's'} · página ${result.page}/${totalPages}</div>
        <div style="display:flex;gap:0.4rem;align-items:center">
            <button id="r-prev" ${result.page <= 1 ? 'disabled' : ''}>← Anterior</button>
            <button id="r-next" ${result.page >= totalPages ? 'disabled' : ''}>Próxima →</button>
        </div>
    `;
    pagEl.querySelector('#r-prev').addEventListener('click', () => { state.reservasFilters.page--; loadReservas(); });
    pagEl.querySelector('#r-next').addEventListener('click', () => { state.reservasFilters.page++; loadReservas(); });
}

async function openReservaDrawer(id) {
    closeDrawer();
    const backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    backdrop.id = 'drawer-backdrop';
    backdrop.innerHTML = `
        <aside class="drawer" role="dialog" aria-modal="true">
            <div class="drawer-header">
                <h3>Reserva</h3>
                <button class="drawer-close" aria-label="Fechar">×</button>
            </div>
            <p class="placeholder">Carregando…</p>
        </aside>
    `;
    document.body.appendChild(backdrop);
    backdrop.querySelector('.drawer-close').addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeDrawer(); });
    document.addEventListener('keydown', escClose);

    let data;
    try {
        data = await api(`/admin/reservations/${id}`);
    } catch (err) {
        backdrop.querySelector('.drawer').innerHTML = `<p style="color:var(--color-danger)">Erro: ${escapeText(err.message)}</p>`;
        return;
    }
    renderReservaDetail(backdrop.querySelector('.drawer'), data);
}

function closeDrawer() {
    document.querySelector('#drawer-backdrop')?.remove();
    document.removeEventListener('keydown', escClose);
}

function escClose(e) {
    if (e.key === 'Escape') closeDrawer();
}

function renderReservaDetail(drawerEl, r) {
    const cust = r.customer || {};
    const prod = r.product || {};
    const pax = r.qty_adults + r.qty_children + r.qty_infants;

    const transitions = Object.entries(r.refund_quote || {});
    const passengersList = (r.passengers || []).map((p) => `
        <div style="font-size:0.85rem;padding:0.3rem 0;border-bottom:1px solid var(--border)">
            <strong>${escapeText(p.full_name)}</strong> · ${escapeText((p.doc_type || '').toUpperCase())} ${escapeText(p.doc_number)} · ${escapeText(p.age_group)}
        </div>
    `).join('') || '<em style="color:var(--color-text-muted)">Sem passageiros cadastrados</em>';

    const paymentsList = (r.payments || []).map((p) => `
        <div style="font-size:0.82rem;padding:0.3rem 0;border-bottom:1px solid var(--border)">
            <strong>${escapeText(p.type)}</strong> · R$ ${formatMoney(p.amount)} · ${escapeText(p.status)} · ${formatDateTime(p.created_at)}<br>
            <span style="color:var(--color-text-muted);font-size:0.75rem">gw_id: ${escapeText(p.gateway_id)}</span>
        </div>
    `).join('') || '<em style="color:var(--color-text-muted)">Nenhum pagamento registrado</em>';

    const auditList = (r.audit_log || []).map((a) => `
        <div class="audit-row">
            <time>${formatDateTime(a.created_at)} · ${escapeText(a.actor_email || '?')}</time>
            ${escapeText(a.from_status || '?')} → <strong>${escapeText(a.to_status || '?')}</strong>
            ${a.refund_amount ? ` · refund R$ ${formatMoney(a.refund_amount)}` : ''}
            ${a.reason ? `<br><span style="color:var(--color-text-muted)">"${escapeText(a.reason)}"</span>` : ''}
        </div>
    `).join('') || '<em style="color:var(--color-text-muted)">Sem histórico</em>';

    const actionsHtml = transitions.length ? transitions.map(([target, quote]) => {
        const cls = target === 'cancelled_noshow' ? 'danger'
            : target === 'cancelled_force_majeure' ? 'warning'
            : (target === 'fully_paid' || target === 'deposit_paid') ? 'primary'
            : 'secondary';
        return `<button class="${cls}" data-target="${target}">${escapeText(STATUS_LABELS[target])}${quote.refund_amount > 0 ? ` (refund R$ ${formatMoney(quote.refund_amount)})` : ''}</button>`;
    }).join('') : '<em style="color:var(--color-text-muted)">Status final, sem transições disponíveis</em>';

    drawerEl.innerHTML = `
        <div class="drawer-header">
            <h3>Reserva <span class="badge badge-${r.status}">${escapeText(STATUS_LABELS[r.status] || r.status)}</span></h3>
            <button class="drawer-close" aria-label="Fechar">×</button>
        </div>

        <section>
            <h4>Cliente</h4>
            <dl class="kv-grid">
                <dt>Nome</dt><dd>${escapeText(cust.name || '?')}</dd>
                <dt>WhatsApp</dt><dd>${escapeText(cust.whatsapp || '?')}</dd>
                <dt>Email</dt><dd>${escapeText(cust.email || '—')}</dd>
                <dt>Idioma</dt><dd>${escapeText(cust.locale || '?')}</dd>
            </dl>
        </section>

        <section>
            <h4>Produto + Embarque</h4>
            <dl class="kv-grid">
                <dt>Produto</dt><dd>${escapeText(prod.name || '?')} <span style="color:var(--color-text-muted)">(${escapeText(prod.slug || '')})</span></dd>
                <dt>Tipo</dt><dd>${escapeText(prod.type || '?')} · ${escapeText(prod.pricing_mode || '?')}</dd>
                <dt>Data</dt><dd>${formatDate(r.travel_date)} ${escapeText(r.departure_time)}</dd>
                <dt>Pax</dt><dd>${pax} total — ${r.qty_adults} adulto(s), ${r.qty_children} criança(s), ${r.qty_infants} infant(s)</dd>
            </dl>
        </section>

        <section>
            <h4>Valores</h4>
            <dl class="kv-grid">
                <dt>Total</dt><dd>R$ ${formatMoney(r.amount_total)}</dd>
                <dt>Sinal</dt><dd>R$ ${formatMoney(r.amount_deposit)}</dd>
                <dt>Restante</dt><dd>R$ ${formatMoney(r.amount_remaining)}</dd>
                <dt>Gateway ID</dt><dd>${escapeText(r.gateway_payment_id || '—')}</dd>
                <dt>Cart ID</dt><dd style="font-family:monospace;font-size:0.78rem">${escapeText(r.cart_id)}</dd>
                <dt>OK cliente</dt><dd>${r.customer_ack_at ? formatDateTime(r.customer_ack_at) : '—'}</dd>
            </dl>
        </section>

        <section>
            <h4>Fornecedor + comissão</h4>
            <dl class="kv-grid">
                <dt>Fornecedor</dt><dd>${r.provider ? escapeText(r.provider.name) : '<span class="badge badge-cancelled_noshow">SEM FORNECEDOR</span>'}</dd>
                ${r.provider ? `<dt>WhatsApp</dt><dd>${escapeText(r.provider.whatsapp || '—')}</dd>` : ''}
            </dl>
            <div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.5rem">
                <label style="flex:1">Comissão (R$)
                    <input type="number" id="r-commission" step="0.01" min="0" value="${Number(r.commission_amount || 0)}" style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-size:0.92rem">
                </label>
                <button id="r-save-commission" class="primary-btn" style="margin-top:1.1rem">Salvar comissão</button>
            </div>
            <p style="font-size:0.78rem;color:var(--color-text-muted);margin:0.4rem 0 0">
                Mudanças são auditadas. Razão será solicitada ao salvar.
            </p>
        </section>

        <section>
            <h4>Mudar status</h4>
            <div class="actions-row" id="r-actions">
                ${actionsHtml}
                <p class="quote">Refund é calculado server-side conforme política §5.3 (CLAUDE.md). Confirme antes de aplicar.</p>
            </div>
        </section>

        <section>
            <h4>Passageiros (${(r.passengers || []).length})</h4>
            ${passengersList}
        </section>

        <section>
            <h4>Pagamentos (${(r.payments || []).length})</h4>
            ${paymentsList}
        </section>

        <section>
            <h4>Histórico (${(r.audit_log || []).length})</h4>
            ${auditList}
        </section>
    `;

    drawerEl.querySelector('.drawer-close').addEventListener('click', closeDrawer);
    drawerEl.querySelectorAll('[data-target]').forEach((btn) => {
        btn.addEventListener('click', () => confirmAndPatchStatus(r.id, btn.dataset.target, r.refund_quote[btn.dataset.target]));
    });
    drawerEl.querySelector('#r-save-commission')?.addEventListener('click', () => saveCommission(r.id, Number(r.commission_amount || 0)));
}

async function saveCommission(id, previous) {
    const newVal = Number($('#r-commission').value);
    if (isNaN(newVal) || newVal < 0) { toast('Valor inválido', 'error'); return; }
    if (newVal === previous) { toast('Sem alteração', 'error'); return; }
    const reason = window.prompt(`Mudar comissão de R$ ${formatMoney(previous)} para R$ ${formatMoney(newVal)}?\n\nMotivo (opcional, registrado no audit log):`);
    if (reason === null) return;
    const idempotencyKey = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    try {
        const result = await api(`/admin/reservations/${id}/commission`, {
            method: 'PATCH',
            headers: { 'Idempotency-Key': idempotencyKey },
            body: JSON.stringify({ commission_amount: newVal, reason: reason || undefined }),
        });
        toast(`Comissão: R$ ${formatMoney(result.previous)} → R$ ${formatMoney(result.commission_amount)}`, 'success');
        closeDrawer();
        loadReservas();
    } catch (err) {
        toast(`Erro: ${err.message}`, 'error');
    }
}

async function confirmAndPatchStatus(id, toStatus, quote) {
    const refundLine = quote.refund_amount > 0
        ? `\nRefund: R$ ${formatMoney(quote.refund_amount)} (${quote.policy})`
        : '\nSem refund.';
    const reason = window.prompt(
        `Mudar status para "${STATUS_LABELS[toStatus]}"?${refundLine}\n\nMotivo (opcional, registrado no audit log):`
    );
    if (reason === null) return;

    const idempotencyKey = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    try {
        const result = await api(`/admin/reservations/${id}/status`, {
            method: 'PATCH',
            headers: { 'Idempotency-Key': idempotencyKey },
            body: JSON.stringify({ to_status: toStatus, reason: reason || undefined }),
        });
        toast(`Status: ${result.from_status} → ${result.to_status}` + (result.refund?.amount > 0 ? ` (refund R$ ${formatMoney(result.refund.amount)})` : ''), 'success');
        closeDrawer();
        loadReservas();
    } catch (err) {
        toast(`Erro: ${err.message}`, 'error');
    }
}

// ---------- Produtos view ----------
const PRODUCT_TYPES = [
    { value: 'passeio', label: 'Passeio' },
    { value: 'atividade', label: 'Atividade' },
    { value: 'passagem_ida', label: 'Passagem ida' },
    { value: 'passagem_volta', label: 'Passagem volta' },
];

const PRICING_MODES = [
    { value: 'per_person', label: 'Por pessoa' },
    { value: 'per_vehicle', label: 'Por veículo' },
];

let produtosShowInactive = false;

async function renderProdutos(container) {
    container.innerHTML = `
        <div class="filters-bar">
            <button id="p-new" class="primary-btn">+ Novo produto</button>
            <label style="display:flex;gap:0.4rem;align-items:center;font-size:0.88rem;margin-left:auto">
                <input type="checkbox" id="p-show-inactive" ${produtosShowInactive ? 'checked' : ''}>
                Mostrar inativos
            </label>
        </div>
        <div id="p-list"><p class="placeholder">Carregando…</p></div>
    `;
    container.querySelector('#p-new').addEventListener('click', () => openProdutoDrawer(null));
    container.querySelector('#p-show-inactive').addEventListener('change', (e) => {
        produtosShowInactive = e.target.checked;
        loadProdutos();
    });
    await loadProdutos();
}

async function loadProdutos() {
    const listEl = $('#p-list');
    listEl.innerHTML = '<p class="placeholder">Carregando…</p>';
    let result;
    try {
        result = await api(`/admin/products${produtosShowInactive ? '?include_inactive=1' : ''}`);
    } catch (err) {
        listEl.innerHTML = `<p class="placeholder" style="color:var(--color-danger)">Erro: ${escapeText(err.message)}</p>`;
        return;
    }
    if (!result.items.length) {
        listEl.innerHTML = '<p class="placeholder">Nenhum produto.</p>';
        return;
    }
    const rows = result.items.map((p) => `
        <tr data-id="${p.id}" ${p.active ? '' : 'style="opacity:0.55"'}>
            <td>${escapeText(p.sort_order)}</td>
            <td>${escapeText(p.name)}<br><span style="color:var(--color-text-muted);font-size:0.78rem">${escapeText(p.slug)}</span></td>
            <td>${escapeText(p.type)}</td>
            <td>${escapeText(p.pricing_mode)}</td>
            <td>R$ ${formatMoney(p.price_full)}<br><span style="color:var(--color-text-muted);font-size:0.78rem">sinal R$ ${formatMoney(p.price_deposit)}</span></td>
            <td>${escapeText(p.capacity)}</td>
            <td>${(p.departure_times || []).length ? escapeText((p.departure_times || []).join(', ')) : '<em style="color:var(--color-text-muted)">A combinar</em>'}</td>
            <td>${p.active ? '<span class="badge badge-fully_paid">ativo</span>' : '<span class="badge badge-cancelled_noshow">inativo</span>'}</td>
        </tr>
    `).join('');
    listEl.innerHTML = `
        <table class="data-table">
            <thead>
                <tr><th>#</th><th>Produto</th><th>Tipo</th><th>Pricing</th><th>Preço</th><th>Cap.</th><th>Horários</th><th>Status</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
    listEl.querySelectorAll('tbody tr').forEach((tr) => {
        tr.addEventListener('click', () => openProdutoDrawer(tr.dataset.id));
    });
}

async function openProdutoDrawer(id) {
    closeDrawer();
    const backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    backdrop.id = 'drawer-backdrop';
    backdrop.innerHTML = `
        <aside class="drawer" role="dialog" aria-modal="true">
            <div class="drawer-header">
                <h3>${id ? 'Editar produto' : 'Novo produto'}</h3>
                <button class="drawer-close" aria-label="Fechar">×</button>
            </div>
            <p class="placeholder">Carregando…</p>
        </aside>
    `;
    document.body.appendChild(backdrop);
    backdrop.querySelector('.drawer-close').addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeDrawer(); });
    document.addEventListener('keydown', escClose);

    let product = null;
    if (id) {
        try {
            product = await api(`/admin/products/${id}`);
        } catch (err) {
            backdrop.querySelector('.drawer').innerHTML = `<p style="color:var(--color-danger)">Erro: ${escapeText(err.message)}</p>`;
            return;
        }
    }
    renderProdutoForm(backdrop.querySelector('.drawer'), product);
}

function renderProdutoForm(drawerEl, p) {
    const isEdit = !!p;
    const v = p || {
        type: 'passeio',
        slug: '',
        name: '',
        description: '',
        price_full: 0,
        price_deposit: null,
        pricing_mode: 'per_person',
        vehicle_capacity: null,
        insurance_per_pax: null,
        capacity: 0,
        departure_times: [],
        cutoff_hour: 8,
        cutoff_minute: 30,
        child_min_age: null,
        child_discount: null,
        infant_max_age: 5,
        requires_cnh: false,
        bg_gradient: '',
        sort_order: 0,
        active: true,
    };

    drawerEl.innerHTML = `
        <div class="drawer-header">
            <h3>${isEdit ? 'Editar' : 'Novo'} produto</h3>
            <button class="drawer-close" aria-label="Fechar">×</button>
        </div>

        <form id="p-form" class="produto-form" novalidate>
            <fieldset>
                <legend>Identificação</legend>
                <label>Nome <input name="name" type="text" value="${escapeAttr(v.name)}" required maxlength="200"></label>
                <label>Slug <input name="slug" type="text" value="${escapeAttr(v.slug)}" required pattern="[a-z0-9-]+" placeholder="ex: volta-a-ilha"></label>
                <label>Descrição <textarea name="description" rows="2" maxlength="500">${escapeText(v.description || '')}</textarea></label>
                <label>Tipo
                    <select name="type">
                        ${PRODUCT_TYPES.map(t => `<option value="${t.value}" ${v.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                    </select>
                </label>
            </fieldset>

            <fieldset>
                <legend>Preço</legend>
                <label>Pricing mode
                    <select name="pricing_mode">
                        ${PRICING_MODES.map(m => `<option value="${m.value}" ${v.pricing_mode === m.value ? 'selected' : ''}>${m.label}</option>`).join('')}
                    </select>
                </label>
                <label>Preço total (R$) <input name="price_full" type="number" step="0.01" min="0" value="${v.price_full}" required></label>
                <label>Sinal/depósito (R$, vazio = paga tudo) <input name="price_deposit" type="number" step="0.01" min="0" value="${v.price_deposit ?? ''}"></label>
                <label>Veículo: capacidade (per_vehicle) <input name="vehicle_capacity" type="number" min="1" value="${v.vehicle_capacity ?? ''}"></label>
                <label>Veículo: seguro/pax (R$) <input name="insurance_per_pax" type="number" step="0.01" min="0" value="${v.insurance_per_pax ?? ''}"></label>
            </fieldset>

            <fieldset>
                <legend>Operação</legend>
                <label>Capacidade vagas/horário <input name="capacity" type="number" min="0" value="${v.capacity}" required></label>
                <label>Horários (vírgula, vazio = "a combinar")
                    <input name="departure_times" type="text" value="${escapeAttr((v.departure_times || []).join(', '))}" placeholder="09:30, 14:00">
                </label>
                <div style="display:flex;gap:0.5rem">
                    <label style="flex:1">Cutoff hora <input name="cutoff_hour" type="number" min="0" max="23" value="${v.cutoff_hour}"></label>
                    <label style="flex:1">Cutoff min <input name="cutoff_minute" type="number" min="0" max="59" value="${v.cutoff_minute}"></label>
                </div>
                <label><input name="requires_cnh" type="checkbox" ${v.requires_cnh ? 'checked' : ''}> Exige CNH</label>
            </fieldset>

            <fieldset>
                <legend>Política infantil</legend>
                <label>Idade mínima criança (vazio = qualquer) <input name="child_min_age" type="number" min="0" max="17" value="${v.child_min_age ?? ''}"></label>
                <label>Desconto criança (0–1, ex: 0.5 = 50%) <input name="child_discount" type="number" step="0.01" min="0" max="1" value="${v.child_discount ?? ''}"></label>
                <label>Idade máxima infant (gratuito) <input name="infant_max_age" type="number" min="0" max="17" value="${v.infant_max_age}"></label>
            </fieldset>

            <fieldset>
                <legend>UI</legend>
                <label>Sort order <input name="sort_order" type="number" value="${v.sort_order}"></label>
                <label>BG gradient (CSS class) <input name="bg_gradient" type="text" value="${escapeAttr(v.bg_gradient || '')}"></label>
                <label><input name="active" type="checkbox" ${v.active ? 'checked' : ''}> Ativo (visível ao público)</label>
            </fieldset>

            <div class="form-actions">
                <button type="submit" class="primary-btn">${isEdit ? 'Salvar' : 'Criar'}</button>
            </div>
        </form>

        ${isEdit ? `
            <section style="margin-top:1.5rem">
                <h4>Fotos</h4>
                <p style="font-size:0.82rem;color:var(--color-text-muted);margin:0.3rem 0 0.6rem">
                    JPG/PNG/WebP, máx 5MB. Primeira foto = capa. Arrastar para reordenar (futuro).
                </p>
                <div id="p-photos"></div>
                <div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.5rem">
                    <input type="file" id="p-photo-input" accept="image/jpeg,image/png,image/webp" style="font-size:0.85rem">
                    <button type="button" id="p-photo-upload" class="primary-btn">Upload</button>
                </div>
            </section>

            <section style="margin-top:1.5rem">
                <h4>Conteúdo (accordions)</h4>
                <p style="font-size:0.82rem;color:var(--color-text-muted);margin:0.3rem 0 0.6rem">
                    Cada item vira uma seção expansível na página do produto. Body aceita HTML simples (&lt;p&gt;, &lt;ul&gt;, &lt;strong&gt;, &lt;a&gt;).
                </p>
                <div id="p-accordions"></div>
                <div style="display:flex;gap:0.5rem;margin-top:0.5rem">
                    <button type="button" id="p-acc-add" class="ghost">+ Adicionar item</button>
                    <button type="button" id="p-acc-save" class="primary-btn" style="margin-left:auto">Salvar conteúdo</button>
                </div>
            </section>
        ` : '<p style="margin-top:1rem;color:var(--color-text-muted);font-size:0.85rem">Salva o produto primeiro para editar fotos e accordions.</p>'}
    `;

    drawerEl.querySelector('.drawer-close').addEventListener('click', closeDrawer);
    drawerEl.querySelector('#p-form').addEventListener('submit', (e) => {
        e.preventDefault();
        submitProduto(e.target, p?.id || null);
    });

    if (isEdit) {
        accordionState = JSON.parse(JSON.stringify(v.accordion_data || []));
        renderAccordionItems();
        drawerEl.querySelector('#p-acc-add').addEventListener('click', () => {
            accordionState.push({ title: '', body_html: '' });
            renderAccordionItems();
        });
        drawerEl.querySelector('#p-acc-save').addEventListener('click', () => saveAccordions(p.id));

        photoState = [...(v.photos || [])];
        renderPhotos(p.id);
        drawerEl.querySelector('#p-photo-upload').addEventListener('click', () => uploadPhoto(p.id));
    }
}

let photoState = [];

function renderPhotos(productId) {
    const host = document.querySelector('#p-photos');
    if (!host) return;
    if (photoState.length === 0) {
        host.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.85rem;padding:0.5rem 0">Sem fotos. Adicione abaixo.</p>';
        return;
    }
    host.innerHTML = `
        <div class="photo-grid">
            ${photoState.map((url, i) => `
                <div class="photo-card" data-idx="${i}">
                    <img src="${escapeAttr(url)}" alt="Foto ${i + 1}" loading="lazy">
                    <div class="photo-actions">
                        <span class="photo-num">#${i + 1}${i === 0 ? ' (capa)' : ''}</span>
                        <button type="button" class="photo-up" title="Mover esquerda" ${i === 0 ? 'disabled' : ''}>←</button>
                        <button type="button" class="photo-down" title="Mover direita" ${i === photoState.length - 1 ? 'disabled' : ''}>→</button>
                        <button type="button" class="photo-del danger-btn" title="Remover">✕</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    host.querySelectorAll('.photo-card').forEach((el) => {
        const i = Number(el.dataset.idx);
        el.querySelector('.photo-up').addEventListener('click', () => movePhoto(productId, i, -1));
        el.querySelector('.photo-down').addEventListener('click', () => movePhoto(productId, i, 1));
        el.querySelector('.photo-del').addEventListener('click', () => deletePhoto(productId, i));
    });
}

async function uploadPhoto(productId) {
    const input = document.querySelector('#p-photo-input');
    const file = input.files?.[0];
    if (!file) { toast('Escolha um ficheiro', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('Máx 5MB', 'error'); return; }

    const btn = document.querySelector('#p-photo-upload');
    btn.disabled = true;
    btn.textContent = 'Enviando…';

    const fd = new FormData();
    fd.append('file', file);

    try {
        const res = await fetch(`${state.apiBase}/admin/products/${productId}/photos`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${state.session.access_token}` },
            body: fd,
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        photoState = data.photos || [];
        renderPhotos(productId);
        input.value = '';
        toast('Foto enviada', 'success');
    } catch (err) {
        toast(`Erro: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Upload';
    }
}

async function deletePhoto(productId, idx) {
    if (!window.confirm('Remover esta foto? Ação irreversível.')) return;
    try {
        const data = await api(`/admin/products/${productId}/photos/${idx}`, { method: 'DELETE' });
        photoState = data.photos || [];
        renderPhotos(productId);
        toast('Foto removida', 'success');
    } catch (err) {
        toast(`Erro: ${err.message}`, 'error');
    }
}

async function movePhoto(productId, i, delta) {
    const j = i + delta;
    if (j < 0 || j >= photoState.length) return;
    const order = photoState.map((_, k) => k);
    [order[i], order[j]] = [order[j], order[i]];
    try {
        const data = await api(`/admin/products/${productId}/photos/reorder`, {
            method: 'PATCH',
            body: JSON.stringify({ order }),
        });
        photoState = data.photos || [];
        renderPhotos(productId);
    } catch (err) {
        toast(`Erro: ${err.message}`, 'error');
    }
}

let accordionState = [];

function renderAccordionItems() {
    const host = document.querySelector('#p-accordions');
    if (!host) return;
    if (accordionState.length === 0) {
        host.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.85rem;padding:0.5rem 0">Sem itens. Clique em "+ Adicionar item".</p>';
        return;
    }
    host.innerHTML = accordionState.map((it, i) => `
        <div class="acc-item" data-idx="${i}">
            <div class="acc-head">
                <span class="acc-num">#${i + 1}</span>
                <input class="acc-title" type="text" value="${escapeAttr(it.title || '')}" placeholder="Título da seção" maxlength="120">
                <button type="button" class="acc-up" title="Mover acima" ${i === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" class="acc-down" title="Mover abaixo" ${i === accordionState.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" class="acc-del danger-btn" title="Remover">✕</button>
            </div>
            <textarea class="acc-body" rows="6" placeholder="<p>Conteúdo HTML aqui...</p>">${escapeText(it.body_html || '')}</textarea>
        </div>
    `).join('');

    host.querySelectorAll('.acc-item').forEach((el) => {
        const i = Number(el.dataset.idx);
        el.querySelector('.acc-title').addEventListener('input', (e) => { accordionState[i].title = e.target.value; });
        el.querySelector('.acc-body').addEventListener('input', (e) => { accordionState[i].body_html = e.target.value; });
        el.querySelector('.acc-up').addEventListener('click', () => moveAccordion(i, -1));
        el.querySelector('.acc-down').addEventListener('click', () => moveAccordion(i, 1));
        el.querySelector('.acc-del').addEventListener('click', () => {
            if (!window.confirm('Remover este item?')) return;
            accordionState.splice(i, 1);
            renderAccordionItems();
        });
    });
}

function moveAccordion(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= accordionState.length) return;
    [accordionState[i], accordionState[j]] = [accordionState[j], accordionState[i]];
    renderAccordionItems();
}

async function saveAccordions(productId) {
    const cleaned = accordionState
        .map(it => ({ title: (it.title || '').trim(), body_html: it.body_html || '' }))
        .filter(it => it.title.length > 0);

    const btn = document.querySelector('#p-acc-save');
    btn.disabled = true;
    btn.textContent = 'Salvando…';
    try {
        await api(`/admin/products/${productId}/accordions`, {
            method: 'PATCH',
            body: JSON.stringify({ accordion_data: cleaned }),
        });
        toast(`Conteúdo salvo (${cleaned.length} item${cleaned.length === 1 ? '' : 's'})`, 'success');
    } catch (err) {
        const issues = err.body?.issues ? '\n' + err.body.issues.map(i => `• ${i.path.join('.')}: ${i.message}`).join('\n') : '';
        toast(`Erro: ${err.message}${issues}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar conteúdo';
    }
}

function readProdutoForm(form) {
    const fd = new FormData(form);
    const get = (k) => fd.get(k);
    const num = (k) => { const v = get(k); return v === '' || v == null ? null : Number(v); };
    const required = (k) => { const v = get(k); return v === '' || v == null ? null : Number(v); };
    return {
        type: get('type'),
        slug: get('slug').trim(),
        name: get('name').trim(),
        description: get('description').trim() || null,
        price_full: required('price_full') ?? 0,
        price_deposit: num('price_deposit'),
        pricing_mode: get('pricing_mode'),
        vehicle_capacity: num('vehicle_capacity'),
        insurance_per_pax: num('insurance_per_pax'),
        capacity: required('capacity') ?? 0,
        departure_times: (get('departure_times') || '').split(',').map(s => s.trim()).filter(Boolean),
        cutoff_hour: required('cutoff_hour') ?? 8,
        cutoff_minute: required('cutoff_minute') ?? 30,
        child_min_age: num('child_min_age'),
        child_discount: num('child_discount'),
        infant_max_age: required('infant_max_age') ?? 5,
        requires_cnh: fd.has('requires_cnh'),
        bg_gradient: get('bg_gradient') || null,
        sort_order: required('sort_order') ?? 0,
        active: fd.has('active'),
    };
}

async function submitProduto(form, id) {
    const payload = readProdutoForm(form);
    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando…';
    try {
        if (id) {
            await api(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
            toast('Produto atualizado', 'success');
        } else {
            await api('/admin/products', { method: 'POST', body: JSON.stringify(payload) });
            toast('Produto criado', 'success');
        }
        closeDrawer();
        loadProdutos();
    } catch (err) {
        const issues = err.body?.issues ? '\n' + err.body.issues.map(i => `• ${i.path.join('.')}: ${i.message}`).join('\n') : '';
        toast(`Erro: ${err.message}${issues}`, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = id ? 'Salvar' : 'Criar';
    }
}

// ---------- Dashboard view ----------
async function renderDashboard(container) {
    const today = new Date().toISOString().slice(0, 10);
    const fromDefault = new Date(); fromDefault.setDate(fromDefault.getDate() - 30);
    const from = fromDefault.toISOString().slice(0, 10);

    container.innerHTML = `
        <div class="filters-bar">
            <label>De <input type="date" id="d-from" value="${from}"></label>
            <label>Até <input type="date" id="d-to" value="${today}"></label>
            <button id="d-apply">Atualizar</button>
        </div>
        <div id="d-content"><p class="placeholder">Carregando…</p></div>
    `;
    container.querySelector('#d-apply').addEventListener('click', loadDashboard);
    await loadDashboard();
}

async function loadDashboard() {
    const fromDate = $('#d-from').value;
    const toDate = $('#d-to').value;
    const contentEl = $('#d-content');
    contentEl.innerHTML = '<p class="placeholder">Carregando…</p>';

    let data;
    try {
        data = await api(`/admin/analytics/sales?from_date=${fromDate}&to_date=${toDate}`);
    } catch (err) {
        contentEl.innerHTML = `<p class="placeholder" style="color:var(--color-danger)">Erro: ${escapeText(err.message)}</p>`;
        return;
    }

    const statusEntries = Object.entries(data.by_status).sort((a, b) => b[1] - a[1]);
    const productEntries = Object.entries(data.by_product).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 8);
    const dayEntries = Object.entries(data.by_day).sort();
    const maxDayRev = Math.max(1, ...dayEntries.map(([, v]) => v.revenue));

    contentEl.innerHTML = `
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Valor gerado</div>
                <div class="kpi-value">R$ ${formatMoney(data.total_revenue)}</div>
                <div class="kpi-sub">${data.total_count} reserva(s) no período</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Sinais recebidos</div>
                <div class="kpi-value">R$ ${formatMoney(data.total_deposits || 0)}</div>
                <div class="kpi-sub">pagos online (sinal)</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Comissões</div>
                <div class="kpi-value" style="color:var(--color-primary)">R$ ${formatMoney(data.total_commissions || 0)}</div>
                <div class="kpi-sub">tua receita líquida</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Reservas pagas</div>
                <div class="kpi-value">${(data.by_status.deposit_paid || 0) + (data.by_status.fully_paid || 0)}</div>
                <div class="kpi-sub">${data.by_status.deposit_paid || 0} sinal · ${data.by_status.fully_paid || 0} integral</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Pendentes</div>
                <div class="kpi-value">${data.by_status.pending_payment || 0}</div>
                <div class="kpi-sub">aguardando pgto.</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Canceladas</div>
                <div class="kpi-value">${(data.by_status.cancelled_noshow || 0) + (data.by_status.cancelled_force_majeure || 0)}</div>
                <div class="kpi-sub">${data.by_status.cancelled_noshow || 0} no-show · ${data.by_status.cancelled_force_majeure || 0} FM</div>
            </div>
        </div>

        <section class="dash-section">
            <h4>Status</h4>
            <div class="bars">
                ${statusEntries.map(([s, n]) => `
                    <div class="bar-row">
                        <span class="bar-label"><span class="badge badge-${s}">${escapeText(STATUS_LABELS[s] || s)}</span></span>
                        <div class="bar-track"><div class="bar-fill" style="width:${(n / data.total_count * 100).toFixed(1)}%;background:var(--color-secondary)"></div></div>
                        <span class="bar-num">${n}</span>
                    </div>
                `).join('')}
            </div>
        </section>

        <section class="dash-section">
            <h4>Top produtos por receita</h4>
            ${productEntries.length === 0 ? '<em style="color:var(--color-text-muted)">Sem dados</em>' : `
                <table class="data-table">
                    <thead><tr><th>Produto</th><th>Reservas</th><th>Valor gerado</th><th>Comissão</th></tr></thead>
                    <tbody>
                        ${productEntries.map(([slug, p]) => `
                            <tr><td>${escapeText(p.name)} <span style="color:var(--color-text-muted);font-size:0.78rem">${escapeText(slug)}</span></td>
                            <td>${p.count}</td>
                            <td>R$ ${formatMoney(p.revenue)}</td>
                            <td style="color:var(--color-primary);font-weight:600">R$ ${formatMoney(p.commission || 0)}</td></tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </section>

        <section class="dash-section">
            <h4>Receita por dia</h4>
            ${dayEntries.length === 0 ? '<em style="color:var(--color-text-muted)">Sem dados</em>' : `
                <div class="bars">
                    ${dayEntries.map(([day, v]) => `
                        <div class="bar-row">
                            <span class="bar-label" style="font-family:monospace;font-size:0.78rem">${formatDateShort(day)}</span>
                            <div class="bar-track"><div class="bar-fill" style="width:${(v.revenue / maxDayRev * 100).toFixed(1)}%;background:var(--color-primary)"></div></div>
                            <span class="bar-num">R$ ${formatMoney(v.revenue)}</span>
                        </div>
                    `).join('')}
                </div>
            `}
        </section>
    `;
}

// ---------- Envios diários view ----------
async function renderEnvios(container) {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const dateDefault = tomorrow.toISOString().slice(0, 10);
    container.innerHTML = `
        <div class="filters-bar">
            <label>Data do passeio <input type="date" id="e-date" value="${dateDefault}"></label>
            <button id="e-load">Carregar preview</button>
        </div>
        <div id="e-content"><p class="placeholder">Selecione uma data e clique em Carregar.</p></div>
    `;
    container.querySelector('#e-load').addEventListener('click', loadEnviosPreview);
    await loadEnviosPreview();
}

async function loadEnviosPreview() {
    const date = $('#e-date').value;
    const contentEl = $('#e-content');
    contentEl.innerHTML = '<p class="placeholder">Carregando…</p>';

    let data;
    try {
        data = await api(`/admin/analytics/passengers-preview?date=${date}`);
    } catch (err) {
        contentEl.innerHTML = `<p class="placeholder" style="color:var(--color-danger)">Erro: ${escapeText(err.message)}</p>`;
        return;
    }

    if (data.total_reservations === 0) {
        contentEl.innerHTML = `<p class="placeholder">Sem reservas pagas para ${formatDate(date)}.</p>`;
        return;
    }

    const providersHtml = data.providers.map((g) => {
        const productsHtml = g.products.map((ps) => {
            const slotsHtml = ps.slots.map((s) => `
                <div style="margin:0.4rem 0 0.6rem;border-left:2px solid var(--border);padding-left:0.7rem">
                    <strong>${escapeText(s.time)}</strong> · ${s.pax_total} pax
                    <ol style="margin:0.3rem 0 0;padding-left:1.4rem;font-size:0.85rem">
                        ${s.reservations.map(r => `
                            <li>${escapeText(r.customer_name || '?')} — ${r.qty_adults}A/${r.qty_children}C/${r.qty_infants}I · ${escapeText(r.customer_whatsapp || '—')}</li>
                        `).join('')}
                    </ol>
                </div>
            `).join('');
            return `
                <div style="margin-top:0.5rem">
                    <strong>${escapeText(ps.product?.name || '?')}</strong>
                    ${slotsHtml}
                </div>
            `;
        }).join('');

        const hasWhatsapp = !!g.provider.whatsapp;
        return `
            <div style="border:1px solid var(--border);border-radius:8px;padding:1rem;margin-bottom:1rem">
                <h4 style="margin:0 0 0.5rem">${escapeText(g.provider.name)} ${hasWhatsapp ? `<span style="color:var(--color-text-muted);font-size:0.78rem;font-weight:400">${escapeText(g.provider.whatsapp)}</span>` : '<span class="badge badge-cancelled_noshow">SEM WHATSAPP</span>'}</h4>
                ${productsHtml}
            </div>
        `;
    }).join('');

    contentEl.innerHTML = `
        <div style="margin-bottom:1rem;padding:0.75rem;background:#fef3c7;border-radius:8px;font-size:0.85rem;color:#78350f">
            ⚠️ Confirme tudo antes de enviar. Mensagens vão para fornecedores via WhatsApp e não podem ser desfeitas.
        </div>
        ${providersHtml}
        <div style="display:flex;justify-content:flex-end;padding:1rem;border-top:1px solid var(--border);margin-top:1rem">
            <button id="e-send" class="primary-btn">Enviar lista a todos os fornecedores</button>
        </div>
    `;
    contentEl.querySelector('#e-send').addEventListener('click', () => sendDaily(date));
}

async function sendDaily(date) {
    if (!window.confirm(`Enviar lista do dia ${formatDate(date)} aos fornecedores agora?`)) return;
    const btn = $('#e-send');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
        const result = await api('/admin/notifications/send-daily', {
            method: 'POST',
            body: JSON.stringify({ date }),
        });
        toast(`Enviadas: ${result.sent} · Falhas: ${result.failed}`, result.failed > 0 ? 'error' : 'success');
        loadEnviosPreview();
    } catch (err) {
        toast(`Erro: ${err.message}`, 'error');
        btn.disabled = false;
        btn.textContent = 'Enviar lista a todos os fornecedores';
    }
}

// ---------- Fornecedores view ----------
let providersShowInactive = false;
let _productsCache = null;

async function getProductsCache() {
    if (_productsCache) return _productsCache;
    const res = await api('/admin/products?include_inactive=1');
    _productsCache = res.items || [];
    return _productsCache;
}

async function renderFornecedores(container) {
    container.innerHTML = `
        <div class="filters-bar">
            <button id="f-new" class="primary-btn">+ Novo fornecedor</button>
            <label style="display:flex;gap:0.4rem;align-items:center;font-size:0.88rem;margin-left:auto">
                <input type="checkbox" id="f-show-inactive" ${providersShowInactive ? 'checked' : ''}>
                Mostrar inativos
            </label>
        </div>
        <div id="f-list"><p class="placeholder">Carregando…</p></div>
    `;
    container.querySelector('#f-new').addEventListener('click', () => openProviderDrawer(null));
    container.querySelector('#f-show-inactive').addEventListener('change', (e) => {
        providersShowInactive = e.target.checked;
        loadFornecedores();
    });
    await loadFornecedores();
}

async function loadFornecedores() {
    const listEl = $('#f-list');
    listEl.innerHTML = '<p class="placeholder">Carregando…</p>';
    let result;
    try {
        result = await api(`/admin/providers${providersShowInactive ? '?include_inactive=1' : ''}`);
    } catch (err) {
        listEl.innerHTML = `<p class="placeholder" style="color:var(--color-danger)">Erro: ${escapeText(err.message)}</p>`;
        return;
    }
    if (!result.items.length) {
        listEl.innerHTML = '<p class="placeholder">Nenhum fornecedor.</p>';
        return;
    }
    const rows = result.items.map((p) => `
        <tr data-id="${p.id}" ${p.active ? '' : 'style="opacity:0.55"'}>
            <td>${escapeText(p.name)}</td>
            <td>${escapeText(p.whatsapp)}</td>
            <td>${escapeText(p.email || '—')}</td>
            <td>${p.active ? '<span class="badge badge-fully_paid">ativo</span>' : '<span class="badge badge-cancelled_noshow">inativo</span>'}</td>
        </tr>
    `).join('');
    listEl.innerHTML = `
        <table class="data-table">
            <thead><tr><th>Nome</th><th>WhatsApp</th><th>Email</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;
    listEl.querySelectorAll('tbody tr').forEach((tr) => {
        tr.addEventListener('click', () => openProviderDrawer(tr.dataset.id));
    });
}

async function openProviderDrawer(id) {
    closeDrawer();
    const backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    backdrop.id = 'drawer-backdrop';
    backdrop.innerHTML = `
        <aside class="drawer" role="dialog" aria-modal="true">
            <div class="drawer-header">
                <h3>${id ? 'Editar fornecedor' : 'Novo fornecedor'}</h3>
                <button class="drawer-close" aria-label="Fechar">×</button>
            </div>
            <p class="placeholder">Carregando…</p>
        </aside>
    `;
    document.body.appendChild(backdrop);
    backdrop.querySelector('.drawer-close').addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeDrawer(); });
    document.addEventListener('keydown', escClose);

    let provider = null;
    let products = [];
    try {
        if (id) provider = await api(`/admin/providers/${id}`);
        products = await getProductsCache();
    } catch (err) {
        backdrop.querySelector('.drawer').innerHTML = `<p style="color:var(--color-danger)">Erro: ${escapeText(err.message)}</p>`;
        return;
    }
    renderProviderForm(backdrop.querySelector('.drawer'), provider, products);
}

function renderProviderForm(drawerEl, p, allProducts) {
    const isEdit = !!p;
    const v = p || { name: '', whatsapp: '+55', email: '', active: true, products: [] };
    const linkedMap = new Map((v.products || []).map(l => [l.product_id, l]));

    const productRows = allProducts.map((prod) => {
        const link = linkedMap.get(prod.id);
        return `
            <tr data-product-id="${prod.id}">
                <td><strong>${escapeText(prod.name)}</strong> <span style="color:var(--color-text-muted);font-size:0.78rem">${escapeText(prod.slug)}</span></td>
                <td>
                    <input type="number" class="link-comm" step="0.01" min="0" value="${link ? link.commission_value : ''}" placeholder="—" style="width:90px">
                </td>
                <td>
                    <label style="display:flex;align-items:center;gap:0.3rem;font-size:0.85rem">
                        <input type="checkbox" class="link-active" ${link?.active !== false && link ? 'checked' : ''} ${link ? '' : 'disabled'}>
                        ativo
                    </label>
                </td>
                <td>
                    ${link
                        ? `<button type="button" class="link-save" data-act="save">Salvar</button> <button type="button" class="link-unlink danger-btn" data-act="unlink">×</button>`
                        : `<button type="button" class="link-save primary-btn" data-act="link">Vincular</button>`
                    }
                </td>
            </tr>
        `;
    }).join('');

    drawerEl.innerHTML = `
        <div class="drawer-header">
            <h3>${isEdit ? 'Editar' : 'Novo'} fornecedor</h3>
            <button class="drawer-close" aria-label="Fechar">×</button>
        </div>

        <form id="f-form" class="produto-form" novalidate>
            <fieldset>
                <legend>Dados</legend>
                <label>Nome <input name="name" type="text" value="${escapeAttr(v.name)}" required maxlength="120"></label>
                <label>WhatsApp (E.164, +55...) <input name="whatsapp" type="text" value="${escapeAttr(v.whatsapp)}" required pattern="\\+\\d{8,15}"></label>
                <label>Email <input name="email" type="email" value="${escapeAttr(v.email || '')}"></label>
                <label><input name="active" type="checkbox" ${v.active ? 'checked' : ''}> Ativo</label>
            </fieldset>
            <div class="form-actions">
                <button type="submit" class="primary-btn">${isEdit ? 'Salvar dados' : 'Criar fornecedor'}</button>
            </div>
        </form>

        ${isEdit ? `
            <section style="margin-top:1.5rem">
                <h4>Produtos e comissões</h4>
                <p style="font-size:0.82rem;color:var(--color-text-muted);margin:0.3rem 0 0.6rem">
                    Comissão é o valor que tu ganhas (R$) por reserva paga. Reserva nova é atribuída ao fornecedor com maior comissão para o produto.
                </p>
                <table class="data-table">
                    <thead><tr><th>Produto</th><th>Comissão (R$)</th><th>Ativo</th><th></th></tr></thead>
                    <tbody id="f-products-body">${productRows}</tbody>
                </table>
            </section>
        ` : '<p style="margin-top:1rem;color:var(--color-text-muted);font-size:0.85rem">Salva o fornecedor primeiro para vincular produtos.</p>'}
    `;

    drawerEl.querySelector('.drawer-close').addEventListener('click', closeDrawer);
    drawerEl.querySelector('#f-form').addEventListener('submit', (e) => {
        e.preventDefault();
        submitProvider(e.target, p?.id || null);
    });

    if (isEdit) {
        drawerEl.querySelectorAll('#f-products-body tr').forEach((tr) => {
            const productId = tr.dataset.productId;
            tr.querySelectorAll('button[data-act]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const act = btn.dataset.act;
                    if (act === 'unlink') return unlinkProviderProduct(p.id, productId);
                    const commInput = tr.querySelector('.link-comm');
                    const activeInput = tr.querySelector('.link-active');
                    const commission = Number(commInput.value);
                    if (isNaN(commission) || commission < 0) { toast('Comissão inválida', 'error'); return; }
                    linkProviderProduct(p.id, productId, commission, activeInput.checked || act === 'link');
                });
            });
            tr.querySelector('.link-active')?.addEventListener('change', () => { /* habilita save */ });
        });
    }
}

async function submitProvider(form, id) {
    const fd = new FormData(form);
    const payload = {
        name: fd.get('name').trim(),
        whatsapp: fd.get('whatsapp').trim(),
        email: fd.get('email').trim() || null,
        active: fd.has('active'),
    };
    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando…';
    try {
        const result = id
            ? await api(`/admin/providers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
            : await api('/admin/providers', { method: 'POST', body: JSON.stringify(payload) });
        toast(id ? 'Fornecedor atualizado' : 'Fornecedor criado', 'success');
        if (!id) {
            // Reabre drawer em modo edit para vincular produtos
            openProviderDrawer(result.id);
        } else {
            loadFornecedores();
        }
    } catch (err) {
        const issues = err.body?.issues ? '\n' + err.body.issues.map(i => `• ${i.path.join('.')}: ${i.message}`).join('\n') : '';
        toast(`Erro: ${err.message}${issues}`, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = id ? 'Salvar dados' : 'Criar fornecedor';
    }
}

async function linkProviderProduct(providerId, productId, commission, active) {
    try {
        await api(`/admin/providers/${providerId}/products`, {
            method: 'POST',
            body: JSON.stringify({ product_id: productId, commission_value: commission, active }),
        });
        toast('Vínculo salvo', 'success');
        openProviderDrawer(providerId);
    } catch (err) {
        toast(`Erro: ${err.message}`, 'error');
    }
}

async function unlinkProviderProduct(providerId, productId) {
    if (!window.confirm('Remover este vínculo? Reservas existentes não são afetadas (snapshot da comissão é fixo).')) return;
    try {
        await api(`/admin/providers/${providerId}/products/${productId}`, { method: 'DELETE' });
        toast('Vínculo removido', 'success');
        openProviderDrawer(providerId);
    } catch (err) {
        toast(`Erro: ${err.message}`, 'error');
    }
}

// ---------- API helper ----------
async function api(path, options = {}) {
    if (!state.session) throw Object.assign(new Error('not_authenticated'), { status: 401 });
    const res = await fetch(`${state.apiBase}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.session.access_token}`,
            ...(options.headers || {}),
        },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status, body });
    }
    return res.json();
}

// ---------- helpers ----------
function escapeText(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeText(s); }
function formatMoney(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(d) {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
}
function formatDateShort(d) {
    if (!d) return '';
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
}
function formatDateTime(s) {
    if (!s) return '';
    const d = new Date(s);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function toast(msg, kind = 'success') {
    document.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

bootstrap().catch((err) => {
    console.error('bootstrap failed', err);
    document.body.innerHTML = `<pre style="padding:2rem;color:#d92d20">Erro fatal: ${err.message}</pre>`;
});
