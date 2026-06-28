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
    
    // Извлекаем описание
    let descriptionText = (fields[17] || fields[18] || fields[19] || '').trim();
    
    // Парсим совместимость
    let compatText = fields[14] || fields[15] || '';
    
    // Если совместимость не указана в явных столбцах, попробуем извлечь её из описания
    if (!compatText && descriptionText) {
      const match = descriptionText.match(/Совместимость:\s*([\s\S]+?)(?=(Перед покупкой|Вес и габариты|Способы оплаты|Аналоги|$))/i);
      if (match) {
        compatText = match[1];
      }
    }
    
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
      description: descriptionText.substring(0, 2000)
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
  
  // Известные марки для поиска в строках
  const knownMakes = ['Ford', 'Chevrolet', 'Dodge', 'Ram', 'Honda', 'Toyota', 'Nissan', 'Jeep', 'Buick', 'Cadillac', 'GMC', 'Oldsmobile', 'Pontiac', 'Saturn', 'Chrysler', 'Lincoln', 'Mercury', 'Acura', 'Infiniti', 'Subaru', 'Mazda', 'Hyundai', 'Kia', 'Lexus', 'Mitsubishi', 'Suzuki', 'Volkswagen', 'Audi', 'BMW', 'Mercedes-Benz', 'Volvo'];
  const makesRegex = new RegExp(`^(${knownMakes.join('|')})\\b`, 'i');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // 1. Явное указание марки
    if (trimmed.startsWith('Марка:')) {
      currentMake = trimmed.replace('Марка:', '').trim();
      continue;
    }
    
    // 2. Явное указание модели
    if (trimmed.startsWith('Модель:')) {
      if (currentModel && currentYears) {
        entries.push({ make: currentMake, model: currentModel, years: currentYears });
      }
      currentModel = trimmed.replace('Модель:', '').trim();
      currentYears = '';
      continue;
    }
    
    // 3. Явное указание годов
    if (trimmed.startsWith('Годы Выпуска:') || trimmed.startsWith('Годы выпуска:')) {
      currentYears = trimmed.replace(/Годы [Вв]ыпуска:\s*/, '').trim();
      continue;
    }
    
    // 4. Поиск просто марки в строке (если строка состоит только из названия марки)
    if (knownMakes.some(m => m.toLowerCase() === trimmed.toLowerCase())) {
      currentMake = trimmed;
      continue;
    }
    
    // 5. Поиск годов выпуска в строке (вида 2005-2010 или просто 2008)
    const yearMatch = trimmed.match(/\b(19\d{2}|20\d{2})(?:\s*[-–]\s*(19\d{2}|20\d{2}))?\b/);
    
    if (yearMatch) {
      let years = yearMatch[0];
      let makeAndModel = trimmed.replace(years, '').trim();
      
      // Убираем инфу о двигателе и т.д. (в скобках)
      makeAndModel = makeAndModel.replace(/\([^)]+\)/g, '').replace(/\s{2,}/g, ' ').trim();
      
      // Если модель пустая, пропускаем
      if (!makeAndModel) continue;

      let make = currentMake;
      let model = makeAndModel;
      
      // Попробуем вытащить марку из начала строки
      const inlineMakeMatch = makeAndModel.match(makesRegex);
      if (inlineMakeMatch) {
        make = inlineMakeMatch[1];
        model = makeAndModel.substring(make.length).trim();
        currentMake = make; // Запоминаем марку для следующих строк
      }
      
      // Чтобы не добавлять пустые модели, состоящие только из марки
      if (model.length > 0) {
        entries.push({ make: make, model: model, years: years });
      }
      continue;
    }
    
    // 6. Простой формат (откат к старому, если год в скобках без дефиса, хотя он должен покрываться 5-м пунктом)
    const simpleMatch = trimmed.match(/^(.+?)\s*\((\d{4}[-–]\d{4}|\d{4})\)$/);
    if (simpleMatch) {
      let makeAndModel = simpleMatch[1].trim();
      const years = simpleMatch[2];
      
      let make = currentMake;
      let model = makeAndModel;
      
      const inlineMakeMatch = makeAndModel.match(makesRegex);
      if (inlineMakeMatch) {
        make = inlineMakeMatch[1];
        model = makeAndModel.substring(make.length).trim();
        currentMake = make;
      }
      
      entries.push({ make: make, model: model, years: years });
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
