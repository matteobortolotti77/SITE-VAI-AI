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
    // Esconder todas as telas
    spaViews.forEach(view => view.classList.remove('active'));
    
    // Remover classe ativa dos links
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if(link.dataset.target === targetId) link.classList.add('active');
    });

    // Mostrar tela alvo
    const targetView = document.getElementById(`view-${targetId}`);
    if(targetView) {
        // Atualizar SEO Metadados em tempo real na aba do navegador
        if (routeMeta[targetId]) {
            document.title = routeMeta[targetId].title;
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) metaDesc.setAttribute('content', routeMeta[targetId].desc);
        }

        targetView.classList.add('active');
        // Rolar p/ topo
        window.scrollTo(0,0);
        
        // Push state para o navegador (Ajuste do botão voltar)
        if (pushHistory) {
            history.pushState({ view: targetId }, '', `#${targetId}`);
        }
        
        // Se formos para passeios/passagens, dar um fundo sólido pro header
        if(targetId !== 'home') {
            header.style.background = 'white';
            header.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.05)';
            document.querySelectorAll('.nav-links a, .cart-btn').forEach(el => el.style.color = 'var(--text-main)');
        } else {
            // Volta pro glassmorphism padrão se estiver no Home
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

// Escuta botão voltar do navegador
window.addEventListener('popstate', (e) => {
    const targetId = e.state && e.state.view ? e.state.view : 'home';
    navigateTo(targetId, false);
});

// 3. SWIPER SLIDER PARA PASSEIOS
const swiper = new Swiper('.product-slider', {
    slidesPerView: 1.2,
    spaceBetween: 20,
    pagination: {
        el: '.product-slider > .swiper-pagination', /* Avoid controlling inner swipers */
        clickable: true,
    },
    breakpoints: {
        640: { slidesPerView: 2.2 },
        1024: { slidesPerView: 3.2 }
    }
});

// SLIDER INTERNO (FOTOS DO PRODUTO)
const innerSwipers = new Swiper('.inner-swiper', {
    slidesPerView: 1,
    nested: true, /* Ensures it works inside the outer swiper */
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
// Recuperar carrinho do LocalStorage (Amnésia Resolvida)
let cart = [];
try {
    const savedCart = localStorage.getItem('voltaAilhaCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
} catch(e) {
    console.error("Erro ao ler carrinho:", e);
}

// Inicializar e rotear primeira aba
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

// 5. SISTEMA DE AGENDAMENTO (Modal & Flatpickr)
const bookingModal = document.getElementById('booking-modal');
const closeBookingBtn = document.getElementById('close-booking');
const confirmBookingBtn = document.getElementById('confirm-booking-btn');

let currentBookingProduct = null;
let currentBookingPrice = 0;
let currentBookingFullPrice = 0;

window.openBookingModal = function(productName, price, timesArray, fullPrice = null) {
    currentBookingProduct = productName;
    currentBookingPrice = price;
    currentBookingFullPrice = fullPrice || price;
    
    document.getElementById('booking-title').innerText = productName;
    
    const displayEl = document.getElementById('booking-price-display');
    if (fullPrice && fullPrice > price) {
        displayEl.innerHTML = `<span style="color:#666; font-size:0.9rem;">Valor Total: R$ ${fullPrice}</span><br><span style="color:var(--primary-color); font-weight: bold;">Sinal para Reserva: R$ ${price} / pessoa</span>`;
    } else {
        displayEl.innerHTML = `R$ ${price} por pessoa`;
    }
    
    document.getElementById('booking-qty').value = 1;
    document.getElementById('booking-total').innerText = price;
    
    // Configurar Horários
    const timeSelect = document.getElementById('booking-time');
    timeSelect.innerHTML = '';
    
    if (timesArray && timesArray.length > 0) {
        document.getElementById('booking-time-group').style.display = 'block';
        timesArray.forEach(time => {
            const opt = document.createElement('option');
            opt.value = time;
            opt.innerText = time;
            timeSelect.appendChild(opt);
        });
    } else {
        document.getElementById('booking-time-group').style.display = 'none';
        timeSelect.innerHTML = '<option value="A combinar">A combinar pelo WhatsApp</option>';
    }

    // Limpar data
    document.getElementById('booking-date').value = '';

    bookingModal.classList.add('open');
};

if(closeBookingBtn) {
    closeBookingBtn.addEventListener('click', () => {
        bookingModal.classList.remove('open');
    });
}

// Inicializar Flatpickr
if(document.getElementById('booking-date')) {
    // Helper para obter a data atual no Brasil
    function getBrazilToday() {
        const now = new Date();
        const brazilStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Bahia' }); 
        const [y, m, d] = brazilStr.split('-').map(Number);
        return new Date(y, m - 1, d); 
    }

    const flatpickrInstance = flatpickr("#booking-date", {
        minDate: getBrazilToday(),
        dateFormat: "d/m/Y",
        locale: "pt",
        disableMobile: true,
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 0) return;
            
            // Verifica se a data selecionada é hoje
            const today = getBrazilToday();
            const selected = selectedDates[0];
            
            if (selected.getTime() === today.getTime()) {
                // Checar horário atual na Bahia
                const brTimeStr = new Date().toLocaleString("en-US", {timeZone: "America/Bahia", hour12: false});
                const brTime = new Date(brTimeStr);
                const hours = brTime.getHours();
                const minutes = brTime.getMinutes();
                
                // Passou de 08:30?
                if (hours > 8 || (hours === 8 && minutes >= 30)) {
                    instance.clear();
                    document.getElementById('urgent-modal').classList.add('open');
                }
            }
        }
    });

    // Fechar modal urgente
    const closeUrgentBtn = document.getElementById('close-urgent');
    if (closeUrgentBtn) {
        closeUrgentBtn.addEventListener('click', () => {
            document.getElementById('urgent-modal').classList.remove('open');
        });
    }
}

window.changeQty = function(delta) {
    const input = document.getElementById('booking-qty');
    let newVal = parseInt(input.value) + delta;
    if (newVal < 1) newVal = 1;
    input.value = newVal;
    
    document.getElementById('booking-total').innerText = newVal * currentBookingPrice;
};

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
        
        // Adiciona ao carrinho
        cart.push({ name: finalProductName, price: finalPrice });
        updateCartUI();
        
        bookingModal.classList.remove('open');
        toggleCart();
    });
}

