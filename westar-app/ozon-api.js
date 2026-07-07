// ============================================================================
// Ozon Seller API — модуль для работы с несколькими аккаунтами
// ============================================================================
const https = require('https');

/**
 * Отправка запроса к Ozon Seller API
 * @param {string} clientId - Client ID аккаунта Ozon
 * @param {string} apiKey - API Key аккаунта Ozon
 * @param {string} endpoint - Путь API (напр. /v3/product/list)
 * @param {object} body - Тело запроса
 * @returns {Promise<{status: number, data: object}>}
 */
function ozonRequest(clientId, apiKey, endpoint, body = {}) {

    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: 'api-seller.ozon.ru',
            path: endpoint,
            method: 'POST',
            headers: {
                'Client-Id': clientId,
                'Api-Key': apiKey,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(responseData) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: responseData });
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

/**
 * Получить список всех товаров аккаунта (с пагинацией)
 */
async function getAllProducts(clientId, apiKey, limit = 1000) {
    let allItems = [];
    let lastId = '';
    let hasMore = true;

    while (hasMore && allItems.length < limit) {
        const batchSize = Math.min(1000, limit - allItems.length);
        const res = await ozonRequest(clientId, apiKey, '/v3/product/list', {
            filter: {},
            last_id: lastId,
            limit: batchSize
        });

        if (res.status !== 200) {
            throw new Error(`Ozon API ошибка: ${res.status} — ${JSON.stringify(res.data)}`);
        }

        const items = res.data.result?.items || [];
        allItems = allItems.concat(items);
        lastId = res.data.result?.last_id || '';
        hasMore = items.length === batchSize && lastId !== '';
    }

    return allItems;
}

/**
 * Получить детальную информацию о товарах (цены, названия, статусы)
 * Принимает массив product_id, разбивает на батчи по 1000
 */
async function getProductsInfo(clientId, apiKey, productIds) {
    const batchSize = 1000;
    let allItems = [];

    for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        const res = await ozonRequest(clientId, apiKey, '/v2/product/info/list', {
            product_id: batch
        });

        if (res.status === 200 && res.data.result?.items) {
            allItems = allItems.concat(res.data.result.items);
        }
    }

    return allItems;
}

/**
 * Получить остатки товаров (FBO + FBS)
 */
async function getProductsStocks(clientId, apiKey, productIds) {
    const batchSize = 100;
    let allStocks = [];

    for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        const res = await ozonRequest(clientId, apiKey, '/v1/product/info/stocks-by-warehouse/fbs', {
            sku: batch
        });

        if (res.status === 200 && res.data.result) {
            allStocks = allStocks.concat(res.data.result);
        }
    }

    return allStocks;
}

/**
 * Обновить цены товаров
 * @param {string} accountKey
 * @param {Array<{product_id: number, price: string, old_price: string}>} prices
 */
async function updatePrices(clientId, apiKey, prices) {
    const batchSize = 1000;
    const results = [];

    for (let i = 0; i < prices.length; i += batchSize) {
        const batch = prices.slice(i, i + batchSize);
        const res = await ozonRequest(clientId, apiKey, '/v1/product/import/prices', {
            prices: batch
        });
        results.push(res);
    }

    return results;
}

/**
 * Обновить остатки товаров
 * @param {string} accountKey
 * @param {Array<{offer_id: string, stock: number, warehouse_id: number}>} stocks
 */
async function updateStocks(clientId, apiKey, stocks) {
    const batchSize = 100;
    const results = [];

    for (let i = 0; i < stocks.length; i += batchSize) {
        const batch = stocks.slice(i, i + batchSize);
        const res = await ozonRequest(clientId, apiKey, '/v2/products/stocks', {
            stocks: batch
        });
        results.push(res);
    }

    return results;
}

/**
 * Получить информацию о продавце
 */
async function getSellerInfo(clientId, apiKey) {
    return await ozonRequest(clientId, apiKey, '/v1/seller/info', {});
}

