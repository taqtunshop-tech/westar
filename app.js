document.addEventListener('DOMContentLoaded', () => {
    if (!window.WESTAR_CATALOG) {
        console.error('Каталог не загружен!');
        document.getElementById('resultsCount').textContent = 'Ошибка загрузки данных';
        return;
    }

    const catalog = window.WESTAR_CATALOG;
    
    const state = {
        searchQuery: '',
        categories: new Set(),
        makes: new Set(),
        makeSearchQuery: '',
        
        vehicleMake: '',
        vehicleModel: '',
        vehicleYear: '',
        
        sortBy: 'default',
        renderedCount: 0,
        chunkSize: 100,
        filteredProducts: [],
        
        cart: JSON.parse(localStorage.getItem('westar_cart')) || []
    };

    const DOM = {
        productsGrid: document.getElementById('productsGrid'),
        resultsCount: document.getElementById('resultsCount'),
        categoryFilters: document.getElementById('categoryFilters'),
        searchInput: document.getElementById('searchInput'),
        searchInputMobile: document.getElementById('searchInputMobile'),
        sortSelect: document.getElementById('sortSelect'),
        resetFiltersBtn: document.getElementById('resetFiltersBtn'),
        emptyState: document.getElementById('emptyState'),
        clearSearchBtn: document.getElementById('clearSearchBtn'),
        loadingTrigger: document.getElementById('loadingTrigger'), // Need to add this to HTML
        brandGrid: document.getElementById('brandGrid'),
        
        modal: document.getElementById('productModal'),
        modalBackdrop: document.getElementById('modalBackdrop'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        modalContent: document.getElementById('modalContent'),
        
        cartBtn: document.getElementById('cartBtn'),
        cartBadge: document.getElementById('cartBadge'),
        cartDrawer: document.getElementById('cartDrawer'),
        closeCartBtn: document.getElementById('closeCartBtn'),
        cartBackdrop: document.getElementById('cartBackdrop'),
        cartItems: document.getElementById('cartItems'),
        cartTotal: document.getElementById('cartTotal'),
        
        vehicleMake: document.getElementById('vehicleMake'),
        vehicleModel: document.getElementById('vehicleModel'),
        vehicleYear: document.getElementById('vehicleYear')
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
    };

    // Таблица маппинга брендов → имя файла в filippofilip95/car-logos-dataset
    const LOGO_MAP = {
        'acura':       'acura',
        'buick':       'buick',
        'cadillac':    'cadillac',
        'chevrolet':   'chevrolet',
        'chrysler':    'chrysler',
        'dodge':       'dodge',
        'ford':        'ford',
        'gmc':         'gmc',
        'gm':          'gmc',
        'general motors': 'gmc',
        'honda':       'honda',
        'jeep':        'jeep',
        'lexus':       'lexus',
        'lincoln':     'lincoln',
        'mercury':     'mercury',
        'mopar':       'chrysler',  // Mopar — запчасти Chrysler Group, используем chrysler лого
        'nissan':      'nissan',
        'oldsmobile':  'oldsmobile',
        'pontiac':     'pontiac',
        'ram':         'ram',
        'saturn':      'saturn',
        'toyota':      'toyota',
    };

    const getMakeLogoUrl = (make) => {
        if (!make) return '';
        const key = make.toLowerCase().trim();
        if (key === 'westar') return 'images/westar-logo.svg';
        const slug = LOGO_MAP[key] || key.replace(/\s+/g, '-');
        return `https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/${slug}.png`;
    };

    const saveCart = () => {
        localStorage.setItem('westar_cart', JSON.stringify(state.cart));
        updateCartUI();
    };

    const addToCart = (productId) => {
        const product = catalog.products.find(p => p.id === productId);
        if (!product) return;
        
        const existingItem = state.cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            state.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                article: product.article,
                imageUrl: product.imageUrl,
                quantity: 1
            });
        }
        saveCart();
        openCart();
    };

    const removeFromCart = (productId) => {
        state.cart = state.cart.filter(item => item.id !== productId);
        saveCart();
    };

    const updateQuantity = (productId, delta) => {
        const item = state.cart.find(i => i.id === productId);
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                removeFromCart(productId);
            } else {
                saveCart();
            }
        }
    };

    const updateCartUI = () => {
        const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        if (totalItems > 0) {
            DOM.cartBadge.textContent = totalItems;
            DOM.cartBadge.classList.remove('hidden');
        } else {
            DOM.cartBadge.classList.add('hidden');
        }

        DOM.cartTotal.textContent = formatPrice(totalPrice);

        if (state.cart.length === 0) {
            DOM.cartItems.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full py-16" style="color:#555">
                    <svg class="w-12 h-12 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    <p class="font-mono tracking-widest text-xs uppercase">Корзина пуста</p>
                </div>
            `;
            return;
        }

        DOM.cartItems.innerHTML = state.cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-img">
                    <img src="${item.imageUrl || `https://ui-avatars.com/api/?name=${item.article}&background=0f0f0f&color=d4af37`}" alt="${item.name}">
                </div>
                <div class="flex flex-col justify-between flex-grow min-w-0">
                    <div class="flex justify-between items-start gap-2">
                        <h4 class="text-xs font-semibold text-apex-text line-clamp-2 leading-tight">${item.name}</h4>
                        <button onclick="window.removeFromCart('${item.id}')" class="text-apex-muted hover:text-red-400 transition-colors p-1 flex-shrink-0">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <p class="text-[10px] font-mono mt-0.5 uppercase" style="color:#555">${item.article}</p>
                    <div class="flex items-center justify-between mt-2">
                        <div class="cart-qty-control">
                            <button class="cart-qty-btn" onclick="window.updateQuantity('${item.id}', -1)">−</button>
                            <span class="text-xs font-mono text-apex-text min-w-[20px] text-center">${item.quantity}</span>
                            <button class="cart-qty-btn" onclick="window.updateQuantity('${item.id}', 1)">+</button>
                        </div>
                        <span class="text-sm font-semibold" style="color:#d4af37">${formatPrice(item.price * item.quantity)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    };

    const openCart = () => {
        DOM.cartDrawer.classList.remove('translate-x-full');
        DOM.cartBackdrop.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    const closeCart = () => {
        DOM.cartDrawer.classList.add('translate-x-full');
        DOM.cartBackdrop.classList.add('hidden');
        document.body.style.overflow = '';
    };

    DOM.cartBtn.addEventListener('click', openCart);
    DOM.closeCartBtn.addEventListener('click', closeCart);
    DOM.cartBackdrop.addEventListener('click', closeCart);
    
    window.addToCart = addToCart;
    window.removeFromCart = removeFromCart;
    window.updateQuantity = updateQuantity;

    const vehicleData = {};
    catalog.products.forEach(p => {
        if (p.compatibility) {
            p.compatibility.forEach(c => {
                if (!c.make) return;
                const make = c.make.trim();
                const model = (c.model || '').trim();
                const yearsStr = (c.years || '').trim();
                
                if (!vehicleData[make]) vehicleData[make] = {};
                if (model && !vehicleData[make][model]) vehicleData[make][model] = new Set();
                
                if (model && yearsStr) {
                    const matches = yearsStr.match(/\d{4}/g);
                    if (matches) {
                        matches.forEach(y => vehicleData[make][model].add(y));
                    } else {
                        vehicleData[make][model].add(yearsStr);
                    }
                }
            });
        }
    });

    const initVehicleSelector = () => {
        const makes = Object.keys(vehicleData).sort();
        DOM.vehicleMake.innerHTML = '<option value="">Все марки</option>' + makes.map(m => `<option value="${m}">${m}</option>`).join('');
        
        DOM.vehicleMake.addEventListener('change', (e) => {
            state.vehicleMake = e.target.value;
            state.vehicleModel = '';
            state.vehicleYear = '';
            
            if (state.vehicleMake) {
                const models = Object.keys(vehicleData[state.vehicleMake]).sort();
                DOM.vehicleModel.innerHTML = '<option value="">Все модели</option>' + models.map(m => `<option value="${m}">${m}</option>`).join('');
                DOM.vehicleModel.disabled = false;
            } else {
                DOM.vehicleModel.innerHTML = '<option value="">Все модели</option>';
                DOM.vehicleModel.disabled = true;
            }
            
            DOM.vehicleYear.innerHTML = '<option value="">Любой год</option>';
            DOM.vehicleYear.disabled = true;
            
            applyFilters();
        });
        
        DOM.vehicleModel.addEventListener('change', (e) => {
            state.vehicleModel = e.target.value;
            state.vehicleYear = '';
            
            if (state.vehicleMake && state.vehicleModel) {
                const yearsSet = vehicleData[state.vehicleMake][state.vehicleModel];
                const years = Array.from(yearsSet).sort((a,b) => b.localeCompare(a));
                DOM.vehicleYear.innerHTML = '<option value="">Любой год</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
                DOM.vehicleYear.disabled = years.length === 0;
            } else {
                DOM.vehicleYear.innerHTML = '<option value="">Любой год</option>';
                DOM.vehicleYear.disabled = true;
            }
            
            applyFilters();
        });
        
        DOM.vehicleYear.addEventListener('change', (e) => {
            state.vehicleYear = e.target.value;
            applyFilters();
        });
    };

    const initFilters = () => {
        DOM.categoryFilters.innerHTML = catalog.categories.map(cat => `
            <label class="filter-checkbox-label">
                <input type="checkbox" value="${cat}" class="category-cb">
                <span>${cat}</span>
            </label>
        `).join('');

        document.querySelectorAll('.category-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) state.categories.add(e.target.value);
                else state.categories.delete(e.target.value);
                applyFilters();
            });
        });
    };



    const renderBrandGrid = () => {
        if (!DOM.brandGrid) return;

        const originalMakesMap = new Map();
        catalog.makes.forEach(m => {
            let clean = m.toLowerCase().trim();
            if (clean === 'mercedes-benz' || clean === 'mercedes benz') clean = 'mercedes';
            if (clean === 'vw') clean = 'volkswagen';
            if (clean === 'vaz' || clean === 'ваз') clean = 'lada';
            if (clean === 'uaz' || clean === 'уаз') clean = 'uaz';
            clean = clean.replace(/[^a-z0-9а-яё]/gi, '');
            if (!originalMakesMap.has(clean)) originalMakesMap.set(clean, m);
        });

        const makesToShow = Array.from(originalMakesMap.values()).sort();

        DOM.brandGrid.innerHTML = makesToShow.map(make => {
            const isActive = state.makes.has(make);
            const letter = make.charAt(0).toUpperCase();
            // SVG fallback — показывается если лого не загрузилось
            const fallbackSvg = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect width='48' height='48' rx='4' fill='%23111'/><text x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' font-family='serif' font-size='22' font-weight='700' fill='%23d4af37'>${letter}</text></svg>`;
            return `
                <div class="brand-item${isActive ? ' active' : ''}" data-make="${make}">
                    ${isActive ? '<div class="corner-tl"></div><div class="corner-br"></div>' : ''}
                    <img src="${getMakeLogoUrl(make)}" onerror="this.src='${fallbackSvg}'" alt="${make}">
                    <span class="brand-label">${make}</span>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.brand-item').forEach(item => {
            item.addEventListener('click', function() {
                const make = this.dataset.make;
                if (state.makes.has(make)) state.makes.delete(make);
                else state.makes.add(make);
                renderBrandGrid();
                applyFilters();
            });
        });
    };

    // Алиас для совместимости
    const updateBrandGridState = renderBrandGrid;

    const createProductCard = (product, index) => {
        const hasImage = !!product.imageUrl;
        const imgPlaceholder = `https://ui-avatars.com/api/?name=${product.article}&background=0f0f0f&color=d4af37&size=400&font-size=0.2`;
        const imgSrc = hasImage ? product.imageUrl : imgPlaceholder;
        
        const loadStrategy = 'eager';
        const priorityStrategy = 'fetchpriority="high"';
        
        let compatHtml = '';
        if (product.compatibility && product.compatibility.length > 0) {
            const uniqueCars = [];
            const makesOnly = new Set();
            
            product.compatibility.forEach(c => {
                if (!c.make) return;
                makesOnly.add(c.make);
                if (c.model) {
                    const key = `${c.make.trim()} ${c.model.trim()}`;
                    if (!uniqueCars.find(x => x.key === key)) {
                        uniqueCars.push({ key, make: c.make, model: c.model });
                    }
                }
            });
            
            if (uniqueCars.length > 0) {
                const displayCars = uniqueCars.slice(0, 4);
                const hasMore = uniqueCars.length > 4;
                
                const carBlocks = displayCars.map(car => {
                    return `
                        <div class="compat-car-thumb" title="${car.make} ${car.model}">
                            <img src="${getCarImageUrl(car.make, car.model)}" onerror="this.onerror=null; this.src='${getMakeLogoUrl(car.make)}'; this.style.transform='none'; this.style.mixBlendMode='normal';" alt="${car.make} ${car.model}">
                        </div>
                    `;
                }).join('');

                compatHtml = `
                    <div class="mt-3">
                        <div class="flex items-center gap-1.5">
                            ${carBlocks}
                            ${hasMore ? `<div class="compat-car-thumb flex items-center justify-center text-[9px] font-mono" style="color:#888">+${uniqueCars.length - 4}</div>` : ''}
                        </div>
                    </div>
                `;
            } else if (makesOnly.size > 0) {
                const makes = Array.from(makesOnly);
                const displayMakes = makes.slice(0, 5);
                const hasMore = makes.length > 5;

                const makeBlocks = displayMakes.map(make => {
                    return `
                        <div class="compat-car-thumb" title="${make}" style="align-items:center;justify-content:center;background:rgba(255,255,255,0.95);padding:2px;">
                            <img src="${getMakeLogoUrl(make)}" onerror="this.style.display='none'" style="width:auto;height:24px;object-fit:contain;transform:none;opacity:1;mix-blend-mode:normal;" alt="${make}">
                        </div>
                    `;
                }).join('');

                compatHtml = `
                    <div class="mt-3">
                        <div class="flex items-center gap-1.5">
                            ${makeBlocks}
                            ${hasMore ? `<div class="compat-car-thumb flex items-center justify-center text-[9px] font-mono" style="color:#888">+${makes.length - 5}</div>` : ''}
                        </div>
                    </div>
                `;
            }
        }

        return `
            <div class="apex-product-card" data-id="${product.id}" onclick="window.openProductModal('${product.id}')">
                <!-- Угловые декораторы -->
                <div class="apex-corner apex-corner-tl"></div>
                <div class="apex-corner apex-corner-tr"></div>
                <div class="apex-corner apex-corner-bl"></div>
                <div class="apex-corner apex-corner-br"></div>

                <!-- Верхняя строка HUD -->
                <div class="flex justify-between items-center px-4 py-2.5 border-b border-apex-border bg-apex-bg relative z-10">
                    <div class="flex items-center gap-2">
                        <span class="relative flex h-1.5 w-1.5">
                            ${product.stock > 0 ? `<span class="animate-ping-gold absolute inline-flex h-full w-full rounded-full opacity-75" style="background:#d4af37"></span>` : ''}
                            <span class="relative inline-flex rounded-full h-1.5 w-1.5" style="background:${product.stock > 0 ? '#d4af37;box-shadow:0 0 6px #d4af37' : '#ef4444'}"></span>
                        </span>
                        <span class="text-[10px] font-mono uppercase tracking-widest text-apex-silver">${product.article}</span>
                    </div>
                    ${product.oem
                        ? `<span class="text-[8px] font-mono px-2 py-0.5 border uppercase tracking-widest" style="background:rgba(212,175,55,0.1);color:#d4af37;border-color:rgba(212,175,55,0.4)">OEM</span>`
                        : `<span class="text-[8px] font-mono text-apex-muted uppercase tracking-widest">${product.brand || 'Aftermarket'}</span>`
                    }
                </div>

                <!-- Зона изображения -->
                <div class="apex-product-img-zone">
                    <div class="apex-crosshair-h"></div>
                    <div class="apex-crosshair-v"></div>
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none" id="loader-${product.id}">
                        <div class="w-5 h-5 border border-apex-border border-t-transparent rounded-full animate-spin opacity-40"></div>
                    </div>
                    <img src="${imgSrc}" alt="${product.name}"
                        class="relative z-10 max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105 opacity-0"
                        loading="lazy"
                        onload="this.style.opacity='1'; var l=document.getElementById('loader-${product.id}'); if(l) l.style.display='none';"
                        onerror="this.onerror=null; this.src='${imgPlaceholder}'; this.style.opacity='1'; var l=document.getElementById('loader-${product.id}'); if(l) l.style.display='none';">
                </div>

                <!-- Детали товара -->
                <div class="p-5 flex flex-col flex-grow">
                    <div class="text-[9px] font-mono mb-2 uppercase tracking-widest" style="color:#d4af37">
                        ${product.category}
                    </div>
                    <h3 class="text-apex-text font-semibold text-sm leading-snug mb-2 flex-grow line-clamp-2 group-hover:text-white transition-colors">${product.name}</h3>
                    ${compatHtml}
                    <div class="flex flex-col gap-3 mt-4 pt-4 border-t border-apex-border">
                        <div class="flex items-end justify-between">
                            <div class="flex flex-col">
                                <span class="text-[9px] font-mono text-apex-muted uppercase tracking-widest mb-1">${product.stock > 0 ? 'В наличии' : 'Под заказ'}</span>
                                <span class="text-lg font-semibold text-apex-text tracking-wide">${formatPrice(product.price)}</span>
                            </div>
                            <button onclick="event.stopPropagation(); window.addToCart('${product.id}')"
                                class="h-9 px-4 border font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all duration-300"
                                style="border-color:rgba(212,175,55,0.35);color:#d4af37;background:rgba(212,175,55,0.07)"
                                onmouseover="this.style.background='rgba(212,175,55,0.15)';this.style.borderColor='#d4af37'"
                                onmouseout="this.style.background='rgba(212,175,55,0.07)';this.style.borderColor='rgba(212,175,55,0.35)'">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                            </button>
                        </div>
                        <div class="flex items-center gap-2 pt-2 border-t border-apex-border/50">
                            <span class="text-[9px] font-mono text-apex-muted uppercase">Сравнить цены:</span>
                            <a href="https://www.zzap.ru/public/search.aspx?partnumber=${product.article}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="text-[9px] font-mono text-apex-silver hover:text-apex-gold transition-colors underline decoration-apex-border hover:decoration-apex-gold underline-offset-2">Zzap</a>
                            <span class="text-apex-border text-[9px]">|</span>
                            <a href="https://www.exist.ru/Price/?pcode=${product.article}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="text-[9px] font-mono text-apex-silver hover:text-apex-gold transition-colors underline decoration-apex-border hover:decoration-apex-gold underline-offset-2">Exist</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    // --- Источники реальных фото автомобилей ---
    const CAR_PHOTO_SOURCES = [
        // 1) imagin.studio — специализированный CDN с реальными фото авто по марке/модели
        (make, model) => `https://cdn.imagin.studio/getImage?customer=hr&make=${encodeURIComponent(make)}&modelFamily=${encodeURIComponent(model)}&angle=23&width=400`,
        // 2) Wikimedia Commons — широкое покрытие марок
        (make, model) => `https://en.wikipedia.org/w/index.php?action=render&title=${encodeURIComponent(make + '_' + model)}`,
    ];

    const getCarImageUrl = (make, model) => {
        let cleanMake = make.trim().toLowerCase();
        if (cleanMake === 'mercedes-benz' || cleanMake === 'mercedes benz') cleanMake = 'mercedes';
        if (cleanMake === 'vw') cleanMake = 'volkswagen';
        if (cleanMake === 'vaz' || cleanMake === 'ваз') cleanMake = 'lada';
        if (cleanMake === 'uaz' || cleanMake === 'уаз') cleanMake = 'uaz';
        cleanMake = cleanMake.replace(/\s+/g, '-');

        let cleanModel = '';
        if (model) {
            cleanModel = model.trim().toLowerCase()
                .split('(')[0].split('/')[0].trim()
                .replace(/\s+[ivx]+$/i, '')
                .replace(/\s+/g, '-');
        }

        // imagin.studio — лучший источник для авто
        return `https://cdn.imagin.studio/getImage?customer=hr&make=${cleanMake}&modelFamily=${cleanModel}&angle=23&width=400`;
    };


    const openProductModal = (id) => {
        const product = catalog.products.find(p => p.id === id);
        if (!product) return;

        const hasImage = !!product.imageUrl;
        const imgPlaceholder = `https://ui-avatars.com/api/?name=${product.article}&background=0f0f0f&color=d4af37&size=500&font-size=0.2`;
        const imgSrc = hasImage ? product.imageUrl : imgPlaceholder;

        // --- Совместимость ---
        let compatHtml = `<p class="text-xs font-mono" style="color:#555">Нет данных о совместимости</p>`;
        if (product.compatibility && product.compatibility.length > 0) {
            const makesGroup = {};
            product.compatibility.forEach(c => {
                const mk = c.make || 'Разное';
                if (!makesGroup[mk]) makesGroup[mk] = {};
                const md = c.model || 'Разное';
                if (!makesGroup[mk][md]) makesGroup[mk][md] = [];
                makesGroup[mk][md].push(c);
            });

            compatHtml = Object.keys(makesGroup).map(make => `
                <div class="mb-5">
                    <h5 class="flex items-center gap-2 text-xs font-mono uppercase tracking-widest mb-3 pb-2" style="border-bottom:1px solid var(--apex-border);color:var(--apex-silver)">
                        <span style="background:rgba(255,255,255,0.9);padding:4px;border-radius:4px;display:flex"><img src="${getMakeLogoUrl(make)}" onerror="this.style.display='none'" style="height:20px;width:auto;object-fit:contain;opacity:1" alt=""></span>
                        ${make}
                    </h5>
                    <div class="grid grid-cols-2 gap-3">
                        ${Object.keys(makesGroup[make]).map(model => `
                            <div class="modal-compat-card">
                                <div class="modal-compat-img">
                                    <img src="${getCarImageUrl(make, model)}"
                                        onerror="this.parentElement.style.background='#0f0f0f'; this.src='${getMakeLogoUrl(make)}'; this.style.height='32px';this.style.width='auto';this.style.objectFit='contain';this.style.opacity='0.3';"
                                        alt="${make} ${model}">
                                </div>
                                <div style="padding:10px 12px">
                                    <p class="text-xs font-semibold text-apex-text mb-1 uppercase tracking-wide">${model !== 'Разное' ? model : make}</p>
                                    <div class="flex flex-wrap gap-1">
                                        ${makesGroup[make][model].map(c => c.years ? `<span class="year-badge">${c.years}</span>` : '').join('')}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }

        DOM.modalContent.innerHTML = `
            <!-- Левая колонка: фото -->
            <div class="modal-left">
                <div class="modal-img-container" id="modalMainMediaContainer">
                    ${product.brand ? `
                    <div style="position:absolute;top:12px;left:12px;z-index:20;padding:8px 12px;background:rgba(255,255,255,0.95);border:1px solid rgba(212,175,55,0.5);border-radius:6px;box-shadow:0 4px 15px rgba(0,0,0,0.5)">
                        <img src="${getMakeLogoUrl(product.brand)}" onerror="this.style.display='none'" style="height:28px;width:auto;object-fit:contain;opacity:1" alt="${product.brand}">
                    </div>` : ''}
                    ${product.oem ? `
                    <div style="position:absolute;top:12px;right:12px;z-index:20">
                        <span class="oem-badge">OEM</span>
                    </div>` : ''}
                    <img id="modalMainImage" src="${imgSrc}" alt="${product.name}"
                        style="max-width:100%;max-height:420px;object-fit:contain;position:relative;z-index:10;transition:transform 0.5s">
                </div>
                ${(product.imageUrls && product.imageUrls.length > 1) ? `
                <div style="display:flex;gap:8px;overflow-x:auto;padding:12px 16px" class="custom-scrollbar" id="modalThumbnails">
                    ${product.imageUrls.map((url, i) => `
                        <button class="modal-thumb-btn${i === 0 ? ' active' : ''}" data-src="${url}" data-type="image">
                            <img src="${url}" style="width:100%;height:100%;object-fit:cover" alt="">
                        </button>
                    `).join('')}
                </div>` : ''}
            </div>

            <!-- Правая колонка: детали -->
            <div class="modal-right">
                <div class="flex items-center gap-2 mb-4">
                    <span class="modal-badge">${product.category}</span>
                    <span style="color:var(--apex-muted);font-size:10px;font-family:monospace">${product.purpose || 'Автозапчасть'}</span>
                </div>

                <h2 style="font-size:1.4rem;font-weight:700;color:#fff;margin-bottom:20px;line-height:1.3;letter-spacing:0.03em">${product.name}</h2>

                <!-- Параметры -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
                    <div class="modal-param-box">
                        <p class="modal-param-label">Артикул</p>
                        <p class="modal-param-value" style="color:var(--apex-gold)">${product.article}</p>
                    </div>
                    <div class="modal-param-box">
                        <p class="modal-param-label">Остаток</p>
                        <p class="modal-param-value" style="color:${product.stock > 0 ? '#4ade80' : '#f59e0b'}">
                            ${product.stock > 0 ? product.stock + ' шт.' : 'Под заказ'}
                        </p>
                    </div>
                </div>
                
                <!-- Цена и Корзина -->
                <div class="modal-param-box" style="border-color:rgba(212,175,55,0.3);background:rgba(212,175,55,0.05);margin-bottom:24px;flex-direction:row;align-items:center;justify-content:space-between">
                    <div>
                        <p class="modal-param-label" style="color:var(--apex-gold)">Цена Westar</p>
                        <p class="modal-param-value" style="color:#fff;font-size:1.4rem">${formatPrice(product.price)}</p>
                    </div>
                    <button onclick="window.addToCart('${product.id}')" class="modal-add-btn" style="margin-top:0;width:auto;padding:10px 24px;font-size:12px">В корзину</button>
                </div>

                <!-- Сравнение цен -->
                <div class="modal-section" style="padding-top:0;border-top:none;margin-bottom:24px">
                    <h4 class="modal-section-title" style="margin-bottom:8px">Проверить рыночные цены</h4>
                    <div class="flex gap-3">
                        <a href="https://www.zzap.ru/public/search.aspx?partnumber=${product.article}" target="_blank" rel="noopener noreferrer" class="flex-1 flex items-center justify-center gap-2 py-2 border border-apex-border rounded bg-apex-container hover:border-apex-silver hover:bg-apex-border/30 transition-colors text-xs font-mono text-apex-text">
                            🔍 Искать на Zzap.ru
                        </a>
                        <a href="https://www.exist.ru/Price/?pcode=${product.article}" target="_blank" rel="noopener noreferrer" class="flex-1 flex items-center justify-center gap-2 py-2 border border-apex-border rounded bg-apex-container hover:border-apex-silver hover:bg-apex-border/30 transition-colors text-xs font-mono text-apex-text">
                            🔍 Искать на Exist.ru
                        </a>
                    </div>
                </div>

                <!-- Описание -->
                ${product.description ? `
                <div class="modal-section">
                    <h4 class="modal-section-title">Описание</h4>
                    <p style="font-size:13px;color:var(--apex-silver);line-height:1.7">${product.description.replace(/\n/g, '<br>')}</p>
                </div>` : ''}

                <!-- Совместимость -->
                <div class="modal-section">
                    <h4 class="modal-section-title">Совместимость</h4>
                    <div class="max-h-72 overflow-y-auto custom-scrollbar pr-2">${compatHtml}</div>
                </div>

                <!-- Кросс-номера -->
                ${(product.oem || product.analogs) ? `
                <div class="modal-section">
                    <h4 class="modal-section-title">Кросс-номера</h4>
                    ${product.oem ? `<p style="font-size:12px;font-family:monospace;margin-bottom:8px"><span style="color:var(--apex-muted)">OEM: </span><span style="color:var(--apex-gold)">${product.oem}</span></p>` : ''}
                    ${product.analogs ? `<p style="font-size:11px;font-family:monospace;color:var(--apex-silver);white-space:pre-wrap;line-height:1.8">${product.analogs}</p>` : ''}
                </div>` : ''}
            </div>
        `;

        DOM.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Галерея thumbnail
        document.querySelectorAll('.modal-thumb-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.getElementById('modalMainImage').src = this.dataset.src;
                document.querySelectorAll('.modal-thumb-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });
    };  // <-- конец openProductModal

    const closeModal = () => {
        const mainVideo = document.getElementById('modalMainVideo');
        if (mainVideo) mainVideo.pause();
        DOM.modal.classList.add('hidden');
        document.body.style.overflow = '';
    };

    window.openProductModal = openProductModal;

    DOM.closeModalBtn.addEventListener('click', closeModal);
    DOM.modalBackdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !DOM.modal.classList.contains('hidden')) closeModal();
    });

    const renderChunk = () => {
        const toRender = state.filteredProducts.slice(state.renderedCount, state.renderedCount + state.chunkSize);
        if (toRender.length === 0) return;

        const html = toRender.map((p, i) => createProductCard(p, state.renderedCount + i)).join('');
        DOM.productsGrid.insertAdjacentHTML('beforeend', html);
        
        state.renderedCount += toRender.length;

        // Привязываем клик на каждую карточку
        document.querySelectorAll('.apex-product-card').forEach(card => {
            card.onclick = () => openProductModal(card.dataset.id);
        });

        // Toggle loader visibility
        if (state.renderedCount >= state.filteredProducts.length) {
            if (DOM.loadingTrigger) DOM.loadingTrigger.classList.add('hidden');
        } else {
            if (DOM.loadingTrigger) DOM.loadingTrigger.classList.remove('hidden');
        }
    };

    const applyFilters = () => {
        state.filteredProducts = catalog.products.filter(p => {
            if (state.searchQuery) {
                const q = state.searchQuery.toLowerCase();
                const matchName = p.name && p.name.toLowerCase().includes(q);
                const matchArticle = p.article && p.article.toLowerCase().includes(q);
                const matchOem = p.oem && p.oem.toLowerCase().includes(q);
                if (!matchName && !matchArticle && !matchOem) return false;
            }
            if (state.categories.size > 0 && !state.categories.has(p.category)) return false;
            if (state.makes.size > 0) {
                // Собираем марки товара в нижнем регистре для case-insensitive сравнения
                const pMakesLower = new Set();
                if (p.brand) pMakesLower.add(p.brand.toLowerCase().trim());
                if (p.compatibility) p.compatibility.forEach(c => {
                    if (c.make) {
                        let mk = c.make.toLowerCase().trim();
                        // GM и Gmc — это GMC
                        if (mk === 'gm' || mk === 'gmc') { pMakesLower.add('gmc'); }
                        else { pMakesLower.add(mk); }
                    }
                });
                
                let makeMatch = false;
                for (let make of state.makes) {
                    let mk = make.toLowerCase().trim();
                    if (mk === 'gm') mk = 'gmc';
                    if (pMakesLower.has(mk)) {
                        makeMatch = true;
                        break;
                    }
                }
                if (!makeMatch) return false;
            }
            
            if (state.vehicleMake) {
                let match = false;
                if (p.compatibility) {
                    for (let c of p.compatibility) {
                        if (c.make === state.vehicleMake) {
                            if (state.vehicleModel) {
                                if (c.model === state.vehicleModel) {
                                    if (state.vehicleYear) {
                                        if (c.years && c.years.includes(state.vehicleYear)) {
                                            match = true; break;
                                        }
                                    } else {
                                        match = true; break;
                                    }
                                }
                            } else {
                                match = true; break;
                            }
                        }
                    }
                }
                if (!match) return false;
            }
            
            return true;
        });

        switch (state.sortBy) {
            case 'price_asc': state.filteredProducts.sort((a, b) => a.price - b.price); break;
            case 'price_desc': state.filteredProducts.sort((a, b) => b.price - a.price); break;
            case 'stock_desc': state.filteredProducts.sort((a, b) => b.stock - a.stock); break;
            default: break;
        }

        DOM.resultsCount.textContent = `Найдено деталей: ${state.filteredProducts.length}`;
        DOM.productsGrid.innerHTML = '';
        state.renderedCount = 0;
        
        if (state.filteredProducts.length === 0) {
            DOM.productsGrid.classList.add('hidden');
            DOM.emptyState.classList.remove('hidden');
            DOM.emptyState.classList.add('flex');
            if (DOM.loadingTrigger) DOM.loadingTrigger.classList.add('hidden');
        } else {
            DOM.emptyState.classList.add('hidden');
            DOM.emptyState.classList.remove('flex');
            DOM.productsGrid.classList.remove('hidden');
            renderChunk();
        }
    };

    // Infinite scroll observer
    const setupIntersectionObserver = () => {
        // Create trigger element if it doesn't exist
        if (!document.getElementById('loadingTrigger')) {
            const trigger = document.createElement('div');
            trigger.id = 'loadingTrigger';
            trigger.className = 'w-full py-8 flex justify-center hidden';
            trigger.innerHTML = `<div class="w-8 h-8 border-2 border-apex-border border-t-[#d4af37] rounded-full animate-spin"></div>`;
            DOM.productsGrid.parentNode.insertBefore(trigger, DOM.productsGrid.nextSibling);
            DOM.loadingTrigger = trigger;
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && state.renderedCount < state.filteredProducts.length) {
                renderChunk();
            }
        }, { rootMargin: '400px' }); // Load ahead of time

        observer.observe(DOM.loadingTrigger);
    };

    const handleSearch = (e) => {
        state.searchQuery = e.target.value;
        if (e.target.id === 'searchInput') DOM.searchInputMobile.value = state.searchQuery;
        if (e.target.id === 'searchInputMobile') DOM.searchInput.value = state.searchQuery;
        applyFilters();
    };

    DOM.searchInput.addEventListener('input', handleSearch);
    DOM.searchInputMobile.addEventListener('input', handleSearch);

    DOM.sortSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        applyFilters();
    });

    const resetAll = () => {
        state.searchQuery = '';
        state.categories.clear();
        state.makes.clear();
        state.makeSearchQuery = '';
        
        state.vehicleMake = '';
        state.vehicleModel = '';
        state.vehicleYear = '';
        
        state.sortBy = 'default';
        
        DOM.searchInput.value = '';
        DOM.searchInputMobile.value = '';
        if (DOM.makeSearchInput) DOM.makeSearchInput.value = '';
        DOM.sortSelect.value = 'default';
        
        DOM.vehicleMake.value = '';
        DOM.vehicleModel.value = '';
        DOM.vehicleModel.disabled = true;
        DOM.vehicleYear.value = '';
        DOM.vehicleYear.disabled = true;
        
        document.querySelectorAll('.category-cb').forEach(cb => cb.checked = false);
        updateBrandGridState();
        applyFilters();
    };

    DOM.resetFiltersBtn.addEventListener('click', resetAll);
    DOM.clearSearchBtn.addEventListener('click', resetAll);

    // Initial setup
    initFilters();
    renderBrandGrid();
    initVehicleSelector();
    updateCartUI();
    setupIntersectionObserver();
    applyFilters();
});
