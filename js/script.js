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

// Função chamada pelos botões de compra no HTML
window.addToCart = function(productName, price) {
    cart.push({ name: productName, price: price });
    updateCartUI();
    toggleCart(); // Abre a gaveta pra mostrar q add
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