/**
 * Получить список складов
 */
async function getWarehouses(clientId, apiKey) {
    return await ozonRequest(clientId, apiKey, '/v2/warehouse/list', {});
}

// ============================================================================
// Динамические функции — принимают clientId и apiKey как параметры
// ============================================================================

/**
 * Отправка запроса к Ozon Seller API с динамическими credentials
 * @param {string} clientId - Client ID аккаунта Ozon
 * @param {string} apiKey - API Key аккаунта Ozon
 * @param {string} endpoint - Путь API (напр. /v3/product/list)
 * @param {object} body - Тело запроса
 * @returns {Promise<{status: number, data: object}>}
 */
function ozonRequestDynamic(clientId, apiKey, endpoint, body = {}) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: 'api-seller.ozon.ru',
            path: endpoint,
            method: 'POST',
            headers: {
                'Client-Id': clientId,
                'Api-Key': apiKey,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(responseData) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: responseData });
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

/**
 * Проверка валидности аккаунта Ozon
 * @param {string} clientId
 * @param {string} apiKey
 * @returns {Promise<{valid: boolean, seller?: object, error?: string}>}
 */
async function validateAccount(clientId, apiKey) {
    try {
        const res = await ozonRequestDynamic(clientId, apiKey, '/v1/seller/info', {});
        if (res.status === 200) {
            return { valid: true, seller: res.data };
        }
        return { valid: false, error: res.data?.message || `HTTP ${res.status}` };
    } catch (err) {
        return { valid: false, error: err.message };
    }
}

/**
 * Получить список складов (динамический)
 */
async function getWarehousesDynamic(clientId, apiKey) {
    const res = await ozonRequestDynamic(clientId, apiKey, '/v2/warehouse/list', {});
    if (res.status !== 200) {
        throw new Error(`Ozon API ошибка: ${res.status} — ${JSON.stringify(res.data)}`);
    }
    return res.data.warehouses || res.data.result || [];
}

/**
 * Импорт товаров на Ozon (динамический)
 * @param {string} clientId
 * @param {string} apiKey
 * @param {Array} items — массив товаров в формате Ozon API /v3/product/import
 * @returns {Promise<number>} task_id
 */
async function importProductsDynamic(clientId, apiKey, items) {
    const res = await ozonRequestDynamic(clientId, apiKey, '/v3/product/import', {
        items
    });
    if (res.status !== 200) {
        throw new Error(`Ozon API ошибка импорта: ${res.status} — ${JSON.stringify(res.data)}`);
    }
    return res.data.result?.task_id || res.data.task_id;
}

/**
 * Получить статус импорта товаров (динамический)
 * @param {string} clientId
 * @param {string} apiKey
 * @param {number} taskId
 */
async function getImportStatusDynamic(clientId, apiKey, taskId) {
    const res = await ozonRequestDynamic(clientId, apiKey, '/v1/product/import/info', {
        task_id: taskId
    });
    if (res.status !== 200) {
        throw new Error(`Ozon API ошибка статуса: ${res.status} — ${JSON.stringify(res.data)}`);
    }
    return res.data.result || res.data;
}

/**
 * Обновить атрибуты товаров (динамический)
 */
async function attributesUpdateDynamic(clientId, apiKey, items) {
    const res = await ozonRequestDynamic(clientId, apiKey, '/v1/product/attributes/update', {
        items
    });
    if (res.status !== 200) {
        throw new Error(`Ozon API ошибка обновления атрибутов: ${res.status} — ${JSON.stringify(res.data)}`);
    }
    return res.data;
}

/**
 * Загрузить изображения товара (динамический)
 */
async function uploadProductImages(clientId, apiKey, productId, imageUrls) {
    if (!imageUrls || imageUrls.length === 0) return null;
    const res = await ozonRequestDynamic(clientId, apiKey, '/v1/product/pictures/import', {
        product_id: productId,
        color_image: imageUrls[0] || '',
        images: imageUrls
    });
    if (res.status !== 200) {
        throw new Error(`Ozon API ошибка загрузки фото: ${res.status} — ${JSON.stringify(res.data)}`);
    }
    return res.data;
}

