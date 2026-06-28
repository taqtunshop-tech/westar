document.addEventListener('DOMContentLoaded', () => {
    // Проверка загрузки данных
    if (!window.WESTAR_CATALOG) {
        console.error('Каталог не загружен!');
        document.getElementById('resultsCount').textContent = 'Ошибка загрузки данных';
        return;
    }

    const catalog = window.WESTAR_CATALOG;
    
    // Состояние фильтров
    const state = {
        searchQuery: '',
        categories: new Set(),
        makes: new Set(),
        makeSearchQuery: '',
        sortBy: 'default'
    };

    // Элементы DOM
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
        
        modal: document.getElementById('productModal'),
        modalBackdrop: document.getElementById('modalBackdrop'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        modalContent: document.getElementById('modalContent')
    };

    // Форматирование цены
    const formatPrice = (price) => {
        return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
    };

    // Получение URL логотипа марки авто
    const getMakeLogoUrl = (make) => {
        if (!make) return '';
        let cleanMake = make.toLowerCase().trim();
        // Обработка особых случаев
        if (cleanMake === 'gm' || cleanMake === 'general motors') cleanMake = 'gmc';
        return `https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/${cleanMake}.png`;
    };

    // Инициализация фильтров
    const initFilters = () => {
        // Категории
        DOM.categoryFilters.innerHTML = catalog.categories.map(cat => `
            <label class="flex items-center space-x-3 cursor-pointer group">
                <input type="checkbox" value="${cat}" class="category-cb form-checkbox h-4 w-4 text-brand-500 rounded border-slate-600 bg-slate-800 focus:ring-brand-500 focus:ring-offset-slate-900 transition duration-150 ease-in-out">
                <span class="text-slate-300 text-sm group-hover:text-white transition-colors">${cat}</span>
            </label>
        `).join('');

        document.querySelectorAll('.category-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) state.categories.add(e.target.value);
                else state.categories.delete(e.target.value);
                render();
            });
        });

        renderMakeFilters();
    };

    const renderMakeFilters = () => {
        const filteredMakes = catalog.makes.filter(m => m.toLowerCase().includes(state.makeSearchQuery.toLowerCase()));
        
        DOM.makeFilters.innerHTML = filteredMakes.map(make => `
            <label class="flex items-center space-x-3 cursor-pointer group">
                <input type="checkbox" value="${make}" ${state.makes.has(make) ? 'checked' : ''} class="make-cb form-checkbox h-4 w-4 text-brand-500 rounded border-slate-600 bg-slate-800 focus:ring-brand-500 focus:ring-offset-slate-900 transition duration-150 ease-in-out">
                <span class="text-slate-300 text-sm group-hover:text-white transition-colors truncate flex items-center gap-2" title="${make}">
                    <img src="${getMakeLogoUrl(make)}" onerror="this.style.display='none'" class="w-5 h-5 object-contain" alt="${make} logo">
                    ${make}
                </span>
            </label>
        `).join('');

        if (filteredMakes.length === 0) {
            DOM.makeFilters.innerHTML = `<p class="text-xs text-slate-500 italic">Ничего не найдено</p>`;
        }

        document.querySelectorAll('.make-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) state.makes.add(e.target.value);
                else state.makes.delete(e.target.value);
                render();
            });
        });
    };

    // Карточка товара
    const createProductCard = (product) => {
        const hasImage = !!product.imageUrl;
        const imgPlaceholder = `https://ui-avatars.com/api/?name=${product.article}&background=1e293b&color=94a3b8&size=300&font-size=0.2`;
        const imgSrc = hasImage ? product.imageUrl : imgPlaceholder;
        
        return `
            <div class="product-card glass-panel rounded-2xl overflow-hidden flex flex-col h-full cursor-pointer group" data-id="${product.id}">
                <div class="relative h-48 bg-slate-800 flex items-center justify-center p-4 overflow-hidden border-b border-slate-800/50">
                    <img src="${imgSrc}" alt="${product.name}" class="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-110" loading="lazy">
                    <div class="absolute top-3 right-3 bg-slate-900/80 backdrop-blur text-xs font-mono px-2 py-1 rounded text-slate-300 border border-slate-700">
                        ${product.article}
                    </div>
                </div>
                <div class="p-5 flex flex-col flex-grow">
                    <div class="text-[10px] font-semibold text-brand-400 mb-2 uppercase tracking-wider flex items-center justify-between">
                        <span>${product.category}</span>
                        <span class="text-slate-500 text-right w-1/2 truncate ml-2 flex items-center justify-end gap-1">
                            ${product.brand ? `<img src="${getMakeLogoUrl(product.brand)}" onerror="this.style.display='none'" class="h-3 object-contain opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all" alt="">` : ''}
                            ${product.brand || 'Westar'}
                        </span>
                    </div>
                    <h3 class="text-white font-medium text-sm mb-4 flex-grow line-clamp-3 leading-snug group-hover:text-brand-300 transition-colors">${product.name}</h3>
                    <div class="flex items-end justify-between mt-auto pt-4 border-t border-slate-800/50">
                        <div>
                            <p class="text-xs text-slate-400 mb-1">Остаток: <span class="text-emerald-400 font-medium">${product.stock > 0 ? product.stock + ' шт.' : 'Под заказ'}</span></p>
                            <p class="text-lg font-bold text-white">${formatPrice(product.price)}</p>
                        </div>
                        <button class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-brand-600 flex items-center justify-center transition-all duration-300 border border-slate-700 hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/30">
                            <svg class="w-5 h-5 text-white transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    };

    // Окно товара
    const openProductModal = (id) => {
        const product = catalog.products.find(p => p.id === id);
        if (!product) return;

        const hasImage = !!product.imageUrl;
        const imgPlaceholder = `https://ui-avatars.com/api/?name=${product.article}&background=1e293b&color=94a3b8&size=500&font-size=0.2`;
        const imgSrc = hasImage ? product.imageUrl : imgPlaceholder;

        let compatHtml = '<p class="text-sm text-slate-400">Информация не указана</p>';
        if (product.compatibility && product.compatibility.length > 0) {
            const makesGroup = {};
            product.compatibility.forEach(c => {
                const make = c.make || 'Разное';
                if (!makesGroup[make]) makesGroup[make] = [];
                makesGroup[make].push(c);
            });
            
            compatHtml = Object.keys(makesGroup).map(make => `
                <div class="mb-3">
                    <h5 class="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                        <img src="${getMakeLogoUrl(make)}" onerror="this.style.display='none'" class="w-5 h-5 object-contain" alt="">
                        ${make}
                    </h5>
                    <ul class="text-sm text-slate-400 space-y-1 pl-4 border-l-2 border-slate-700">
                        ${makesGroup[make].map(c => `<li><span class="text-slate-300">${c.model}</span> <span class="text-slate-500">${c.years ? '('+c.years+')' : ''}</span></li>`).join('')}
                    </ul>
                </div>
            `).join('');
        }

        DOM.modalContent.innerHTML = `
            <!-- Left: Image -->
            <div class="w-full md:w-2/5 bg-slate-800 p-8 flex items-center justify-center min-h-[300px]">
                <img src="${imgSrc}" alt="${product.name}" class="max-w-full max-h-[400px] object-contain drop-shadow-2xl">
            </div>
            
            <!-- Right: Details -->
            <div class="w-full md:w-3/5 p-6 md:p-10 flex flex-col bg-slate-900">
                <div class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                    <span class="text-brand-400">${product.category}</span>
                    <span class="text-slate-600">•</span>
                    <span class="text-slate-400">${product.purpose || 'Автозапчасть'}</span>
                </div>
                
                <h2 class="text-2xl md:text-3xl font-bold text-white mb-6 leading-tight">${product.name}</h2>
                
                <div class="flex flex-wrap items-center gap-4 mb-8">
                    <div class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex-1 min-w-[120px]">
                        <p class="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Артикул</p>
                        <p class="font-mono text-white text-lg">${product.article}</p>
                    </div>
                    <div class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex-1 min-w-[120px]">
                        <p class="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Остаток</p>
                        <p class="font-medium text-emerald-400 text-lg">${product.stock > 0 ? product.stock + ' шт.' : 'Под заказ'}</p>
                    </div>
                    <div class="bg-gradient-to-br from-brand-600 to-blue-700 rounded-xl px-5 py-3 shadow-lg shadow-brand-500/20 text-white min-w-[140px]">
                        <p class="text-[10px] text-brand-100 uppercase tracking-wider mb-1">Цена</p>
                        <p class="text-2xl font-bold">${formatPrice(product.price)}</p>
                    </div>
                </div>
                
                <div class="space-y-8 flex-grow">
                    ${product.description ? `
                    <div>
                        <h4 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                            <svg class="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Описание
                        </h4>
                        <div class="text-sm text-slate-300 leading-relaxed max-w-none">
                            ${product.description.replace(/\\n/g, '<br>')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <!-- Compatibility -->
                        <div>
                            <h4 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                <svg class="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                                Совместимость
                            </h4>
                            <div class="max-h-60 overflow-y-auto custom-scrollbar pr-2 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                ${compatHtml}
                            </div>
                        </div>
                        
                        <!-- OEM & Analogs -->
                        <div>
                            <h4 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                <svg class="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                Номера
                            </h4>
                            <div class="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                ${product.oem ? `
                                <div class="mb-4">
                                    <h5 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">OEM номер</h5>
                                    <p class="text-sm text-white font-mono bg-slate-800 px-2 py-1 rounded inline-block border border-slate-700">${product.oem}</p>
                                </div>
                                ` : ''}
                                ${product.analogs ? `
                                <div>
                                    <h5 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Кросс-номера</h5>
                                    <p class="text-sm text-slate-300 whitespace-pre-line leading-relaxed">${product.analogs.replace(/\\n/g, '<br>')}</p>
                                </div>
                                ` : '<p class="text-sm text-slate-400 italic">Нет данных об аналогах</p>'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        DOM.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        DOM.modal.classList.add('hidden');
        document.body.style.overflow = '';
    };

    DOM.closeModalBtn.addEventListener('click', closeModal);
    DOM.modalBackdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !DOM.modal.classList.contains('hidden')) closeModal();
    });

    // Фильтрация, сортировка и рендер
    const render = () => {
        let filtered = catalog.products.filter(p => {
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
            return true;
        });

        switch (state.sortBy) {
            case 'price_asc': filtered.sort((a, b) => a.price - b.price); break;
            case 'price_desc': filtered.sort((a, b) => b.price - a.price); break;
            case 'stock_desc': filtered.sort((a, b) => b.stock - a.stock); break;
            default: break;
        }

        DOM.resultsCount.textContent = `Найдено: ${filtered.length}`;
        
        if (filtered.length === 0) {
            DOM.productsGrid.innerHTML = '';
            DOM.productsGrid.classList.add('hidden');
            DOM.emptyState.classList.remove('hidden');
            DOM.emptyState.classList.add('flex');
        } else {
            DOM.emptyState.classList.add('hidden');
            DOM.emptyState.classList.remove('flex');
            DOM.productsGrid.classList.remove('hidden');
            DOM.productsGrid.innerHTML = filtered.map(createProductCard).join('');
            
            document.querySelectorAll('.product-card').forEach(card => {
                card.addEventListener('click', () => openProductModal(card.dataset.id));
            });
        }
    };

    const handleSearch = (e) => {
        state.searchQuery = e.target.value;
        if (e.target.id === 'searchInput') DOM.searchInputMobile.value = state.searchQuery;
        if (e.target.id === 'searchInputMobile') DOM.searchInput.value = state.searchQuery;
        render();
    };

    DOM.searchInput.addEventListener('input', handleSearch);
    DOM.searchInputMobile.addEventListener('input', handleSearch);
    
    DOM.makeSearchInput.addEventListener('input', (e) => {
        state.makeSearchQuery = e.target.value;
        renderMakeFilters();
    });

    DOM.sortSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        render();
    });

    const resetAll = () => {
        state.searchQuery = '';
        state.categories.clear();
        state.makes.clear();
        state.makeSearchQuery = '';
        state.sortBy = 'default';
        
        DOM.searchInput.value = '';
        DOM.searchInputMobile.value = '';
        DOM.makeSearchInput.value = '';
        DOM.sortSelect.value = 'default';
        
        document.querySelectorAll('.category-cb, .make-cb').forEach(cb => cb.checked = false);
        renderMakeFilters();
        render();
    };

    DOM.resetFiltersBtn.addEventListener('click', resetAll);
    DOM.clearSearchBtn.addEventListener('click', resetAll);

    // Запуск
    initFilters();
    render();
});
