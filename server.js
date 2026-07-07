const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

function mskTime() {
    return new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
const ozonApiPath = fs.existsSync(path.join(__dirname, 'westar-app', 'ozon-api.js')) ? './westar-app/ozon-api' : './ozon-api';
const ozonApi = require(ozonApiPath);
const contentTemplates = require('./westar-app/data/content-templates');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Paths
// Auto-detect: files in ./westar-app/ (local) or ./ (cloud/Render)
const westarDir = fs.existsSync(path.join(__dirname, 'westar-app', 'data')) ? 'westar-app' : '.';
const dataDir = path.join(__dirname, westarDir, 'data');
const catalogJsonPath = path.join(dataDir, 'catalog.json');
const catalogJsPath = path.join(dataDir, 'catalog.js');
const uploadDir = path.join(__dirname, westarDir, 'uploads');

// Configure Multer for image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Helper to read DB
const readDb = () => {
    let dbData = { products: [], categories: [], makes: [] };
    if (fs.existsSync(catalogJsonPath)) {
        const raw = fs.readFileSync(catalogJsonPath, 'utf8');
        try {
            dbData = JSON.parse(raw);
        } catch (e) {
            console.error('Error parsing catalog.json', e);
        }
    }
    
    // Если БД пустая (нет товаров), добавляем стандартные тестовые данные
    if (!dbData.products || dbData.products.length === 0) {
        console.log('Инициализация БД стандартными входными данными...');
        dbData = {
            generatedAt: new Date().toISOString(),
            totalProducts: 2,
            categories: ["Двигатель", "Трансмиссия"],
            makes: ["Chevrolet", "Ford"],
            products: [
                {
                    id: "TEST-001",
                    category: "Двигатель",
                    purpose: "Крепление",
                    article: "TEST-001",
                    stock: 10,
                    price: 1500,
                    name: "Опора двигателя (тестовая)",
                    imageUrl: "",
                    brand: "Chevrolet",
                    oem: "123456",
                    analogs: "Аналог 1, Аналог 2",
                    compatibility: [{ make: "Chevrolet", model: "Tahoe", years: "2010-2015" }],
                    description: "Стандартная тестовая деталь для проверки API"
                },
                {
                    id: "TEST-002",
                    category: "Трансмиссия",
                    purpose: "Подушка АКПП",
                    article: "TEST-002",
                    stock: 5,
                    price: 2500,
                    name: "Подушка АКПП (тестовая)",
                    imageUrl: "",
                    brand: "Ford",
                    oem: "654321",
                    analogs: "Аналог 3",
                    compatibility: [{ make: "Ford", model: "Explorer", years: "2015-2020" }],
                    description: "Вторая стандартная тестовая деталь"
                }
            ]
        };
        writeDb(dbData);
    }
    return dbData;
};

// Helper to write DB
const writeDb = (data) => {
    // Regenerate derived lists
    const categories = new Set();
    const makes = new Set();
    
    data.products.forEach(p => {
        if (p.category) categories.add(p.category);
        if (p.compatibility) {
            p.compatibility.forEach(c => {
                if (c.make) makes.add(c.make);
            });
        }
    });
    
    data.categories = Array.from(categories).sort();
    data.makes = Array.from(makes).sort();
    data.generatedAt = new Date().toISOString();
    data.totalProducts = data.products.length;

    // Write JSON
    fs.writeFileSync(catalogJsonPath, JSON.stringify(data, null, 2), 'utf8');
    
    // Write JS for frontend static compatibility
    const jsContent = `window.WESTAR_CATALOG = ${JSON.stringify(data, null, 2)};`;
    fs.writeFileSync(catalogJsPath, jsContent, 'utf8');
};

// ================================================================
//  API Endpoints — Каталог (существующие)
// ================================================================

// Route to upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
    }
    // Return the relative URL to be saved in DB
    const imageUrl = '/uploads/' + req.file.filename;
    res.json({ imageUrl });
});

app.get('/api/catalog', (req, res) => {
    const db = readDb();
    res.json(db);
});

app.post('/api/products', (req, res) => {
    const db = readDb();
    const newProduct = req.body;
    
    if (!newProduct.id) {
        newProduct.id = 'prod_' + Date.now() + Math.floor(Math.random() * 1000);
    }
    
    db.products.push(newProduct);
    writeDb(db);
    res.status(201).json(newProduct);
});

