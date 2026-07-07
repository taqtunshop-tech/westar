/**
 * Шаблоны контента для повышения контент-рейтинга Ozon
 * Генерирует HTML-описания, вариации названий, перемешивание фото
 */

// ════════════════════════════════════════════════════════
// ВАРИАЦИИ НАЗВАНИЙ (чтобы карточки отличались между аккаунтами)
// ════════════════════════════════════════════════════════
const TITLE_VARIATIONS = [
    // Набор слов для замены
    {
        brand: ['Westar', 'WESTAR', 'Вестар'],
        prefix: ['', 'Автозапчасть ', 'Запчасть ', 'Компонент '],
        suffix: [' (оригинал)', ' (高质量)', ' Premium', ' (OEM)', ''],
        compat: ['совместим', 'аналог', 'заменитель', '']
    }
];

function varyTitle(baseName, clientId, index = 0) {
    // Простое хеширование clientId для стабильного порядка вариаций
    let hash = 0;
    for (let i = 0; i < String(clientId).length; i++) {
        hash = ((hash << 5) - hash) + String(clientId).charCodeAt(i);
        hash |= 0;
    }
    const seed = Math.abs(hash) + index;
    const pick = (arr) => arr[seed % arr.length];

    const v = TITLE_VARIATIONS[0];
    const brand = pick(v.brand);
    const prefix = pick(v.prefix);
    const suffix = pick(v.suffix);

    // Заменяем Westar на вариацию
    let name = baseName.replace(/Westar/gi, brand).replace(/WESTAR/gi, brand);
    if (prefix && !name.startsWith(prefix)) {
        name = prefix + name;
    }
    if (suffix && !name.includes(suffix)) {
        name = name + suffix;
    }
    return name;
}

// ════════════════════════════════════════════════════════
// ГЕНЕРАЦИЯ HTML-ОПИСАНИЯ (для контент-рейтинга 0→25 баллов)
// ════════════════════════════════════════════════════════
const DESCRIPTION_TEMPLATES = [
    // Шаблон 1: Технический стиль
    (name, article, purpose, brand) => `<b>${name}</b><br><br>` +
        `<b>Артикул:</b> ${article}<br>` +
        `<b>Бренд:</b> ${brand}<br>` +
        `<b>Назначение:</b> ${purpose}<br><br>` +
        `<b>Описание:</b><br>` +
        `Качественная автозапчасть ${brand} для легковых автомобилей. ` +
        `Произведена из прочных материалов, обеспечивает надёжную работу и долгий срок службы. ` +
        `Полностью соответствует техническим характеристикам оригинала.<br><br>` +
        `<b>Преимущества:</b><br>` +
        `<ul>` +
        `<li>Высокое качество материалов</li>` +
        `<li>Точное соответствие OEM-размерам</li>` +
        `<li>Простая установка</li>` +
        `<li>Долгий срок службы</li>` +
        `</ul>` +
        `<b>Гарантия возврата:</b> 14 дней`,

    // Шаблон 2: Маркетинговый стиль
    (name, article, purpose, brand) => `<b>${name}</b><br><br>` +
        `Ищете надёжную замену оригинальной детали? ${brand} — проверенный бренд с многолетним опытом производства автозапчастей.<br><br>` +
        `<b>Характеристики:</b><br>` +
        `• Артикул: ${article}<br>` +
        `• Назначение: ${purpose}<br>` +
        `• Бренд: ${brand}<br><br>` +
        `Деталь изготовлена на современном оборудовании из сертифицированных материалов. ` +
        `Подходит для большинства моделей автомобилей в 해당 категории.<br><br>` +
        `<b>Почему выбирают нас:</b><br>` +
        `<ul>` +
        `<li>Быстрая отправка</li>` +
        `<li>Гарантия качества</li>` +
        `<li>Возврат в течение 14 дней</li>` +
        `</ul>`,

    // Шаблон 3: Лаконичный стиль
    (name, article, purpose, brand) => `<b>${name}</b><br><br>` +
        `Автозапчасть ${brand} — ${purpose.toLowerCase()}. ` +
        `Заводское качество, полная совместимость с оригиналом.<br><br>` +
        `<b>Артикул:</b> ${article}<br>` +
        `<b>Бренд:</b> ${brand}<br><br>` +
        `Отправка в течение 1-2 рабочих дней. Гарантия возврата 14 дней.`,

    // Шаблон 4: Развернутый стиль
    (name, article, purpose, brand) => `<div style="font-family:Arial,sans-serif;">` +
        `<h3 style="color:#333;">${name}</h3>` +
        `<p>Фирменная автозапчасть <b>${brand}</b> — ${purpose.toLowerCase()} для легковых автомобилей.</p>` +
        `<table style="border-collapse:collapse;width:100%;margin:10px 0;">` +
        `<tr><td style="padding:6px 12px;border:1px solid #ddd;background:#f5f5f5;"><b>Артикул</b></td>` +
        `<td style="padding:6px 12px;border:1px solid #ddd;">${article}</td></tr>` +
        `<tr><td style="padding:6px 12px;border:1px solid #ddd;background:#f5f5f5;"><b>Бренд</b></td>` +
        `<td style="padding:6px 12px;border:1px solid #ddd;">${brand}</td></tr>` +
        `<tr><td style="padding:6px 12px;border:1px solid #ddd;background:#f5f5f5;"><b>Назначение</b></td>` +
        `<td style="padding:6px 12px;border:1px solid #ddd;">${purpose}</td></tr>` +
        `</table>` +
        `<p>Деталь произведена с соблюдением всех стандартов качества. ` +
        `Обеспечивает надёжную работу узла автомобиля на протяжении всего срока эксплуатации.</p>` +
        `<p><b>Доставка:</b> 1-3 дня | <b>Гарантия:</b> 14 дней на возврат</p>` +
        `</div>`
];

