// 🛡️ ENCAPSULAMENTO DE SEGURANÇA (IIFE)
// Previne vazamento de variáveis, colisões de escopo e limpa a Window.
(() => {

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
        desc: 'Conheça os melhores roteiros: Passeio Volta à Ilha, Mergulho, Quadriciclo e mais. Agende online.' 
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
        
        if(targetId !== 'home') {
            header.style.background = 'white';
            header.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.05)';
            document.querySelectorAll('.nav-links a, .cart-btn').forEach(el => el.style.color = 'var(--text-main)');
        } else {
            header.style = '';
            document.querySelectorAll('.nav-links a, .cart-btn').forEach(el => el.style = '');
        }
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

// 3. SWIPER SLIDERS
const defaultSwiperOptions = {
    slidesPerView: 1.2,
    spaceBetween: 20,
    breakpoints: {
        640: { slidesPerView: 2.2 },
        1024: { slidesPerView: 3.2 }
    }
};

const swiperPasseios = new Swiper('#view-passeios .product-slider', {
    ...defaultSwiperOptions,
    pagination: { el: '#view-passeios .product-slider > .swiper-pagination', clickable: true }
});

const swiperIda = new Swiper('#carousel-ida', {
    ...defaultSwiperOptions,
    pagination: { el: '#carousel-ida > .swiper-pagination', clickable: true }
});

const swiperVolta = new Swiper('#carousel-volta', {
    ...defaultSwiperOptions,
    pagination: { el: '#carousel-volta > .swiper-pagination', clickable: true }
});

// 3.1 TOGGLE IDA E VOLTA (Passagens)
const btnToggleIda = document.getElementById('btn-toggle-ida');
const btnToggleVolta = document.getElementById('btn-toggle-volta');
const carouselIda = document.getElementById('carousel-ida');
const carouselVolta = document.getElementById('carousel-volta');

if (btnToggleIda && btnToggleVolta) {
    btnToggleIda.addEventListener('click', () => {
        btnToggleIda.classList.add('active');
        btnToggleVolta.classList.remove('active');
        carouselIda.style.display = 'block';
        carouselVolta.style.display = 'none';
        if (swiperIda) swiperIda.update(); 
    });

    btnToggleVolta.addEventListener('click', () => {
        btnToggleVolta.classList.add('active');
        btnToggleIda.classList.remove('active');
        carouselVolta.style.display = 'block';
        carouselIda.style.display = 'none';
        if (swiperVolta) swiperVolta.update();
    });
}

const innerSwipers = new Swiper('.inner-swiper', {
    slidesPerView: 1,
    nested: true, 
    pagination: {
        el: '.inner-pagination',
        clickable: true,
    },
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

function openBookingModal(productName, price, timesArray, fullPrice = null) {
    currentBookingProduct = productName;
    currentBookingPrice = parseFloat(price);
    currentBookingFullPrice = fullPrice ? parseFloat(fullPrice) : currentBookingPrice;
    
    document.getElementById('booking-title').textContent = productName;
    
    const displayEl = document.getElementById('booking-price-display');
    if (fullPrice && fullPrice > price) {
        displayEl.innerHTML = `<span style="color:#666; font-size:0.9rem;">Valor Total: R$ ${fullPrice}</span><br><span style="color:var(--primary-color); font-weight: bold;">Sinal para Reserva: R$ ${price} / pessoa</span>`;
    } else {
        displayEl.textContent = `R$ ${price} por pessoa`;
    }
    
    document.getElementById('booking-qty').value = 1;
    document.getElementById('booking-total').textContent = price;
    
    const timeSelect = document.getElementById('booking-time');
    timeSelect.innerHTML = '';
    
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
        timeSelect.innerHTML = '<option value="A combinar">A combinar pelo WhatsApp</option>';
    }

    document.getElementById('booking-date').value = '';
    bookingModal.classList.add('open');
}

if(closeBookingBtn) {
    closeBookingBtn.addEventListener('click', () => {
        bookingModal.classList.remove('open');
    });
}

// 5.1 SISTEMA DE MODAL TERCEIRIZADO DINÂMICO (TICKETS/PASSAGENS)
const ticketModal = document.getElementById('ticket-modal');
const closeTicketBtn = document.getElementById('close-ticket-modal');
const confirmTicketBtn = document.getElementById('confirm-ticket-btn');

let currentTicketProduct = null;
let currentTicketPrice = 0;
let currentTicketRoutes = []; 

function openTicketModal(productName, routesJSON) {
    currentTicketProduct = productName;
    document.getElementById('ticket-product-display').textContent = productName;
    
    // Decodifica JSON
    try {
        currentTicketRoutes = JSON.parse(routesJSON);
    } catch(e) {
        currentTicketRoutes = [];
        console.error("Erro ao ler JSON de rotas", e);
    }
    
    const timeSelect = document.getElementById('ticket-time');
    timeSelect.innerHTML = '';
    
    if (currentTicketRoutes && currentTicketRoutes.length > 0) {
        document.getElementById('ticket-time-group').style.display = 'block';
        currentTicketRoutes.forEach((route, index) => {
            const opt = document.createElement('option');
            opt.value = index; // O valor será o índice do array JS centralizado
            opt.textContent = `${route.name} — R$ ${route.price},00`;
            timeSelect.appendChild(opt);
        });
        
        currentTicketPrice = parseFloat(currentTicketRoutes[0].price);
        document.getElementById('ticket-price-unit').textContent = currentTicketPrice;
    } else {
        document.getElementById('ticket-time-group').style.display = 'none';
        timeSelect.innerHTML = '<option value="">A combinar pelo WhatsApp</option>';
        currentTicketPrice = 0;
        document.getElementById('ticket-price-unit').textContent = "0";
    }

    document.getElementById('ticket-qty').value = 1;
    document.getElementById('ticket-total').textContent = currentTicketPrice;
    
    document.getElementById('ticket-date').value = '';
    if(ticketModal) ticketModal.classList.add('open');
}

// Escutador Reativo do Dropdown de Rotas
const ticketTimeSelect = document.getElementById('ticket-time');
if(ticketTimeSelect) {
    ticketTimeSelect.addEventListener('change', (e) => {
        const index = e.target.value;
        if(currentTicketRoutes[index]) {
            currentTicketPrice = parseFloat(currentTicketRoutes[index].price);
            document.getElementById('ticket-price-unit').textContent = currentTicketPrice;
            changeTicketQty(0); // Truque chamando a si mesmo em delta zero pra forçar o Recálculo do Span HTML
        }
    });
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
        disableMobile: true
    });
}