app.put('/api/products/:id', (req, res) => {
    const db = readDb();
    const id = req.params.id;
    const index = db.products.findIndex(p => p.id === id);
    
    if (index !== -1) {
        db.products[index] = { ...db.products[index], ...req.body };
        writeDb(db);
        res.json(db.products[index]);
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

app.delete('/api/products/:id', (req, res) => {
    const db = readDb();
    const id = req.params.id;
    const initialLength = db.products.length;
    
    db.products = db.products.filter(p => p.id !== id);
    
    if (db.products.length !== initialLength) {
        writeDb(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

// ================================================================
//  API Endpoints — Ozon Dashboard
// ================================================================

// ================================================================
//  API Endpoints — Пульт (управление аккаунтами и экспорт)
// ================================================================

// Путь к файлу аккаунтов Пульта
const accountsJsonPath = path.join(dataDir, 'accounts.json');

/**
 * Поиск аккаунта по clientId в accounts.json
 * Возвращает { clientId, apiKey } или null
 */
function findAccountByClientId(clientId) {
    const data = readAccounts();
    const acc = (data.accounts || []).find(a => a.clientId === clientId);
    return acc ? { clientId: acc.clientId, apiKey: acc.apiKey } : null;
}

/**
 * Чтение аккаунтов из accounts.json
 */
const readAccounts = () => {
    if (!fs.existsSync(accountsJsonPath)) {
        fs.writeFileSync(accountsJsonPath, JSON.stringify({ accounts: [] }, null, 2), 'utf8');
    }
    try {
        return JSON.parse(fs.readFileSync(accountsJsonPath, 'utf8'));
    } catch (e) {
        return { accounts: [] };
    }
};

/**
 * Запись аккаунтов в accounts.json
 */
const writeAccounts = (data) => {
    fs.writeFileSync(accountsJsonPath, JSON.stringify(data, null, 2), 'utf8');
};

// POST /api/pulse/validate — Проверка аккаунта Ozon
app.post('/api/pulse/validate', async (req, res) => {
    try {
        const { clientId, apiKey } = req.body;
        if (!clientId || !apiKey) {
            return res.status(400).json({ error: 'clientId и apiKey обязательны' });
        }
        const result = await ozonApi.validateAccount(clientId, apiKey);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pulse/catalog — Получить каталог товаров
app.get('/api/pulse/catalog', (req, res) => {
    try {
        const db = readDb();
        res.json(db);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/type-id — Получить type_id по category_id
app.post('/api/pulse/type-id', async (req, res) => {
    try {
        const { clientId, apiKey, categoryId } = req.body;
        if (!clientId || !apiKey || !categoryId) {
            return res.status(400).json({ error: 'clientId, apiKey и categoryId обязательны' });
        }
        const tree = await ozonApi.getCategoryTree(clientId, apiKey);
        const cats = tree || [];
        function findType(cats, catId) {
            for (const c of cats) {
                if (String(c.description_category_id) === String(catId) && c.type_id) {
                    return c.type_id;
                }
                if (c.children && c.children.length > 0) {
                    const found = findType(c.children, catId);
                    if (found) return found;
                }
            }
            return null;
        }
        const typeId = findType(cats, categoryId);
        res.json({ typeId: typeId || 0, categoryId: Number(categoryId) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/categories — Получить дерево категорий
app.post('/api/pulse/categories', async (req, res) => {
    try {
        const { clientId, apiKey } = req.body;
        if (!clientId || !apiKey) {
            return res.status(400).json({ error: 'clientId и apiKey обязательны' });
        }
        const tree = await ozonApi.getCategoryTree(clientId, apiKey);

        // Плоский список с путями
        const flat = [];
        function flatten(nodes, path = '') {
            if (!Array.isArray(nodes)) return;
            for (const n of nodes) {
                const name = n.category_name || n.name || '';
                const currentPath = path ? `${path} / ${name}` : name;
                if (n.type_id) {
                    flat.push({
                        category_id: n.description_category_id,
                        type_id: n.type_id,
                        name: name,
                        path: currentPath
                    });
                }
                if (n.children && n.children.length > 0) {
                    flatten(n.children, currentPath);
                }
            }
        }
        flatten(tree);

        res.json({ categories: flat, total: flat.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/warehouses — Получить склады аккаунта
app.post('/api/pulse/warehouses', async (req, res) => {
    try {
        const { clientId, apiKey } = req.body;
        if (!clientId || !apiKey) {
            return res.status(400).json({ error: 'clientId и apiKey обязательны' });
        }
        const warehouses = await ozonApi.getWarehousesDynamic(clientId, apiKey);
        res.json({ warehouses });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/export — Экспорт товаров на Ozon
app.post('/api/pulse/export', async (req, res) => {
    try {
        const { clientId, apiKey, products: productIds, warehouseId, markup, categoryId, prefix } = req.body;

        if (!clientId || !apiKey || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: 'clientId, apiKey и products обязательны' });
        }
        if (!categoryId) {
            return res.status(400).json({ error: 'categoryId обязателен' });
        }

        // 0. type_id для категории Ozon (хардкод — дерево категорий слишком велико для запроса)
        const typeId = 970782919;
        const numCategoryId = Number(categoryId);
        console.log('Using typeId:', typeId, 'for categoryId:', numCategoryId);

        // 1. Читаем каталог и находим нужные товары
        const db = readDb();
        const selectedProducts = db.products.filter(p => productIds.includes(p.id) || productIds.includes(p.article));
        if (selectedProducts.length === 0) {
            return res.status(404).json({ error: 'Товары не найдены в каталоге' });
        }

        // 2. Формируем объекты для Ozon API /v3/product/import
        const ozonItems = selectedProducts.map((product, idx) => {
            // Применяем наценку
            let finalPrice = product.price || 0;
            if (markup) {
                if (markup.type === 'percent') {
                    finalPrice = Math.round(finalPrice * (1 + markup.value / 100));
                } else if (markup.type === 'fixed') {
                    finalPrice = Math.round(finalPrice + markup.value);
                }
            }
            const oldPrice = Math.round(finalPrice * 1.3);

            // Изображения — перемешиваем для каждого аккаунта
            let images = [];
            if (product.imageUrls && Array.isArray(product.imageUrls)) {
                product.imageUrls.forEach(url => {
                    if (url && url.startsWith('http')) images.push(url);
                });
            } else if (product.imageUrl && product.imageUrl.startsWith('http')) {
                images.push(product.imageUrl);
            }
            images = contentTemplates.shuffleImages(images, clientId);
            const brand = 'Westar';

            // Вариация названия для уникальности карточки
            const variedName = prefix
                ? `${prefix}${product.name || 'Без названия'}`
                : contentTemplates.varyTitle(product.name || 'Без названия', clientId, idx);

            // Генерация HTML-описания для контент-рейтинга
            const richDescription = contentTemplates.generateDescription(
                product.name || variedName,
                product.article || product.id,
                product.purpose || 'Автозапчасть',
                brand,
                clientId
            );

            const item = {
                description_category_id: numCategoryId,
                type_id: typeId,
                offer_id: prefix ? `${prefix}${product.article || product.id}` : product.article || product.id,
                name: variedName,
                price: String(finalPrice),
                old_price: String(oldPrice),
                description: richDescription,
                complex_attributes: [],
                currency_code: 'RUB',
                weight: product.weight || 1000,
                height: product.height || 100,
                width: product.width || 100,
                depth: product.length || 100,
                dimension_unit: 'mm',
                weight_unit: 'g',
                vat: '0',
                attributes: contentTemplates.getExtraAttributes(product, brand)
            };

            if (images.length > 0) {
                item.primary_image = images[0];
                item.images = images;
            }

            return item;
        });

        // 3. Разбиваем на батчи по 100 штук и отправляем
        const batchSize = 100;
        const taskIds = [];
        const errors = [];

        for (let i = 0; i < ozonItems.length; i += batchSize) {
            const batch = ozonItems.slice(i, i + batchSize);
            try {
                const taskId = await ozonApi.importProductsDynamic(clientId, apiKey, batch);
                taskIds.push(taskId);
            } catch (err) {
                errors.push({ batch: Math.floor(i / batchSize) + 1, error: err.message });
            }
            // Задержка между батчами
            if (i + batchSize < ozonItems.length) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        // 4. Если указан warehouseId — обновляем остатки
        if (warehouseId) {
            try {
                const stocks = selectedProducts.map(product => ({
                    offer_id: product.article || product.id,
                    stock: product.stock || 0,
                    warehouse_id: Number(warehouseId)
                }));
                await ozonApi.updateStocksDynamic(clientId, apiKey, stocks);
            } catch (err) {
                errors.push({ stage: 'updateStocks', error: err.message });
            }
        }

        res.json({
            success: true,
            taskIds,
            totalExported: selectedProducts.length,
            errors
        });
    } catch (err) {
        console.error('Ошибка экспорта Пульт:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Дефолтные значения для обязательных атрибутов по ID
function getDefaultAttributeValue(attrId, product) {
    const defaults = {
        85: { id: 85, complex_id: 0, values: [{ dictionary_value_id: 970800889, value: 'Westar' }] },
        8229: { id: 8229, complex_id: 0, values: [{ dictionary_value_id: 970782919, value: 'Опора двигателя' }] },
        9048: { id: 9048, complex_id: 0, values: [{ value: product?.offer_id || '' }] },
        7236: { id: 7236, complex_id: 0, values: [{ value: product?.offer_id || '' }] },
        23536: { id: 23536, complex_id: 0, values: [{ value: 'false' }] },
        22232: { id: 22232, complex_id: 0, values: [{ dictionary_value_id: 971398045, value: '4016995209' }] }
    };
    return defaults[attrId] || null;
}

// Загрузка изображения на imgur.com (бесплатно, без API ключа)
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '64ebd1cc097cc3f1b985231232643e9e';

async function uploadImage(sourceUrl, axios, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await axios.get(sourceUrl, {
                responseType: 'arraybuffer',
                timeout: 60000
            });
            const buf = Buffer.from(response.data);
            if (buf.length < 1000) {
                console.log(`[CLONE] skip: too small (${buf.length} bytes)`);
                return null;
            }
            const base64 = buf.toString('base64');
            const body = 'key=' + IMGBB_API_KEY + '&image=' + encodeURIComponent(base64);
            const res = await axios.post('https://api.imgbb.com/1/upload', body, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 60000
            });
            if (res.data?.data?.url) {
                return res.data.data.url;
            }
            console.log(`[CLONE] imgbb no url: ${JSON.stringify(res.data).substring(0, 200)}`);
            return null;
        } catch (e) {
            const isRateLimit = e.message.includes('429') || e.message.includes('Too Many');
            const waitMs = isRateLimit ? (30000 * (attempt + 1)) : (3000 * (attempt + 1));
            if (attempt < retries - 1) {
                console.log(`[CLONE] imgbb retry ${attempt+1}/${retries} in ${waitMs/1000}s: ${e.message.substring(0, 100)}`);
                await new Promise(r => setTimeout(r, waitMs));
            } else {
                console.log(`[CLONE] imgbb FAIL: ${e.message.substring(0, 100)}`);
                return null;
            }
        }
    }
    return null;
}

// Clone tasks store (in-memory)
const cloneTasks = new Map();

// POST /api/pulse/clone — Start async clone task
app.post('/api/pulse/clone', async (req, res) => {
    const { sourceClientId, sourceApiKey, targetClientId, targetApiKey, productIds, markup, warehouseId, categoryId, typeId, offerPrefix } = req.body;

    if (!sourceClientId || !sourceApiKey || !targetClientId || !targetApiKey) {
        return res.status(400).json({ error: 'sourceClientId, sourceApiKey, targetClientId, targetApiKey обязательны' });
    }

    const taskId = 'clone_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    cloneTasks.set(taskId, {
        status: 'starting',
        progress: 0,
        total: 0,
        phase: 'init',
        log: [],
        result: null,
        startedAt: Date.now()
    });

    // Run clone in background
    runCloneTask(taskId, { sourceClientId, sourceApiKey, targetClientId, targetApiKey, productIds, markup, warehouseId, categoryId, typeId, offerPrefix });

    res.json({ taskId, status: 'started' });
});

// GET /api/pulse/clone/status — Poll clone task progress
app.get('/api/pulse/clone/status', (req, res) => {
    const { taskId } = req.query;
    if (!taskId) return res.status(400).json({ error: 'taskId required' });
    const task = cloneTasks.get(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
});

async function runCloneTask(taskId, params) {
    const task = cloneTasks.get(taskId);
    const log = (msg) => { task.log.push(`[${mskTime()}] ${msg}`); console.log(msg); };

    try {
        const { sourceClientId, sourceApiKey, targetClientId, targetApiKey, productIds, markup, warehouseId, categoryId, typeId, skipImages, offerPrefix } = params;
        const prefix = offerPrefix || '';

        task.status = 'running';
        task.phase = 'fetch_source';
        log(`[CLONE] Получение товаров из ${sourceClientId}...`);

        let allProducts = [], lastId = '';
        while (true) {
            const listRes = await ozonApi.ozonRequestDynamic(sourceClientId, sourceApiKey, '/v3/product/list', {
                filter: {}, last_id: lastId, limit: 1000
            });
            if (listRes.status !== 200) throw new Error('Ошибка получения списка: ' + JSON.stringify(listRes.data));
            const items = listRes.data.result?.items || [];
            allProducts = allProducts.concat(items);
            lastId = listRes.data.result?.last_id || '';
            if (items.length < 1000) break;
        }

        let targetProducts = allProducts;
        if (productIds && Array.isArray(productIds) && productIds.length > 0) {
            targetProducts = allProducts.filter(p =>
                productIds.includes(String(p.product_id)) || productIds.includes(p.offer_id)
            );
            // Если ни один ID не совпал — клонируем все (productIds из устаревшего каталога)
            if (targetProducts.length === 0) {
                log(`[CLONE] productIds не совпали (${productIds.length} шт), клонируем все ${allProducts.length} товаров`);
                targetProducts = allProducts;
            }
        }

        if (targetProducts.length === 0) {
            task.status = 'failed';
            task.result = { error: 'Товары не найдены в исходном аккаунте' };
            return;
        }
        task.total = targetProducts.length;
        log(`[CLONE] Найдено ${targetProducts.length} товаров`);

        // 2. Детальная информация
        task.phase = 'fetch_details';
        let detailedProducts = [];
        for (let i = 0; i < targetProducts.length; i += 1000) {
            const ids = targetProducts.slice(i, i + 1000).map(p => p.product_id);
            const infoRes = await ozonApi.ozonRequestDynamic(sourceClientId, sourceApiKey, '/v3/product/info/list', { product_id: ids });
            if (infoRes.status === 200 && infoRes.data.items) detailedProducts = detailedProducts.concat(infoRes.data.items);
            if (i + 1000 < targetProducts.length) await new Promise(r => setTimeout(r, 1500));
        }

        // 2.1 Атрибуты source
        task.phase = 'fetch_attrs';
        const attrsMap = {};
        for (let i = 0; i < detailedProducts.length; i += 1000) {
            const ids = detailedProducts.slice(i, i + 1000).map(p => p.product_id);
            const attrRes = await ozonApi.ozonRequestDynamic(sourceClientId, sourceApiKey, '/v4/product/info/attributes', {
                filter: { product_id: ids },
                limit: 1000
            });
            log(`[CLONE] Attrs API: status=${attrRes.status}`);
            if (attrRes.status === 200) {
                const resultList = Array.isArray(attrRes.data?.result) ? attrRes.data.result : [];
                if (resultList.length === 0) {
                    log(`[CLONE] Attrs raw: ${JSON.stringify(attrRes.data).substring(0, 500)}`);
                }
                for (const p of resultList) {
                    if (p.product_id) attrsMap[p.product_id] = p.attributes || [];
                    if (p.offer_id) attrsMap[p.offer_id] = p.attributes || [];
                }
            }
            if (i + 1000 < detailedProducts.length) await new Promise(r => setTimeout(r, 1500));
        }
        log(`[CLONE] Атрибуты: ${Object.keys(attrsMap).length} товаров`);

        // 2.5 Архивация дубликатов — SKIP: Ozon treats re-import of same offer_id as update
        // Archive before import causes "duplicate" rejection because Ozon still sees the archived product
        log(`[CLONE] Пропуск архивации (re-import updates in place)`);

        // 3. Формируем товары
        task.phase = 'upload_images';
        const overrideCategoryId = categoryId ? Number(categoryId) : null;
        const overrideTypeId = typeId ? Number(typeId) : null;
        const axios = require('axios');

        const categoryTypeMap = {};
        for (const product of detailedProducts) {
            const catId = overrideCategoryId || product.description_category_id;
            const typId = overrideTypeId || product.type_id;
            const key = `${catId}_${typId}`;
            if (!categoryTypeMap[key]) categoryTypeMap[key] = { catId, typId, count: 0 };
            categoryTypeMap[key].count++;
        }
        log(`[CLONE] Категорий: ${Object.keys(categoryTypeMap).length}`);

        const requiredAttrsByType = {};
        for (const [key, ct] of Object.entries(categoryTypeMap)) {
            try {
                const attrsRes = await ozonApi.ozonRequestDynamic(targetClientId, targetApiKey, '/v3/category/attribute', {
                    description_category_id: ct.catId, type_id: ct.typId, language: 'DEFAULT'
                });
                if (attrsRes.status === 200 && attrsRes.data?.result) {
                    requiredAttrsByType[key] = attrsRes.data.result.filter(a => a.is_required).map(a => ({
                        id: a.id, name: a.name, type: a.type, is_collection: a.is_collection
                    }));
                    log(`[CLONE] cat=${ct.catId} type=${ct.typId}: ${requiredAttrsByType[key].length} req attrs`);
                }
            } catch (e) {
                log(`[CLONE] Ошибка attrs ${key}: ${e.message}`);
            }
        }

        const ozonItems = [];
        const ozonAttributes = [];

        // Upload images with concurrency limit (3 parallel) — use proxy-image for Ozon accessibility
        const CONCURRENCY = 3;
        const imgurResults = new Array(detailedProducts.length).fill(null);
        const RENDER_HOST = 'https://westar-api.onrender.com';

        for (let p = 0; p < detailedProducts.length; p++) {
            const product = detailedProducts[p];
            const productCategoryId = overrideCategoryId || product.description_category_id;
            const productTypeId = overrideTypeId || product.type_id;
            const typeKey = `${productCategoryId}_${productTypeId}`;

            let finalPrice = Number(product.price) || 0;
            if (markup) {
                if (markup.type === 'percent') finalPrice = Math.round(finalPrice * (1 + markup.value / 100));
                else if (markup.type === 'fixed') finalPrice = Math.round(finalPrice + markup.value);
            }
            const oldPrice = Math.round(finalPrice * 1.3);

            const allSourceImages = [];
            if (product.primary_image && typeof product.primary_image === 'string' && product.primary_image.startsWith('http')) {
                allSourceImages.push(product.primary_image);
            }
            if (Array.isArray(product.images)) {
                for (const img of product.images) {
                    let url = typeof img === 'string' ? img : (img?.img_url || img?.url || '');
                    if (typeof url === 'string' && url.startsWith('http') && !allSourceImages.includes(url)) {
                        allSourceImages.push(url);
                    }
                }
            }

            ozonAttributes.push({
                offer_id: product.offer_id,
                attributes: (attrsMap[product.product_id] || attrsMap[product.offer_id] || []).map(a => ({
                    id: a.id || a.attribute_id,
                    complex_id: a.complex_id || 0,
                    values: (a.values || []).map(v => ({
                        value: (v.value != null) ? String(v.value) : '',
                        ...(v.dictionary_value_id ? { dictionary_value_id: v.dictionary_value_id } : {})
                    }))
                })),
                categoryId: productCategoryId,
                typeId: productTypeId
            });

            // Add required attrs
            const requiredAttrs = requiredAttrsByType[typeKey] || [];
            const attrIds = new Set(ozonAttributes[p].attributes.map(a => a.id));
            for (const reqAttr of requiredAttrs) {
                if (!attrIds.has(reqAttr.id)) {
                    const defaults = getDefaultAttributeValue(reqAttr.id, product);
                    if (defaults) { ozonAttributes[p].attributes.push(defaults); attrIds.add(reqAttr.id); }
                }
            }

            // Queue imgur uploads
            imgurResults[p] = { images: [], product, allSourceImages, productCategoryId, productTypeId, finalPrice, oldPrice };
        }

        // Parallel imgur uploads
        if (skipImages) {
            log(`[CLONE] Пропуск загрузки фото (skipImages=true)`);
            for (let p = 0; p < imgurResults.length; p++) {
                imgurResults[p].images = []; // no images
            }
            task.progress = 50;
        } else {
            let imgurDone = 0;
            const imgurQueue = [...Array(detailedProducts.length).keys()];
            async function uploadWorker() {
                while (imgurQueue.length > 0) {
                    const p = imgurQueue.shift();
                    const r = imgurResults[p];
                    const maxImages = Math.min(r.allSourceImages.length, 15);
                    for (let i = 0; i < maxImages; i++) {
                        // Прямой прокси — Ozon скачивает фото через Render, без imgbb
                        const directProxy = `${RENDER_HOST}/api/proxy-image?url=${encodeURIComponent(r.allSourceImages[i])}`;
                        r.images.push(directProxy);
                        // Задержка между загрузками чтобы не долбить
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                    imgurDone++;
                    task.progress = Math.round(imgurDone / detailedProducts.length * 50);
                    log(`[CLONE] Фото: ${imgurDone}/${detailedProducts.length} (${task.progress}%)`);
                }
            }
            await uploadWorker();
        }

        // Build items
        task.phase = 'importing';
        for (let ri = 0; ri < imgurResults.length; ri++) {
            const r = imgurResults[ri];
            const targetOfferId = prefix + r.product.offer_id;

            // Уникальное название для каждого аккаунта
            const baseName = r.product.name || 'Без названия';
            const targetName = prefix
                ? baseName.replace(r.product.offer_id, targetOfferId)
                : contentTemplates.varyTitle(baseName, targetClientId, ri);

            // Перемешиваем фото для уникального порядка
            const shuffledImages = contentTemplates.shuffleImages(r.images, targetClientId);

            // Генерируем HTML-описание для контент-рейтинга
            const brand = 'Westar';
            const richDescription = contentTemplates.generateDescription(
                baseName, r.product.offer_id,
                r.product.purpose || 'Опора двигателя',
                brand, targetClientId
            );

            const item = {
                description_category_id: r.productCategoryId,
                type_id: r.productTypeId,
                offer_id: targetOfferId,
                name: targetName,
                price: String(r.finalPrice),
                old_price: String(r.oldPrice),
                description: richDescription,
                currency_code: 'RUB',
                weight: r.product.weight || 1000,
                height: r.product.height || 100,
                width: r.product.width || 100,
                depth: r.product.depth || 100,
                dimension_unit: 'mm',
                weight_unit: 'g',
                vat: '0'
            };
            if (shuffledImages.length > 0) {
                item.primary_image = shuffledImages[0];
                item.images = shuffledImages;
            }
            // Include attributes in import item (mandatory attrs must be set during import)
            const attrData = ozonAttributes[ri];
            const importAttrs = (attrData && attrData.attributes && attrData.attributes.length > 0) ? [...attrData.attributes] : [];
            
            // ALWAYS force mandatory attributes — they MUST be present during import
            // Use prefixed offer_id for article/partner attrs to avoid cross-account dedup
            const mandatoryImportAttrs = [
                { id: 22232, complex_id: 0, values: [{ dictionary_value_id: 971398045, value: '4016995209' }] },
                { id: 9048, complex_id: 0, values: [{ value: targetOfferId }] },
                { id: 7236, complex_id: 0, values: [{ value: targetOfferId }] },
                { id: 23536, complex_id: 0, values: [{ value: 'false' }] },
                { id: 85, complex_id: 0, values: [{ dictionary_value_id: 970800889, value: 'Westar' }] },
                { id: 8229, complex_id: 0, values: [{ dictionary_value_id: 970782919, value: 'Опора двигателя' }] }
            ];
            const existingAttrIds = new Set(importAttrs.map(a => a.id));
            for (const ma of mandatoryImportAttrs) {
                if (!existingAttrIds.has(ma.id)) {
                    importAttrs.push(ma);
                }
            }
            item.attributes = importAttrs;
            ozonItems.push(item);
            log(`[CLONE] ${r.product.offer_id} → ${targetOfferId}: cat=${r.productCategoryId} type=${r.productTypeId} images=${r.images.length} attrs=${item.attributes?.length || 0}`);
        }

        // 4. Import
        const taskIds = [];
        const errors = [];
        const batchSize = 100;
        for (let i = 0; i < ozonItems.length; i += batchSize) {
            const batch = ozonItems.slice(i, i + batchSize);
            try {
                log(`[CLONE] Import batch ${Math.floor(i/batchSize)+1}: ${batch.length} items. First item: ${JSON.stringify(batch[0]).substring(0, 300)}`);
                const tid = await ozonApi.importProductsDynamic(targetClientId, targetApiKey, batch);
                log(`[CLONE] Import task ID: ${tid}`);
                taskIds.push(tid);
            } catch (err) {
                log(`[CLONE] Import ERROR batch ${Math.floor(i/batchSize)+1}: ${err.message}`);
                errors.push({ batch: Math.floor(i / batchSize) + 1, error: err.message });
            }
            if (i + batchSize < ozonItems.length) await new Promise(r => setTimeout(r, 2000));
        }
        task.progress = 70;
        task.ozonImportTaskIds = taskIds;
        log(`[CLONE] Импорт отправлен: ${taskIds.length} задач. TaskIDs: ${taskIds.join(', ')}`);

        // 5. Wait for import
        const attrErrors = [];
        if (taskIds.length > 0) {
            const completedItems = [];
            for (let attempt = 0; attempt < 60; attempt++) {
                await new Promise(r => setTimeout(r, 5000));
                let allDone = true;
                for (const tid of taskIds) {
                    try {
                        const status = await ozonApi.getImportStatusDynamic(targetClientId, targetApiKey, tid);
                        log(`[CLONE] Import status for ${tid}: ${status.items?.length || 0} items. allDone=${allDone}`);
                        for (const imp of (status.items || [])) {
                            if (imp.status === 'imported' && imp.product_id && imp.offer_id) {
                                if (!completedItems.find(c => c.offer_id === imp.offer_id)) completedItems.push(imp);
                            } else if (imp.status === 'pending' || imp.status === 'processing') {
                                allDone = false;
                            } else {
                                log(`[CLONE] Import NON-OK: status=${imp.status} offer=${imp.offer_id} product_id=${imp.product_id} errors=${JSON.stringify(imp.errors || []).substring(0, 200)}`);
                            }
                        }
                    } catch (e) { allDone = false; }
                }
                task.progress = 70 + Math.round(completedItems.length / ozonItems.length * 15);
                if (allDone || completedItems.length >= ozonItems.length) break;
                if (attempt % 6 === 0) log(`[CLONE] Импорт: ${completedItems.length}/${ozonItems.length}`);
            }
            log(`[CLONE] Импорт завершён: ${completedItems.length} товаров`);

            // Wait 30s for indexing
            log(`[CLONE] Ожидание 30s для индексации...`);
            await new Promise(r => setTimeout(r, 30000));

            // Update attrs
            task.phase = 'updating_attrs';
            // Build lookup: prefixed offer_id → source attributes
            const attrsByTargetOffer = {};
            for (let ri = 0; ri < imgurResults.length; ri++) {
                const targetOffer = prefix + imgurResults[ri].product.offer_id;
                attrsByTargetOffer[targetOffer] = ozonAttributes[ri]?.attributes || [];
            }
            for (const imp of completedItems) {
                const srcAttrs = attrsByTargetOffer[imp.offer_id];
                if (srcAttrs && srcAttrs.length > 0) {
                    try {
                        await ozonApi.attributesUpdateDynamic(targetClientId, targetApiKey, [{
                            offer_id: imp.offer_id,
                            attributes: srcAttrs
                        }]);
                    } catch (e) {
                        attrErrors.push({ offer_id: imp.offer_id, error: e.message });
                    }
                }
            }
            await new Promise(r => setTimeout(r, 15000));
        }

        // 6. Stocks
        if (warehouseId) {
            try {
                const stocks = detailedProducts.map(p => ({
                    offer_id: p.offer_id,
                    stock: p.stocks?.stocks?.[0]?.present || 0,
                    warehouse_id: Number(warehouseId)
                }));
                await ozonApi.updateStocksDynamic(targetClientId, targetApiKey, stocks);
            } catch (err) { errors.push({ stage: 'stocks', error: err.message }); }
        }

        task.status = 'completed';
        task.progress = 100;
        task.result = {
            success: true,
            totalExported: detailedProducts.length,
            attributeUpdates: ozonItems.length,
            attrErrors,
            errors
        };
        log(`[CLONE] Готово! ${detailedProducts.length} товаров`);
    } catch (err) {
        task.status = 'failed';
        task.result = { error: err.message };
        log(`[CLONE] ОШИБКА: ${err.message}`);
    }
}

// POST /api/pulse/upload-images — Upload images for already-cloned products (archive + re-create with imgur)
const imageTasks = new Map();
app.post('/api/pulse/upload-images', async (req, res) => {
    const { targetClientId, targetApiKey, sourceClientId, sourceApiKey, productIds, limit } = req.body;
    if (!targetClientId || !targetApiKey || !sourceClientId || !sourceApiKey) {
        return res.status(400).json({ error: 'targetClientId, targetApiKey, sourceClientId, sourceApiKey required' });
    }
    const taskId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    imageTasks.set(taskId, { status: 'starting', progress: 0, total: 0, log: [], result: null });
    res.json({ taskId, status: 'started' });

    // Run in background
    (async () => {
        const task = imageTasks.get(taskId);
        const log = (msg) => { task.log.push(`[${mskTime()}] ${msg}`); console.log(msg); };
        const axios = require('axios');
        try {
            task.status = 'running';
            // Get target products
            let tgtItems = [], tgtLastId = '';
            while (true) {
                const r = await ozonApi.ozonRequestDynamic(targetClientId, targetApiKey, '/v3/product/list', { filter: {}, last_id: tgtLastId, limit: 1000 });
                if (r.status !== 200) break;
                const items = r.data.result?.items || [];
                tgtItems = tgtItems.concat(items);
                tgtLastId = r.data.result?.last_id || '';
                if (items.length < 1000) break;
            }
            // Filter by productIds (offer_ids) if specified
            let targetProducts = tgtItems.filter(i => !i.archived);
            if (productIds && productIds.length > 0) {
                targetProducts = targetProducts.filter(p => productIds.includes(p.offer_id));
            }
            if (limit) targetProducts = targetProducts.slice(0, limit);
            task.total = targetProducts.length;
            log(`[IMG] Найдено ${targetProducts.length} товаров в target без архива`);

            // Get source products (to find images)
            let srcItems = [], srcLastId = '';
            while (true) {
                const r = await ozonApi.ozonRequestDynamic(sourceClientId, sourceApiKey, '/v3/product/list', { filter: {}, last_id: srcLastId, limit: 1000 });
                if (r.status !== 200) break;
                const items = r.data.result?.items || [];
                srcItems = srcItems.concat(items);
                srcLastId = r.data.result?.last_id || '';
                if (items.length < 1000) break;
            }
            // Map source offer_id -> source product_id
            const srcMap = {};
            for (const s of srcItems) srcMap[s.offer_id] = s.product_id;

            let done = 0;
            for (const tgt of targetProducts) {
                const srcPid = srcMap[tgt.offer_id];
                if (!srcPid) { log(`[IMG] SKIP ${tgt.offer_id}: source not found`); done++; continue; }

                // Get source product details (with images)
                const infoRes = await ozonApi.ozonRequestDynamic(sourceClientId, sourceApiKey, '/v3/product/info/list', { product_id: [srcPid] });
                const srcProduct = infoRes.data?.items?.[0];
                if (!srcProduct) { log(`[IMG] SKIP ${tgt.offer_id}: source info not found`); done++; continue; }

                // Collect source image URLs
                const srcImages = [];
                if (srcProduct.primary_image) srcImages.push(srcProduct.primary_image);
                if (Array.isArray(srcProduct.images)) {
                    for (const img of srcProduct.images) {
                        const url = typeof img === 'string' ? img : (img?.img_url || img?.url || '');
                        if (url && !srcImages.includes(url)) srcImages.push(url);
                    }
                }
                if (srcImages.length === 0) { log(`[IMG] SKIP ${tgt.offer_id}: no images`); done++; continue; }

                // Upload only primary image to imgur
                const imgurUrl = await uploadImage(srcImages[0], axios);
                if (!imgurUrl) { log(`[IMG] FAIL ${tgt.offer_id}: imgur failed`); done++; continue; }

                // Archive target product
                try {
                    await ozonApi.ozonRequestDynamic(targetClientId, targetApiKey, '/v1/product/archive', { product_id: [tgt.product_id] });
                    await new Promise(r => setTimeout(r, 3000));
                } catch (e) { log(`[IMG] archive warn: ${e.message}`); }

                // Re-create with image
                const catId = srcProduct.description_category_id;
                const typId = srcProduct.type_id;
                const item = {
                    description_category_id: catId,
                    type_id: typId,
                    offer_id: tgt.offer_id,
                    name: tgt.name || srcProduct.name,
                    price: tgt.price,
                    old_price: tgt.old_price,
                    description: srcProduct.description || '',
                    currency_code: 'RUB',
                    weight: srcProduct.weight || 1000,
                    height: srcProduct.height || 100,
                    width: srcProduct.width || 100,
                    depth: srcProduct.depth || 100,
                    dimension_unit: 'mm',
                    weight_unit: 'g',
                    vat: '0',
                    primary_image: imgurUrl,
                    images: [imgurUrl]
                };
                try {
                    const taskId2 = await ozonApi.importProductsDynamic(targetClientId, targetApiKey, [item]);
                    log(`[IMG] OK ${tgt.offer_id} → re-created with imgur`);
                } catch (e) {
                    log(`[IMG] FAIL ${tgt.offer_id}: import ${e.message}`);
                }

                done++;
                task.progress = Math.round(done / targetProducts.length * 100);
                if (done % 5 === 0) log(`[IMG] Progress: ${done}/${targetProducts.length} (${task.progress}%)`);
                // Rate limit: wait 2s between products
                await new Promise(r => setTimeout(r, 2000));
            }

            task.status = 'completed';
            task.progress = 100;
            task.result = { total: targetProducts.length, done };
            log(`[IMG] Готово: ${done}/${targetProducts.length}`);
        } catch (e) {
            task.status = 'failed';
            task.result = { error: e.message };
            log(`[IMG] ОШИБКА: ${e.message}`);
        }
    })();
});

// GET /api/pulse/image-status — Poll image upload task
app.get('/api/pulse/image-status', (req, res) => {
    const { taskId } = req.query;
    if (!taskId) return res.status(400).json({ error: 'taskId required' });
    const task = imageTasks.get(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
});

// POST /api/pulse/archive — Архивация товаров на Ozon
app.post('/api/pulse/archive', async (req, res) => {
    try {
        const { clientId, apiKey, productIds } = req.body;
        if (!clientId || !apiKey || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: 'clientId, apiKey и productIds обязательны' });
        }

        // Архивируем батчами по 100
        const batchSize = 100;
        let archived = 0;
        const errors = [];

        for (let i = 0; i < productIds.length; i += batchSize) {
            const batch = productIds.slice(i, i + batchSize);
            try {
                const result = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v1/product/archive', {
                    product_id: batch.map(id => Number(id))
                });
                if (result.status === 200) {
                    archived += batch.length;
                } else {
                    errors.push({ batch: Math.floor(i / batchSize) + 1, error: JSON.stringify(result.data) });
                }
            } catch (err) {
                errors.push({ batch: Math.floor(i / batchSize) + 1, error: err.message });
            }
            if (i + batchSize < productIds.length) await new Promise(r => setTimeout(r, 500));
        }

        res.json({ success: true, archived, errors });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/delete-products — Удаление товаров с Ozon (через архивацию)
app.post('/api/pulse/delete-products', async (req, res) => {
    try {
        const { clientId, apiKey, productIds } = req.body;
        if (!clientId || !apiKey || !productIds || !Array.isArray(productIds)) {
            return res.status(400).json({ error: 'clientId, apiKey и productIds обязательны' });
        }

        // Сначала получаем info по товарам чтобы узнать product_id
        const offerIds = productIds.filter(id => isNaN(id));
        const numericIds = productIds.filter(id => !isNaN(id)).map(Number);

        let allProductIds = [...numericIds];

        if (offerIds.length > 0) {
            // Ищем по offer_id
            for (let i = 0; i < offerIds.length; i += 1000) {
                const batch = offerIds.slice(i, i + 1000);
                try {
                    const result = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v2/products/info/ids', {
                        offer_id: batch
                    });
                    if (result.status === 200 && result.data.items) {
                        result.data.items.forEach(item => {
                            if (item.id) allProductIds.push(item.id);
                        });
                    }
                } catch (e) {}
            }
        }

        if (allProductIds.length === 0) {
            return res.status(404).json({ error: 'Товары не найдены' });
        }

        // Архивируем
        const batchSize = 100;
        let archived = 0;
        const errors = [];

        for (let i = 0; i < allProductIds.length; i += batchSize) {
            const batch = allProductIds.slice(i, i + batchSize);
            try {
                const result = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v1/product/archive', {
                    product_id: batch
                });
                if (result.status === 200) {
                    archived += batch.length;
                } else {
                    errors.push({ error: JSON.stringify(result.data) });
                }
            } catch (err) {
                errors.push({ error: err.message });
            }
            if (i + batchSize < allProductIds.length) await new Promise(r => setTimeout(r, 500));
        }

        res.json({ success: true, archived, total: allProductIds.length, errors });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/products — Получить список товаров аккаунта
app.post('/api/pulse/products', async (req, res) => {
    try {
        const { clientId, apiKey } = req.body;
        if (!clientId || !apiKey) {
            return res.status(400).json({ error: 'clientId и apiKey обязательны' });
        }

        let allProducts = [];
        let lastId = '';

        while (true) {
            const listRes = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v3/product/list', {
                filter: {},
                last_id: lastId,
                limit: 1000
            });
            if (listRes.status !== 200) {
                throw new Error('Ошибка получения списка: ' + JSON.stringify(listRes.data));
            }
            const items = listRes.data.result?.items || [];
            allProducts = allProducts.concat(items);
            lastId = listRes.data.result?.last_id || '';
            if (items.length < 1000) break;
        }

        // Получаем детальную инфо по каждому товару (батчами по 1000)
        let detailed = [];
        for (let i = 0; i < allProducts.length; i += 1000) {
            const ids = allProducts.slice(i, i + 1000).map(p => p.product_id);
            try {
                const infoRes = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v3/product/info/list', {
                    product_id: ids
                });
                if (infoRes.status === 200 && infoRes.data.items) {
                    detailed = detailed.concat(infoRes.data.items);
                }
            } catch (e) {}
            if (i + 1000 < allProducts.length) await new Promise(r => setTimeout(r, 1000));
        }

        res.json({ products: detailed, total: detailed.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/export/status — Статус импорта
app.post('/api/pulse/export/status', async (req, res) => {
    try {
        const { clientId, apiKey, taskId } = req.body;
        if (!clientId || !apiKey || !taskId) {
            return res.status(400).json({ error: 'clientId, apiKey и taskId обязательны' });
        }
        const status = await ozonApi.getImportStatusDynamic(clientId, apiKey, taskId);
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/accounts/save — Сохранить аккаунт
app.post('/api/pulse/accounts/save', (req, res) => {
    try {
        const { name, clientId, apiKey, color, markup, prefix, warehouseId } = req.body;
        if (!name || !clientId || !apiKey) {
            return res.status(400).json({ error: 'name, clientId и apiKey обязательны' });
        }
        const db = readAccounts();
        // Проверяем, нет ли уже такого clientId
        const existing = db.accounts.find(a => a.clientId === clientId);
        if (existing) {
            // Обновляем существующий
            existing.name = name;
            existing.apiKey = apiKey;
            if (color) existing.color = color;
            if (markup) existing.markup = markup;
            if (prefix !== undefined) existing.prefix = prefix;
            if (warehouseId !== undefined) existing.warehouseId = warehouseId;
            writeAccounts(db);
            return res.json(existing);
        }
        const newAccount = {
            id: 'acc_' + Date.now() + Math.floor(Math.random() * 1000),
            name,
            clientId,
            apiKey,
            color: color || '#4ade80',
            markup: markup || { type: 'percent', value: 0 },
            prefix: prefix || '',
            warehouseId: warehouseId || null,
            enabled: true,
            createdAt: new Date().toISOString()
        };
        db.accounts.push(newAccount);
        writeAccounts(db);
        res.status(201).json(newAccount);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pulse/accounts — Получить все аккаунты
app.get('/api/pulse/accounts', (req, res) => {
    try {
        const db = readAccounts();
        res.json({ accounts: db.accounts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/accounts/update — Обновить настройки аккаунта
app.post('/api/pulse/accounts/update', (req, res) => {
    try {
        const { id, name, markup, prefix, warehouseId, enabled } = req.body;
        if (!id) return res.status(400).json({ error: 'id обязателен' });
        const db = readAccounts();
        const acc = db.accounts.find(a => a.id === id);
        if (!acc) return res.status(404).json({ error: 'Аккаунт не найден' });
        if (name !== undefined) acc.name = name;
        if (markup !== undefined) acc.markup = markup;
        if (prefix !== undefined) acc.prefix = prefix;
        if (warehouseId !== undefined) acc.warehouseId = warehouseId;
        if (enabled !== undefined) acc.enabled = enabled;
        writeAccounts(db);
        res.json(acc);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/accounts/delete — Удалить аккаунт
app.post('/api/pulse/accounts/delete', (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'id обязателен' });
        }
        const db = readAccounts();
        const initialLength = db.accounts.length;
        db.accounts = db.accounts.filter(a => a.id !== id);
        if (db.accounts.length === initialLength) {
            return res.status(404).json({ error: 'Аккаунт не найден' });
        }
        writeAccounts(db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/check-import-task — Check Ozon import task status directly
app.post('/api/pulse/check-import-task', async (req, res) => {
    try {
        const { clientId, apiKey, taskId } = req.body;
        if (!clientId || !apiKey || !taskId) {
            return res.status(400).json({ error: 'clientId, apiKey, taskId required' });
        }
        const status = await ozonApi.getImportStatusDynamic(clientId, apiKey, taskId);
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/product-by-id — Get product info by product_id
app.post('/api/pulse/product-by-id', async (req, res) => {
    try {
        const { clientId, apiKey, productId } = req.body;
        if (!clientId || !apiKey || !productId) {
            return res.status(400).json({ error: 'clientId, apiKey, productId required' });
        }
        const result = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v3/product/info/list', {
            product_id: [Number(productId)]
        });
        res.json(result.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/test-import — Test single product import with full response
app.post('/api/pulse/test-import', async (req, res) => {
    try {
        const { clientId, apiKey, item } = req.body;
        if (!clientId || !apiKey || !item) {
            return res.status(400).json({ error: 'clientId, apiKey, item required' });
        }
        const result = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v3/product/import', {
            items: [item]
        });
        res.json({ status: result.status, data: result.data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/lookup-by-offer — Find product by offer_id in account
app.post('/api/pulse/lookup-by-offer', async (req, res) => {
    try {
        const { clientId, apiKey, offerId } = req.body;
        if (!clientId || !apiKey || !offerId) {
            return res.status(400).json({ error: 'clientId, apiKey, offerId required' });
        }
        const result = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v2/products/info/ids', {
            offer_id: [offerId]
        });
        res.json(result.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pulse/detect-warehouse — Auto-detect working warehouse for an account
app.post('/api/pulse/detect-warehouse', async (req, res) => {
    try {
        const { clientId, apiKey } = req.body;
        if (!clientId || !apiKey) return res.status(400).json({ error: 'clientId и apiKey обязательны' });

        const warehouses = await ozonApi.getWarehousesDynamic(clientId, apiKey);
        if (!warehouses.length) return res.json({ error: 'Нет складов', warehouses: [] });

        // Берём товары из info/list для теста
        const listRes = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v3/product/list', { filter: {}, last_id: '', limit: 10 });
        const items = listRes.data?.result?.items || [];
        if (!items.length) return res.json({ error: 'Нет товаров для теста' });
        const testProduct = items[0];

        for (const wh of warehouses) {
            try {
                const testStock = [{ offer_id: testProduct.offer_id, product_id: testProduct.product_id, stock: "1", warehouse_id: wh.warehouse_id }];
                const result = await ozonApi.updateStocksDynamic(clientId, apiKey, testStock);
                const r = result?.[0]?.data?.result?.[0];
                if (r && r.updated) {
                    // Сбросим тестовое значение
                    try { await ozonApi.updateStocksDynamic(clientId, apiKey, [{ offer_id: testProduct.offer_id, product_id: testProduct.product_id, stock: "0", warehouse_id: wh.warehouse_id }]); } catch (e) {}
                    return res.json({ warehouseId: wh.warehouse_id, warehouseName: wh.name });
                }
            } catch (e) {}
        }
        res.json({ error: 'Нет рабочего склада', warehouses: warehouses.map(w => ({ id: w.warehouse_id, name: w.name })) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Batch update descriptions/attributes on existing products
// ================================================================

const updateDescTasks = new Map();

app.post('/api/pulse/update-descriptions', async (req, res) => {
    const { clientId, apiKey } = req.body;
    if (!clientId || !apiKey) return res.status(400).json({ error: 'clientId и apiKey обязательны' });

    const taskId = 'updesc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    updateDescTasks.set(taskId, { status: 'running', progress: 0, log: [], results: [], startedAt: Date.now() });

    (async () => {
        const task = updateDescTasks.get(taskId);
        const logMsg = (msg) => { task.log.push(`[${mskTime()}] ${msg}`); console.log(msg); };

        try {
            // Get all products
            let allProducts = [], lastId = '';
            while (true) {
                const r = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v3/product/list', { filter: {}, last_id: lastId, limit: 1000 });
                if (r.status !== 200) throw new Error('Ошибка списка: ' + JSON.stringify(r.data));
                const items = r.data.result?.items || [];
                allProducts = allProducts.concat(items);
                lastId = r.data.result?.last_id || '';
                if (items.length < 1000) break;
            }
            logMsg(`[UPDESC] Найдено ${allProducts.length} товаров`);

            // Get details
            let details = [];
            for (let i = 0; i < allProducts.length; i += 1000) {
                const ids = allProducts.slice(i, i + 1000).map(p => p.product_id);
                const r = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v3/product/info/list', { product_id: ids });
                if (r.status === 200 && r.data.items) details = details.concat(r.data.items);
                if (i + 1000 < allProducts.length) await new Promise(r => setTimeout(r, 1500));
            }
            logMsg(`[UPDESC] Деталей: ${details.length}`);

            // Update each product with new description + shuffled images
            let done = 0;
            let updated = 0;
            let failed = 0;
            for (const product of details) {
                if (product.archived) { done++; continue; }

                const brand = 'Westar';
                const purpose = product.purpose || 'Опора двигателя';
                const richDescription = contentTemplates.generateDescription(
                    product.name, product.offer_id, purpose, brand, clientId
                );
                const shuffledImages = contentTemplates.shuffleImages(
                    [product.primary_image, ...(product.images || [])].filter(Boolean),
                    clientId
                );

                const item = {
                    description_category_id: product.description_category_id,
                    type_id: product.type_id,
                    product_id: product.product_id,
                    offer_id: product.offer_id,
                    name: product.name,
                    price: product.price,
                    old_price: product.old_price,
                    description: richDescription,
                    currency_code: 'RUB',
                    weight: product.weight || 1000,
                    height: product.height || 100,
                    width: product.width || 100,
                    depth: product.depth || 100,
                    dimension_unit: 'mm',
                    weight_unit: 'g',
                    vat: '0'
                };
                if (shuffledImages.length > 0) {
                    item.primary_image = shuffledImages[0];
                    item.images = shuffledImages;
                }

                try {
                    await ozonApi.importProductsDynamic(clientId, apiKey, [item]);
                    updated++;
                    logMsg(`[UPDESC] OK ${product.offer_id}`);
                } catch (e) {
                    failed++;
                    logMsg(`[UPDESC] FAIL ${product.offer_id}: ${e.message}`);
                }
                done++;
                task.progress = Math.round(done / details.length * 100);
                if (done % 10 === 0) logMsg(`[UPDESC] Прогресс: ${done}/${details.length}`);
                await new Promise(r => setTimeout(r, 1000));
            }

            task.status = 'completed';
            task.progress = 100;
            task.results = { total: details.length, updated, failed };
            logMsg(`[UPDESC] Готово: ${updated} обновлено, ${failed} ошибок`);
        } catch (e) {
            task.status = 'failed';
            task.results = { error: e.message };
            logMsg(`[UPDESC] ОШИБКА: ${e.message}`);
        }
    })();

    res.json({ taskId, status: 'started' });
});

app.get('/api/pulse/update-descriptions/status', (req, res) => {
    const { taskId } = req.query;
    if (!taskId) return res.status(400).json({ error: 'taskId required' });
    const task = updateDescTasks.get(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
});

// ================================================================
//  API — Обновление атрибутов существующих товаров
// ================================================================
const updateAttrTasks = new Map();

app.post('/api/pulse/update-attributes', async (req, res) => {
    const { sourceClientId, sourceApiKey, targetClientId, targetApiKey, prefix } = req.body;
    if (!sourceClientId || !sourceApiKey || !targetClientId || !targetApiKey) {
        return res.status(400).json({ error: 'sourceClientId, sourceApiKey, targetClientId, targetApiKey обязательны' });
    }

    const taskId = 'upattr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    updateAttrTasks.set(taskId, { status: 'running', progress: 0, log: [], results: [], startedAt: Date.now() });

    (async () => {
        const task = updateAttrTasks.get(taskId);
        const logMsg = (msg) => { task.log.push(`[${mskTime()}] ${msg}`); console.log(msg); };

        try {
            // 1. Source products
            logMsg(`[UPATTR] Загрузка товаров источника ${sourceClientId}...`);
            let srcProducts = [], srcLastId = '';
            while (true) {
                const r = await ozonApi.ozonRequestDynamic(sourceClientId, sourceApiKey, '/v3/product/list', { filter: {}, last_id: srcLastId, limit: 1000 });
                if (r.status !== 200) throw new Error('Ошибка списка source: ' + JSON.stringify(r.data));
                const items = r.data.result?.items || [];
                srcProducts = srcProducts.concat(items);
                srcLastId = r.data.result?.last_id || '';
                if (items.length < 1000) break;
            }
            logMsg(`[UPATTR] Источник: ${srcProducts.length} товаров`);

            // 2. Source details + attributes
            let srcDetails = [];
            for (let i = 0; i < srcProducts.length; i += 1000) {
                const ids = srcProducts.slice(i, i + 1000).map(p => p.product_id);
                const r = await ozonApi.ozonRequestDynamic(sourceClientId, sourceApiKey, '/v3/product/info/list', { product_id: ids });
                if (r.status === 200 && r.data.items) srcDetails = srcDetails.concat(r.data.items);
                if (i + 1000 < srcProducts.length) await new Promise(r => setTimeout(r, 1500));
            }

            const srcAttrsMap = {};
            for (let i = 0; i < srcDetails.length; i += 1000) {
                const ids = srcDetails.slice(i, i + 1000).map(p => p.product_id);
                const r = await ozonApi.ozonRequestDynamic(sourceClientId, sourceApiKey, '/v4/product/info/attributes', {
                    filter: { product_id: ids }, limit: 1000
                });
                if (r.status === 200 && Array.isArray(r.data?.result)) {
                    for (const p of r.data.result) {
                        if (p.product_id) srcAttrsMap[p.product_id] = p.attributes || [];
                        if (p.offer_id) srcAttrsMap[p.offer_id] = p.attributes || [];
                    }
                }
                if (i + 1000 < srcDetails.length) await new Promise(r => setTimeout(r, 1500));
            }
            logMsg(`[UPATTR] Атрибуты источника: ${Object.keys(srcAttrsMap).length} товаров`);

            // 3. Target products
            logMsg(`[UPATTR] Загрузка товаров целевого аккаунта ${targetClientId}...`);
            let tgtProducts = [], tgtLastId = '';
            while (true) {
                const r = await ozonApi.ozonRequestDynamic(targetClientId, targetApiKey, '/v3/product/list', { filter: {}, last_id: tgtLastId, limit: 1000 });
                if (r.status !== 200) throw new Error('Ошибка списка target: ' + JSON.stringify(r.data));
                const items = r.data.result?.items || [];
                tgtProducts = tgtProducts.concat(items);
                tgtLastId = r.data.result?.last_id || '';
                if (items.length < 1000) break;
            }
            logMsg(`[UPATTR] Целевой: ${tgtProducts.length} товаров`);

            // 4. Match source→target by offer_id (strip prefix)
            const pfx = prefix || '';
            let matched = 0, updated = 0, failed = 0;
            for (const tgt of tgtProducts) {
                const srcOfferId = pfx ? tgt.offer_id.replace(new RegExp('^' + pfx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '') : tgt.offer_id;
                const srcAttrs = srcAttrsMap[srcOfferId] || srcAttrsMap[tgt.offer_id] || [];
                if (srcAttrs.length === 0) { continue; }

                // Filter out mandatory attrs that should not be overwritten
                const mandatoryIds = new Set([22232, 9048, 7236, 23536, 85, 8229]);
                const attrsToSend = srcAttrs.filter(a => !mandatoryIds.has(a.id || a.attribute_id));

                if (attrsToSend.length === 0) { continue; }
                matched++;

                try {
                    await ozonApi.attributesUpdateDynamic(targetClientId, targetApiKey, [{
                        offer_id: tgt.offer_id,
                        attributes: attrsToSend.map(a => ({
                            id: a.id || a.attribute_id,
                            complex_id: a.complex_id || 0,
                            values: (a.values || []).map(v => ({
                                value: (v.value != null) ? String(v.value) : '',
                                ...(v.dictionary_value_id ? { dictionary_value_id: v.dictionary_value_id } : {})
                            }))
                        }))
                    }]);
                    updated++;
                    logMsg(`[UPATTR] OK ${tgt.offer_id} (${attrsToSend.length} attrs)`);
                } catch (e) {
                    failed++;
                    logMsg(`[UPATTR] FAIL ${tgt.offer_id}: ${e.message.substring(0, 100)}`);
                }
                await new Promise(r => setTimeout(r, 500));
            }

            task.status = 'done';
            task.results = { matched, updated, failed };
            logMsg(`[UPATTR] Готово: ${updated}/${matched} обновлено, ${failed} ошибок`);
        } catch (e) {
            task.status = 'error';
            task.results = { error: e.message };
            logMsg(`[UPATTR] ОШИБКА: ${e.message}`);
        }
    })();

    res.json({ taskId, status: 'started' });
});

app.get('/api/pulse/update-attributes/status', (req, res) => {
    const { taskId } = req.query;
    if (!taskId) return res.status(400).json({ error: 'taskId required' });
    const task = updateAttrTasks.get(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
});

// ================================================================
//  API — Bulk price change
// ================================================================

app.post('/api/pulse/bulk-price', async (req, res) => {
    try {
        const { clientId, apiKey, offerIds, markup } = req.body;
        if (!clientId || !apiKey || !markup) return res.status(400).json({ error: 'clientId, apiKey, markup обязательны' });

        // Get product details
        let allProducts = [], lastId = '';
        while (true) {
            const r = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v3/product/list', { filter: {}, last_id: lastId, limit: 1000 });
            if (r.status !== 200) throw new Error('Ошибка списка');
            const items = r.data.result?.items || [];
            allProducts = allProducts.concat(items);
            lastId = r.data.result?.last_id || '';
            if (items.length < 1000) break;
        }

        let details = [];
        for (let i = 0; i < allProducts.length; i += 1000) {
            const ids = allProducts.slice(i, i + 1000).map(p => p.product_id);
            const r = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v3/product/info/list', { product_id: ids });
            if (r.status === 200 && r.data.items) details = details.concat(r.data.items);
            if (i + 1000 < allProducts.length) await new Promise(r => setTimeout(r, 1500));
        }

        // Filter by offerIds if provided
        let targets = details.filter(d => !d.archived);
        if (offerIds && offerIds.length > 0) {
            targets = targets.filter(d => offerIds.includes(d.offer_id) || offerIds.includes(String(d.product_id)));
        }

        const priceItems = targets.map(d => {
            let newPrice = parseFloat(d.price) || 0;
            let oldPrice = parseFloat(d.old_price) || 0;
            if (markup.type === 'percent') {
                newPrice = Math.round(newPrice * (1 + markup.value / 100));
                oldPrice = Math.round(oldPrice * (1 + markup.value / 100));
            } else {
                newPrice = Math.round(newPrice + markup.value);
                oldPrice = Math.round(oldPrice + markup.value);
            }
            return {
                product_id: d.product_id,
                price: String(newPrice),
                old_price: String(oldPrice),
                min_price: String(Math.round(newPrice * 0.9))
            };
        });

        // Batch update prices
        let updated = 0;
        for (let i = 0; i < priceItems.length; i += 1000) {
            const batch = priceItems.slice(i, i + 1000);
            try {
                const r = await ozonApi.updatePricesDynamic(clientId, apiKey, batch);
                updated += batch.length;
            } catch (e) {}
            if (i + 1000 < priceItems.length) await new Promise(r => setTimeout(r, 1000));
        }

        res.json({ total: targets.length, updated, markup });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Excel export
// ================================================================

app.post('/api/pulse/export-excel', async (req, res) => {
    try {
        const { clientId, apiKey } = req.body;
        if (!clientId || !apiKey) return res.status(400).json({ error: 'clientId и apiKey обязательны' });

        let allProducts = [], lastId = '';
        while (true) {
            const r = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v3/product/list', { filter: {}, last_id: lastId, limit: 1000 });
            if (r.status !== 200) throw new Error('Ошибка списка');
            const items = r.data.result?.items || [];
            allProducts = allProducts.concat(items);
            lastId = r.data.result?.last_id || '';
            if (items.length < 1000) break;
        }

        let details = [];
        for (let i = 0; i < allProducts.length; i += 1000) {
            const ids = allProducts.slice(i, i + 1000).map(p => p.product_id);
            const r = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v3/product/info/list', { product_id: ids });
            if (r.status === 200 && r.data.items) details = details.concat(r.data.items);
            if (i + 1000 < allProducts.length) await new Promise(r => setTimeout(r, 1500));
        }

        // Get stocks
        let stocksMap = {};
        for (let i = 0; i < allProducts.length; i += 1000) {
            const ids = allProducts.slice(i, i + 1000).map(p => p.product_id);
            const r = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v3/product/info/stocks', { product_id: ids, limit: 1000 });
            if (r.status === 200 && r.data.result?.items) {
                for (const s of r.data.result.items) {
                    const stock = s.stocks?.[0]?.present || 0;
                    stocksMap[s.product_id] = stock;
                }
            }
            if (i + 1000 < allProducts.length) await new Promise(r => setTimeout(r, 1500));
        }

        // Build CSV
        const BOM = '\uFEFF';
        const header = 'Артикул;Название;Цена;Старая цена;Остаток;Статус;Архив\n';
        const rows = details.map(d => {
            const stock = stocksMap[d.product_id] || 0;
            return `${d.offer_id};${(d.name || '').replace(/;/g, ',')};${d.price};${d.old_price};${stock};${d.visible ? 'В продаже' : 'Не видим'};${d.archived ? 'Да' : 'Нет'}`;
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="products_${clientId}_${new Date().toISOString().slice(0,10)}.csv"`);
        res.send(BOM + header + rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Мульти-синхронизация (цены + остатки на N аккаунтов)
// ================================================================

const syncTasks = new Map();

/**
 * POST /api/pulse/sync/multi — Запуск мульти-синхронизации
 * Body: { sourceClientId, sourceApiKey, accounts: [{ clientId, apiKey, markup: { type, value }, prefix }] }
 */
app.post('/api/pulse/sync/multi', async (req, res) => {
    const { sourceClientId, sourceApiKey, accounts } = req.body;

    if (!sourceClientId || !sourceApiKey || !accounts || !Array.isArray(accounts) || accounts.length === 0) {
        return res.status(400).json({ error: 'sourceClientId, sourceApiKey и accounts обязательны' });
    }

    const taskId = 'sync_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    syncTasks.set(taskId, {
        status: 'running',
        phase: 'fetch_source',
        progress: 0,
        log: [],
        results: [],
        startedAt: Date.now()
    });

    runSyncTask(taskId, { sourceClientId, sourceApiKey, accounts });
    res.json({ taskId, status: 'started' });
});

/**
 * GET /api/pulse/sync/status — Статус синхронизации
 */
app.get('/api/pulse/sync/status', (req, res) => {
    const { taskId } = req.query;
    if (!taskId) return res.status(400).json({ error: 'taskId required' });
    const task = syncTasks.get(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
});

async function runSyncTask(taskId, params) {
    const task = syncTasks.get(taskId);
    const log = (msg) => { task.log.push(`[${mskTime()}] ${msg}`); console.log(msg); };

    try {
        const { sourceClientId, sourceApiKey, accounts } = params;

        // 1. Получаем товары-источника (Westar) с ценами и остатками
        log(`[SYNC] Получение товаров из source ${sourceClientId}...`);

        // Список товаров source
        let srcList = [], srcLastId = '';
        while (true) {
            const r = await ozonApi.ozonRequestDynamic(sourceClientId, sourceApiKey, '/v3/product/list', { filter: {}, last_id: srcLastId, limit: 1000 });
            if (r.status !== 200) throw new Error('Ошибка получения списка source: ' + JSON.stringify(r.data));
            const items = r.data.result?.items || [];
            srcList = srcList.concat(items);
            srcLastId = r.data.result?.last_id || '';
            if (items.length < 1000) break;
        }
        log(`[SYNC] Source товаров: ${srcList.length}`);

        // Детали source (цены)
        let srcDetails = [];
        for (let i = 0; i < srcList.length; i += 1000) {
            const ids = srcList.slice(i, i + 1000).map(p => p.product_id);
            const r = await ozonApi.ozonRequestDynamic(sourceClientId, sourceApiKey, '/v3/product/info/list', { product_id: ids });
            if (r.status === 200 && r.data.items) srcDetails = srcDetails.concat(r.data.items);
            if (i + 1000 < srcList.length) await new Promise(r => setTimeout(r, 1500));
        }
        log(`[SYNC] Source деталей: ${srcDetails.length}`);

        // Маппинг: offer_id → { price, stock, product_id } — stock берём из /v3/product/info/list
        const srcMap = {};
        for (const d of srcDetails) {
            const stockQty = d.stocks?.stocks?.[0]?.present || 0;
            srcMap[d.offer_id] = {
                product_id: d.product_id,
                offer_id: d.offer_id,
                price: parseFloat(d.price) || 0,
                old_price: parseFloat(d.old_price) || 0,
                stock: stockQty,
                name: d.name
            };
        }
        log(`[SYNC] Source маппинг: ${Object.keys(srcMap).length} товаров`);
        const withStock = Object.values(srcMap).filter(v => v.stock > 0).length;
        log(`[SYNC] Source с остатками: ${withStock}/${Object.keys(srcMap).length}`);
        log(`[SYNC] Примеры: ${Object.entries(srcMap).slice(0, 3).map(([k,v]) => `${k}=${v.stock}`).join(', ')}`);

        // 2. Синхронизация с каждым target-аккаунтом
        task.phase = 'syncing_targets';
        task.total = accounts.length;
        const allResults = [];

        for (let ai = 0; ai < accounts.length; ai++) {
            const acc = accounts[ai];
            const accLog = `[SYNC] Аккаунт ${ai + 1}/${accounts.length}: ${acc.name || acc.clientId}`;
            log(accLog);

            try {
                // Получаем товары target
                let tgtList = [], tgtLastId = '';
                while (true) {
                    const r = await ozonApi.ozonRequestDynamic(acc.clientId, acc.apiKey, '/v3/product/list', { filter: {}, last_id: tgtLastId, limit: 1000 });
                    if (r.status !== 200) throw new Error('Ошибка target list: ' + JSON.stringify(r.data));
                    const items = r.data.result?.items || [];
                    tgtList = tgtList.concat(items);
                    tgtLastId = r.data.result?.last_id || '';
                    if (items.length < 1000) break;
                }

                // Получаем склады target (чтобы знать warehouse_id)
                let tgtWarehouses = [];
                try {
                    tgtWarehouses = await ozonApi.getWarehousesDynamic(acc.clientId, acc.apiKey);
                } catch (e) {}

                // Поддержка prefix как строки или массива ["PnDn-", "PnDn2-"]
                const prefixes = Array.isArray(acc.prefixes) ? acc.prefixes : (acc.prefix ? [acc.prefix] : []);
                const markup = acc.markup || { type: 'percent', value: 0 };

                // Строим цены и остатки для target
                const priceItems = [];
                const stockItems = [];
                let matched = 0, updated = 0;

                // Найдём работающий склад — пробуем по очереди с тестовым значением > 0
                let defaultWarehouseId = null;
                if (acc.warehouseId) {
                    defaultWarehouseId = Number(acc.warehouseId);
                    log(`[SYNC] ${acc.name}: warehouseId из конфига=${defaultWarehouseId}`);
                } else if (tgtWarehouses.length > 0 && tgtList.length > 0) {
                    const testProduct = tgtList.find(t => !t.archived);
                    if (testProduct) {
                        for (const wh of tgtWarehouses) {
                            try {
                                const testStock = [{ offer_id: testProduct.offer_id, product_id: testProduct.product_id, stock: "1", warehouse_id: wh.warehouse_id }];
                                const testResult = await ozonApi.updateStocksDynamic(acc.clientId, acc.apiKey, testStock);
                                const r = testResult?.[0]?.data?.result?.[0];
                                if (r && r.updated) {
                                    defaultWarehouseId = wh.warehouse_id;
                                    log(`[SYNC] ${acc.name}: рабочий склад=${wh.warehouse_id} (${wh.name || 'unnamed'})`);
                                    break;
                                }
                            } catch (e) {}
                        }
                        // Сбросим тестовый stock обратно на 0
                        if (defaultWarehouseId) {
                            try {
                                const resetStock = [{ offer_id: testProduct.offer_id, product_id: testProduct.product_id, stock: "0", warehouse_id: defaultWarehouseId }];
                                await ozonApi.updateStocksDynamic(acc.clientId, acc.apiKey, resetStock);
                            } catch (e) {}
                        }
                    }
                }
                if (!defaultWarehouseId) {
                    log(`[SYNC] ${acc.name}: ВНИМАНИЕ! Нет рабочего склада, остатки не будут обновлены`);
                }

                for (const tgt of tgtList) {
                    if (tgt.archived) continue;
                    // Умный матчинг: ищем товар в source по offer_id
                    // 1. Точное совпадение: EM-4116 == EM-4116
                    // 2. По префиксу: PnDn-EM-4116 → убираем префикс → EM-4116
                    // 3. По вхождению: 0з8нр4-EM-4116 содержит EM-4116 (любой префикс)
                    let src = srcMap[tgt.offer_id];
                    let matchType = src ? 'exact' : null;
                    if (!src) {
                        for (const pfx of prefixes) {
                            const escaped = pfx.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                            const stripped = tgt.offer_id.replace(new RegExp('^' + escaped), '');
                            if (stripped !== tgt.offer_id && srcMap[stripped]) { src = srcMap[stripped]; matchType = 'prefix:' + pfx; break; }
                        }
                    }
                    if (!src) {
                        // Умный поиск: проверяем заканчивается ли target на "-" + source offer_id
                        for (const [srcOid, srcData] of Object.entries(srcMap)) {
                            if (tgt.offer_id.endsWith('-' + srcOid)) {
                                src = srcData;
                                matchType = 'smart:' + srcOid;
                                break;
                            }
                        }
                    }
                    if (!src) continue;
                    matched++;
                    if (matchType !== 'exact') log(`[SYNC] ${acc.name}: матчинг "${tgt.offer_id}" → "${src.offer_id}" (${matchType})`);

                    // Цена с наценкой
                    let finalPrice = src.price;
                    if (markup.value > 0) {
                        if (markup.type === 'percent') {
                            finalPrice = Math.round(src.price * (1 + markup.value / 100));
                        } else {
                            finalPrice = Math.round(src.price + markup.value);
                        }
                    }

                    priceItems.push({
                        product_id: tgt.product_id,
                        price: String(finalPrice),
                        old_price: String(Math.round(finalPrice * 1.3)),
                        min_price: String(Math.round(finalPrice * 0.9))
                    });

                    let finalStock = src.stock;
                    const stockMode = acc.stockMode || 'sync';
                    const stockValue = parseFloat(acc.stockValue) || 0;
                    if (stockMode === 'plus' && stockValue > 0) {
                        finalStock = Math.round(src.stock * (1 + stockValue / 100));
                    } else if (stockMode === 'minus' && stockValue > 0) {
                        finalStock = Math.max(0, Math.round(src.stock * (1 - stockValue / 100)));
                    } else if (stockMode === 'fixed') {
                        finalStock = Math.round(stockValue);
                    }

                    stockItems.push({
                        offer_id: tgt.offer_id,
                        product_id: tgt.product_id,
                        stock: String(finalStock),
                        warehouse_id: defaultWarehouseId
                    });
                    updated++;
                }

                log(`[SYNC] ${acc.name}: matched=${matched}, prices=${priceItems.length}, stocks=${stockItems.length}`);

                // Обновляем цены
                if (priceItems.length > 0) {
                    log(`[SYNC] ${acc.name}: первый priceItem=${JSON.stringify(priceItems[0])}`);
                    try {
                        await ozonApi.updatePricesDynamic(acc.clientId, acc.apiKey, priceItems);
                        log(`[SYNC] ${acc.name}: цены обновлены (${priceItems.length})`);
                    } catch (e) {
                        log(`[SYNC] ${acc.name}: ОШИБКА цен: ${e.message}`);
                    }
                }

                // Обновляем остатки
                if (stockItems.length > 0 && defaultWarehouseId) {
                    log(`[SYNC] ${acc.name}: первый stockItem=${JSON.stringify(stockItems[0])}`);
                    try {
                        const stockResult = await ozonApi.updateStocksDynamic(acc.clientId, acc.apiKey, stockItems);
                        for (const sr of stockResult) {
                            if (sr.status !== 200 || (sr.data && sr.data.result)) {
                                log(`[SYNC] ${acc.name}: stock API status=${sr.status} result=${JSON.stringify(sr.data).substring(0, 300)}`);
                            }
                        }
                        log(`[SYNC] ${acc.name}: остатки обновлены (${stockItems.length})`);
                    } catch (e) {
                        log(`[SYNC] ${acc.name}: ОШИБКА остатков: ${e.message}`);
                    }
                } else if (stockItems.length > 0) {
                    log(`[SYNC] ${acc.name}: остатки пропущены (нет складов)`);
                }

                allResults.push({
                    name: acc.name || acc.clientId,
                    clientId: acc.clientId,
                    matched,
                    prices: priceItems.length,
                    stocks: stockItems.length,
                    success: true
                });

            } catch (e) {
                log(`[SYNC] ${acc.name}: ОШИБКА: ${e.message}`);
                allResults.push({
                    name: acc.name || acc.clientId,
                    clientId: acc.clientId,
                    success: false,
                    error: e.message
                });
            }

            task.progress = Math.round((ai + 1) / accounts.length * 100);
            if (ai < accounts.length - 1) await new Promise(r => setTimeout(r, 2000));
        }

        task.status = 'completed';
        task.progress = 100;
        task.results = allResults;
        task.phase = 'done';
        log(`[SYNC] Готово! Синхронизировано ${allResults.filter(r => r.success).length}/${accounts.length} аккаунтов`);

    } catch (err) {
        task.status = 'failed';
        task.error = err.message;
        log(`[SYNC] ОШИБКА: ${err.message}`);
    }
}

// POST /api/pulse/target/products — Товары целевого аккаунта
app.post('/api/pulse/target/products', async (req, res) => {
    try {
        const { clientId, apiKey } = req.body;
        if (!clientId || !apiKey) {
            return res.status(400).json({ error: 'clientId и apiKey обязательны' });
        }

        // Получаем список товаров
        const productList = await ozonApi.getAllProductsDynamic(clientId, apiKey, 1000);
        const productIds = productList.map(p => p.product_id);

        // Получаем детальную информацию
        let details = [];
        if (productIds.length > 0) {
            details = await ozonApi.getProductsInfoDynamic(clientId, apiKey, productIds);
        }

        res.json({
            total: productList.length,
            items: details
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Мониторинг цен (наши vs Ozon + конкуренты)
// ================================================================

/**
 * Нормализация артикула для сравнения:
 * - Убираем пробелы, дефисы, нижний регистр
 * - Извлекаем числовую часть (EM-2292 -> 2292)
 */
function normalizeArticle(art) {
    if (!art) return '';
    return art.toString().trim().toLowerCase().replace(/[\s\-_.]/g, '');
}

function extractNumeric(art) {
    if (!art) return '';
    const m = art.toString().match(/(\d+)/);
    return m ? m[1] : '';
}

app.get('/api/price-monitor/:accountKey', async (req, res) => {
    try {
        const accountKey = req.params.accountKey;
        const acc = findAccountByClientId(accountKey);
        if (!acc) return res.status(404).json({ error: 'Аккаунт не найден' });

        // 1. Читаем наш каталог
        let catalog = { products: [] };
        if (fs.existsSync(catalogJsonPath)) {
            catalog = JSON.parse(fs.readFileSync(catalogJsonPath, 'utf8'));
        }

        // Строим индексы для сопоставления
        const catalogByArticle = {};   // точное совпадение
        const catalogByNumeric = {};   // по числовой части
        const catalogByName = {};      // по имени (для fuzzy)

        (catalog.products || []).forEach(p => {
            if (p.article) {
                const entry = {
                    id: p.id,
                    article: p.article,
                    name: p.name,
                    ourPrice: p.price || 0,
                    purchasePrice: p.purchase_price || 0,
                    stock: p.stock || 0,
                    category: p.category || '',
                    brand: p.brand || '',
                    oem: p.oem || ''
                };
                catalogByArticle[normalizeArticle(p.article)] = entry;
                const num = extractNumeric(p.article);
                if (num) catalogByNumeric[num] = entry;
                if (p.name) {
                    const nameKey = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    catalogByName[nameKey] = entry;
                }
            }
        });

        // 2. Получаем товары с Ozon
        const productList = await ozonApi.getAllProducts(acc.clientId, acc.apiKey, 1000);
        const productIds = productList.map(p => p.product_id);

        let ozonDetails = [];
        if (productIds.length > 0) {
            ozonDetails = await ozonApi.getProductsInfo(acc.clientId, acc.apiKey, productIds);
        }

        console.log(`[PriceMonitor] Ozon товаров: ${ozonDetails.length}, наш каталог: ${Object.keys(catalogByArticle).length}`);
        if (ozonDetails.length > 0) {
            console.log(`[PriceMonitor] Пример offer_id: ${ozonDetails.slice(0, 3).map(i => i.offer_id).join(', ')}`);
        }

        // 3. Сопоставляем и формируем результат
        const result = [];
        let matchedCount = 0;
        let onlyOzonCount = 0;
        let onlyOurCount = 0;

        // Товары с Ozon
        ozonDetails.forEach(item => {
            const offerId = item.offer_id || '';

            // Стратегия сопоставления:
            // 1. Точное совпадение артикула
            // 2. По числовой части
            // 3. По имени товара
            let local = catalogByArticle[normalizeArticle(offerId)];
            let matchType = 'exact';
            if (!local) {
                const num = extractNumeric(offerId);
                if (num && catalogByNumeric[num]) {
                    local = catalogByNumeric[num];
                    matchType = 'numeric';
                }
            }
            if (!local) {
                const nameKey = item.name ? item.name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
                if (nameKey && catalogByName[nameKey]) {
                    local = catalogByName[nameKey];
                    matchType = 'name';
                }
            }

            // Цены Ozon — все поля
            const ozonPrice = parseFloat(item.price) || 0;
            const oldPrice = parseFloat(item.old_price) || 0;
            const minPrice = parseFloat(item.min_price) || 0;
            const marketingPrice = parseFloat(item.marketing_price) || 0;

            // Расчёт цены на витрине Ozon:
            // Если marketing_price задана и меньше price — это акционная цена
            // Иначе price — это продажная цена
            const storefrontPrice = (marketingPrice > 0 && marketingPrice < ozonPrice) ? marketingPrice : ozonPrice;

            if (local) {
                matchedCount++;
                const diff = storefrontPrice - local.ourPrice;
                const diffPercent = local.ourPrice > 0 ? ((diff / local.ourPrice) * 100).toFixed(1) : 0;
                result.push({
                    article: offerId,
                    name: local.name || item.name,
                    ourPrice: local.ourPrice,
                    purchasePrice: local.purchasePrice,
                    ozonPrice: ozonPrice,
                    ozonOldPrice: oldPrice,
                    ozonMinPrice: minPrice,
                    ozonMarketingPrice: marketingPrice,
                    ozonStorefrontPrice: storefrontPrice,
                    diff: Math.round(diff),
                    diffPercent: parseFloat(diffPercent),
                    stock: local.stock,
                    visible: item.visible,
                    status: item.status,
                    source: 'both',
                    matchType: matchType,
                    productId: item.product_id,
                    competitors: []
                });
                delete catalogByArticle[normalizeArticle(local.article)];
            } else {
                onlyOzonCount++;
                result.push({
                    article: offerId,
                    name: item.name,
                    ourPrice: 0,
                    purchasePrice: 0,
                    ozonPrice: ozonPrice,
                    ozonOldPrice: oldPrice,
                    ozonMinPrice: minPrice,
                    ozonMarketingPrice: marketingPrice,
                    ozonStorefrontPrice: storefrontPrice,
                    diff: 0,
                    diffPercent: 0,
                    stock: 0,
                    visible: item.visible,
                    status: item.status,
                    source: 'ozon_only',
                    matchType: null,
                    productId: item.product_id,
                    competitors: []
                });
            }
        });

        // Товары только в нашем каталоге (нет на Ozon)
        Object.values(catalogByArticle).forEach(local => {
            onlyOurCount++;
            result.push({
                article: local.article,
                name: local.name,
                ourPrice: local.ourPrice,
                purchasePrice: local.purchasePrice,
                ozonPrice: 0,
                ozonOldPrice: 0,
                ozonMinPrice: 0,
                ozonMarketingPrice: 0,
                ozonStorefrontPrice: 0,
                diff: 0,
                diffPercent: 0,
                stock: local.stock,
                visible: false,
                status: 'not_on_ozon',
                source: 'our_only',
                matchType: null,
                productId: null,
                competitors: []
            });
        });

        // Статистика
        const both = result.filter(r => r.source === 'both');
        const stats = {
            total: result.length,
            matched: matchedCount,
            ozonOnly: onlyOzonCount,
            ourOnly: onlyOurCount,
            avgDiff: both.length > 0
                ? Math.round(both.reduce((s, r) => s + r.diff, 0) / both.length)
                : 0,
            priceHigherOnOzon: both.filter(r => r.diff > 0).length,
            priceLowerOnOzon: both.filter(r => r.diff < 0).length,
            priceSame: both.filter(r => r.diff === 0).length
        };

        res.json({ stats, products: result });
    } catch (err) {
        console.error('Ошибка мониторинга цен:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Поиск цен конкурентов (Wildberries)
// ================================================================

const https_search = require('https');

function wbSearch(article, name) {
    return new Promise((resolve) => {
        const query = encodeURIComponent(article || name);
        const url = `https://search.wb.ru/exactmatch/ru/common/v7/search?appType=1&curr=rub&dest=-1257786&query=${query}&resultset=catalog&sort=popular&spp=30&suppressSpellcheck=false`;

        const req = https_search.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Origin': 'https://www.wildberries.ru'
            },
            timeout: 8000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const products = (json.data?.products || []).slice(0, 5).map(p => ({
                        name: p.name,
                        brand: p.brand || '',
                        price: p.sizes?.[0]?.price?.total ? Math.round(p.sizes[0].price.total / 100) : 0,
                        oldPrice: p.sizes?.[0]?.price?.basic ? Math.round(p.sizes[0].price.basic / 100) : 0,
                        salePrice: p.sizes?.[0]?.price?.total ? Math.round(p.sizes[0].price.total / 100 * 0.95) : 0,
                        url: `https://www.wildberries.ru/catalog/${p.id}/detail.aspx`,
                        rating: p.reviewRating || 0,
                        feedbacks: p.feedbacks || 0
                    }));
                    resolve({ source: 'Wildberries', products });
                } catch (e) {
                    resolve({ source: 'Wildberries', products: [], error: e.message });
                }
            });
        });
        req.on('error', () => resolve({ source: 'Wildberries', products: [], error: 'Connection failed' }));
        req.on('timeout', () => { req.destroy(); resolve({ source: 'Wildberries', products: [], error: 'Timeout' }); });
    });
}

app.get('/api/competitors/search', async (req, res) => {
    try {
        const { article, name } = req.query;
        if (!article && !name) {
            return res.status(400).json({ error: 'article или name обязательны' });
        }

        const results = await Promise.all([
            wbSearch(article, name)
        ]);

        res.json({ query: article || name, sources: results });
    } catch (err) {
        console.error('Ошибка поиска конкурентов:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Массовый поиск конкурентов для списка артикулов
app.post('/api/competitors/batch', async (req, res) => {
    try {
        const { articles } = req.body;
        if (!articles || !Array.isArray(articles)) {
            return res.status(400).json({ error: 'articles обязательный массив' });
        }

        const results = [];
        // Ограничиваем 20 запросами за раз, с задержкой
        for (let i = 0; i < Math.min(articles.length, 20); i++) {
            const art = articles[i];
            const wb = await wbSearch(art.article, art.name);
            results.push({ article: art.article, competitors: wb.products || [] });
            // Задержка чтобы не забанили
            if (i < articles.length - 1) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

        res.json({ results });
    } catch (err) {
        console.error('Ошибка массового поиска:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Аналитика Ozon
// ================================================================

app.post('/api/ozon/:accountKey/analytics', async (req, res) => {
    try {
        const { date_from, date_to, metrics, dimension, limit, offset, filters } = req.body;
        const body = {
            date_from: date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
            date_to: date_to || new Date().toISOString().split('T')[0],
            metrics: metrics || ['revenue', 'ordered_units', 'hits_view', 'hits_tocart', 'session_view', 'conv_tocart', 'conv_tocart_pdp', 'returns', 'cancellations'],
            dimension: dimension || ['sku'],
            limit: limit || 1000,
            offset: offset || 0
        };
        if (filters) body.filters = filters;
        if (req.body.sort) body.sort = req.body.sort;

        const acc = findAccountByClientId(req.params.accountKey);
        if (!acc) return res.status(404).json({ error: 'Аккаунт не найден' });
        const result = await ozonApi.ozonRequest(acc.clientId, acc.apiKey, '/v1/analytics/data', body);
        res.json(result.data);
    } catch (err) {
        console.error('Ошибка аналитики:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Заказы FBS
// ================================================================

app.post('/api/ozon/:accountKey/orders/fbs', async (req, res) => {
    try {
        const { since, to, limit, offset, status } = req.body;
        const body = {
            dir: 'ASC',
            filter: {
                since: since || new Date(Date.now() - 7 * 86400000).toISOString(),
                to: to || new Date().toISOString()
            },
            limit: limit || 100,
            offset: offset || 0,
            with: { analytics_data: true, financial_data: true }
        };
        if (status) body.filter.status = status;

        const acc = findAccountByClientId(req.params.accountKey);
        if (!acc) return res.status(404).json({ error: 'Аккаунт не найден' });
        const result = await ozonApi.ozonRequest(acc.clientId, acc.apiKey, '/v3/posting/fbs/list', body);
        res.json(result.data);
    } catch (err) {
        console.error('Ошибка заказов FBS:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Детали заказа
app.post('/api/ozon/:accountKey/orders/fbs/get', async (req, res) => {
    try {
        const { posting_number } = req.body;
        if (!posting_number) return res.status(400).json({ error: 'posting_number обязателен' });
        const acc = findAccountByClientId(req.params.accountKey);
        if (!acc) return res.status(404).json({ error: 'Аккаунт не найден' });
        const result = await ozonApi.ozonRequest(acc.clientId, acc.apiKey, '/v3/posting/fbs/get', {
            posting_number,
            with: { analytics_data: true, financial_data: true }
        });
        res.json(result.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Заказы FBO
// ================================================================

app.post('/api/ozon/:accountKey/orders/fbo', async (req, res) => {
    try {
        const { since, to, limit, offset } = req.body;
        const body = {
            dir: 'ASC',
            filter: {
                since: since || new Date(Date.now() - 7 * 86400000).toISOString(),
                to: to || new Date().toISOString()
            },
            limit: limit || 100,
            offset: offset || 0,
            with: { analytics_data: true, financial_data: true }
        };
        const acc = findAccountByClientId(req.params.accountKey);
        if (!acc) return res.status(404).json({ error: 'Аккаунт не найден' });
        const result = await ozonApi.ozonRequest(acc.clientId, acc.apiKey, '/v2/posting/fbo/list', body);
        res.json(result.data);
    } catch (err) {
        console.error('Ошибка заказов FBO:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Финансы
// ================================================================

app.post('/api/ozon/:accountKey/finance/transactions', async (req, res) => {
    try {
        const { date_from, date_to, limit, offset } = req.body;
        const body = {
            filter: {
                date: {
                    from: date_from || new Date(Date.now() - 30 * 86400000).toISOString(),
                    to: date_to || new Date().toISOString()
                }
            },
            page: 1,
            page_size: limit || 100
        };
        if (offset) body.page = Math.floor(offset / (limit || 100)) + 1;
        const acc = findAccountByClientId(req.params.accountKey);
        if (!acc) return res.status(404).json({ error: 'Аккаунт не найден' });
        const result = await ozonApi.ozonRequest(acc.clientId, acc.apiKey, '/v3/finance/transaction/list', body);
        res.json(result.data);
    } catch (err) {
        console.error('Ошибка финансов:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Возвраты
// ================================================================

app.post('/api/ozon/:accountKey/returns', async (req, res) => {
    try {
        const { last_id, limit } = req.body;
        const body = {
            filter: {},
            last_id: last_id || '',
            limit: limit || 100
        };
        const acc = findAccountByClientId(req.params.accountKey);
        if (!acc) return res.status(404).json({ error: 'Аккаунт не найден' });
        const result = await ozonApi.ozonRequest(acc.clientId, acc.apiKey, '/v3/returns/company/fbs', body);
        res.json(result.data);
    } catch (err) {
        console.error('Ошибка возвратов:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Рейтинги товаров
// ================================================================

app.post('/api/ozon/:accountKey/ratings', async (req, res) => {
    try {
        const { skus } = req.body;
        if (!skus || !Array.isArray(skus)) return res.status(400).json({ error: 'skus обязательный массив' });
        const acc = findAccountByClientId(req.params.accountKey);
        if (!acc) return res.status(404).json({ error: 'Аккаунт не найден' });
        const result = await ozonApi.ozonRequest(acc.clientId, acc.apiKey, '/v1/product/rating-by-sku', { skus });
        res.json(result.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Подписчики
// ================================================================

app.post('/api/ozon/:accountKey/subscriptions', async (req, res) => {
    try {
        const { product_ids } = req.body;
        if (!product_ids || !Array.isArray(product_ids)) return res.status(400).json({ error: 'product_ids обязательный массив' });
        const acc = findAccountByClientId(req.params.accountKey);
        if (!acc) return res.status(404).json({ error: 'Аккаунт не найден' });
        const result = await ozonApi.ozonRequest(acc.clientId, acc.apiKey, '/v1/product/info/subscription', { product_id: product_ids });
        res.json(result.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Детальные цены (v5) с комиссиями
// ================================================================

app.post('/api/ozon/:accountKey/prices/v5', async (req, res) => {
    try {
        const { filter, limit, last_id } = req.body;
        const body = { limit: limit || 100 };
        if (filter) body.filter = filter;
        if (last_id) body.last_id = last_id;
        const acc = findAccountByClientId(req.params.accountKey);
        if (!acc) return res.status(404).json({ error: 'Аккаунт не найден' });
        const result = await ozonApi.ozonRequest(acc.clientId, acc.apiKey, '/v5/product/info/prices', body);
        res.json(result.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Атрибуты товаров
// ================================================================

app.post('/api/ozon/:accountKey/attributes', async (req, res) => {
    try {
        const { filter, limit, last_id, sort_by, sort_dir } = req.body;
        const body = { limit: limit || 100 };
        if (filter) body.filter = filter;
        if (last_id) body.last_id = last_id;
        if (sort_by) { body.sort_by = sort_by; body.sort_dir = sort_dir || 'ASC'; }
        const acc = findAccountByClientId(req.params.accountKey);
        if (!acc) return res.status(404).json({ error: 'Аккаунт не найден' });
        const result = await ozonApi.ozonRequest(acc.clientId, acc.apiKey, '/v4/product/info/attributes', body);
        res.json(result.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Остатки на складах (v4)
// ================================================================

app.post('/api/ozon/:accountKey/stocks', async (req, res) => {
    try {
        const { filter, limit, last_id } = req.body;
        const body = { limit: limit || 100 };
        if (filter) body.filter = filter;
        if (last_id) body.last_id = last_id;
        const acc = findAccountByClientId(req.params.accountKey);
        if (!acc) return res.status(404).json({ error: 'Аккаунт не найден' });
        const result = await ozonApi.ozonRequest(acc.clientId, acc.apiKey, '/v4/product/info/stocks', body);
        res.json(result.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  API — Конкуренты: Exist/Emex (поиск по OEM-номеру)
// ================================================================

const httpsExist = require('https');

function existSearch(oemNumber) {
    return new Promise((resolve) => {
        const query = encodeURIComponent(oemNumber);
        const url = `https://emex.ru/api/search/search?detailNum=${query}&locationId=35339&showAll=true`;

        const req = httpsExist.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Origin': 'https://emex.ru',
                'Referer': 'https://emex.ru/'
            },
            timeout: 10000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const items = (json.data?.detailNums || []).slice(0, 5).map(d => ({
                        brand: d.brandName || '',
                        article: d.detailNum || '',
                        name: d.name || '',
                        price: d.minPrice || 0,
                        deliveryDays: d.deliveryDays || '',
                        supplier: d.supplierName || '',
                        country: d.country || '',
                        url: `https://emex.ru/products/${d.brandName}+${d.detailNum}`
                    }));
                    resolve({ source: 'Emex', items });
                } catch (e) {
                    resolve({ source: 'Emex', items: [], error: e.message });
                }
            });
        });
        req.on('error', () => resolve({ source: 'Emex', items: [], error: 'Connection failed' }));
        req.on('timeout', () => { req.destroy(); resolve({ source: 'Emex', items: [], error: 'Timeout' }); });
    });
}

function existSearchAlt(oemNumber) {
    return new Promise((resolve) => {
        const query = encodeURIComponent(oemNumber);
        const url = `https://exist.ru/Price/?pcode=${query}&maker=&mode=0`;

        const req = httpsExist.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html'
            },
            timeout: 10000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // Exist возвращает HTML, парсим минимальную цену
                const priceMatch = data.match(/data-price="(\d+)"/);
                const brandMatch = data.match(/data-brand="([^"]+)"/);
                resolve({
                    source: 'Exist',
                    items: priceMatch ? [{
                        brand: brandMatch ? brandMatch[1] : '',
                        article: oemNumber,
                        price: parseInt(priceMatch[1]) || 0,
                        url: `https://exist.ru/Price/?pcode=${query}`
                    }] : []
                });
            });
        });
        req.on('error', () => resolve({ source: 'Exist', items: [], error: 'Connection failed' }));
        req.on('timeout', () => { req.destroy(); resolve({ source: 'Exist', items: [], error: 'Timeout' }); });
    });
}

function autodocSearch(article) {
    return new Promise((resolve) => {
        const query = encodeURIComponent(article);
        const url = `https://webapi.autodoc.ru/api/catalogs/1/brands/${query}/articles?country=ru`;

        const req = httpsExist.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Origin': 'https://www.autodoc.ru'
            },
            timeout: 10000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const items = (json.data || json || []).slice(0, 5).map(d => ({
                        brand: d.brandName || d.brand || '',
                        article: d.article || d.number || '',
                        name: d.name || '',
                        price: d.minPrice || d.price || 0,
                        deliveryDays: d.deliveryTime || '',
                        url: `https://www.autodoc.ru/search/${query}`
                    }));
                    resolve({ source: 'Autodoc', items });
                } catch (e) {
                    resolve({ source: 'Autodoc', items: [], error: e.message });
                }
            });
        });
        req.on('error', () => resolve({ source: 'Autodoc', items: [], error: 'Connection failed' }));
        req.on('timeout', () => { req.destroy(); resolve({ source: 'Autodoc', items: [], error: 'Timeout' }); });
    });
}

// Поиск на всех площадках
app.get('/api/competitors/all', async (req, res) => {
    try {
        const { article, oem } = req.query;
        const query = article || oem;
        if (!query) return res.status(400).json({ error: 'article или oem обязателен' });

        const results = await Promise.all([
            wbSearch(query, query),
            existSearch(oem || article),
            autodocSearch(query)
        ]);

        res.json({ query, sources: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  Serve frontend static files
// ================================================================
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, westarDir)));

// POST /api/pulse/download-image — Скачать изображение с Ozon CDN и сохранить локально
app.post('/api/pulse/download-image', async (req, res) => {
    try {
        const { url, offerId } = req.body;
        if (!url) return res.status(400).json({ error: 'url обязателен' });

        const axios = require('axios');
        const crypto = require('crypto');

        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
        const ext = url.includes('.png') ? 'png' : 'jpg';
        const filename = `${offerId || crypto.randomBytes(4).toString('hex')}_${Date.now()}.${ext}`;
        const filepath = path.join(__dirname, 'static', 'images', filename);

        fs.writeFileSync(filepath, response.data);
        const publicUrl = `${req.protocol}://${req.get('host')}/static/images/${filename}`;

        res.json({ success: true, url: publicUrl, filename });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/proxy-image — прокси для скачивания изображений с любых URL
// Ozon может скачивать фото через этот эндпоинт: /api/proxy-image?url=...
app.get('/api/proxy-image', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url || !url.startsWith('http')) {
            return res.status(400).json({ error: 'url параметр обязателен' });
        }
        const axios = require('axios');
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(Buffer.from(response.data));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  POST /api/pulse/cleanup — Удаление мусорных товаров
// ================================================================

app.post('/api/pulse/cleanup', async (req, res) => {
    const { clientId, apiKey, prefixes, offerIds } = req.body;
    if (!clientId || !apiKey) return res.status(400).json({ error: 'clientId, apiKey обязательны' });

    try {
        // Получаем все товары аккаунта
        let allProducts = [], lastId = '';
        while (true) {
            const r = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v3/product/list', { filter: {}, last_id: lastId, limit: 1000 });
            if (r.status !== 200) throw new Error(JSON.stringify(r.data));
            const items = r.data.result?.items || [];
            allProducts = allProducts.concat(items);
            lastId = r.data.result?.last_id || '';
            if (items.length < 1000) break;
        }

        // Фильтруем по префиксам или конкретным offer_id
        const toDelete = allProducts.filter(p => {
            if (offerIds && offerIds.includes(p.offer_id)) return true;
            if (prefixes) {
                return prefixes.some(pfx => p.offer_id.startsWith(pfx));
            }
            return false;
        });

        if (toDelete.length === 0) return res.json({ deleted: 0, message: 'Нет товаров для удаления' });

        // Архивируем
        const ids = toDelete.map(p => p.product_id);
        const archResp = await ozonApi.ozonRequestDynamic(clientId, apiKey, '/v1/product/archive', { product_id: ids });

        res.json({ deleted: toDelete.length, ids, offerIds: toDelete.map(p => p.offer_id), archiveStatus: archResp.status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================================================================
//  AUTO-SYNC: синхронизация каждые 30 минут
// ================================================================

async function runAutoSync() {
    try {
        const db = readAccounts();
        const source = db.accounts.find(a => a.enabled && a.markup?.value === 0);
        const targets = db.accounts.filter(a => a.enabled && a.markup?.value > 0);
        if (!source || targets.length === 0) return;

        console.log(`[AUTO-SYNC] Запуск: source=${source.clientId} → targets=${targets.map(t => t.name).join(',')}`);

        for (const target of targets) {
            const body = {
                sourceClientId: source.clientId,
                sourceApiKey: source.apiKey,
                accounts: [{
                    clientId: target.clientId,
                    apiKey: target.apiKey,
                    name: target.name,
                    markup: target.markup,
                    prefix: target.prefix,
                    warehouseId: target.warehouseId
                }]
            };

            const axios = require('axios');
            const resp = await axios.post(`http://localhost:${PORT}/api/pulse/sync/multi`, body, { timeout: 30000 });
            const taskId = resp.data.taskId;

            // Ждём завершения (макс 120 сек)
            for (let i = 0; i < 60; i++) {
                await new Promise(r => setTimeout(r, 2000));
                const statusResp = await axios.get(`http://localhost:${PORT}/api/pulse/sync/status?taskId=${taskId}`, { timeout: 10000 });
                if (statusResp.data.status === 'completed' || statusResp.data.status === 'failed') {
                    console.log(`[AUTO-SYNC] ${target.name}: ${statusResp.data.status}`);
                    break;
                }
            }
        }
        console.log('[AUTO-SYNC] Завершён');
    } catch (err) {
        console.error('[AUTO-SYNC] Ошибка:', err.message);
    }
}

// Авто-синк отключён — ключи хранятся в localStorage браузера
// Синк запускается вручную через UI кнопку «Синхронизировать все»
// Если нужен авто-синк — раскомментируйте код ниже и сохраните accounts.json в git
/*
setTimeout(() => {
    runAutoSync();
    setInterval(runAutoSync, 30 * 60 * 1000);
}, 5 * 60 * 1000);
console.log('[AUTO-SYNC] Авто-синк активирован (каждые 30 мин)');
*/

app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
    console.log(`📦 Каталог:        http://localhost:${PORT}/index.html`);
    console.log(`⚙️  Админка:        http://localhost:${PORT}/admin.html`);
    console.log(`📊 Dashboard:      http://localhost:${PORT}/dashboard.html`);
    console.log(`📡 Пульт:          http://localhost:${PORT}/pulse.html`);
    console.log(`💰 Мониторинг:     http://localhost:${PORT}/price-monitor.html`);
    console.log(`📊 Полный дашборд:  http://localhost:${PORT}/dashboard-full.html`);
    console.log('═══════════════════════════════════════════════');
    console.log(`📡 Пульт: ${PORT === 3000 ? 'http://localhost:3000/pulse.html' : 'westar-api.onrender.com/pulse.html'}`);
    console.log('');
});

