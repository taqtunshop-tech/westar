const fs = require('fs');
const path = require('path');

const PARENT_DIR = path.join(__dirname, '..');
const IMAGES_DIR = path.join(__dirname, 'images');
const CATALOG_JSON_PATH = path.join(__dirname, 'data', 'catalog.json');
const CATALOG_JS_PATH = path.join(__dirname, 'data', 'catalog.js');

// Создаем папку для картинок, если нет
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Поиск папок и извлечение артикула
const dirs = fs.readdirSync(PARENT_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name !== 'westar-app')
    .map(dirent => dirent.name);

const imageMapping = {};
const articleRegex = /EM-?\d{4}/i;

let copiedCount = 0;

for (const dirName of dirs) {
    const match = dirName.match(articleRegex);
    if (match) {
        // Стандартизируем артикул: например EM 1234 -> EM-1234, em-1234 -> EM-1234
        let article = match[0].toUpperCase();
        if (!article.includes('-')) {
            article = article.replace('EM', 'EM-');
        }

        const fullDirPath = path.join(PARENT_DIR, dirName);
        
        // Получаем файлы в папке
        try {
            const files = fs.readdirSync(fullDirPath);
            
            // Ищем все подходящие картинки
            const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
            
            if (imageFiles.length > 0) {
                imageMapping[article] = [];
                
                imageFiles.forEach((file, index) => {
                    const ext = path.extname(file).toLowerCase();
                    const sourcePath = path.join(fullDirPath, file);
                    
                    // Сохраняем как [Артикул]-[Индекс].jpg
                    const targetFileName = `${article}-${index + 1}${ext}`;
                    const targetPath = path.join(IMAGES_DIR, targetFileName);
                    
                    fs.copyFileSync(sourcePath, targetPath);
                    
                    imageMapping[article].push(`images/${targetFileName}`);
                    copiedCount++;
                });
                
                console.log(`[+] Скопировано картинок для ${article}: ${imageFiles.length}`);
            } else {
                console.log(`[-] Нет картинок в папке: ${dirName}`);
            }
        } catch (e) {
            console.error(`[!] Ошибка чтения папки ${dirName}:`, e.message);
        }
    }
}

console.log(`\nВсего скопировано ${copiedCount} картинок.`);

// Теперь обновляем catalog.json и catalog.js
if (fs.existsSync(CATALOG_JSON_PATH)) {
    const catalog = JSON.parse(fs.readFileSync(CATALOG_JSON_PATH, 'utf8'));
    
    let updatedCount = 0;
    
    catalog.products.forEach(product => {
        const productArticle = product.article.toUpperCase();
        
        if (imageMapping[productArticle] && imageMapping[productArticle].length > 0) {
            product.imageUrl = imageMapping[productArticle][0]; // Главная картинка
            product.imageUrls = imageMapping[productArticle];   // Все картинки
            updatedCount++;
        }
    });

    // Пересохраняем JSON
    fs.writeFileSync(CATALOG_JSON_PATH, JSON.stringify(catalog, null, 2), 'utf8');
    
    // Пересохраняем JS
    const jsContent = `window.WESTAR_CATALOG = ${JSON.stringify(catalog, null, 2)};`;
    fs.writeFileSync(CATALOG_JS_PATH, jsContent, 'utf8');

    console.log(`Обновлено товаров в каталоге: ${updatedCount}`);
} else {
    console.log(`[!] Файл ${CATALOG_JSON_PATH} не найден!`);
}