function changeQty(delta) {
    const input = document.getElementById('booking-qty');
    let newVal = parseInt(input.value) + delta;
    if (newVal < 1) newVal = 1;
    input.value = newVal;
    
    document.getElementById('booking-total').textContent = newVal * currentBookingPrice;
}

function changeTicketQty(delta) {
    const input = document.getElementById('ticket-qty');
    let newVal = parseInt(input.value) + delta;
    if (newVal < 1) newVal = 1;
    input.value = newVal;
    
    document.getElementById('ticket-total').textContent = newVal * currentTicketPrice;
}

if(confirmBookingBtn) {
    confirmBookingBtn.addEventListener('click', () => {
        const date = document.getElementById('booking-date').value;
        const time = document.getElementById('booking-time').value;
        const qty = parseInt(document.getElementById('booking-qty').value);
        
        if (!date) {
            alert("Por favor, selecione uma data.");
            return;
        }
        
        let detailStr = `(Data: ${date}`;
        if (time !== 'A combinar' && time !== '') {
            detailStr += ` - ${time}`;
        }
        if (currentBookingFullPrice > currentBookingPrice) {
            let restante = (currentBookingFullPrice - currentBookingPrice) * qty;
            detailStr += ` | Pagar no embarque: R$ ${restante}`;
        }
        detailStr += `) [x${qty}]`;
        
        const finalProductName = `${currentBookingProduct} ${detailStr}`;
        const finalPrice = currentBookingPrice * qty;
        
        cart.push({ name: finalProductName, price: finalPrice });
        updateCartUI();
        
        bookingModal.classList.remove('open');
        toggleCart();
    });
}

