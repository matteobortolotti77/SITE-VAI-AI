// 🛡️ ENCAPSULAMENTO DE SEGURANÇA (IIFE)
// Previne vazamento de variáveis, colisões de escopo e limpa a Window.
(() => {

// 0. INICIALIZAÇÃO DE ÍCONES (movido do HTML inline para dentro da IIFE)
if (window.lucide) lucide.createIcons();

const footerYearEl = document.getElementById('footer-year');
if (footerYearEl) footerYearEl.textContent = new Date().getFullYear();

// 0.1 i18n — Detecção, aplicação, helper t()
const SUPPORTED_LOCALES = ['pt-BR', 'en', 'es', 'fr', 'it', 'de', 'he'];
const DEFAULT_LOCALE = 'pt-BR';
let currentLocale = DEFAULT_LOCALE;

function detectLocale() {
    const saved = localStorage.getItem('vai_locale');
    if (saved && SUPPORTED_LOCALES.includes(saved)) return saved;
    const nav = (navigator.language || 'pt-BR');
    if (SUPPORTED_LOCALES.includes(nav)) return nav;
    const short = nav.split('-')[0];
    const match = SUPPORTED_LOCALES.find(l => l.split('-')[0] === short);
    return match || DEFAULT_LOCALE;
}

function t(key) {
    const dict = (window.VAI_I18N && window.VAI_I18N[currentLocale]) || {};
    if (key in dict) return dict[key];
    const fallback = (window.VAI_I18N && window.VAI_I18N[DEFAULT_LOCALE]) || {};
    return fallback[key] || key;
}

function applyLocale(locale) {
    if (!SUPPORTED_LOCALES.includes(locale)) locale = DEFAULT_LOCALE;
    currentLocale = locale;
    localStorage.setItem('vai_locale', locale);

    const isRtl = (window.VAI_I18N_RTL || []).includes(locale);
    document.documentElement.lang = (window.VAI_I18N_LANG_TAGS || {})[locale] || locale;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        el.innerHTML = t(key);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        el.setAttribute('aria-label', t(key));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.setAttribute('placeholder', t(key));
    });

    const langCodeEl = document.getElementById('lang-code');
    if (langCodeEl) langCodeEl.textContent = locale === 'pt-BR' ? 'PT' : locale.toUpperCase();

    document.querySelectorAll('.lang-option').forEach(opt => {
        opt.classList.toggle('active', opt.getAttribute('data-lang') === locale);
    });

    if (typeof flatpickr !== 'undefined' && flatpickr.l10ns) {
        const fpMap = { 'pt-BR': 'pt', 'en': 'default', 'es': 'es', 'fr': 'fr', 'it': 'it', 'de': 'de', 'he': 'he' };
        const fpKey = fpMap[locale];
        if (fpKey && (fpKey === 'default' || flatpickr.l10ns[fpKey])) {
            flatpickr.localize(fpKey === 'default' ? flatpickr.l10ns.default : flatpickr.l10ns[fpKey]);
        }
    }

    if (typeof updateRouteMeta === 'function') updateRouteMeta();
}

// 0.2 LANGUAGE SELECTOR — dropdown
const langBtn = document.getElementById('lang-btn');
const langDropdown = document.getElementById('lang-dropdown');
function closeLangDropdown() {
    if (!langDropdown) return;
    langDropdown.classList.remove('open');
    if (langBtn) langBtn.setAttribute('aria-expanded', 'false');
}
if (langBtn && langDropdown) {
    langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = langDropdown.classList.toggle('open');
        langBtn.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', (e) => {
        if (!langDropdown.contains(e.target) && e.target !== langBtn && !langBtn.contains(e.target)) {
            closeLangDropdown();
        }
    });
    langDropdown.querySelectorAll('.lang-option').forEach(opt => {
        opt.addEventListener('click', () => {
            applyLocale(opt.getAttribute('data-lang'));
            closeLangDropdown();
        });
    });
}

// 0.3 PRODUTOS DINÂMICOS — fetch /v1/products e re-renderiza carrosséis
// Progressive enhancement: HTML estático aparece primeiro; se backend responder
// em ≤2s, sobrescreve com dados frescos do DB. Se falhar, mantém estático.
const API_BASE = 'https://site-vai-ai-production.up.railway.app/v1';

// Mapping accordion title (pt-BR base) → chave i18n
const ACCORDION_KEYS = {
    'Roteiro e Horários': 'accordion.roteiro',
    'O que está incluso': 'accordion.incluso',
    'O que levar': 'accordion.levar',
    'Formas de Pagamento': 'accordion.pagamento',
    'Requisitos': 'accordion.requisitos',
    'Detalhes': 'accordion.detalhes'
};

// Map slug → chave i18n base (já existem em i18n.js)
const PRODUCT_I18N_PREFIX = {
    'volta-a-ilha': 'product.volta_a_ilha',
    'garapua-4x4': 'product.garapua_4x4',
    'gamboa-full': 'product.gamboa_full',
    'gamboa-convencional': 'product.gamboa_conv',
    'quadriciclo': 'product.quadriciclo',
    'buggy': 'product.buggy',
    'mergulho-cilindro': 'product.mergulho',
    'cavalgada': 'product.cavalgada',
    'tiroleza': 'product.tiroleza',
    'banana-boat': 'product.banana_boat',
    'bike-aquatica': 'product.bike_aquatica',
    'aluguel-bicicleta': 'product.bicicletas',
    'ida-terminal': 'product.ida_terminal',
    'ida-hoteis': 'product.ida_hoteis',
    'ida-aeroporto': 'product.ida_aeroporto',
    'ida-catamara': 'product.ida_catamara',
    'volta-terminal': 'product.volta_terminal',
    'volta-hoteis': 'product.volta_hoteis',
    'volta-aeroporto': 'product.volta_aeroporto',
    'volta-catamara': 'product.volta_catamara'
};

