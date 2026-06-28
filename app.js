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
    const createProductCard = (product, index = 0) => {
        const hasImage = !!product.imageUrl;
        const imgPlaceholder = `https://ui-avatars.com/api/?name=${product.article}&background=f1f5f9&color=64748b&size=300&font-size=0.2`;
        const imgSrc = hasImage ? product.imageUrl : imgPlaceholder;
        
        // Eager load first 6 images, lazy load the rest
        const loadStrategy = index < 6 ? 'eager' : 'lazy';
        const priorityStrategy = index < 4 ? 'fetchpriority="high"' : '';
        
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
                        <div class="flex items-center gap-2 bg-slate-50 rounded-lg py-1.5 px-2 border border-slate-200 group/make cursor-help" title="${make}: ${models}">
                            <img src="${getMakeLogoUrl(make)}" onerror="this.style.display='none'" class="h-4 object-contain opacity-70 group-hover/make:opacity-100 transition-opacity" alt="${make}">
                            <span class="text-[10px] text-slate-500 font-medium truncate flex-grow group-hover/make:text-brand-600 transition-colors">${models || make}</span>
                        </div>
                    `;
                }).join('');
                
                compatHtml = `
                    <div class="mb-4 flex flex-col gap-1.5 w-full mt-3">
                        ${makeBlocks}
                        ${hasMore ? `<div class="text-[10px] text-slate-400 font-medium text-center bg-slate-100/50 rounded py-1 border border-slate-200">еще ${makes.length - 3} марк${makes.length - 3 > 1 && makes.length - 3 < 5 ? 'и' : 'а'}...</div>` : ''}
                    </div>
                `;
            }
        }

        return `
            <div class="product-card rounded-2xl overflow-hidden flex flex-col h-full cursor-pointer group" data-id="${product.id}">
                <div class="relative h-56 flex items-center justify-center p-4 overflow-hidden border-b border-slate-100 bg-white">
                    <img src="${imgSrc}" alt="${product.name}" class="max-h-full max-w-full object-contain transition-transform duration-700 group-hover:scale-110 drop-shadow-sm" loading="${loadStrategy}" ${priorityStrategy}>
                    <div class="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-xs font-mono px-2 py-1 rounded text-slate-600 border border-slate-200 shadow-sm font-semibold">
                        ${product.article}
                    </div>
                </div>
                <div class="p-5 flex flex-col flex-grow bg-white">
                    <div class="text-[10px] font-semibold text-brand-500 mb-3 uppercase tracking-wider flex items-center justify-between">
                        <span class="label-caps">${product.category}</span>
                        <span class="text-slate-500 text-right w-1/2 truncate ml-2 flex items-center justify-end gap-1">
                            ${product.brand ? `<img src="${getMakeLogoUrl(product.brand)}" onerror="this.style.display='none'" class="h-4 object-contain opacity-70 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt="">` : ''}
                            ${product.brand || 'Westar'}
                        </span>
                    </div>
                    <h3 class="text-slate-800 font-semibold text-base mb-2 flex-grow line-clamp-3 leading-snug group-hover:text-brand-600 transition-colors">${product.name}</h3>
                    ${compatHtml}
                    <div class="flex items-end justify-between mt-auto pt-4 border-t border-slate-100">
                        <div>
                            <p class="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full ${product.stock > 0 ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
                                <span class="${product.stock > 0 ? 'text-emerald-600' : 'text-amber-600'}">${product.stock > 0 ? product.stock + ' шт.' : 'Под заказ'}</span>
                            </p>
                            <p class="text-xl font-bold text-slate-900 tracking-tight">${formatPrice(product.price)}</p>
                        </div>
                        <button class="w-10 h-10 rounded-xl bg-slate-50 hover:bg-brand-50 flex items-center justify-center transition-all duration-300 border border-slate-200 hover:border-brand-300 text-slate-400 hover:text-brand-600 shadow-sm">
                            <svg class="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
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

        let compatHtml = '<p class="text-sm text-slate-500 italic">Информация не указана</p>';
        if (product.compatibility && product.compatibility.length > 0) {
            const makesGroup = {};
            product.compatibility.forEach(c => {
                const make = c.make || 'Разное';
                if (!makesGroup[make]) makesGroup[make] = [];
                makesGroup[make].push(c);
            });
            
            compatHtml = Object.keys(makesGroup).map(make => `
                <div class="mb-3">
                    <h5 class="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
                        <img src="${getMakeLogoUrl(make)}" onerror="this.style.display='none'" class="w-5 h-5 object-contain opacity-80" alt="">
                        ${make}
                    </h5>
                    <ul class="text-sm text-slate-600 space-y-1 pl-4 border-l-2 border-brand-200">
                        ${makesGroup[make].map(c => `<li><span class="font-medium">${c.model}</span> <span class="text-slate-400">${c.years ? '('+c.years+')' : ''}</span></li>`).join('')}
                    </ul>
                </div>
            `).join('');
        }

        DOM.modalContent.innerHTML = `
            <!-- Left: Media Gallery -->
            <div class="w-full md:w-2/5 bg-slate-50 p-6 md:p-8 flex flex-col items-center justify-center min-h-[300px] gap-6 border-r border-slate-200 relative">
                <div class="flex-grow flex items-center justify-center w-full relative z-10" id="modalMainMediaContainer">
                    <img id="modalMainImage" src="${imgSrc}" alt="${product.name}" class="max-w-full max-h-[350px] object-contain drop-shadow-md transition-all duration-500 hover:scale-105">
                    <video id="modalMainVideo" class="max-w-full max-h-[350px] object-contain drop-shadow-md hidden rounded-xl shadow-lg" controls></video>
                </div>
                ${(product.imageUrls && product.imageUrls.length > 1) || (product.videoUrls && product.videoUrls.length > 0) ? `
                <div class="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-2 w-full px-2 z-10" id="modalThumbnails">
                    ${product.imageUrls ? product.imageUrls.map((url, i) => `
                        <button class="thumbnail-btn flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-300 shadow-sm ${i === 0 ? 'border-brand-500 shadow-md opacity-100 scale-105' : 'border-slate-200 opacity-70 hover:opacity-100 hover:border-brand-400 bg-white'}" data-src="${url}" data-type="image">
                            <img src="${url}" class="w-full h-full object-cover" alt="Ракурс ${i+1}">
                        </button>
                    `).join('') : ''}
                    
                    ${product.videoUrls ? product.videoUrls.map((url, i) => `
                        <button class="thumbnail-btn flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-200 opacity-70 hover:opacity-100 hover:border-brand-400 transition-all duration-300 relative shadow-sm bg-white" data-src="${url}" data-type="video">
                            <div class="w-full h-full bg-slate-100 flex items-center justify-center text-brand-500">
                                <svg class="w-8 h-8 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z"></path></svg>
                            </div>
                        </button>
                    `).join('') : ''}
                </div>
                ` : ''}
            </div>
            
            <!-- Right: Details -->
            <div class="w-full md:w-3/5 p-6 md:p-10 flex flex-col bg-white relative z-10">
                <div class="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider">
                    <span class="text-brand-600 label-caps px-2 py-1 rounded bg-brand-50 border border-brand-100">${product.category}</span>
                    <span class="text-slate-300">•</span>
                    <span class="text-slate-500 label-caps">${product.purpose || 'Автозапчасть'}</span>
                </div>
                
                <h2 class="text-3xl md:text-4xl font-bold text-slate-900 mb-8 leading-tight tracking-tight">${product.name}</h2>
                
                <div class="flex flex-wrap items-center gap-4 mb-8">
                    <div class="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 flex-1 min-w-[120px] hover:border-brand-300 transition-colors">
                        <p class="label-caps text-slate-500 mb-2">Артикул</p>
                        <p class="font-mono text-slate-900 text-xl font-semibold">${product.article}</p>
                    </div>
                    <div class="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 flex-1 min-w-[120px] hover:border-brand-300 transition-colors">
                        <p class="label-caps text-slate-500 mb-2">Остаток</p>
                        <p class="font-semibold ${product.stock > 0 ? 'text-emerald-600' : 'text-amber-600'} text-xl flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full ${product.stock > 0 ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
                            ${product.stock > 0 ? product.stock + ' шт.' : 'Под заказ'}
                        </p>
                    </div>
                    <div class="bg-brand-50 rounded-xl px-6 py-4 text-brand-900 min-w-[140px] border border-brand-200 hover:bg-brand-100 transition-colors shadow-sm">
                        <p class="label-caps text-brand-600 mb-2">Цена</p>
                        <p class="text-3xl font-bold tracking-tight">${formatPrice(product.price)}</p>
                    </div>
                </div>
                
                <div class="space-y-8 flex-grow">
                    ${product.description ? `
                    <div>
                        <h4 class="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <svg class="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Описание
                        </h4>
                        <div class="text-sm text-slate-600 leading-relaxed max-w-none bg-slate-50 p-4 rounded-xl border border-slate-100">
                            ${product.description.replace(/\\n/g, '<br>')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <!-- Compatibility -->
                        <div>
                            <h4 class="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <svg class="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                                Совместимость
                            </h4>
                            <div class="max-h-60 overflow-y-auto custom-scrollbar pr-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                ${compatHtml}
                            </div>
                        </div>
                        
                        <!-- OEM & Analogs -->
                        <div>
                            <h4 class="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <svg class="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                Номера
                            </h4>
                            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                ${product.oem ? `
                                <div class="mb-4">
                                    <h5 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">OEM номер</h5>
                                    <p class="text-sm text-slate-900 font-mono bg-white px-2 py-1 rounded inline-block border border-slate-200 font-medium">${product.oem}</p>
                                </div>
                                ` : ''}
                                ${product.analogs ? `
                                <div>
                                    <h5 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Кросс-номера</h5>
                                    <p class="text-sm text-slate-700 whitespace-pre-line leading-relaxed">${product.analogs.replace(/\\n/g, '<br>')}</p>
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
        
        // Gallery logic
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
                    
                    // Update active state
                    thumbnails.forEach(t => {
                        t.classList.remove('border-brand-500', 'shadow-md', 'opacity-100', 'scale-105');
                        t.classList.add('border-slate-200', 'opacity-70');
                    });
                    this.classList.remove('border-slate-200', 'opacity-70');
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
            DOM.productsGrid.innerHTML = filtered.map((p, i) => createProductCard(p, i)).join('');
            
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
