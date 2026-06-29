const fs = require('fs');
const path = require('path');
// Раскомментируем, когда определимся с сайтами
// const axios = require('axios');
// const cheerio = require('cheerio');

// Пути к файлам данных
const catalogPath = path.join(__dirname, '../data/catalog.json');
const competitorsPath = path.join(__dirname, '../data/competitors.json');

async function parsePrices() {
    console.log('Начинаем сбор цен конкурентов...');
    let catalog = [];
    try {
        const data = fs.readFileSync(catalogPath, 'utf8');
        catalog = JSON.parse(data).products || JSON.parse(data);
    } catch (e) {
        console.error('Ошибка чтения каталога (catalog.json):', e.message);
        console.log('Попытка прочитать из catalog.js...');
        try {
            // Фолбэк, если используется catalog.js
            let jsData = fs.readFileSync(path.join(__dirname, '../data/catalog.js'), 'utf8');
            jsData = jsData.replace('window.WESTAR_CATALOG = ', '').replace(/;$/, '');
            catalog = JSON.parse(jsData).products;
        } catch (err) {
            console.error('Не удалось загрузить каталог:', err);
            return;
        }
    }

    const competitorsData = {};

    for (const product of catalog) {
        console.log(`Парсинг цен для артикула ${product.article}...`);
        
        // TODO: Здесь будет реальная логика парсинга
        // Например:
        // const response = await axios.get(`https://exist.ru/price/?pcode=${product.article}`);
        // const $ = cheerio.load(response.data);
        // ... извлекаем цену ...

        // ПОКА ЧТО: Генерируем моковые цены (имитация парсинга)
        // Если наша цена 5000, конкуренты будут стоить около того (±15%)
        const ourPrice = product.price || 5000;
        competitorsData[product.article] = [
            { 
                store: "Exist", 
                price: Math.round(ourPrice * (1 + (Math.random() * 0.2 - 0.05))), 
                link: `https://exist.ru/price/?pcode=${product.article}` 
            },
            { 
                store: "Zzap", 
                price: Math.round(ourPrice * (1 - (Math.random() * 0.15))), 
                link: `https://www.zzap.ru/public/search.aspx?partnumber=${product.article}` 
            },
            { 
                store: "Emex", 
                price: Math.round(ourPrice * (1 + (Math.random() * 0.1 - 0.05))), 
                link: `https://emex.ru/products/${product.article}` 
            }
        ];
        
        // Пауза 1 секунда между запросами, чтобы нас не забанили
        await new Promise(r => setTimeout(r, 1000));
    }

    fs.writeFileSync(competitorsPath, JSON.stringify(competitorsData, null, 2), 'utf8');
    console.log('Цены конкурентов успешно сохранены в competitors.json!');
}

parsePrices();