function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function priceTagText(p) {
    // Catamarãs originais usavam "A partir de R$ X" — replicamos para 'ida-catamara' e 'volta-catamara'
    if (p.slug === 'ida-catamara' || p.slug === 'volta-catamara') {
        return `A partir de R$ ${p.price_full}`;
    }
    return `R$ ${p.price_full}`;
}

function cardImageHTML(p) {
    if (Array.isArray(p.photos) && p.photos.length > 0) {
        const slides = p.photos.map(url =>
            `<div class="swiper-slide" style="background-image: url('${escapeHTML(url)}'); background-size: cover; background-position: center;"></div>`
        ).join('');
        return `<div class="card-image swiper inner-swiper">
            <div class="swiper-wrapper">${slides}</div>
            <div class="swiper-pagination inner-pagination"></div>
            <div class="price-tag">${escapeHTML(priceTagText(p))}</div>
        </div>`;
    }
    const cls = p.bg_gradient ? `ticket-card-img ${p.bg_gradient}` : '';
    return `<div class="card-image ${cls}">
        <div class="price-tag">${escapeHTML(priceTagText(p))}</div>
    </div>`;
}

function accordionHTML(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    const itemsHTML = items.map(it => {
        const i18nKey = ACCORDION_KEYS[it.title];
        const titleAttr = i18nKey ? ` data-i18n="${i18nKey}"` : '';
        return `<div class="accordion-item">
            <div class="accordion-header" data-action="accordion">
                <span${titleAttr}>${escapeHTML(it.title)}</span>
                <i data-lucide="chevron-down"></i>
            </div>
            <div class="accordion-body"><div class="accordion-inner">${it.body_html || ''}</div></div>
        </div>`;
    }).join('');
    return `<div class="custom-accordion">${itemsHTML}</div>`;
}

function buyButtonHTML(p) {
    const isPassagem = p.type === 'passagem_ida' || p.type === 'passagem_volta';
    const action = isPassagem ? 'consult-ticket' : 'book';
    const labelKey = isPassagem ? 'btn.consultar' : 'btn.adicionar';
    const labelText = isPassagem ? 'Consultar' : 'Adicionar';
    const icon = isPassagem ? 'arrow-right' : 'plus';
    const times = (p.departure_times && p.departure_times.length > 0)
        ? p.departure_times.join(',')
        : 'A combinar';
    const childPolicy = (p.child_discount != null && p.infant_max_age != null) ? ' data-child-policy="1"' : '';
    const fullprice = p.price_deposit ? ` data-fullprice="${p.price_full}"` : '';
    const price = p.price_deposit != null ? p.price_deposit : p.price_full;
    return `<button class="btn-buy" data-action="${action}" data-product="${escapeHTML(p.name)}" data-price="${price}" data-times="${escapeHTML(times)}"${fullprice}${childPolicy}>
        <span data-i18n="${labelKey}">${labelText}</span>
        <i data-lucide="${icon}"></i>
    </button>`;
}

function productCardHTML(p) {
    const prefix = PRODUCT_I18N_PREFIX[p.slug] || '';
    const nameAttr = prefix ? ` data-i18n="${prefix}.name"` : '';
    const descAttr = prefix ? ` data-i18n="${prefix}.desc"` : '';
    return `<div class="swiper-slide product-card">
        ${cardImageHTML(p)}
        <div class="card-content">
            <h3${nameAttr}>${escapeHTML(p.name)}</h3>
            <p${descAttr}>${escapeHTML(p.description || '')}</p>
            ${accordionHTML(p.accordion_data)}
            ${buyButtonHTML(p)}
        </div>
    </div>`;
}

async function fetchProducts() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
        const res = await fetch(`${API_BASE}/products`, { signal: ctrl.signal });
        if (!res.ok) return null;
        const data = await res.json();
        return Array.isArray(data.products) ? data.products : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

function renderInnerSwipers(rootEl) {
    rootEl.querySelectorAll('.inner-swiper').forEach(el => {
        if (el.dataset.swiperInited === '1') return;
        const pagEl = el.querySelector('.inner-pagination');
        new Swiper(el, {
            slidesPerView: 1,
            nested: true,
            pagination: pagEl ? { el: pagEl, clickable: true } : false
        });
        el.dataset.swiperInited = '1';
    });
}

function repopulateCarousel(swiper, products) {
    if (!swiper) return;
    // Limpa DOM diretamente (Swiper.removeAllSlides às vezes deixa
    // resíduos de slides que vieram do HTML inicial)
    const wrapper = swiper.el && swiper.el.querySelector('.swiper-wrapper');
    if (wrapper) {
        while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);
    }
    products.forEach(p => swiper.appendSlide(productCardHTML(p)));
    swiper.update();
}

