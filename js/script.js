// 1. EFEITO DO HEADER (Glassmorphism)
const header = document.querySelector('.glass-header');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// 2. SISTEMA DE SPA (Troca de Telas)
const navItems = document.querySelectorAll('.nav-item');
const spaViews = document.querySelectorAll('.spa-view');

function navigateTo(targetId) {
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
        targetView.classList.add('active');
        // Rolar p/ topo
        window.scrollTo(0,0);
        
        // Se formos para passeios/passagens, dar um fundo sólido pro header
        if(targetId !== 'home') {
            header.style.background = 'white';
            header.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.05)';
            // document.querySelector('.logo h1').style.color = 'var(--text-main)';
            document.querySelectorAll('.nav-links a, .cart-btn').forEach(el => el.style.color = 'var(--text-main)');
        } else {
            // Volta pro glassmorphism padrão se estiver no Home
            header.style = '';
            // document.querySelector('.logo h1').style = '';
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

// 3. SWIPER SLIDER PARA PASSEIOS
const swiper = new Swiper('.product-slider', {
    slidesPerView: 1.2,
    spaceBetween: 20,
    pagination: {
        el: '.swiper-pagination',
        clickable: true,
    },
    breakpoints: {
        640: { slidesPerView: 2.2 },
        1024: { slidesPerView: 3.2 }
    }
});

// 4. SISTEMA DE CARRINHO DE COMPRAS
const cartBtn = document.querySelector('.cart-btn');
const closeCartBtn = document.querySelector('.close-cart');
const cartDrawer = document.querySelector('.cart-drawer');
const cartOverlay = document.querySelector('.cart-drawer-overlay');
let cart = [];

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
        displayEl.innerHTML = `<del style="color:#999; font-size:0.9rem;">Valor Total: R$ ${fullPrice}</del><br><span style="color:var(--primary-color)">Sinal para Reserva: R$ ${price} / pessoa</span>`;
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
    let tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    flatpickr("#booking-date", {
        minDate: tomorrow,
        dateFormat: "d/m/Y",
        locale: "pt"
    });
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
    cart.forEach(item => {
        total += item.price;
        container.innerHTML += `
            <div style="display: flex; justify-content: space-between; border-bottom:1px solid #eee; padding: 10px 0;">
                <span>${item.name}</span>
                <strong>R$ ${item.price}</strong>
            </div>
        `;
    });
    
    totalEl.innerText = `R$ ${total},00`;
}

// 6. ACCORDION (Menu Sanfona)
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
