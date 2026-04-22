// 🛡️ ENCAPSULAMENTO DE SEGURANÇA (IIFE)
// Previne vazamento de variáveis, colisões de escopo e limpa a Window.
(() => {

// 0. INICIALIZAÇÃO DE ÍCONES (movido do HTML inline para dentro da IIFE)
if (window.lucide) lucide.createIcons();

// 1. EFEITO DO HEADER (Glassmorphism)
const header = document.querySelector('.glass-header');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// 2. SISTEMA DE SPA (Troca de Telas com SEO Dinâmico)
const navItems = document.querySelectorAll('.nav-item');
const spaViews = document.querySelectorAll('.spa-view');

const routeMeta = {
    'home': { 
        title: 'Volta à Ilha | Agência de Turismo em Morro de São Paulo', 
        desc: 'A melhor agência de turismo de Morro de São Paulo. Reserve agora seus passeios, transfers e passagens com segurança e facilidade.' 
    },
    'passeios': {
        title: 'Passeios e Reservas | Volta à Ilha',
        desc: 'Conheça os melhores roteiros: Volta à Ilha, Garapuá 4X4, Gamboa e Quadriciclo. Agende online.'
    },
    'atividades': {
        title: 'Atividades em Morro de São Paulo | Volta à Ilha',
        desc: 'Mergulho, cavalgada, tiroleza, banana boat, bike aquática e aluguel de bicicletas. Reserve sua atividade.'
    },
    'passagens': {
        title: 'Transfers e Passagens (Catamarã) | Volta à Ilha', 
        desc: 'Compre ingressos para transfer semi-terrestre ou catamarã para Morro de São Paulo com segurança e pontualidade.' 
    }
};

function navigateTo(targetId, pushHistory = true) {
    spaViews.forEach(view => view.classList.remove('active'));
    
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if(link.dataset.target === targetId) link.classList.add('active');
    });

    const targetView = document.getElementById(`view-${targetId}`);
    if(targetView) {
        if (routeMeta[targetId]) {
            document.title = routeMeta[targetId].title;
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) metaDesc.setAttribute('content', routeMeta[targetId].desc);
        }

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

let cart = [];
try {
    const savedCart = localStorage.getItem('voltaAilhaCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
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
let currentBookingPrice = 0;
let currentBookingFullPrice = 0;
let currentBookingChildPolicy = false;

function openBookingModal(productName, price, timesArray, fullPrice = null, childPolicy = false) {
    currentBookingProduct = productName;
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
    bookingModal.classList.add('open');
}

if(closeBookingBtn) {
    closeBookingBtn.addEventListener('click', () => {
        bookingModal.classList.remove('open');
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
    if(ticketModal) ticketModal.classList.add('open');
}

if(closeTicketBtn) {
    closeTicketBtn.addEventListener('click', () => {
        ticketModal.classList.remove('open');
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
                    document.getElementById('urgent-modal').classList.add('open');
                }
            }
        }
    });

    const closeUrgentBtn = document.getElementById('close-urgent');
    if (closeUrgentBtn) {
        closeUrgentBtn.addEventListener('click', () => {
            document.getElementById('urgent-modal').classList.remove('open');
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

if(confirmBookingBtn) {
    confirmBookingBtn.addEventListener('click', () => {
        const date = document.getElementById('booking-date').value;
        const time = document.getElementById('booking-time').value;
        const pax = bookingPax();

        if (!date) {
            alert("Por favor, selecione uma data.");
            return;
        }

        const paxParts = [`${pax.adults} adulto${pax.adults > 1 ? 's' : ''}`];
        if (pax.kids > 0) paxParts.push(`${pax.kids} criança${pax.kids > 1 ? 's' : ''} (6-9)`);
        if (pax.babies > 0) paxParts.push(`${pax.babies} bebê${pax.babies > 1 ? 's' : ''} (0-5)`);

        let detailStr = `(Data: ${date}`;
        if (time !== 'A combinar' && time !== '') {
            detailStr += ` - ${time}`;
        }
        detailStr += ` | ${paxParts.join(', ')}`;

        if (currentBookingFullPrice > currentBookingPrice) {
            const restAdult = (currentBookingFullPrice - currentBookingPrice) * pax.adults;
            const restKid = (currentBookingFullPrice - currentBookingPrice) * 0.5 * pax.kids;
            const restante = restAdult + restKid;
            detailStr += ` | Pagar no embarque: R$ ${fmtNum(restante)}`;
        }
        detailStr += `)`;

        const finalProductName = `${currentBookingProduct} ${detailStr}`;
        const finalPrice = currentBookingPrice * pax.adults + currentBookingPrice * 0.5 * pax.kids;

        cart.push({ name: finalProductName, price: finalPrice });
        updateCartUI();

        bookingModal.classList.remove('open');
        toggleCart();
    });
}

// Whatsapp Generator Inteligente e Dinâmico
const WHATSAPP_NUMBER = '5575998240043';

if(confirmTicketBtn) {
    confirmTicketBtn.addEventListener('click', () => {
        const date = document.getElementById('ticket-date').value;
        const selectEl = document.getElementById('ticket-time');
        const pax = ticketPax();

        if (!date) {
            alert("Por favor, selecione uma data para embarque.");
            return;
        }

        const selectedTime = selectEl.value || 'Sob Consulta';
        const total = pax.adults * currentTicketPrice + pax.kids * currentTicketPrice * 0.5;
        const totalFmt = fmtNum(total);

        let paxLine = `${pax.adults} adulto${pax.adults > 1 ? 's' : ''}`;
        if (pax.kids > 0) paxLine += `, ${pax.kids} criança${pax.kids > 1 ? 's' : ''} (6-9, 50%)`;
        if (pax.babies > 0) paxLine += `, ${pax.babies} bebê${pax.babies > 1 ? 's' : ''} (0-5, grátis)`;

        let msg = `Olá! Gostaria de consultar a disponibilidade e reservar:\n\n`;
        msg += `🚍 *TICKET:* ${currentTicketProduct}\n`;
        msg += `📅 *DATA:* ${date}\n`;
        msg += `⏰ *HORÁRIO:* ${selectedTime}\n`;
        msg += `👥 *PASSAGEIROS:* ${paxLine}\n`;
        msg += `💰 *VALOR TOTAL APROX.*: R$ ${totalFmt}\n\n`;
        msg += `Aguardo instruções e o link de pagamento!`;

        const encMsg = encodeURIComponent(msg);
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encMsg}`, '_blank', 'noopener,noreferrer');
        ticketModal.classList.remove('open');
    });
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function updateCartUI() {
    localStorage.setItem('voltaAilhaCart', JSON.stringify(cart));
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

function removeFromCart(index) {
    if (confirm("Deseja remover este item do carrinho?")) {
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

})(); // Fim da IIFE