async function applyDynamicProducts() {
    const products = await fetchProducts();
    if (!products) return;  // backend offline → mantém HTML estático

    const byType = {
        passeio: [],
        atividade: [],
        passagem_ida: [],
        passagem_volta: []
    };
    products.forEach(p => {
        if (byType[p.type]) byType[p.type].push(p);
    });
    Object.values(byType).forEach(arr => arr.sort((a, b) => a.sort_order - b.sort_order));

    repopulateCarousel(swiperPasseios, byType.passeio);
    repopulateCarousel(swiperAtividades, byType.atividade);
    repopulateCarousel(swiperIda, byType.passagem_ida);
    repopulateCarousel(swiperVolta, byType.passagem_volta);

    // Pós-render: i18n + ícones + inner swipers
    if (window.lucide) lucide.createIcons();
    if (typeof applyLocale === 'function') applyLocale(currentLocale);
    renderInnerSwipers(document.body);
}

// 1. EFEITO DO HEADER (Glassmorphism)
const header = document.querySelector('.glass-header');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// 1.1 UI UTILS — Toast, Confirm Dialog, Modal Stack (focus trap + Escape)
const toastEl = document.getElementById('toast');
let toastTimer = null;
function showToast(message, kind = 'info') {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.toggle('toast--error', kind === 'error');
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const modalStack = [];

function getFocusable(container) {
    return Array.from(container.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
}

function openOverlay(overlayEl) {
    if (!overlayEl || overlayEl.classList.contains('open')) return;
    const entry = { el: overlayEl, previousFocus: document.activeElement };
    modalStack.push(entry);
    overlayEl.classList.add('open');
    const focusables = getFocusable(overlayEl);
    if (focusables.length) focusables[0].focus();
}

function closeOverlay(overlayEl) {
    if (!overlayEl || !overlayEl.classList.contains('open')) return;
    overlayEl.classList.remove('open');
    const idx = modalStack.findIndex(e => e.el === overlayEl);
    if (idx !== -1) {
        const entry = modalStack.splice(idx, 1)[0];
        if (entry.previousFocus && typeof entry.previousFocus.focus === 'function') {
            entry.previousFocus.focus();
        }
    }
}

document.addEventListener('keydown', (e) => {
    if (modalStack.length === 0) return;
    const top = modalStack[modalStack.length - 1].el;

    if (e.key === 'Escape') {
        e.preventDefault();
        closeOverlay(top);
        return;
    }

    if (e.key === 'Tab') {
        const focusables = getFocusable(top);
        if (focusables.length === 0) { e.preventDefault(); return; }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }
});

const confirmDialogEl = document.getElementById('confirm-dialog');
const confirmDialogTitle = document.getElementById('confirm-dialog-title');
const confirmDialogText = document.getElementById('confirm-dialog-text');
const confirmDialogOk = document.getElementById('confirm-dialog-ok');
const confirmDialogCancel = document.getElementById('confirm-dialog-cancel');

function openConfirmDialog(title, message) {
    return new Promise((resolve) => {
        confirmDialogTitle.textContent = title;
        confirmDialogText.textContent = message;

        const finish = (result) => {
            confirmDialogOk.removeEventListener('click', onOk);
            confirmDialogCancel.removeEventListener('click', onCancel);
            confirmDialogEl.removeEventListener('click', onBackdrop);
            closeOverlay(confirmDialogEl);
            resolve(result);
        };
        const onOk = () => finish(true);
        const onCancel = () => finish(false);
        const onBackdrop = (e) => { if (e.target === confirmDialogEl) finish(false); };

        confirmDialogOk.addEventListener('click', onOk);
        confirmDialogCancel.addEventListener('click', onCancel);
        confirmDialogEl.addEventListener('click', onBackdrop);

        openOverlay(confirmDialogEl);
    });
}

// 2. SISTEMA DE SPA (Troca de Telas com SEO Dinâmico)
const navItems = document.querySelectorAll('.nav-item');
const spaViews = document.querySelectorAll('.spa-view');

let currentRoute = 'home';

function updateRouteMeta() {
    document.title = t(`route.${currentRoute}.title`);
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', t(`route.${currentRoute}.desc`));
}

function navigateTo(targetId, pushHistory = true) {
    spaViews.forEach(view => view.classList.remove('active'));

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if(link.dataset.target === targetId) link.classList.add('active');
    });

    const targetView = document.getElementById(`view-${targetId}`);
    if(targetView) {
        currentRoute = targetId;
        updateRouteMeta();

        targetView.classList.add('active');
        window.scrollTo(0,0);

        if (pushHistory) {
            history.pushState({ view: targetId }, '', `#${targetId}`);
        }

        header.classList.toggle('on-section', targetId !== 'home');

        if (targetId === 'passeios' && typeof swiperPasseios !== 'undefined') swiperPasseios.update();
        if (targetId === 'atividades' && typeof swiperAtividades !== 'undefined') swiperAtividades.update();
    }
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = item.dataset.target;
        navigateTo(target);
    });
});

window.addEventListener('popstate', (e) => {
    const targetId = e.state && e.state.view ? e.state.view : 'home';
    navigateTo(targetId, false);
});

// 2.1 MENU HAMBURGER (Mobile Navigation)
const hamburgerBtn = document.getElementById('hamburger-btn');
const mobileNav = document.getElementById('mobile-nav');
const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
const closeMobileNavBtn = document.getElementById('close-mobile-nav');

