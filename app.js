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
        makeFilters: document.getElementById('makeFilters'),
        searchInput: document.getElementById('searchInput'),
        searchInputMobile: document.getElementById('searchInputMobile'),
        makeSearchInput: document.getElementById('makeSearchInput'),
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

    const getMakeLogoUrl = (make) => {
        if (!make) return '';
        let cleanMake = make.toLowerCase().trim();
        if (cleanMake === 'gm' || cleanMake === 'general motors') cleanMake = 'gmc';
        return `https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/${cleanMake}.png`;
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
                <div class="flex flex-col items-center justify-center h-full text-cyan-600/50 py-12">
                    <svg class="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    <p class="font-mono tracking-widest text-sm uppercase">Корзина пуста</p>
                </div>
            `;
            return;
        }
        
        DOM.cartItems.innerHTML = state.cart.map(item => `
            <div class="flex gap-4 p-4 bg-cyber-dark/80 rounded-xl border border-cyan-900/30 shadow-sm relative group/item hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(0,212,255,0.2)] transition-all">
                <div class="w-20 h-20 bg-cyber-dark/50 rounded-lg flex items-center justify-center border border-cyan-900/30 p-1 flex-shrink-0">
                    <img src="${item.imageUrl || `https://ui-avatars.com/api/?name=${item.article}&background=0a1128&color=00d4ff`}" alt="${item.name}" class="max-w-full max-h-full object-contain">
                </div>
                <div class="flex flex-col justify-between flex-grow">
                    <div>
                        <div class="flex justify-between items-start gap-2">
                            <h4 class="text-sm font-bold text-white font-space tracking-wide line-clamp-2 leading-tight">${item.name}</h4>
                            <button onclick="window.removeFromCart('${item.id}')" class="text-cyan-600/50 hover:text-red-400 transition-colors p-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                        <p class="text-[11px] font-mono text-cyan-500/70 mt-1 uppercase">${item.article}</p>
                    </div>
                    <div class="flex items-center justify-between mt-2">
                        <div class="flex items-center gap-3 bg-cyber-dark border border-cyan-900/50 rounded-lg px-2 py-1">
                            <button onclick="window.updateQuantity('${item.id}', -1)" class="text-cyan-600 hover:text-cyan-300 font-bold w-4 flex justify-center">-</button>
                            <span class="text-sm font-bold text-white min-w-[20px] text-center">${item.quantity}</span>
                            <button onclick="window.updateQuantity('${item.id}', 1)" class="text-cyan-600 hover:text-cyan-300 font-bold w-4 flex justify-center">+</button>
                        </div>
                        <span class="font-black text-cyan-400 font-space tracking-widest">${formatPrice(item.price * item.quantity)}</span>
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
            <label class="flex items-center space-x-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <input type="checkbox" value="${cat}" class="category-cb w-4 h-4 text-brand-600 bg-white border-slate-300 rounded focus:ring-brand-500 focus:ring-2 transition-all">
                <span class="text-slate-700 text-sm font-medium group-hover:text-brand-600 transition-colors">${cat}</span>
            </label>
        `).join('');

        document.querySelectorAll('.category-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) state.categories.add(e.target.value);
                else state.categories.delete(e.target.value);
                applyFilters();
            });
        });

        renderMakeFilters();
    };

    const renderMakeFilters = () => {
        if (!DOM.makeFilters) return;
        const filteredMakes = catalog.makes.filter(m => m.toLowerCase().includes(state.makeSearchQuery.toLowerCase()));
        
        DOM.makeFilters.innerHTML = filteredMakes.map(make => `
            <label class="flex items-center space-x-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <input type="checkbox" value="${make}" ${state.makes.has(make) ? 'checked' : ''} class="make-cb w-4 h-4 text-brand-600 bg-white border-slate-300 rounded focus:ring-brand-500 focus:ring-2 transition-all">
                <span class="text-slate-700 text-sm font-medium group-hover:text-brand-600 transition-colors truncate flex items-center gap-3" title="${make}">
                    <div class="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm border border-slate-100 group-hover:border-brand-200 transition-colors">
                        <img src="${getMakeLogoUrl(make)}" onerror="this.style.display='none'" class="max-w-[16px] max-h-[16px] object-contain" alt="${make} logo">
                    </div>
                    ${make}
                </span>
            </label>
        `).join('');

        if (filteredMakes.length === 0) {
            DOM.makeFilters.innerHTML = `<p class="text-sm text-slate-500 italic p-2">Ничего не найдено</p>`;
        }

        document.querySelectorAll('.make-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) state.makes.add(e.target.value);
                else state.makes.delete(e.target.value);
                updateBrandGridState();
                applyFilters();
            });
        });
    };

    const updateBrandGridState = () => {
        if (!DOM.brandGrid) return;
        document.querySelectorAll('.brand-item').forEach(item => {
            const make = item.dataset.make;
            if (state.makes.has(make)) {
                item.classList.add('border-cyan-400', 'shadow-[0_0_15px_rgba(0,212,255,0.4)]');
                item.classList.remove('border-cyan-900/30');
                const img = item.querySelector('img');
                if(img) img.classList.remove('grayscale', 'opacity-70');
            } else {
                item.classList.remove('border-cyan-400', 'shadow-[0_0_15px_rgba(0,212,255,0.4)]');
                item.classList.add('border-cyan-900/30');
                const img = item.querySelector('img');
                if(img) img.classList.add('grayscale', 'opacity-70');
            }
        });
    };

    const renderBrandGrid = () => {
        if (!DOM.brandGrid) return;
        
        const originalMakesMap = new Map();
        catalog.makes.forEach(m => {
            const clean = m.toLowerCase().trim();
            if (!originalMakesMap.has(clean)) {
                originalMakesMap.set(clean, m);
            }
        });
        
        const makesToShow = Array.from(originalMakesMap.values()).sort();
        
        DOM.brandGrid.innerHTML = makesToShow.map(make => {
            const isActive = state.makes.has(make);
            return `
                <div class="brand-item cyber-glass rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 border ${isActive ? 'border-cyan-400 shadow-[0_0_15px_rgba(0,212,255,0.4)]' : 'border-cyan-900/30 hover:border-cyan-500/50 hover:shadow-[0_0_10px_rgba(0,212,255,0.2)]'} group" data-make="${make}">
                    <img src="${getMakeLogoUrl(make)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" class="h-10 md:h-12 w-auto object-contain mb-2 ${isActive ? '' : 'grayscale opacity-70'} group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300" alt="${make}">
                    <span class="text-[10px] font-mono text-cyan-500 uppercase tracking-widest text-center" style="display: none;">${make}</span>
                </div>
            `;
        }).join('');
        
        document.querySelectorAll('.brand-item').forEach(item => {
            item.addEventListener('click', function() {
                const make = this.dataset.make;
                if (state.makes.has(make)) {
                    state.makes.delete(make);
                } else {
                    state.makes.add(make);
                }
                
                updateBrandGridState();
                
                // update sidebar checkboxes
                document.querySelectorAll('.make-cb').forEach(cb => {
                    if (cb.value === make) {
                        cb.checked = state.makes.has(make);
                    }
                });
                
                applyFilters();
            });
        });
    };

    const createProductCard = (product, index) => {
        const hasImage = !!product.imageUrl;
        const imgPlaceholder = `https://ui-avatars.com/api/?name=${product.article}&background=f8fafc&color=94a3b8&size=400&font-size=0.2`;
        const imgSrc = hasImage ? product.imageUrl : imgPlaceholder;
        
        // Load all items eagerly to avoid slow loading issues
        const loadStrategy = 'eager';
        const priorityStrategy = 'fetchpriority="high"';
        
        let compatHtml = '';
        if (product.compatibility && product.compatibility.length > 0) {
            const makesGroup = {};
            product.compatibility.forEach(c => {
                if (!c.make) return;
                if (!makesGroup[c.make]) makesGroup[c.make] = new Set();
                if (c.model) makesGroup[c.make].add(c.model);
            });
            
            const makes = Object.keys(makesGroup);
            if (makes.length > 0) {
                const displayMakes = makes.slice(0, 3);
                const hasMore = makes.length > 3;
                
                const makeBlocks = displayMakes.map(make => {
                    const models = Array.from(makesGroup[make]).join(', ');
                    return `
                        <div class="flex items-center gap-2 bg-slate-100/80 rounded-md py-1.5 px-2.5 border border-slate-200/60 group/make cursor-help hover:bg-white hover:border-brand-200 hover:shadow-sm transition-all" title="${make}: ${models}">
                            <img src="${getMakeLogoUrl(make)}" onerror="this.style.display='none'" class="h-3.5 object-contain opacity-60 group-hover/make:opacity-100 transition-opacity" alt="${make}">
                            <span class="text-[11px] text-slate-600 font-semibold truncate flex-grow group-hover/make:text-brand-600 transition-colors">${models || make}</span>
                        </div>
                    `;
                }).join('');
                
                compatHtml = `
                    <div class="mb-5 flex flex-col gap-1.5 w-full mt-4">
                        ${makeBlocks}
                        ${hasMore ? `<div class="text-[10px] text-brand-600 font-bold text-center bg-brand-50 rounded py-1 border border-brand-100/50 uppercase tracking-wider">еще ${makes.length - 3} марк${makes.length - 3 > 1 && makes.length - 3 < 5 ? 'и' : 'а'}</div>` : ''}
                    </div>
                `;
            }
        }

        return `
            <div class="product-card bg-white rounded-2xl overflow-hidden flex flex-col h-full cursor-pointer group hover:shadow-2xl transition-all duration-500 border border-slate-200/60 hover:border-brand-300 relative" data-id="${product.id}">
                <!-- Glow effect on hover -->
                <div class="absolute -inset-0.5 bg-gradient-to-r from-brand-400 to-blue-500 rounded-2xl opacity-0 group-hover:opacity-10 blur-md transition-opacity duration-500 -z-10"></div>
                
                <div class="relative h-64 flex items-center justify-center p-6 overflow-hidden border-b border-slate-100/80 bg-slate-50/50 group/img">
                    <!-- Technical corners -->
                    <div class="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-slate-200 z-10 transition-all duration-300 group-hover/img:border-brand-400 group-hover/img:scale-110"></div>
                    <div class="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-slate-200 z-10 transition-all duration-300 group-hover/img:border-brand-400 group-hover/img:scale-110"></div>
                    <div class="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-slate-200 z-10 transition-all duration-300 group-hover/img:border-brand-400 group-hover/img:scale-110"></div>
                    <div class="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-slate-200 z-10 transition-all duration-300 group-hover/img:border-brand-400 group-hover/img:scale-110"></div>
                    
                    <div class="absolute inset-0 flex items-center justify-center opacity-[0.015] pointer-events-none select-none z-0 mix-blend-multiply">
                        <span class="text-6xl font-black tracking-[0.2em] text-slate-900 rotate-[-25deg] uppercase">Westar</span>
                    </div>

                    <!-- Loader for image -->
                    <div class="absolute inset-0 flex items-center justify-center bg-slate-50 z-0 image-loader transition-opacity duration-300">
                        <div class="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>

                    <img src="${imgSrc}" alt="${product.name}" class="relative z-10 max-h-full max-w-full object-contain transition-all duration-200 group-hover:scale-110 group-hover:drop-shadow-xl opacity-0" loading="${loadStrategy}" ${priorityStrategy} onload="this.style.opacity='1'; this.previousElementSibling.style.opacity='0';" onerror="this.onerror=null; this.src='${imgPlaceholder}'; this.style.opacity='1'; this.previousElementSibling.style.opacity='0';">
                    
                    <div class="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end">
                        <div class="bg-white/90 backdrop-blur-md text-[11px] font-mono px-3 py-1.5 rounded-lg text-slate-700 border border-slate-200/80 shadow-sm font-bold tracking-wider group-hover/img:border-brand-300 group-hover/img:text-brand-700 transition-colors">
                            ${product.article}
                        </div>
                        ${product.oem ? `
                        <div class="bg-gradient-to-r from-brand-500 to-blue-600 text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md text-white shadow-md uppercase">
                            OEM
                        </div>
                        ` : ''}
                    </div>
                    
                    ${product.brand ? `
                    <div class="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md p-2 rounded-xl border border-slate-200/80 shadow-sm group-hover/img:border-brand-300 group-hover/img:shadow-md transition-all duration-300">
                        <img src="${getMakeLogoUrl(product.brand)}" onerror="this.style.display='none'" class="h-5 w-auto object-contain opacity-70 grayscale group-hover/img:grayscale-0 group-hover/img:opacity-100 transition-all duration-300" alt="${product.brand}">
                    </div>
                    ` : ''}
                </div>
                <div class="p-6 flex flex-col flex-grow bg-white relative z-10">
                    <div class="text-[11px] font-bold text-brand-500 mb-3 uppercase tracking-wider flex items-center justify-between bg-brand-50/50 inline-flex w-fit px-2.5 py-1 rounded-md">
                        ${product.category}
                    </div>
                    <h3 class="text-slate-800 font-bold text-lg mb-2 flex-grow line-clamp-3 leading-snug group-hover:text-brand-600 transition-colors">${product.name}</h3>
                    ${compatHtml}
                    <div class="flex items-end justify-between mt-auto pt-5 border-t border-slate-100">
                        <div>
                            <p class="text-xs font-semibold mb-1.5 flex items-center gap-2">
                                <span class="relative flex h-2.5 w-2.5">
                                  ${product.stock > 0 ? `<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>` : ''}
                                  <span class="relative inline-flex rounded-full h-2.5 w-2.5 ${product.stock > 0 ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
                                </span>
                                <span class="${product.stock > 0 ? 'text-emerald-600' : 'text-amber-600'} uppercase tracking-wider text-[10px]">${product.stock > 0 ? 'В наличии: ' + product.stock + ' шт.' : 'Под заказ'}</span>
                            </p>
                            <p class="text-2xl font-extrabold text-slate-900 tracking-tight">${formatPrice(product.price)}</p>
                        </div>
                        <button onclick="event.stopPropagation(); window.addToCart('${product.id}')" class="w-12 h-12 rounded-full bg-brand-50 hover:bg-brand-600 flex items-center justify-center transition-all duration-300 border border-brand-100 group-hover:border-brand-500 text-brand-600 hover:text-white group-hover:shadow-md group-hover:-translate-y-1">
                            <svg class="w-6 h-6 transform group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    };

    const openProductModal = (id) => {
        const product = catalog.products.find(p => p.id === id);
        if (!product) return;

        const hasImage = !!product.imageUrl;
        const imgPlaceholder = `https://ui-avatars.com/api/?name=${product.article}&background=f8fafc&color=94a3b8&size=500&font-size=0.2`;
        const imgSrc = hasImage ? product.imageUrl : imgPlaceholder;

        let compatHtml = '<div class="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-500 italic">Сведения о совместимости отсутствуют</div>';
        if (product.compatibility && product.compatibility.length > 0) {
            const makesGroup = {};
            product.compatibility.forEach(c => {
                const make = c.make || 'Разное';
                if (!makesGroup[make]) makesGroup[make] = [];
                makesGroup[make].push(c);
            });
            
            compatHtml = Object.keys(makesGroup).map(make => `
                <div class="mb-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-brand-200 transition-colors">
                    <h5 class="text-sm font-bold text-slate-900 mb-3 flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                            <img src="${getMakeLogoUrl(make)}" onerror="this.style.display='none'" class="max-w-[20px] max-h-[20px] object-contain opacity-80" alt="">
                        </div>
                        ${make}
                    </h5>
                    <ul class="text-sm text-slate-600 space-y-2">
                        ${makesGroup[make].map(c => `
                            <li class="flex items-start gap-2">
                                <svg class="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <div>
                                    <span class="font-semibold text-slate-800">${c.model}</span> 
                                    ${c.years ? `<span class="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-xs ml-1 font-mono">${c.years}</span>` : ''}
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `).join('');
        }

        DOM.modalContent.innerHTML = `
            <!-- Left: Media Gallery -->
            <div class="w-full lg:w-2/5 bg-slate-50/50 p-6 md:p-10 flex flex-col items-center min-h-[400px] gap-6 border-r border-slate-200 relative overflow-hidden">
                <!-- Decorative background -->
                <div class="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-slate-100 to-transparent z-0"></div>
                <div class="absolute inset-4 border border-slate-200/80 rounded-2xl pointer-events-none z-0 border-dashed"></div>

                <div class="flex-grow flex items-center justify-center w-full relative z-10 bg-white rounded-2xl shadow-sm p-8 border border-slate-200 hover:shadow-md transition-shadow" id="modalMainMediaContainer">
                    <!-- Brand Logo -->
                    ${product.brand ? `
                    <div class="absolute top-5 left-5 z-20">
                        <img src="${getMakeLogoUrl(product.brand)}" onerror="this.style.display='none'" class="h-8 w-auto object-contain opacity-60 grayscale transition-all hover:grayscale-0 hover:opacity-100" alt="${product.brand}">
                    </div>
                    ` : ''}
                    
                    <!-- OEM Badge -->
                    ${product.oem ? `
                    <div class="absolute bottom-5 right-5 z-20">
                        <span class="bg-gradient-to-r from-brand-500 to-blue-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest shadow-sm">Оригинал (OEM)</span>
                    </div>
                    ` : ''}

                    <img id="modalMainImage" src="${imgSrc}" alt="${product.name}" class="relative z-10 max-w-full max-h-[400px] object-contain drop-shadow-xl transition-transform duration-700 hover:scale-110">
                    <video id="modalMainVideo" class="relative z-10 max-w-full max-h-[400px] object-contain drop-shadow-xl hidden rounded-xl shadow-2xl border border-slate-100" controls></video>
                </div>
                
                ${(product.imageUrls && product.imageUrls.length > 1) || (product.videoUrls && product.videoUrls.length > 0) ? `
                <div class="flex items-center gap-4 overflow-x-auto custom-scrollbar pb-3 w-full px-2 z-10" id="modalThumbnails">
                    ${product.imageUrls ? product.imageUrls.map((url, i) => `
                        <button class="thumbnail-btn flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all duration-300 shadow-sm bg-white p-1 ${i === 0 ? 'border-brand-500 shadow-md opacity-100 scale-105' : 'border-transparent hover:border-brand-300 opacity-70 hover:opacity-100'}" data-src="${url}" data-type="image">
                            <img src="${url}" class="w-full h-full object-cover rounded-lg" alt="Ракурс ${i+1}">
                        </button>
                    `).join('') : ''}
                    
                    ${product.videoUrls ? product.videoUrls.map((url, i) => `
                        <button class="thumbnail-btn flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 border-transparent hover:border-brand-300 opacity-70 hover:opacity-100 transition-all duration-300 relative shadow-sm bg-slate-800 p-1 group/vid" data-src="${url}" data-type="video">
                            <div class="w-full h-full bg-slate-900 rounded-lg flex items-center justify-center text-white group-hover/vid:text-brand-400 transition-colors">
                                <svg class="w-8 h-8 drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z"></path></svg>
                            </div>
                        </button>
                    `).join('') : ''}
                </div>
                ` : ''}
            </div>
            
            <!-- Right: Details -->
            <div class="w-full lg:w-3/5 p-6 md:p-10 flex flex-col bg-white relative z-10">
                <div class="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider">
                    <span class="text-brand-600 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-100">${product.category}</span>
                    <span class="text-slate-300">•</span>
                    <span class="text-slate-500">${product.purpose || 'Автозапчасть'}</span>
                </div>
                
                <h2 class="text-3xl md:text-4xl font-extrabold text-slate-900 mb-8 leading-tight tracking-tight">${product.name}</h2>
                
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
                    <div class="bg-slate-50 border border-slate-200/70 rounded-2xl p-5 hover:border-brand-300 transition-colors shadow-sm">
                        <p class="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Артикул</p>
                        <p class="font-mono text-slate-900 text-xl font-bold">${product.article}</p>
                    </div>
                    <div class="bg-slate-50 border border-slate-200/70 rounded-2xl p-5 hover:border-brand-300 transition-colors shadow-sm">
                        <p class="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Остаток</p>
                        <p class="font-bold ${product.stock > 0 ? 'text-emerald-600' : 'text-amber-600'} text-xl flex items-center gap-2">
                            <span class="w-3 h-3 rounded-full ${product.stock > 0 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-amber-500'}"></span>
                            ${product.stock > 0 ? product.stock + ' шт.' : 'Под заказ'}
                        </p>
                    </div>
                    <div class="col-span-2 md:col-span-1 bg-gradient-to-br from-brand-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group/price flex flex-col justify-between">
                        <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20 group-hover/price:opacity-40 transition-opacity"></div>
                        <div>
                            <p class="text-[11px] font-bold text-brand-100 uppercase tracking-widest mb-2 relative z-10">Цена</p>
                            <p class="text-3xl font-black tracking-tight relative z-10">${formatPrice(product.price)}</p>
                        </div>
                        <button onclick="window.addToCart('${product.id}')" class="mt-4 w-full bg-white text-brand-600 font-bold py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all relative z-10 flex items-center justify-center gap-2 group/btn">
                            <svg class="w-5 h-5 group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                            В корзину
                        </button>
                    </div>
                </div>
                
                <div class="space-y-10 flex-grow">
                    ${product.description ? `
                    <div class="relative">
                        <h4 class="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            Описание
                        </h4>
                        <div class="text-base text-slate-600 leading-relaxed max-w-none bg-slate-50/80 p-6 rounded-2xl border border-slate-100">
                            ${product.description.replace(/\\n/g, '<br>')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 class="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                                </div>
                                Совместимость
                            </h4>
                            <div class="max-h-80 overflow-y-auto custom-scrollbar pr-2">
                                ${compatHtml}
                            </div>
                        </div>
                        
                        <div>
                            <h4 class="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                </div>
                                Кросс-номера
                            </h4>
                            <div class="bg-slate-50/80 p-6 rounded-2xl border border-slate-100 space-y-6">
                                ${product.oem ? `
                                <div>
                                    <h5 class="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Оригинальный OEM</h5>
                                    <p class="text-base text-slate-900 font-mono bg-white px-3 py-2 rounded-lg border border-slate-200 font-bold shadow-sm inline-block">${product.oem}</p>
                                </div>
                                ` : ''}
                                ${product.analogs ? `
                                <div>
                                    <h5 class="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Аналоги</h5>
                                    <p class="text-sm text-slate-700 whitespace-pre-line leading-relaxed font-mono bg-white p-4 rounded-xl border border-slate-200 shadow-sm">${product.analogs.replace(/\\n/g, '<br>')}</p>
                                </div>
                                ` : '<p class="text-sm text-slate-400 italic bg-white p-4 rounded-xl border border-slate-100">Нет данных об аналогах</p>'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        DOM.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        const mainImage = document.getElementById('modalMainImage');
        const mainVideo = document.getElementById('modalMainVideo');
        const thumbnails = document.querySelectorAll('.thumbnail-btn');
        if (thumbnails.length > 0) {
            thumbnails.forEach(btn => {
                btn.addEventListener('click', function() {
                    const type = this.getAttribute('data-type');
                    const newSrc = this.getAttribute('data-src');
                    
                    if (type === 'video') {
                        mainImage.classList.add('hidden');
                        mainVideo.classList.remove('hidden');
                        mainVideo.src = newSrc;
                        mainVideo.play();
                    } else {
                        mainVideo.pause();
                        mainVideo.classList.add('hidden');
                        mainImage.classList.remove('hidden');
                        mainImage.style.opacity = '0';
                        setTimeout(() => {
                            mainImage.src = newSrc;
                            mainImage.style.opacity = '1';
                        }, 50);
                    }
                    
                    thumbnails.forEach(t => {
                        t.classList.remove('border-brand-500', 'shadow-md', 'opacity-100', 'scale-105');
                        t.classList.add('border-transparent', 'opacity-70');
                    });
                    this.classList.remove('border-transparent', 'opacity-70');
                    this.classList.add('border-brand-500', 'shadow-md', 'opacity-100', 'scale-105');
                });
            });
        }
    };

    const closeModal = () => {
        const mainVideo = document.getElementById('modalMainVideo');
        if (mainVideo) mainVideo.pause();
        DOM.modal.classList.add('hidden');
        document.body.style.overflow = '';
    };

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

        // Re-attach listeners to new cards
        document.querySelectorAll('.product-card').forEach(card => {
            // Remove old listener just in case to prevent duplicates (though insertAdjacentHTML creates new nodes)
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
                const pMakes = new Set();
                if (p.brand) pMakes.add(p.brand);
                if (p.compatibility) p.compatibility.forEach(c => { if(c.make) pMakes.add(c.make); });
                
                let makeMatch = false;
                for (let make of state.makes) {
                    if (pMakes.has(make)) {
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
            trigger.innerHTML = `<div class="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin"></div>`;
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
    
    if (DOM.makeSearchInput) {
        DOM.makeSearchInput.addEventListener('input', (e) => {
            state.makeSearchQuery = e.target.value;
            renderMakeFilters();
        });
    }

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
        
        document.querySelectorAll('.category-cb, .make-cb').forEach(cb => cb.checked = false);
        renderMakeFilters();
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
