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
            <label class="flex items-center space-x-3 cursor-pointer group p-2 rounded-xl hover:bg-cyan-900/20 transition-all border border-transparent hover:border-cyan-900/50">
                <input type="checkbox" value="${cat}" class="category-cb w-4 h-4 text-cyan-500 bg-cyber-dark border-cyan-700/50 rounded focus:ring-cyan-500 focus:ring-2 transition-all shadow-[0_0_10px_rgba(0,212,255,0.1)]">
                <span class="text-slate-300 text-sm font-mono group-hover:text-cyan-400 transition-colors">${cat}</span>
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
                
                applyFilters();
            });
        });
    };

    const createProductCard = (product, index) => {
        const hasImage = !!product.imageUrl;
        const imgPlaceholder = `https://ui-avatars.com/api/?name=${product.article}&background=050b1a&color=00d4ff&size=400&font-size=0.2`;
        const imgSrc = hasImage ? product.imageUrl : imgPlaceholder;
        
        // Load all items eagerly to avoid slow loading issues
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
                const displayCars = uniqueCars.slice(0, 3);
                const hasMore = uniqueCars.length > 3;
                
                const carBlocks = displayCars.map(car => {
                    return `
                        <div class="relative w-16 h-10 bg-cyber-dark/80 rounded-md border border-cyan-900/40 overflow-hidden group/car hover:border-cyan-400 hover:shadow-[0_0_10px_rgba(0,212,255,0.3)] transition-all flex-shrink-0 cursor-help flex items-center justify-center" title="${car.make} ${car.model}">
                            <div class="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjMDBkNGZmIiBmaWxsLW9wYWNpdHk9IjEuMCIvPgo8L3N2Zz4=')] mix-blend-screen"></div>
                            <img src="${getCarImageUrl(car.make, car.model)}" onerror="this.onerror=null; this.src='${getMakeLogoUrl(car.make)}'; this.classList.remove('scale-[1.3]', 'translate-y-1', 'object-cover'); this.classList.add('object-contain', 'p-1', 'opacity-60');" class="w-full h-full object-cover scale-[1.3] translate-y-1 relative z-10 transition-transform duration-300 group-hover/car:scale-[1.5] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] opacity-90 group-hover/car:opacity-100" alt="${car.make} ${car.model}">
                            <div class="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-cyber-dark/90 to-transparent z-10 pointer-events-none"></div>
                        </div>
                    `;
                }).join('');

                compatHtml = `
                    <div class="mb-5 mt-2 w-full">
                        <p class="text-[9px] text-cyan-500/50 font-mono uppercase tracking-widest mb-2">Автомобили:</p>
                        <div class="flex items-center gap-2">
                            ${carBlocks}
                            ${hasMore ? `<div class="flex items-center justify-center w-10 h-10 rounded-md bg-cyan-900/20 border border-cyan-900/50 text-[10px] text-cyan-400 font-bold font-mono shadow-inner">+${uniqueCars.length - 3}</div>` : ''}
                        </div>
                    </div>
                `;
            } else if (makesOnly.size > 0) {
                const makes = Array.from(makesOnly);
                const displayMakes = makes.slice(0, 3);
                const hasMore = makes.length > 3;
                
                const makeBlocks = displayMakes.map(make => {
                    return `
                        <div class="flex items-center justify-center w-10 h-10 bg-cyber-dark/80 rounded-md border border-cyan-900/40 group/make cursor-help hover:border-cyan-400 transition-all shadow-sm" title="${make}">
                            <img src="${getMakeLogoUrl(make)}" onerror="this.style.display='none'" class="max-w-[20px] max-h-[20px] object-contain opacity-60 group-hover/make:opacity-100 transition-all" alt="${make}">
                        </div>
                    `;
                }).join('');
                
                compatHtml = `
                    <div class="mb-5 mt-2 w-full">
                        <p class="text-[9px] text-cyan-500/50 font-mono uppercase tracking-widest mb-2">Марки:</p>
                        <div class="flex items-center gap-2">
                            ${makeBlocks}
                            ${hasMore ? `<div class="flex items-center justify-center w-10 h-10 rounded-md bg-cyan-900/20 border border-cyan-900/50 text-[10px] text-cyan-400 font-bold font-mono shadow-inner">+${makes.length - 3}</div>` : ''}
                        </div>
                    </div>
                `;
            }
        }

        return `
            <div class="product-card cyber-glass rounded-2xl overflow-hidden flex flex-col h-full cursor-pointer group hover:shadow-[0_0_20px_rgba(0,212,255,0.15)] transition-all duration-500 border border-cyan-900/30 hover:border-cyan-400/80 relative" data-id="${product.id}">
                <!-- Glow effect on hover -->
                <div class="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl opacity-0 group-hover:opacity-10 blur-md transition-opacity duration-500 -z-10"></div>
                
                <div class="relative h-64 flex items-center justify-center p-6 overflow-hidden border-b border-cyan-900/30 bg-cyber-dark/50 group/img">
                    <!-- Technical corners -->
                    <div class="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-cyan-800/50 z-10 transition-all duration-300 group-hover/img:border-cyan-400 group-hover/img:scale-110"></div>
                    <div class="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-cyan-800/50 z-10 transition-all duration-300 group-hover/img:border-cyan-400 group-hover/img:scale-110"></div>
                    <div class="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-cyan-800/50 z-10 transition-all duration-300 group-hover/img:border-cyan-400 group-hover/img:scale-110"></div>
                    <div class="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-cyan-800/50 z-10 transition-all duration-300 group-hover/img:border-cyan-400 group-hover/img:scale-110"></div>
                    
                    <div class="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none select-none z-0">
                        <span class="text-6xl font-black tracking-[0.2em] text-cyan-100 rotate-[-25deg] uppercase">Westar</span>
                    </div>

                    <!-- Loader for image -->
                    <div class="absolute inset-0 flex items-center justify-center bg-cyber-dark z-0 image-loader transition-opacity duration-300">
                        <div class="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin shadow-[0_0_10px_rgba(0,212,255,0.5)]"></div>
                    </div>

                    <img src="${imgSrc}" alt="${product.name}" class="relative z-10 max-h-full max-w-full object-contain transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_15px_rgba(0,212,255,0.2)] opacity-0" loading="${loadStrategy}" ${priorityStrategy} onload="this.style.opacity='1'; this.previousElementSibling.style.opacity='0';" onerror="this.onerror=null; this.src='${imgPlaceholder}'; this.style.opacity='1'; this.previousElementSibling.style.opacity='0';">
                    
                    <div class="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end">
                        <div class="bg-cyber-dark/90 backdrop-blur-md text-[10px] font-mono px-3 py-1.5 rounded-lg text-cyan-400 border border-cyan-900/50 shadow-[0_0_10px_rgba(0,0,0,0.5)] font-bold tracking-wider group-hover/img:border-cyan-400 transition-colors">
                            ${product.article}
                        </div>
                        ${product.oem ? `
                        <div class="bg-gradient-to-r from-cyan-600 to-blue-600 text-[9px] font-bold tracking-wider px-2.5 py-1 rounded-md text-white shadow-[0_0_10px_rgba(0,212,255,0.3)] border border-cyan-400/30 uppercase">
                            OEM
                        </div>
                        ` : ''}
                    </div>
                    
                    ${product.brand ? `
                    <div class="absolute bottom-4 left-4 z-20 bg-cyber-dark/90 backdrop-blur-md p-2 rounded-xl border border-cyan-900/50 shadow-[0_0_10px_rgba(0,0,0,0.5)] group-hover/img:border-cyan-400 transition-all duration-300">
                        <img src="${getMakeLogoUrl(product.brand)}" onerror="this.style.display='none'" class="h-4 w-auto object-contain opacity-70 grayscale group-hover/img:grayscale-0 group-hover/img:opacity-100 transition-all duration-300" alt="${product.brand}">
                    </div>
                    ` : ''}
                </div>
                <div class="p-6 flex flex-col flex-grow bg-cyber-dark/40 relative z-10">
                    <div class="text-[10px] font-mono text-cyan-400 mb-3 uppercase tracking-wider flex items-center justify-between bg-cyan-900/20 border border-cyan-900/40 inline-flex w-fit px-2.5 py-1 rounded-md">
                        ${product.category}
                    </div>
                    <h3 class="text-white font-bold text-lg mb-2 flex-grow line-clamp-3 leading-snug group-hover:text-cyan-300 transition-colors font-space">${product.name}</h3>
                    ${compatHtml}
                    <div class="flex items-end justify-between mt-auto pt-5 border-t border-cyan-900/30">
                        <div>
                            <p class="text-xs font-mono mb-1.5 flex items-center gap-2">
                                <span class="relative flex h-2 w-2">
                                  ${product.stock > 0 ? `<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>` : ''}
                                  <span class="relative inline-flex rounded-full h-2 w-2 ${product.stock > 0 ? 'bg-cyan-500 shadow-[0_0_8px_rgba(0,212,255,0.8)]' : 'bg-amber-500'}"></span>
                                </span>
                                <span class="${product.stock > 0 ? 'text-cyan-400' : 'text-amber-500'} uppercase tracking-wider text-[9px]">${product.stock > 0 ? 'В наличии: ' + product.stock + ' шт.' : 'Под заказ'}</span>
                            </p>
                            <p class="text-2xl font-black text-white tracking-widest font-space">${formatPrice(product.price)}</p>
                        </div>
                        <button onclick="event.stopPropagation(); window.addToCart('${product.id}')" class="w-12 h-12 rounded-xl bg-cyber-dark hover:bg-cyan-900/40 flex items-center justify-center transition-all duration-300 border border-cyan-900/50 hover:border-cyan-400 text-cyan-500 hover:text-cyan-300 shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:shadow-[0_0_15px_rgba(0,212,255,0.3)] group/btn">
                            <svg class="w-5 h-5 transform group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    };

    const getCarImageUrl = (make, model) => {
        let cleanMake = make.trim().toLowerCase();
        
        if (cleanMake === 'mercedes-benz' || cleanMake === 'mercedes benz') cleanMake = 'mercedes';
        if (cleanMake === 'vw') cleanMake = 'volkswagen';
        
        cleanMake = cleanMake.replace(/\s+/g, '-');
        
        let cleanModel = '';
        if (model) {
            cleanModel = model.trim().toLowerCase();
            cleanModel = cleanModel.split('(')[0].split('/')[0].trim();
            cleanModel = cleanModel.replace(/\s+[ivx]+$/i, ''); 
            cleanModel = cleanModel.replace(/\s+/g, ''); 
        }
        
        return `https://cdn.imagin.studio/getImage?customer=hr&make=${cleanMake}&modelFamily=${cleanModel}&angle=23`;
    };

    const openProductModal = (id) => {
        const product = catalog.products.find(p => p.id === id);
        if (!product) return;

        const hasImage = !!product.imageUrl;
        const imgPlaceholder = `https://ui-avatars.com/api/?name=${product.article}&background=050b1a&color=00d4ff&size=500&font-size=0.2`;
        const imgSrc = hasImage ? product.imageUrl : imgPlaceholder;

        let compatHtml = '<div class="p-4 bg-cyber-dark/50 rounded-xl border border-cyan-900/30 text-sm text-cyan-500/50 italic font-mono uppercase text-center">Сведения о совместимости отсутствуют</div>';
        if (product.compatibility && product.compatibility.length > 0) {
            const makesGroup = {};
            product.compatibility.forEach(c => {
                const make = c.make || 'Разное';
                if (!makesGroup[make]) makesGroup[make] = {};
                const model = c.model || 'Разное';
                if (!makesGroup[make][model]) makesGroup[make][model] = [];
                makesGroup[make][model].push(c);
            });
            
            compatHtml = Object.keys(makesGroup).map(make => `
                <div class="mb-6">
                    <h5 class="text-sm font-bold text-cyan-400 mb-4 flex items-center gap-3 font-space uppercase tracking-widest border-b border-cyan-900/30 pb-2">
                        <div class="w-8 h-8 rounded-lg bg-cyber-dark flex items-center justify-center border border-cyan-900/50 shadow-[0_0_10px_rgba(0,212,255,0.1)]">
                            <img src="${getMakeLogoUrl(make)}" onerror="this.style.display='none'" class="max-w-[20px] max-h-[20px] object-contain" alt="">
                        </div>
                        ${make}
                    </h5>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        ${Object.keys(makesGroup[make]).map(model => `
                            <div class="bg-cyber-dark/40 rounded-xl border border-cyan-900/30 overflow-hidden hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(0,212,255,0.15)] transition-all group/model flex flex-col cursor-crosshair">
                                <div class="h-28 bg-cyber-dark/80 relative flex items-center justify-center overflow-hidden border-b border-cyan-900/30">
                                    <div class="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjMDBkNGZmIiBmaWxsLW9wYWNpdHk9IjEuMCIvPgo8L3N2Zz4=')] mix-blend-screen"></div>
                                    <!-- Scanline animation on hover -->
                                    <div class="absolute left-0 right-0 h-0.5 bg-cyan-400/50 top-0 -translate-y-full opacity-0 group-hover/model:animate-[scan_2s_ease-in-out_infinite] group-hover/model:opacity-100 z-20 shadow-[0_0_8px_rgba(0,212,255,0.8)]"></div>
                                    <img src="${getCarImageUrl(make, model)}" onerror="this.style.display='none'" class="h-full object-contain relative z-10 transition-transform duration-500 group-hover/model:scale-110 drop-shadow-xl opacity-90 group-hover/model:opacity-100" alt="${make} ${model}">
                                </div>
                                <div class="p-3 flex-grow flex flex-col justify-center">
                                    <h6 class="font-bold text-white text-xs mb-2 group-hover/model:text-cyan-400 transition-colors uppercase font-mono tracking-wider">${model !== 'Разное' ? model : make}</h6>
                                    <div class="flex flex-wrap gap-1.5">
                                        ${makesGroup[make][model].map(c => c.years ? `<span class="bg-cyan-900/30 border border-cyan-700/50 text-cyan-300 px-2 py-0.5 rounded text-[9px] font-mono">${c.years}</span>` : '').join('')}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }

        DOM.modalContent.innerHTML = `
            <!-- Left: Media Gallery -->
            <div class="w-full lg:w-2/5 bg-cyber-dark/80 p-6 md:p-10 flex flex-col items-center min-h-[400px] gap-6 border-r border-cyan-900/50 relative overflow-hidden">
                <!-- Decorative background -->
                <div class="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-cyan-900/20 to-transparent z-0"></div>
                <div class="absolute inset-4 border border-cyan-900/30 rounded-2xl pointer-events-none z-0 border-dashed"></div>

                <div class="flex-grow flex items-center justify-center w-full relative z-10 bg-cyber-dark/50 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] p-8 border border-cyan-500/20 hover:border-cyan-400/50 transition-colors" id="modalMainMediaContainer">
                    <!-- Brand Logo -->
                    ${product.brand ? `
                    <div class="absolute top-5 left-5 z-20 bg-cyber-dark/80 p-2 rounded-lg border border-cyan-900/50 backdrop-blur-sm">
                        <img src="${getMakeLogoUrl(product.brand)}" onerror="this.style.display='none'" class="h-6 w-auto object-contain opacity-70 grayscale transition-all hover:grayscale-0 hover:opacity-100" alt="${product.brand}">
                    </div>
                    ` : ''}
                    
                    <!-- OEM Badge -->
                    ${product.oem ? `
                    <div class="absolute bottom-5 right-5 z-20">
                        <span class="bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest shadow-[0_0_10px_rgba(0,212,255,0.4)] border border-cyan-400/30">Оригинал (OEM)</span>
                    </div>
                    ` : ''}

                    <img id="modalMainImage" src="${imgSrc}" alt="${product.name}" class="relative z-10 max-w-full max-h-[400px] object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-transform duration-700 hover:scale-110">
                    <video id="modalMainVideo" class="relative z-10 max-w-full max-h-[400px] object-contain drop-shadow-xl hidden rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.8)] border border-cyan-900/50" controls></video>
                </div>
                
                ${(product.imageUrls && product.imageUrls.length > 1) || (product.videoUrls && product.videoUrls.length > 0) ? `
                <div class="flex items-center gap-4 overflow-x-auto custom-scrollbar pb-3 w-full px-2 z-10" id="modalThumbnails">
                    ${product.imageUrls ? product.imageUrls.map((url, i) => `
                        <button class="thumbnail-btn flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all duration-300 shadow-[0_0_10px_rgba(0,0,0,0.5)] bg-cyber-dark p-1 ${i === 0 ? 'border-cyan-400 shadow-[0_0_15px_rgba(0,212,255,0.3)] opacity-100 scale-105' : 'border-cyan-900/30 hover:border-cyan-50 opacity-60 hover:opacity-100'}" data-src="${url}" data-type="image">
                            <img src="${url}" class="w-full h-full object-cover rounded-lg" alt="Ракурс ${i+1}">
                        </button>
                    `).join('') : ''}
                    
                    ${product.videoUrls ? product.videoUrls.map((url, i) => `
                        <button class="thumbnail-btn flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 border-cyan-900/30 hover:border-cyan-50 opacity-60 hover:opacity-100 transition-all duration-300 relative shadow-[0_0_10px_rgba(0,0,0,0.5)] bg-cyber-dark p-1 group/vid" data-src="${url}" data-type="video">
                            <div class="w-full h-full bg-cyber-dark/80 rounded-lg flex items-center justify-center text-cyan-600 group-hover/vid:text-cyan-400 transition-colors">
                                <svg class="w-8 h-8 drop-shadow-[0_0_5px_rgba(0,212,255,0.5)]" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z"></path></svg>
                            </div>
                        </button>
                    `).join('') : ''}
                </div>
                ` : ''}
            </div>
            
            <!-- Right: Details -->
            <div class="w-full lg:w-3/5 p-6 md:p-10 flex flex-col bg-cyber-panel relative z-10 border-l border-cyan-900/30">
                <div class="mb-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest font-mono">
                    <span class="text-cyan-400 px-3 py-1.5 rounded-lg bg-cyan-900/20 border border-cyan-900/50">${product.category}</span>
                    <span class="text-cyan-800">•</span>
                    <span class="text-cyan-500/70">${product.purpose || 'Автозапчасть'}</span>
                </div>
                
                <h2 class="text-2xl md:text-3xl font-bold text-white mb-8 leading-tight font-space tracking-wider uppercase">${product.name}</h2>
                
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
                    <div class="bg-cyber-dark/50 border border-cyan-900/30 rounded-xl p-5 hover:border-cyan-500/50 transition-colors shadow-sm">
                        <p class="text-[10px] font-bold text-cyan-500/70 uppercase tracking-widest mb-2 font-mono">Артикул</p>
                        <p class="font-mono text-cyan-400 text-lg font-bold">${product.article}</p>
                    </div>
                    <div class="bg-cyber-dark/50 border border-cyan-900/30 rounded-xl p-5 hover:border-cyan-500/50 transition-colors shadow-sm">
                        <p class="text-[10px] font-bold text-cyan-500/70 uppercase tracking-widest mb-2 font-mono">Остаток</p>
                        <p class="font-bold ${product.stock > 0 ? 'text-cyan-400' : 'text-amber-500'} text-lg flex items-center gap-2 font-mono">
                            <span class="w-2.5 h-2.5 rounded-full ${product.stock > 0 ? 'bg-cyan-500 shadow-[0_0_10px_rgba(0,212,255,0.6)]' : 'bg-amber-500'}"></span>
                            ${product.stock > 0 ? product.stock + ' шт.' : 'Под заказ'}
                        </p>
                    </div>
                    <div class="col-span-2 md:col-span-1 bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border border-cyan-500/30 rounded-xl p-5 text-white shadow-[0_0_15px_rgba(0,212,255,0.1)] relative overflow-hidden group/price flex flex-col justify-between">
                        <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjMDBkNGZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20 group-hover/price:opacity-40 transition-opacity"></div>
                        <div>
                            <p class="text-[10px] font-bold text-cyan-300 uppercase tracking-widest mb-2 relative z-10 font-mono">Цена</p>
                            <p class="text-2xl font-black tracking-widest relative z-10 font-space text-cyan-50">${formatPrice(product.price)}</p>
                        </div>
                        <button onclick="window.addToCart('${product.id}')" class="mt-4 w-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-bold py-2.5 rounded-lg border border-cyan-500/50 shadow-[0_0_10px_rgba(0,212,255,0.2)] hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] transition-all relative z-10 flex items-center justify-center gap-2 group/btn font-mono uppercase text-[10px] tracking-wider">
                            <svg class="w-4 h-4 group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                            В КОРЗИНУ
                        </button>
                    </div>
                </div>
                
                <div class="space-y-10 flex-grow">
                    ${product.description ? `
                    <div class="relative">
                        <h4 class="text-lg font-bold text-white mb-4 flex items-center gap-3 font-space tracking-wider uppercase">
                            <div class="w-8 h-8 rounded-lg bg-cyan-900/30 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_10px_rgba(0,212,255,0.1)]">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            Описание
                        </h4>
                        <div class="text-sm text-slate-300 leading-relaxed max-w-none bg-cyber-dark/50 p-6 rounded-xl border border-cyan-900/30 font-sans shadow-inner">
                            ${product.description.replace(/\\n/g, '<br>')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 class="text-lg font-bold text-white mb-4 flex items-center gap-3 font-space tracking-wider uppercase">
                                <div class="w-8 h-8 rounded-lg bg-cyan-900/30 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_10px_rgba(0,212,255,0.1)]">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                                </div>
                                Совместимость
                            </h4>
                            <div class="max-h-80 overflow-y-auto custom-scrollbar pr-2">
                                ${compatHtml}
                            </div>
                        </div>
                        
                        <div>
                            <h4 class="text-lg font-bold text-white mb-4 flex items-center gap-3 font-space tracking-wider uppercase">
                                <div class="w-8 h-8 rounded-lg bg-cyan-900/30 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_10px_rgba(0,212,255,0.1)]">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                </div>
                                Кросс-номера
                            </h4>
                            <div class="bg-cyber-dark/50 p-6 rounded-xl border border-cyan-900/30 space-y-6 shadow-inner">
                                ${product.oem ? `
                                <div>
                                    <h5 class="text-[10px] font-bold text-cyan-500/70 uppercase tracking-widest mb-2 font-mono">Оригинальный OEM</h5>
                                    <p class="text-sm text-cyan-300 font-mono bg-cyber-dark px-3 py-2 rounded-lg border border-cyan-900/50 shadow-sm inline-block shadow-[0_0_10px_rgba(0,212,255,0.1)]">${product.oem}</p>
                                </div>
                                ` : ''}
                                ${product.analogs ? `
                                <div>
                                    <h5 class="text-[10px] font-bold text-cyan-500/70 uppercase tracking-widest mb-2 font-mono">Аналоги</h5>
                                    <p class="text-xs text-slate-300 whitespace-pre-line leading-relaxed font-mono bg-cyber-dark p-4 rounded-xl border border-cyan-900/50 shadow-sm">${product.analogs.replace(/\\n/g, '<br>')}</p>
                                </div>
                                ` : '<p class="text-xs text-cyan-700/50 italic bg-cyber-dark p-4 rounded-xl border border-cyan-900/30 font-mono">Нет данных об аналогах</p>'}
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
                        t.classList.remove('border-cyan-400', 'shadow-[0_0_15px_rgba(0,212,255,0.3)]', 'opacity-100', 'scale-105');
                        t.classList.add('border-cyan-900/30', 'opacity-60');
                    });
                    this.classList.remove('border-cyan-900/30', 'opacity-60');
                    this.classList.add('border-cyan-400', 'shadow-[0_0_15px_rgba(0,212,255,0.3)]', 'opacity-100', 'scale-105');
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
            trigger.innerHTML = `<div class="w-10 h-10 border-4 border-cyan-900/30 border-t-cyan-500 rounded-full animate-spin shadow-[0_0_15px_rgba(0,212,255,0.4)]"></div>`;
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