function toggleMobileNav() {
    mobileNav.classList.toggle('open');
    mobileNavOverlay.classList.toggle('open');
}

if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', toggleMobileNav);
}
if (closeMobileNavBtn) {
    closeMobileNavBtn.addEventListener('click', toggleMobileNav);
}
if (mobileNavOverlay) {
    mobileNavOverlay.addEventListener('click', toggleMobileNav);
}

// Fechar menu e navegar ao clicar nos links do mobile nav
if (mobileNav) {
    mobileNav.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.dataset.target;
            if (mobileNav.classList.contains('open')) {
                toggleMobileNav();
            }
            navigateTo(target);
        });
    });
}

// 3. SWIPER SLIDERS
const defaultSwiperOptions = {
    slidesPerView: 1.2,
    spaceBetween: 20,
    breakpoints: {
        640: { slidesPerView: 2.2 },
        1024: { slidesPerView: 3.2 }
    }
};

const swiperPasseios = new Swiper('#carousel-passeios', {
    ...defaultSwiperOptions,
    pagination: { el: '#carousel-passeios > .swiper-pagination', clickable: true }
});

const swiperAtividades = new Swiper('#carousel-atividades', {
    ...defaultSwiperOptions,
    pagination: { el: '#carousel-atividades > .swiper-pagination', clickable: true }
});

const swiperIda = new Swiper('#carousel-ida', {
    ...defaultSwiperOptions,
    pagination: { el: '#carousel-ida > .swiper-pagination', clickable: true }
});

const swiperVolta = new Swiper('#carousel-volta', {
    ...defaultSwiperOptions,
    pagination: { el: '#carousel-volta > .swiper-pagination', clickable: true }
});

// 3.1 TOGGLE IDA E VOLTA (Passagens) - Botão Único
const btnToggleRoute = document.getElementById('btn-toggle-route');
const carouselIda = document.getElementById('carousel-ida');
const carouselVolta = document.getElementById('carousel-volta');
let isShowingIda = true;

if (btnToggleRoute) {
    btnToggleRoute.addEventListener('click', () => {
        isShowingIda = !isShowingIda;
        const label = btnToggleRoute.querySelector('.toggle-label');
        carouselIda.classList.toggle('hidden', !isShowingIda);
        carouselVolta.classList.toggle('hidden', isShowingIda);
        if (label) {
            label.textContent = isShowingIda
                ? ' Trocar para: VOLTA (Salvador)'
                : ' Trocar para: IDA (Morro de SP)';
        }
        const activeSwiper = isShowingIda ? swiperIda : swiperVolta;
        if (activeSwiper) activeSwiper.update();
    });
}

document.querySelectorAll('.inner-swiper').forEach((el) => {
    const pagEl = el.querySelector('.inner-pagination');
    new Swiper(el, {
        slidesPerView: 1,
        nested: true,
        pagination: pagEl ? { el: pagEl, clickable: true } : false,
    });
});

// 4. SISTEMA DE CARRINHO DE COMPRAS
const cartBtn = document.querySelector('.cart-btn');
const closeCartBtn = document.querySelector('.close-cart');
const cartDrawer = document.querySelector('.cart-drawer');
const cartOverlay = document.querySelector('.cart-drawer-overlay');

const CART_TTL_MS = 24 * 60 * 60 * 1000;
let cart = [];
try {
    const raw = localStorage.getItem('voltaAilhaCart');
    if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
            const fresh = typeof parsed.ts === 'number' && (Date.now() - parsed.ts) < CART_TTL_MS;
            if (fresh) cart = parsed.items;
            else localStorage.removeItem('voltaAilhaCart');
        } else if (Array.isArray(parsed)) {
            // formato antigo (sem ts) — descarta
            localStorage.removeItem('voltaAilhaCart');
        }
    }
} catch(e) {
    console.error("Erro ao ler carrinho:", e);
}

document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`view-${hash}`)) {
        navigateTo(hash, false);
    } else {
        history.replaceState({ view: 'home' }, '', '#home');
    }
});

function toggleCart() {
    cartDrawer.classList.toggle('open');
    cartOverlay.classList.toggle('open');
}

cartBtn.addEventListener('click', toggleCart);
closeCartBtn.addEventListener('click', toggleCart);
cartOverlay.addEventListener('click', toggleCart);

// 5. SISTEMAS DE MODAIS
const bookingModal = document.getElementById('booking-modal');
const closeBookingBtn = document.getElementById('close-booking');
const confirmBookingBtn = document.getElementById('confirm-booking-btn');

let currentBookingProduct = null;
let currentBookingSlug = null;
let currentBookingPrice = 0;
let currentBookingFullPrice = 0;
let currentBookingChildPolicy = false;