// Whatsapp Generator Inteligente e Dinâmico
if(confirmTicketBtn) {
    confirmTicketBtn.addEventListener('click', () => {
        const date = document.getElementById('ticket-date').value;
        const selectEl = document.getElementById('ticket-time');
        const qty = parseInt(document.getElementById('ticket-qty').value);
        
        if (!date) {
            alert("Por favor, selecione uma data para embarque.");
            return;
        }
        
        let routeName = "Sob Consulta";
        let routePrice = 0;
        const indexVal = selectEl.value;
        if (currentTicketRoutes[indexVal]) {
            routeName = currentTicketRoutes[indexVal].name;
            routePrice = currentTicketRoutes[indexVal].price;
        }
        
        const total = qty * routePrice;
        
        let msg = `Olá! Gostaria de consultar a disponibilidade e reservar:\n\n`;
        msg += `🚍 *TICKET:* ${currentTicketProduct}\n`;
        msg += `📅 *DATA:* ${date}\n`;
        msg += `⏰ *ROTA/HORÁRIO:* ${routeName}\n`;
        msg += `👥 *PASSAGEIROS:* ${qty}\n`;
        msg += `💰 *VALOR TOTAL APROX.*: R$ ${total},00\n\n`;
        msg += `Aguardo instruções e o link de pagamento!`;
        
        const encMsg = encodeURIComponent(msg);
        window.open(`https://wa.me/5575999999999?text=${encMsg}`, '_blank');
        ticketModal.classList.remove('open');
    });
}

function updateCartUI() {
    localStorage.setItem('voltaAilhaCart', JSON.stringify(cart));
    document.querySelector('.cart-badge').textContent = cart.length;
    
    const container = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total-value');
    
    container.innerHTML = ''; 
    
    if(cart.length === 0) {
        container.innerHTML = '<p class="empty-cart-msg">Seu carrinho está vazio.</p>';
        totalEl.textContent = 'R$ 0,00';
        return;
    }

    let total = 0;
    cart.forEach((item, index) => {
        total += item.price;
        
        const row = document.createElement('div');
        row.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom:1px solid #eee; padding: 15px 0; gap: 10px;";
        
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = "flex: 1; font-size: 0.9rem; line-height: 1.4;";
        
        const nameDiv = document.createElement('div');
        nameDiv.style.marginBottom = "5px";
        nameDiv.textContent = item.name; 
        
        const priceDiv = document.createElement('strong');
        priceDiv.style.color = "var(--primary-color)";
        priceDiv.textContent = `R$ ${item.price}`;
        
        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(priceDiv);
        
        const removeBtn = document.createElement('button');
        removeBtn.setAttribute('data-action', 'remove-cart-item');
        removeBtn.setAttribute('data-index', index);
        removeBtn.title = 'Remover item';
        removeBtn.style.cssText = "background: none; border: none; color: #ff4d4f; cursor: pointer; padding: 8px; border-radius: 8px; transition: background 0.3s;";
        removeBtn.innerHTML = '<i data-lucide="trash-2" style="width: 20px; height: 20px;"></i>';
        
        row.appendChild(infoDiv);
        row.appendChild(removeBtn);
        container.appendChild(row);
    });
    
    if (window.lucide) {
        lucide.createIcons({root: container});
    }
    
    totalEl.textContent = `R$ ${total},00`;
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
        
        const times = timesStr ? timesStr.split(',') : [];
        openBookingModal(product, price, times, fullprice);
    }

    // 6.2 Tratamento de Consultas JSON WhatsApp (Passagens)
    const consultBtn = e.target.closest('[data-action="consult-ticket"]');
    if (consultBtn) {
        const product = consultBtn.getAttribute('data-product');
        const routesJSON = consultBtn.getAttribute('data-routes');
        openTicketModal(product, routesJSON);
    }
    
    // 6.3 Tratamento de alterar quantidade
    const changeQtyBtn = e.target.closest('[data-action="change-qty"]');
    if (changeQtyBtn) {
        changeQty(parseInt(changeQtyBtn.getAttribute('data-delta')));
    }

    const changeTicketQtyBtn = e.target.closest('[data-action="change-ticket-qty"]');
    if (changeTicketQtyBtn) {
        changeTicketQty(parseInt(changeTicketQtyBtn.getAttribute('data-delta')));
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