/**
 * Обновить цены (динамический) — батчами по 1000
 */
async function updatePricesDynamic(clientId, apiKey, prices) {
    const batchSize = 1000;
    const results = [];

    for (let i = 0; i < prices.length; i += batchSize) {
        const batch = prices.slice(i, i + batchSize);
        const res = await ozonRequestDynamic(clientId, apiKey, '/v1/product/import/prices', {
            prices: batch
        });
        results.push(res);
        // Задержка между батчами
        if (i + batchSize < prices.length) {
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    return results;
}

/**
 * Обновить остатки (динамический) — батчами по 100
 */
async function updateStocksDynamic(clientId, apiKey, stocks) {
    const batchSize = 100;
    const results = [];

    for (let i = 0; i < stocks.length; i += batchSize) {
        const batch = stocks.slice(i, i + batchSize);
        const res = await ozonRequestDynamic(clientId, apiKey, '/v2/products/stocks', {
            stocks: batch
        });
        results.push(res);
        // Задержка между батчами
        if (i + batchSize < stocks.length) {
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    return results;
}

/**
 * Получить дерево категорий Ozon (динамический)
 */
async function getCategoryTree(clientId, apiKey) {
    const res = await ozonRequestDynamic(clientId, apiKey, '/v1/description-category/tree', {
        language: 'DEFAULT'
    });
    if (res.status !== 200) {
        throw new Error(`Ozon API ошибка категорий: ${res.status} — ${JSON.stringify(res.data)}`);
    }
    return res.data.result || res.data;
}

/**
 * Получить список всех товаров аккаунта с пагинацией (динамический)
 */
async function getAllProductsDynamic(clientId, apiKey, limit = 1000) {
    let allItems = [];
    let lastId = '';
    let hasMore = true;

    while (hasMore && allItems.length < limit) {
        const batchSize = Math.min(1000, limit - allItems.length);
        const res = await ozonRequestDynamic(clientId, apiKey, '/v3/product/list', {
            filter: {},
            last_id: lastId,
            limit: batchSize
        });

        if (res.status !== 200) {
            throw new Error(`Ozon API ошибка: ${res.status} — ${JSON.stringify(res.data)}`);
        }

        const items = res.data.result?.items || [];
        allItems = allItems.concat(items);
        lastId = res.data.result?.last_id || '';
        hasMore = items.length === batchSize && lastId !== '';

        // Задержка между запросами пагинации
        if (hasMore) {
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    return allItems;
}

/**
 * Получить детальную информацию о товарах (динамический)
 * Принимает массив product_id, разбивает на батчи по 1000
 */
async function getProductsInfoDynamic(clientId, apiKey, productIds) {
    const batchSize = 1000;
    let allItems = [];

    for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        const res = await ozonRequestDynamic(clientId, apiKey, '/v2/product/info/list', {
            product_id: batch
        });

        if (res.status === 200 && res.data.result?.items) {
            allItems = allItems.concat(res.data.result.items);
        }

        // Задержка между батчами
        if (i + batchSize < productIds.length) {
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    return allItems;
}

module.exports = {
    ozonRequest,
    getAllProducts,
    getProductsInfo,
    getProductsStocks,
    updatePrices,
    updateStocks,
    getSellerInfo,
    getWarehouses,
    // Динамические функции
    ozonRequestDynamic: ozonRequest,
    validateAccount,
    getWarehousesDynamic,
    importProductsDynamic,
    getImportStatusDynamic,
    attributesUpdateDynamic,
    uploadProductImages,
    updatePricesDynamic,
    updateStocksDynamic,
    getCategoryTree,
    getAllProductsDynamic,
    getProductsInfoDynamic
};