function toSlug(name) {
    return name.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function openBookingModal(productName, price, timesArray, fullPrice = null, childPolicy = false) {
    currentBookingProduct = productName;
    currentBookingSlug = toSlug(productName);
    currentBookingPrice = parseFloat(price);
    currentBookingFullPrice = fullPrice ? parseFloat(fullPrice) : currentBookingPrice;
    currentBookingChildPolicy = !!childPolicy;

    document.getElementById('booking-title').textContent = productName;

    const childGroup = document.getElementById('booking-children-group');
    if (childGroup) childGroup.hidden = !currentBookingChildPolicy;
    document.getElementById('booking-babies').value = 0;
    document.getElementById('booking-kids').value = 0;
    
    const displayEl = document.getElementById('booking-price-display');
    while (displayEl.firstChild) displayEl.removeChild(displayEl.firstChild);
    if (currentBookingFullPrice > currentBookingPrice) {
        const totalSpan = document.createElement('span');
        totalSpan.className = 'price-full';
        totalSpan.textContent = 'Valor Total: ' + BRL.format(currentBookingFullPrice);
        const br = document.createElement('br');
        const signalSpan = document.createElement('span');
        signalSpan.className = 'price-signal';
        signalSpan.textContent = 'Sinal para Reserva: ' + BRL.format(currentBookingPrice) + ' / pessoa';
        displayEl.appendChild(totalSpan);
        displayEl.appendChild(br);
        displayEl.appendChild(signalSpan);
    } else {
        displayEl.textContent = BRL.format(currentBookingPrice) + ' por pessoa';
    }
    
    document.getElementById('booking-qty').value = 1;
    recalcBookingTotal();
    
    const timeSelect = document.getElementById('booking-time');
    while (timeSelect.firstChild) timeSelect.removeChild(timeSelect.firstChild);
    
    if (timesArray && timesArray.length > 0) {
        document.getElementById('booking-time-group').style.display = 'block';
        timesArray.forEach(time => {
            const opt = document.createElement('option');
            opt.value = time;
            opt.textContent = time;
            timeSelect.appendChild(opt);
        });
    } else {
        document.getElementById('booking-time-group').style.display = 'none';
        const fallbackOpt = document.createElement('option');
        fallbackOpt.value = 'A combinar';
        fallbackOpt.textContent = 'A combinar pelo WhatsApp';
        timeSelect.appendChild(fallbackOpt);
    }

    document.getElementById('booking-date').value = '';
    showBookingStep(1);
    openOverlay(bookingModal);
}

if(closeBookingBtn) {
    closeBookingBtn.addEventListener('click', () => {
        closeOverlay(bookingModal);
    });
}

// 5.1 SISTEMA DE MODAL TERCEIRIZADO (TICKETS/PASSAGENS)
// Aceita data-times (CSV de horários) e data-price (preço unitário) dos botões HTML
const ticketModal = document.getElementById('ticket-modal');
const closeTicketBtn = document.getElementById('close-ticket-modal');
const confirmTicketBtn = document.getElementById('confirm-ticket-btn');

let currentTicketProduct = null;
let currentTicketPrice = 0;
let currentTicketTimes = [];
let currentTicketChildPolicy = false;

function openTicketModal(productName, price, timesArray, childPolicy = false) {
    currentTicketProduct = productName;
    currentTicketPrice = parseFloat(price) || 0;
    currentTicketTimes = timesArray || [];
    currentTicketChildPolicy = !!childPolicy;

    document.getElementById('ticket-product-display').textContent = productName;
    document.getElementById('ticket-price-unit').textContent = currentTicketPrice;

    const childGroup = document.getElementById('ticket-children-group');
    if (childGroup) childGroup.hidden = !currentTicketChildPolicy;
    document.getElementById('ticket-babies').value = 0;
    document.getElementById('ticket-kids').value = 0;
    
    const timeSelect = document.getElementById('ticket-time');
    // Limpar opções existentes sem innerHTML
    while (timeSelect.firstChild) { timeSelect.removeChild(timeSelect.firstChild); }
    
    if (currentTicketTimes.length > 0) {
        document.getElementById('ticket-time-group').style.display = 'block';
        currentTicketTimes.forEach(time => {
            const opt = document.createElement('option');
            opt.value = time;
            opt.textContent = time;
            timeSelect.appendChild(opt);
        });
    } else {
        document.getElementById('ticket-time-group').style.display = 'none';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'A combinar pelo WhatsApp';
        timeSelect.appendChild(opt);
    }

    document.getElementById('ticket-qty').value = 1;
    recalcTicketTotal();
    document.getElementById('ticket-date').value = '';
    if(ticketModal) openOverlay(ticketModal);
}

if(closeTicketBtn) {
    closeTicketBtn.addEventListener('click', () => {
        closeOverlay(ticketModal);
    });
}

// INICIALIZADORES DO FLATPICKR (Calendários)
function getBrazilToday() {
    const now = new Date();
    const brazilStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Bahia' }); 
    const [y, m, d] = brazilStr.split('-').map(Number);
    return new Date(y, m - 1, d); 
}

if(document.getElementById('booking-date')) {
    flatpickr("#booking-date", {
        minDate: getBrazilToday(),
        dateFormat: "d/m/Y",
        locale: "pt",
        disableMobile: true,
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 0) return;
            const today = getBrazilToday();
            const selected = selectedDates[0];
            
            if (selected.getTime() === today.getTime()) {
                const brTimeStr = new Date().toLocaleString("en-US", {timeZone: "America/Bahia", hour12: false});
                const brTime = new Date(brTimeStr);
                const hours = brTime.getHours();
                const minutes = brTime.getMinutes();
                
                if (hours > 8 || (hours === 8 && minutes >= 30)) {
                    instance.clear();
                    openOverlay(document.getElementById('urgent-modal'));
                }
            }
        }
    });

    const closeUrgentBtn = document.getElementById('close-urgent');
    if (closeUrgentBtn) {
        closeUrgentBtn.addEventListener('click', () => {
            closeOverlay(document.getElementById('urgent-modal'));
        });
    }
}