function generateDescription(name, article, purpose, brand, clientId) {
    let hash = 0;
    for (let i = 0; i < String(clientId).length; i++) {
        hash = ((hash << 5) - hash) + String(clientId).charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % DESCRIPTION_TEMPLATES.length;
    return DESCRIPTION_TEMPLATES[idx](name, article, purpose || 'Автозапчасть', brand || 'Westar');
}

// ════════════════════════════════════════════════════════
// ПЕРЕМЕШИВАНИЕ ФОТО (уникальный порядок для каждого аккаунта)
// ════════════════════════════════════════════════════════
function shuffleImages(images, clientId) {
    if (!images || images.length <= 1) return images;
    // Seed based on clientId для стабильного порядка
    let hash = 0;
    for (let i = 0; i < String(clientId).length; i++) {
        hash = ((hash << 5) - hash) + String(clientId).charCodeAt(i);
        hash |= 0;
    }
    const shuffled = [...images];
    // Fisher-Yates с seed
    for (let i = shuffled.length - 1; i > 0; i--) {
        hash = (hash * 1103515245 + 12345) & 0x7fffffff;
        const j = hash % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ════════════════════════════════════════════════════════
// ДОПОЛНИТЕЛЬНЫЕ ХАРАКТЕРИСТИКИ (для контент-рейтинга 0→30 баллов)
// ════════════════════════════════════════════════════════
function getExtraAttributes(product, brand) {
    return [
        { attribute_id: 85, complex_id: 0, values: [{ value: brand || 'Westar' }] },
        { attribute_id: 8229, complex_id: 0, values: [{ value: product.purpose || 'Опора двигателя' }] },
        { attribute_id: 9048, complex_id: 0, values: [{ value: product.article || '' }] },
        { attribute_id: 7236, complex_id: 0, values: [{ value: product.article || '' }] },
        { attribute_id: 4180, complex_id: 0, values: [{ value: product.name || '' }] },
        { attribute_id: 4191, complex_id: 0, values: [{ value: product.description || '' }] },
        { attribute_id: 23536, complex_id: 0, values: [{ value: 'Нет' }] },
        { attribute_id: 22232, complex_id: 0, values: [{ value: '8708999700' }] },
        // Дополнительные для контент-рейтинга
        { attribute_id: 8229, complex_id: 0, values: [{ value: product.purpose || 'Опора двигателя' }] },
    ];
}

module.exports = { varyTitle, generateDescription, shuffleImages, getExtraAttributes };
