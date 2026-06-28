// Парсер CSV-каталога Westar для создания JSON-данных
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ Westar - Лист1.csv');
const raw = fs.readFileSync(csvPath, 'utf-8');
const lines = raw.split('\n');

const products = [];
let currentProduct = null;
let lineIdx = 0;

// Функция для разбора строки CSV с учётом кавычек
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Чтение многострочных полей
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].replace(/\r$/, '');
  
  // Ищем строки начинающиеся с типа места установки
  if (/^(Двигатель|Коробка передач|Трансмиссия)/i.test(line)) {
    // Собираем полную запись (многострочный CSV)
    let fullLine = line;
    let openQuotes = (fullLine.match(/"/g) || []).length;
    while (openQuotes % 2 !== 0 && i + 1 < lines.length) {
      i++;
      fullLine += '\n' + lines[i].replace(/\r$/, '');
      openQuotes = (fullLine.match(/"/g) || []).length;
    }
    
    const fields = parseCSVLine(fullLine);
    
    // Поля: 0-Место установки, 1-Назначение, 2-Артикул, 3-Остатки, 4-Цена, 5-Сумма, 6-Наименование
    // 7-Изображение, 8-Изображение ссылка, 9-Прямой аналог, 10-Original Vendor, 11-(пусто)
    // 12-Original OEM, 13-Аналоги, 14-Совместимость (марки), 15-Совместимость (повтор)
    // 16-Аналоги(повтор), 17-Описание(текст), 18-Описание(html), 19-Описание(для Авито)
    
    const article = (fields[2] || '').trim();
    if (!article || !article.startsWith('EM-')) continue;
    
    const stockRaw = (fields[3] || '').replace(/[^0-9]/g, '');
    const priceRaw = (fields[4] || '').replace(/[^0-9]/g, '');
    
    // Парсим совместимость
    const compatText = fields[14] || fields[15] || '';
    const compatList = parseCompatibility(compatText);
    
    // Парсим аналоги  
    const analogsText = fields[13] || fields[16] || '';
    
    // Извлекаем URL изображения
    const imageUrl = (fields[8] || '').trim();
    
    const product = {
      id: article,
      category: (fields[0] || '').trim(),
      purpose: (fields[1] || '').trim(),
      article: article,
      stock: parseInt(stockRaw) || 0,
      price: parseInt(priceRaw) || 0,
      name: (fields[6] || '').trim().replace(/^"|"$/g, ''),
      imageUrl: imageUrl,
      brand: (fields[10] || '').trim(),
      oem: (fields[12] || '').trim(),
      analogs: analogsText.substring(0, 500),
      compatibility: compatList,
      description: (fields[17] || '').trim().substring(0, 2000)
    };
    
    products.push(product);
  }
}

function parseCompatibility(text) {
  if (!text) return [];
  const entries = [];
  const lines = text.split('\n');
  let currentMake = '';
  let currentModel = '';
  let currentYears = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const makeMatch = trimmed.match(/^(?:Марка:\s*)?([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s*$/i) ||
                       trimmed.match(/^(Ford|Chevrolet|Dodge|Ram|Honda|Toyota|Nissan|Jeep|Buick|Cadillac|GMC|Oldsmobile|Pontiac|Saturn|Chrysler|Lincoln|Mercury|Acura|Infiniti|Subaru|Mazda|Hyundai|Kia)/i);
    
    if (trimmed.startsWith('Марка:')) {
      currentMake = trimmed.replace('Марка:', '').trim();
      continue;
    }
    
    if (trimmed.startsWith('Модель:')) {
      if (currentModel && currentYears) {
        entries.push({ make: currentMake, model: currentModel, years: currentYears });
      }
      currentModel = trimmed.replace('Модель:', '').trim();
      currentYears = '';
      continue;
    }
    
    if (trimmed.startsWith('Годы Выпуска:') || trimmed.startsWith('Годы выпуска:')) {
      currentYears = trimmed.replace(/Годы [Вв]ыпуска:\s*/, '').trim();
      continue;
    }
    
    // Простой формат: "Модель (годы)"
    const simpleMatch = trimmed.match(/^(.+?)\s*\((\d{4}[-–]\d{4}|\d{4})\)$/);
    if (simpleMatch) {
      entries.push({ make: '', model: simpleMatch[1].trim(), years: simpleMatch[2] });
    }
  }
  
  // Добавляем последнюю запись
  if (currentModel && currentYears) {
    entries.push({ make: currentMake, model: currentModel, years: currentYears });
  }
  
  return entries;
}

// Получаем уникальные марки и категории
const allMakes = new Set();
const allCategories = new Set();
products.forEach(p => {
  allCategories.add(p.category);
  if (p.brand) allMakes.add(p.brand);
  p.compatibility.forEach(c => {
    if (c.make) allMakes.add(c.make);
  });
});

const catalog = {
  generatedAt: new Date().toISOString(),
  totalProducts: products.length,
  categories: [...allCategories],
  makes: [...allMakes].sort(),
  products: products
};

const outPath = path.join(__dirname, 'data', 'catalog.json');
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2), 'utf-8');

console.log(`✅ Создано ${products.length} товаров`);
console.log(`📁 Категории: ${[...allCategories].join(', ')}`);
console.log(`🚗 Марки: ${[...allMakes].slice(0, 10).join(', ')}...`);
console.log(`💾 Сохранено в: ${outPath}`);