// Flatpickr para Passagens (Sem regra de bloqueio 08h30 pois é consultivo no ZAP)
if(document.getElementById('ticket-date')) {
    flatpickr("#ticket-date", {
        minDate: getBrazilToday(),
        dateFormat: "d/m/Y",
        locale: "pt",
        disableMobile: true,
        onOpen: function(selectedDates, dateStr, instance) {
            instance.calendarContainer.classList.add('flatpickr-blue');
        }
    });
}

function bookingPax() {
    return {
        adults: parseInt(document.getElementById('booking-qty').value) || 0,
        kids: parseInt(document.getElementById('booking-kids').value) || 0,
        babies: parseInt(document.getElementById('booking-babies').value) || 0
    };
}
function ticketPax() {
    return {
        adults: parseInt(document.getElementById('ticket-qty').value) || 0,
        kids: parseInt(document.getElementById('ticket-kids').value) || 0,
        babies: parseInt(document.getElementById('ticket-babies').value) || 0
    };
}

function fmtNum(n) {
    return n.toFixed(2).replace(/\.00$/, '').replace('.', ',');
}
function recalcBookingTotal() {
    const p = bookingPax();
    const total = p.adults * currentBookingPrice + p.kids * currentBookingPrice * 0.5;
    document.getElementById('booking-total').textContent = fmtNum(total);
}
function recalcTicketTotal() {
    const p = ticketPax();
    const total = p.adults * currentTicketPrice + p.kids * currentTicketPrice * 0.5;
    document.getElementById('ticket-total').textContent = fmtNum(total);
}

function changeQty(delta, target) {
    target = target || 'adults';
    const idMap = { adults: 'booking-qty', kids: 'booking-kids', babies: 'booking-babies' };
    const input = document.getElementById(idMap[target]);
    if (!input) return;
    let newVal = parseInt(input.value) + delta;
    const min = target === 'adults' ? 1 : 0;
    if (newVal < min) newVal = min;
    input.value = newVal;
    recalcBookingTotal();
}

function changeTicketQty(delta, target) {
    target = target || 'adults';
    const idMap = { adults: 'ticket-qty', kids: 'ticket-kids', babies: 'ticket-babies' };
    const input = document.getElementById(idMap[target]);
    if (!input) return;
    let newVal = parseInt(input.value) + delta;
    const min = target === 'adults' ? 1 : 0;
    if (newVal < min) newVal = min;
    input.value = newVal;
    recalcTicketTotal();
}

// ── Step 1 → Step 2 (dados do responsável) ──
const bookingStep1 = document.querySelector('#booking-modal .booking-modal-content > *:not(.booking-modal-step)');
const bookingStep2 = document.getElementById('booking-step-2');
const bookingBackBtn = document.getElementById('booking-back-btn');
const payBookingBtn = document.getElementById('pay-booking-btn');
const countrySelect = document.getElementById('booking-country-code');

function showBookingStep(n) {
    const s2 = document.getElementById('booking-step-2');
    const content = bookingModal.querySelector('.booking-modal-content');
    if (!content) return;
    Array.from(content.children).forEach(el => {
        if (el.classList.contains('close-modal')) return; // sempre visível
        if (el.id === 'booking-step-2') {
            el.hidden = (n !== 2);
        } else {
            el.hidden = (n !== 1);
        }
    });
    if (n === 2) lucide.createIcons();
}

function buildStep2Summary() {
    const date = document.getElementById('booking-date').value;
    const time = document.getElementById('booking-time').value;
    const pax = bookingPax();
    const parts = [`${currentBookingProduct}`, `📅 ${date}`];
    if (time && time !== 'A combinar' && time !== '') parts.push(`🕐 ${time}`);
    const paxParts = [`${pax.adults} adulto${pax.adults > 1 ? 's' : ''}`];
    if (pax.kids > 0) paxParts.push(`${pax.kids} criança${pax.kids > 1 ? 's' : ''}`);
    if (pax.babies > 0) paxParts.push(`${pax.babies} bebê${pax.babies > 1 ? 's' : ''}`);
    parts.push(`👥 ${paxParts.join(', ')}`);
    const total = parseFloat(document.getElementById('booking-total').textContent.replace(',', '.'));
    parts.push(`💳 Sinal: ${BRL.format(total)}`);
    document.getElementById('booking-step2-summary').textContent = parts.join(' · ');
}

function updateEmailRequired() {
    if (!countrySelect) return;
    const isBR = countrySelect.value === '+55';
    const mark = document.getElementById('booking-email-required-mark');
    const emailInput = document.getElementById('booking-email');
    if (mark) mark.style.display = isBR ? 'none' : 'inline';
    if (emailInput) emailInput.required = !isBR;
}

if (countrySelect) {
    countrySelect.addEventListener('change', updateEmailRequired);
    updateEmailRequired();
}

if (confirmBookingBtn) {
    confirmBookingBtn.addEventListener('click', () => {
        const date = document.getElementById('booking-date').value;
        if (!date) { showToast(t('toast.select_date'), 'error'); return; }
        buildStep2Summary();
        showBookingStep(2);
        updateEmailRequired();
    });
}