function updateCartUI() {
    // Salvar estado atual do carrinho na memória do celular do cliente
    localStorage.setItem('voltaAilhaCart', JSON.stringify(cart));

    // Atualiza contagem na bolinha do header
    document.querySelector('.cart-badge').innerText = cart.length;
    
    const container = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total-value');
    
    if(cart.length === 0) {
        container.innerHTML = '<p class="empty-cart-msg">Seu carrinho está vazio.</p>';
        totalEl.innerText = 'R$ 0,00';
        return;
    }

    container.innerHTML = '';
    let total = 0;
    cart.forEach((item, index) => {
        total += item.price;
        container.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom:1px solid #eee; padding: 15px 0; gap: 10px;">
                <div style="flex: 1; font-size: 0.9rem; line-height: 1.4;">
                    <div style="margin-bottom: 5px;">${item.name}</div>
                    <strong style="color:var(--primary-color)">R$ ${item.price}</strong>
                </div>
                <button onclick="removeFromCart(${index})" title="Remover item" style="background: none; border: none; color: #ff4d4f; cursor: pointer; padding: 8px; border-radius: 8px; transition: background 0.3s;">
                    <i data-lucide="trash-2" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
        `;
    });
    
    // Re-renderizar ícones recém adicionados via string HTML
    if (window.lucide) {
        lucide.createIcons();
    }

    
    totalEl.innerText = `R$ ${total},00`;
}

// 6. REMOVER DO CARRINHO
window.removeFromCart = function(index) {
    if (confirm("Deseja remover este item do carrinho?")) {
        cart.splice(index, 1);
        updateCartUI();
    }
};

// 7. ACCORDION (Menu Sanfona)
window.toggleAccordion = function(header) {
    const item = header.parentElement;
    const body = header.nextElementSibling;
    
    // Fechar se já está aberto
    if (item.classList.contains('active')) {
        item.classList.remove('active');
        body.style.maxHeight = null;
    } else {
        // Fechar outros da mesma sanfona
        const parentAccordion = item.closest('.custom-accordion');
        if (parentAccordion) {
            parentAccordion.querySelectorAll('.accordion-item.active').forEach(activeItem => {
                activeItem.classList.remove('active');
                activeItem.querySelector('.accordion-body').style.maxHeight = null;
            });
        }
        
        // Abrir clicado
        item.classList.add('active');
        body.style.maxHeight = body.scrollHeight + "px";
    }
}