if (bookingBackBtn) {
    bookingBackBtn.addEventListener('click', () => showBookingStep(1));
}

// ── Step 2 → POST /v1/reservations → redirect MP ──
function parseDateBR(dateBR) {
    const [d, m, y] = dateBR.split('/');
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

if (payBookingBtn) {
    payBookingBtn.addEventListener('click', async () => {
        const name = document.getElementById('booking-name').value.trim();
        const whatsappNum = document.getElementById('booking-whatsapp').value.trim().replace(/\D/g, '');
        const countryCode = countrySelect ? countrySelect.value : '+55';
        const email = document.getElementById('booking-email').value.trim();
        const isBR = countryCode === '+55';

        if (!name || name.length < 2) {
            showToast('Informe seu nome completo', 'error'); return;
        }
        if (!whatsappNum || whatsappNum.length < 7) {
            showToast('Informe um WhatsApp válido', 'error'); return;
        }
        if (!isBR && !email) {
            showToast('E-mail obrigatório para clientes internacionais', 'error'); return;
        }

        const whatsapp = countryCode + whatsappNum;
        const dateBR = document.getElementById('booking-date').value;
        const travelDate = parseDateBR(dateBR);
        const departureTime = document.getElementById('booking-time').value || 'A combinar';
        const pax = bookingPax();

        const payload = {
            customer: { name, whatsapp, ...(email ? { email } : {}) },
            items: [{
                product_slug: currentBookingSlug,
                travel_date: travelDate,
                departure_time: departureTime,
                qty_adults: pax.adults,
                qty_children: pax.kids,
                qty_infants: pax.babies
            }],
            return_urls: {
                success: 'https://voltaailha.com.br/sucesso.html',
                failure: 'https://voltaailha.com.br/falha.html',
                pending: 'https://voltaailha.com.br/pendente.html'
            }
        };

        payBookingBtn.disabled = true;
        payBookingBtn.querySelector('span').textContent = 'Processando…';

        try {
            const res = await fetch(`${API_BASE}/reservations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.message || 'Erro ao processar reserva', 'error');
                payBookingBtn.disabled = false;
                payBookingBtn.querySelector('span').textContent = t('booking.pay_btn') || 'Pagar Sinal com Segurança';
                return;
            }
            window.location.href = data.sandbox_init_point || data.init_point;
        } catch (err) {
            showToast('Erro de conexão. Tente novamente.', 'error');
            payBookingBtn.disabled = false;
            payBookingBtn.querySelector('span').textContent = t('booking.pay_btn') || 'Pagar Sinal com Segurança';
        }
    });
}

// Whatsapp Generator Inteligente e Dinâmico
const WHATSAPP_NUMBER = '5575998240043';

function waLanguageHeader() {
    if (currentLocale === 'pt-BR') return '';
    const names = { 'en': 'English', 'es': 'Español', 'fr': 'Français', 'it': 'Italiano', 'de': 'Deutsch', 'he': 'עברית' };
    return `🌐 *Idioma do cliente:* ${names[currentLocale] || currentLocale}\n\n`;
}

// 4.X Finalizar Reserva — envia o carrinho para o WhatsApp
const checkoutBtn = document.querySelector('.checkout-btn');
if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) return;

        let msg = waLanguageHeader();
        msg += `Olá! Gostaria de finalizar a reserva dos itens abaixo:\n\n`;
        let total = 0;
        cart.forEach((item, i) => {
            total += item.price;
            msg += `${i + 1}. ${item.name}\n   Sinal: ${BRL.format(item.price)}\n\n`;
        });
        msg += `💰 *TOTAL DO SINAL:* ${BRL.format(total)}\n\n`;
        msg += `Aguardo confirmação de disponibilidade e o link de pagamento.`;

        const encMsg = encodeURIComponent(msg);
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encMsg}`, '_blank', 'noopener,noreferrer');
    });
}

if(confirmTicketBtn) {
    confirmTicketBtn.addEventListener('click', () => {
        const date = document.getElementById('ticket-date').value;
        const selectEl = document.getElementById('ticket-time');
        const pax = ticketPax();

        if (!date) {
            showToast(t('toast.select_date_ticket'), 'error');
            return;
        }

        const selectedTime = selectEl.value || 'Sob Consulta';
        const total = pax.adults * currentTicketPrice + pax.kids * currentTicketPrice * 0.5;
        const totalFmt = fmtNum(total);

        let paxLine = `${pax.adults} adulto${pax.adults > 1 ? 's' : ''}`;
        if (pax.kids > 0) paxLine += `, ${pax.kids} criança${pax.kids > 1 ? 's' : ''} (6-9, 50%)`;
        if (pax.babies > 0) paxLine += `, ${pax.babies} bebê${pax.babies > 1 ? 's' : ''} (0-5, grátis)`;

        let msg = waLanguageHeader();
        msg += `Olá! Gostaria de consultar a disponibilidade e reservar:\n\n`;
        msg += `🚍 *TICKET:* ${currentTicketProduct}\n`;
        msg += `📅 *DATA:* ${date}\n`;
        msg += `⏰ *HORÁRIO:* ${selectedTime}\n`;
        msg += `👥 *PASSAGEIROS:* ${paxLine}\n`;
        msg += `💰 *VALOR TOTAL APROX.*: R$ ${totalFmt}\n\n`;
        msg += `Aguardo instruções e o link de pagamento!`;

        const encMsg = encodeURIComponent(msg);
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encMsg}`, '_blank', 'noopener,noreferrer');
        closeOverlay(ticketModal);
    });
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function updateCartUI() {
    if (cart.length === 0) {
        localStorage.removeItem('voltaAilhaCart');
    } else {
        localStorage.setItem('voltaAilhaCart', JSON.stringify({ ts: Date.now(), items: cart }));
    }
    const badgeEl = document.querySelector('.cart-badge');
    badgeEl.textContent = cart.length;
    if(cart.length === 0) {
        badgeEl.style.display = 'none';
    } else {
        badgeEl.style.display = 'flex';
    }

    const container = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total-value');

    while (container.firstChild) container.removeChild(container.firstChild);

    if(cart.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-cart-msg';
        emptyMsg.textContent = 'Seu carrinho está vazio.';
        container.appendChild(emptyMsg);
        totalEl.textContent = BRL.format(0);
        return;
    }

    let total = 0;
    cart.forEach((item, index) => {
        total += item.price;

        const row = document.createElement('div');
        row.className = 'cart-item-row';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'cart-item-info';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'cart-item-name';
        nameDiv.textContent = item.name;

        const priceDiv = document.createElement('strong');
        priceDiv.className = 'cart-item-price';
        priceDiv.textContent = BRL.format(item.price);

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(priceDiv);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'cart-item-remove';
        removeBtn.setAttribute('data-action', 'remove-cart-item');
        removeBtn.setAttribute('data-index', index);
        removeBtn.title = 'Remover item';
        const trashIcon = document.createElement('i');
        trashIcon.setAttribute('data-lucide', 'trash-2');
        trashIcon.className = 'icon-trash';
        removeBtn.appendChild(trashIcon);

        row.appendChild(infoDiv);
        row.appendChild(removeBtn);
        container.appendChild(row);
    });

    if (window.lucide) {
        lucide.createIcons({root: container});
    }

    totalEl.textContent = BRL.format(total);
}

async function removeFromCart(index) {
    const ok = await openConfirmDialog(t('confirm.remove_title'), t('confirm.remove_text'));
    if (ok) {
        cart.splice(index, 1);
        updateCartUI();
    }
}

function toggleAccordion(header) {
    const item = header.parentElement;
    const body = header.nextElementSibling;
    
    if (item.classList.contains('active')) {
        item.classList.remove('active');
        body.style.maxHeight = null;
    } else {
        const parentAccordion = item.closest('.custom-accordion');
        if (parentAccordion) {
            parentAccordion.querySelectorAll('.accordion-item.active').forEach(activeItem => {
                activeItem.classList.remove('active');
                activeItem.querySelector('.accordion-body').style.maxHeight = null;
            });
        }
        item.classList.add('active');
        body.style.maxHeight = body.scrollHeight + "px";
    }
}

// 6. EVENT DELEGATION
document.addEventListener('click', (e) => {
    // 6.1 Tratamento do Clique em Comprar/Reservar (Passeios)
    const bookBtn = e.target.closest('[data-action="book"]');
    if (bookBtn) {
        const product = bookBtn.getAttribute('data-product');
        const price = bookBtn.getAttribute('data-price');
        const timesStr = bookBtn.getAttribute('data-times');
        const fullprice = bookBtn.getAttribute('data-fullprice');
        const childPolicy = bookBtn.getAttribute('data-child-policy') === '1';

        const times = timesStr ? timesStr.split(',') : [];
        openBookingModal(product, price, times, fullprice, childPolicy);
    }

    // 6.2 Tratamento de Consultas WhatsApp (Passagens)
    const consultBtn = e.target.closest('[data-action="consult-ticket"]');
    if (consultBtn) {
        const product = consultBtn.getAttribute('data-product');
        const price = consultBtn.getAttribute('data-price');
        const timesStr = consultBtn.getAttribute('data-times');
        const childPolicy = consultBtn.getAttribute('data-child-policy') === '1';
        const times = timesStr ? timesStr.split(',') : [];
        openTicketModal(product, price, times, childPolicy);
    }

    // 6.3 Tratamento de alterar quantidade
    const changeQtyBtn = e.target.closest('[data-action="change-qty"]');
    if (changeQtyBtn) {
        changeQty(parseInt(changeQtyBtn.getAttribute('data-delta')), changeQtyBtn.getAttribute('data-target'));
    }

    const changeTicketQtyBtn = e.target.closest('[data-action="change-ticket-qty"]');
    if (changeTicketQtyBtn) {
        changeTicketQty(parseInt(changeTicketQtyBtn.getAttribute('data-delta')), changeTicketQtyBtn.getAttribute('data-target'));
    }
    
    // 6.4 Remoção do Carrinho
    const removeBtn = e.target.closest('[data-action="remove-cart-item"]');
    if (removeBtn) {
        removeFromCart(parseInt(removeBtn.getAttribute('data-index')));
    }
    
    // 6.5 Acordeões
    const accordionHeader = e.target.closest('[data-action="accordion"]');
    if (accordionHeader) {
        toggleAccordion(accordionHeader);
    }
});

// 7. APLICA LOCALE INICIAL
applyLocale(detectLocale());

// 8. CARREGA PRODUTOS DINÂMICOS (overlay sobre HTML estático)
applyDynamicProducts();

})(); // Fim da IIFE
