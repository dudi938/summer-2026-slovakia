/* ===== Slovakia Family Trip 2026 - Main Application ===== */
/* Hebrew RTL static website - 204 attractions */

// ===== Global State =====
let allAttractions = [];
let filteredAttractions = [];
let map = null;
let markers = [];
let currentView = 'grid'; // 'grid' or 'map'
let dayPlan = JSON.parse(localStorage.getItem('dayPlan') || '[]');

// Active filter state
let activeFilters = {
  search: '',
  area: '',
  category: '',
  suitableFor: '',
  babyFriendly: false,
  minFamilyScore: 0
};

// Current sort
let currentSort = 'name';

// ===== Age Badge Detection =====
function getAgeBadges(attraction) {
  const badges = [];
  const suitableFor = (attraction.suitableFor || []).map(function(s) { return s.toLowerCase(); });
  const joined = suitableFor.join(' ');

  // Baby (0-3)
  if (attraction.suitableForBaby === true ||
      /baby|infant|0-3|תינוק/.test(joined)) {
    badges.push({ emoji: '👶', label: 'תינוקות (0-3)', color: '#FFE0E6' });
  }

  // Small kids (4-7)
  if (/toddler|3\+|4\+|5\+|6\+|7\+|פעוט|קטנים/.test(joined)) {
    badges.push({ emoji: '👦', label: 'קטנים (4-7)', color: '#E0F0FF' });
  }

  // Children (8-12)
  if (/children|8\+|9\+|10\+|11\+|12\+|ילדים/.test(joined)) {
    badges.push({ emoji: '🧒', label: 'ילדים (8-12)', color: '#E0FFE8' });
  }

  // Teens (13+)
  if (/teens|13\+|14\+|15\+|נוער/.test(joined)) {
    badges.push({ emoji: '🧑', label: 'נוער (13+)', color: '#FFF0E0' });
  }

  // Adults
  if (/adults|מבוגרים|elderly|קשישים|כל הגילאים|משפחות/.test(joined)) {
    badges.push({ emoji: '👨', label: 'מבוגרים', color: '#F0F0F0' });
  }

  return badges;
}

// ===== Constants =====
const CATEGORY_LABELS = {
  'nature': 'טבע',
  'adventure': 'אתגר והרפתקאות',
  'water-sports': 'ספורט מים',
  'cycling': 'אופניים',
  'family': 'משפחה',
  'shabbat': 'שבת ויהדות',
  'other': 'אחר'
};

const AREA_LABELS = {
  'bratislava': 'ברטיסלבה',
  'high-tatras': 'הרי הטטרה',
  'other-slovakia': 'סלובקיה - אחר',
  'vienna': 'וינה',
  'budapest': 'בודפשט',
  'czech': 'צ׳כיה'
};

// ===== Data Loading =====
async function loadAttractions() {
  const grid = document.getElementById('attractions-grid');
  if (grid) {
    grid.textContent = '';
    const spinnerWrap = document.createElement('div');
    spinnerWrap.className = 'loading-spinner';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinnerWrap.appendChild(spinner);
    grid.appendChild(spinnerWrap);
  }

  try {
    // Try data/attractions.json first (root page), then ../data/attractions.json (subpages)
    let response = await fetch('data/attractions.json');
    if (!response.ok) {
      response = await fetch('../data/attractions.json');
    }
    if (!response.ok) {
      throw new Error('Failed to load attractions data');
    }

    allAttractions = await response.json();

    // Check if page has a filter attribute (for area/category pages)
    const pageFilter = document.body.dataset.filterType;
    const pageFilterValue = document.body.dataset.filterValue;
    if (pageFilter && pageFilterValue) {
      allAttractions = allAttractions.filter(function (a) {
        return a[pageFilter] === pageFilterValue;
      });
    }

    filteredAttractions = allAttractions.slice();
    renderAttractions();
    updateResultCount();
    if (document.getElementById('map')) initMap();
  } catch (error) {
    console.error('Error loading attractions:', error);
    if (grid) {
      grid.textContent = '';
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      const iconDiv = document.createElement('div');
      iconDiv.className = 'empty-state-icon';
      iconDiv.textContent = '⚠️';
      const textDiv = document.createElement('div');
      textDiv.className = 'empty-state-text';
      textDiv.textContent = 'שגיאה בטעינת הנתונים. נסו לרענן את הדף.';
      emptyDiv.appendChild(iconDiv);
      emptyDiv.appendChild(textDiv);
      grid.appendChild(emptyDiv);
    }
  }
}

// ===== Search Function =====
// Searches Hebrew names, English names, description, tags, notes, address
function searchAttractions(query) {
  activeFilters.search = query.trim().toLowerCase();
  applyFilters();
}

// ===== Filter Functions =====
function filterByArea(area) {
  activeFilters.area = (activeFilters.area === area) ? '' : area;
  applyFilters();
  // Update chip UI
  document.querySelectorAll('.filter-chip[data-area]').forEach(function (c) {
    c.classList.toggle('active', c.dataset.area === activeFilters.area);
  });
}

function filterByCategory(category) {
  activeFilters.category = (activeFilters.category === category) ? '' : category;
  applyFilters();
  document.querySelectorAll('.filter-chip[data-category]').forEach(function (c) {
    c.classList.toggle('active', c.dataset.category === activeFilters.category);
  });
}

function filterByBabyFriendly(babyOnly) {
  activeFilters.babyFriendly = babyOnly;
  applyFilters();
}

function filterByFamilyScore(minScore) {
  activeFilters.minFamilyScore = minScore;
  applyFilters();
}

function filterBySuitableFor(value) {
  activeFilters.suitableFor = (activeFilters.suitableFor === value) ? '' : value;
  applyFilters();
  document.querySelectorAll('.filter-chip[data-suitable]').forEach(function (c) {
    c.classList.toggle('active', c.dataset.suitable === activeFilters.suitableFor);
  });
}

// Combines all active filters
function applyFilters() {
  let results = allAttractions.slice();

  // Search filter
  if (activeFilters.search) {
    const query = activeFilters.search;
    results = results.filter(function (a) {
      const searchFields = [
        a.nameHebrew || '',
        a.name || '',
        a.description || '',
        a.descriptionHebrew || '',
        a.address || '',
        a.notes || '',
        a.notesHebrew || '',
        (a.tags || []).join(' ')
      ].join(' ').toLowerCase();
      return searchFields.indexOf(query) !== -1;
    });
  }

  // Area filter
  if (activeFilters.area) {
    results = results.filter(function (a) { return a.area === activeFilters.area; });
  }

  // Category filter
  if (activeFilters.category) {
    results = results.filter(function (a) { return a.category === activeFilters.category; });
  }

  // Suitable for filter
  if (activeFilters.suitableFor) {
    const suitableQuery = activeFilters.suitableFor;
    results = results.filter(function (a) {
      if (!a.suitableFor || !Array.isArray(a.suitableFor)) return false;
      return a.suitableFor.some(function (s) {
        return s.toLowerCase().indexOf(suitableQuery) !== -1;
      });
    });
  }

  // Baby friendly filter
  if (activeFilters.babyFriendly) {
    results = results.filter(function (a) { return a.suitableForBaby === true; });
  }

  // Family score filter
  if (activeFilters.minFamilyScore > 0) {
    results = results.filter(function (a) { return (a.familyScore || 0) >= activeFilters.minFamilyScore; });
  }

  // Apply current sort
  filteredAttractions = sortAttractionsArray(results, currentSort);

  renderAttractions();
  updateResultCount();

  if (currentView === 'map' && map) {
    renderMarkers();
  }

  // Scroll to top smoothly when filters are applied
  const hasFilters = activeFilters.area || activeFilters.category || activeFilters.babyFriendly || activeFilters.minFamilyScore > 0 || activeFilters.suitableFor;
  if (hasFilters) {
    const banner = document.querySelector('.attractions-count-banner');
    if (banner) {
      banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

// ===== Render Functions =====
function renderAttractions() {
  const grid = document.getElementById('attractions-grid');
  if (!grid) return;

  grid.textContent = '';

  if (filteredAttractions.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    const iconDiv = document.createElement('div');
    iconDiv.className = 'empty-state-icon';
    iconDiv.textContent = '🔍';
    const textDiv = document.createElement('div');
    textDiv.className = 'empty-state-text';
    textDiv.textContent = 'לא נמצאו אטרקציות מתאימות';
    emptyDiv.appendChild(iconDiv);
    emptyDiv.appendChild(textDiv);
    grid.appendChild(emptyDiv);
    return;
  }

  filteredAttractions.forEach(function (attraction, index) {
    grid.appendChild(renderAttractionCard(attraction, index));
  });
}

function renderAttractionCard(attraction, index) {
  const isInPlan = dayPlan.some(function (item) { return item.name === attraction.name; });
  const categoryLabel = CATEGORY_LABELS[attraction.category] || attraction.category;
  const areaLabel = AREA_LABELS[attraction.area] || attraction.area;
  const iconEmoji = getCategoryIcon(attraction.category);
  const categoryColor = getCategoryColor(attraction.category);
  const tags = (attraction.suitableFor || []).slice(0, 3);

  // Truncated description (first 100 chars)
  const fullDesc = attraction.descriptionHebrew || attraction.description || '';
  const truncatedDesc = fullDesc.length > 100 ? fullDesc.substring(0, 100) + '...' : fullDesc;

  // Family score as stars
  const familyScore = attraction.familyScore || 0;

  // Google Maps link
  let mapsUrl = '#';
  if (attraction.coordinates && attraction.coordinates.lat && attraction.coordinates.lng) {
    mapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + attraction.coordinates.lat + ',' + attraction.coordinates.lng;
  } else if (attraction.googleMapsUrl) {
    mapsUrl = attraction.googleMapsUrl;
  }

  // Build card element
  const card = document.createElement('article');
  card.className = 'attraction-card fade-in';
  card.style.animationDelay = Math.min(index * 0.05, 0.5) + 's';
  card.dataset.name = attraction.name;
  card.dataset.id = attraction.id || '';

  // Card image / header area
  const cardImage = document.createElement('div');
  cardImage.className = 'card-image';
  if (attraction.imageUrl) {
    cardImage.style.backgroundImage = 'url(' + attraction.imageUrl + ')';
    cardImage.style.backgroundSize = 'cover';
    cardImage.style.backgroundPosition = 'center';
  } else {
    cardImage.style.background = 'linear-gradient(135deg, ' + categoryColor + '22, ' + categoryColor + '44)';
  }

  const placeholderIcon = document.createElement('span');
  placeholderIcon.className = 'placeholder-icon';
  if (!attraction.imageUrl) {
    placeholderIcon.textContent = iconEmoji;
  }
  cardImage.appendChild(placeholderIcon);

  const badge = document.createElement('span');
  badge.className = 'card-category-badge ' + attraction.category;
  badge.style.background = categoryColor;
  badge.style.color = '#fff';
  badge.textContent = categoryLabel;
  cardImage.appendChild(badge);

  // Baby friendly indicator
  if (attraction.suitableForBaby) {
    const babyBadge = document.createElement('span');
    babyBadge.className = 'card-baby-badge';
    babyBadge.textContent = '👶';
    babyBadge.title = 'מתאים לתינוקות';
    cardImage.appendChild(babyBadge);
  }

  card.appendChild(cardImage);

  // Card body
  const cardBody = document.createElement('div');
  cardBody.className = 'card-body';

  // Title
  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = attraction.nameHebrew || attraction.name;
  cardBody.appendChild(title);

  // Area + distance
  const areaDiv = document.createElement('div');
  areaDiv.className = 'card-area';
  areaDiv.textContent = '📍 ' + areaLabel;
  if (attraction.distanceFromMalatiny) {
    areaDiv.textContent += ' • ' + attraction.distanceFromMalatiny;
  }
  cardBody.appendChild(areaDiv);

  // Description (truncated Hebrew)
  const desc = document.createElement('p');
  desc.className = 'card-description';
  desc.textContent = truncatedDesc;
  cardBody.appendChild(desc);

  // Family score stars
  const starsDiv = document.createElement('div');
  starsDiv.className = 'card-stars';
  starsDiv.title = 'ציון משפחתיות: ' + familyScore + '/5';
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span');
    star.className = i <= familyScore ? 'star filled' : 'star empty';
    star.textContent = i <= familyScore ? '★' : '☆';
    starsDiv.appendChild(star);
  }
  cardBody.appendChild(starsDiv);

  // Age badges
  const ageBadges = getAgeBadges(attraction);
  if (ageBadges.length > 0) {
    const badgesDiv = document.createElement('div');
    badgesDiv.className = 'age-badges';
    ageBadges.forEach(function (b) {
      const span = document.createElement('span');
      span.className = 'age-badge';
      span.style.background = b.color;
      span.textContent = b.emoji + ' ' + b.label;
      badgesDiv.appendChild(span);
    });
    cardBody.appendChild(badgesDiv);
  }

  // Tags (suitableFor)
  if (tags.length > 0) {
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'card-tags';
    tags.forEach(function (tagText) {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'card-tag';
      tagSpan.textContent = tagText;
      tagsDiv.appendChild(tagSpan);
    });
    cardBody.appendChild(tagsDiv);
  }

  // Footer with price and actions
  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const price = document.createElement('span');
  price.className = 'card-price';
  price.textContent = attraction.priceAdult || 'לא צוין';
  footer.appendChild(price);

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  // Google Maps navigation button
  const navBtn = document.createElement('a');
  navBtn.className = 'card-btn card-btn-primary btn-navigate';
  navBtn.href = mapsUrl;
  navBtn.target = '_blank';
  navBtn.rel = 'noopener';
  navBtn.title = 'נווט בגוגל מפות';
  navBtn.textContent = '🗺️';
  actions.appendChild(navBtn);

  // Website link button
  if (attraction.website) {
    const webBtn = document.createElement('a');
    webBtn.className = 'card-btn card-btn-secondary btn-website';
    webBtn.href = attraction.website;
    webBtn.target = '_blank';
    webBtn.rel = 'noopener';
    webBtn.title = 'אתר';
    webBtn.textContent = '🌐';
    actions.appendChild(webBtn);
  }

  // Add to day plan button
  const planBtn = document.createElement('button');
  planBtn.className = 'card-btn card-btn-outline btn-add-plan' + (isInPlan ? ' added' : '');
  planBtn.title = isInPlan ? 'הסר מהתוכנית' : 'הוסף לתוכנית יומית';
  planBtn.textContent = isInPlan ? '✓' : '➕';
  planBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    addToPlan(attraction.id || attraction.name);
  });
  actions.appendChild(planBtn);

  footer.appendChild(actions);
  cardBody.appendChild(footer);
  card.appendChild(cardBody);

  // Click card to open modal (skip if clicking action buttons)
  card.style.cursor = 'pointer';
  card.addEventListener('click', function(e) {
    if (e.target.closest('.card-btn')) return;
    openAttractionModal(attraction);
  });

  return card;
}

// ===== Map Functions =====
function initMap() {
  if (map) {
    // If map already exists, just invalidate size
    setTimeout(function () { map.invalidateSize(); }, 200);
    return;
  }

  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  // Check if Leaflet is loaded
  if (typeof L === 'undefined') {
    console.error('Leaflet library not loaded');
    return;
  }

  // Initialize Leaflet map centered on Slovakia
  map = L.map('map').setView([48.9, 19.1], 7);

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18
  }).addTo(map);

  // Fix map rendering in hidden containers
  setTimeout(function () { map.invalidateSize(); }, 300);

  // Render initial markers
  renderMarkers();
}

function renderMarkers() {
  if (!map) return;

  // Clear existing markers
  markers.forEach(function (m) { map.removeLayer(m); });
  markers = [];

  // Add new ones for filteredAttractions
  filteredAttractions.forEach(function (attraction) {
    if (!attraction.coordinates || !attraction.coordinates.lat || !attraction.coordinates.lng) return;

    const color = getCategoryColor(attraction.category);
    const iconEmoji = getCategoryIcon(attraction.category);

    // Color coded custom marker by category
    const icon = L.divIcon({
      className: 'custom-marker',
      html: '<div style="' +
        'background:' + color + ';' +
        'width:32px;height:32px;' +
        'border-radius:50%;' +
        'display:flex;align-items:center;justify-content:center;' +
        'font-size:16px;' +
        'box-shadow:0 2px 8px rgba(0,0,0,0.3);' +
        'border:2px solid white;' +
        'cursor:pointer;' +
        '">' + iconEmoji + '</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });

    const marker = L.marker(
      [attraction.coordinates.lat, attraction.coordinates.lng],
      { icon: icon }
    ).addTo(map);

    // Popup with Hebrew content and Google Maps link
    const categoryLabel = CATEGORY_LABELS[attraction.category] || attraction.category;
    const areaLabel = AREA_LABELS[attraction.area] || attraction.area;
    const desc = (attraction.descriptionHebrew || attraction.description || '').substring(0, 150);
    const navUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + attraction.coordinates.lat + ',' + attraction.coordinates.lng;
    const familyScore = attraction.familyScore || 0;

    // Build stars HTML
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      starsHtml += i <= familyScore ? '★' : '☆';
    }

    // Website button
    const websiteBtn = attraction.website
      ? '<a href="' + escapeAttr(attraction.website) + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;margin-left:8px;padding:4px 10px;background:#4CAF50;color:white;border-radius:4px;text-decoration:none;font-size:12px;">🌐 אתר</a>'
      : '';

    const popupContent = '<div dir="rtl" style="font-family:Heebo,sans-serif;text-align:right;max-width:280px;">' +
      '<div style="font-weight:700;font-size:15px;margin-bottom:4px;color:#1a1a1a;">' + escapeHtml(attraction.nameHebrew || attraction.name) + '</div>' +
      '<div style="margin-bottom:4px;">' +
        '<span style="display:inline-block;background:' + color + ';color:white;padding:2px 8px;border-radius:12px;font-size:11px;">' + iconEmoji + ' ' + escapeHtml(categoryLabel) + '</span>' +
        '<span style="margin-right:8px;color:#666;font-size:12px;">📍 ' + escapeHtml(areaLabel) + '</span>' +
      '</div>' +
      '<div style="color:#F59E0B;font-size:14px;margin-bottom:4px;">' + starsHtml + '</div>' +
      '<div style="font-size:13px;color:#444;line-height:1.5;margin-bottom:6px;">' + escapeHtml(desc) + (desc.length >= 150 ? '...' : '') + '</div>' +
      (attraction.priceAdult ? '<div style="font-size:12px;color:#666;margin-bottom:4px;">💰 ' + escapeHtml(attraction.priceAdult) + '</div>' : '') +
      (attraction.distanceFromMalatiny ? '<div style="font-size:12px;color:#666;margin-bottom:6px;">🚗 ' + escapeHtml(attraction.distanceFromMalatiny) + '</div>' : '') +
      '<div style="margin-top:8px;">' +
        '<a href="' + escapeAttr(navUrl) + '" target="_blank" rel="noopener" style="display:inline-block;padding:6px 12px;background:#4A90D9;color:white;border-radius:4px;text-decoration:none;font-size:12px;font-weight:500;">🗺️ ניווט</a>' +
        websiteBtn +
      '</div>' +
    '</div>';

    marker.bindPopup(popupContent, {
      maxWidth: 300,
      minWidth: 200,
      className: 'rtl-popup'
    });

    markers.push(marker);
  });

  // Fit bounds to visible markers
  if (markers.length > 0) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

// ===== View Toggle =====
function toggleView(view) {
  currentView = view;
  const attractionsSection = document.querySelector('.attractions-section');
  const mapSection = document.querySelector('.map-section');
  const gridBtn = document.getElementById('view-grid-btn');
  const mapBtn = document.getElementById('view-map-btn');

  if (view === 'map') {
    if (attractionsSection) attractionsSection.style.display = 'none';
    if (mapSection) mapSection.classList.add('visible');
    if (gridBtn) gridBtn.classList.remove('active');
    if (mapBtn) mapBtn.classList.add('active');
    initMap();
    renderMarkers();
    setTimeout(function () { if (map) map.invalidateSize(); }, 300);
  } else {
    if (attractionsSection) attractionsSection.style.display = 'block';
    if (mapSection) mapSection.classList.remove('visible');
    if (gridBtn) gridBtn.classList.add('active');
    if (mapBtn) mapBtn.classList.remove('active');
  }

  updateBottomNav(view === 'map' ? 'map' : 'list');
}

// ===== Day Plan Feature =====
function addToPlan(attractionId) {
  // Check if already in plan - toggle behavior
  if (dayPlan.some(function (item) { return (item.id || item.name) === attractionId; })) {
    removeFromPlan(attractionId);
    return;
  }

  const attraction = allAttractions.find(function (a) { return (a.id || a.name) === attractionId; });
  if (!attraction) return;

  dayPlan.push({
    id: attraction.id,
    name: attraction.name,
    nameHebrew: attraction.nameHebrew || attraction.name,
    area: attraction.area,
    category: attraction.category,
    coordinates: attraction.coordinates
  });

  saveDayPlan();
  updateDayPlanBadge();
  renderAttractions();
  showToast('"' + (attraction.nameHebrew || attraction.name) + '" נוסף לתוכנית');
}

function removeFromPlan(attractionId) {
  const item = dayPlan.find(function (i) { return (i.id || i.name) === attractionId; });
  dayPlan = dayPlan.filter(function (i) { return (i.id || i.name) !== attractionId; });
  saveDayPlan();
  updateDayPlanBadge();
  renderAttractions();
  renderDayPlanItems();
  if (item) {
    showToast('"' + (item.nameHebrew || item.name) + '" הוסר מהתוכנית');
  }
}

function getDayPlan() {
  return dayPlan;
}

function clearDayPlan() {
  dayPlan = [];
  saveDayPlan();
  updateDayPlanBadge();
  renderDayPlanItems();
  renderAttractions();
  showToast('התוכנית נוקתה');
}

function saveDayPlan() {
  try {
    localStorage.setItem('dayPlan', JSON.stringify(dayPlan));
  } catch (e) {
    console.warn('Could not save day plan to localStorage:', e);
  }
}

function shareDayPlan() {
  if (dayPlan.length === 0) {
    showToast('התוכנית ריקה');
    return;
  }

  let text = 'תוכנית יומית - סלובקיה קיץ 2026:\n\n';
  dayPlan.forEach(function (item, i) {
    const areaLabel = AREA_LABELS[item.area] || item.area || '';
    text += (i + 1) + '. ' + (item.nameHebrew || item.name);
    if (areaLabel) text += ' (' + areaLabel + ')';
    text += '\n';
  });

  if (navigator.share) {
    navigator.share({
      title: 'תוכנית יומית - סלובקיה',
      text: text
    }).catch(function () {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function () {
      showToast('הועתק ללוח!');
    }).catch(function () {
      showToast('לא ניתן להעתיק');
    });
  }
}

// ===== Sort Function =====
function sortAttractions(by) {
  currentSort = by || currentSort;
  filteredAttractions = sortAttractionsArray(filteredAttractions, currentSort);
  renderAttractions();
  updateResultCount();
  return filteredAttractions;
}

function sortAttractionsArray(attractions, by) {
  const sorted = attractions.slice();

  switch (by) {
    case 'score':
      sorted.sort(function (a, b) { return (b.familyScore || 0) - (a.familyScore || 0); });
      break;
    case 'distance':
      sorted.sort(function (a, b) { return parseDistance(a.distanceFromMalatiny) - parseDistance(b.distanceFromMalatiny); });
      break;
    case 'price':
      sorted.sort(function (a, b) { return parsePrice(a.priceAdult) - parsePrice(b.priceAdult); });
      break;
    case 'name':
      sorted.sort(function (a, b) { return (a.nameHebrew || a.name || '').localeCompare(b.nameHebrew || b.name || '', 'he'); });
      break;
    case 'area':
      sorted.sort(function (a, b) { return (a.area || '').localeCompare(b.area || ''); });
      break;
    case 'category':
      sorted.sort(function (a, b) { return (a.category || '').localeCompare(b.category || ''); });
      break;
    default:
      sorted.sort(function (a, b) { return (a.nameHebrew || a.name || '').localeCompare(b.nameHebrew || b.name || '', 'he'); });
  }

  return sorted;
}

function parseDistance(distStr) {
  if (!distStr) return 9999;
  const match = distStr.match(/(\d+)\s*km/i);
  return match ? parseInt(match[1], 10) : 9999;
}

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const lower = priceStr.toLowerCase();
  if (lower.indexOf('free') !== -1 || priceStr.indexOf('חינם') !== -1) return 0;
  const match = priceStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// ===== Navigation =====
function toggleMobileMenu() {
  const mobileNav = document.getElementById('nav-mobile');
  const overlay = document.getElementById('nav-overlay');
  const hamburger = document.getElementById('hamburger-btn');

  if (!mobileNav) return;

  const isOpen = mobileNav.classList.contains('open');

  if (isOpen) {
    mobileNav.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
    if (hamburger) hamburger.classList.remove('active');
    document.body.style.overflow = '';
  } else {
    mobileNav.classList.add('open');
    if (overlay) overlay.classList.add('visible');
    if (hamburger) hamburger.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeMobileMenu() {
  const mobileNav = document.getElementById('nav-mobile');
  const overlay = document.getElementById('nav-overlay');
  const hamburger = document.getElementById('hamburger-btn');

  if (mobileNav) mobileNav.classList.remove('open');
  if (overlay) overlay.classList.remove('visible');
  if (hamburger) hamburger.classList.remove('active');
  document.body.style.overflow = '';
}

// ===== Category Icons Helper =====
function getCategoryIcon(category) {
  const icons = {
    'water-sports': '🚣',
    'adventure': '🧗',
    'nature': '🌲',
    'cycling': '🚴',
    'shabbat': '✡️',
    'family': '👨‍👩‍👧‍👦',
    'other': '📍'
  };
  return icons[category] || '📍';
}

// ===== Category Colors for Map Markers =====
function getCategoryColor(category) {
  const colors = {
    'water-sports': '#2196F3',
    'adventure': '#F44336',
    'nature': '#4CAF50',
    'cycling': '#FF9800',
    'shabbat': '#9C27B0',
    'family': '#E91E63',
    'other': '#6B7280'
  };
  return colors[category] || '#6B7280';
}

// ===== Toast Notification =====
function showToast(message) {
  // Remove existing toast if any
  const existingToast = document.querySelector('.toast-notification');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.setAttribute('dir', 'rtl');
  toast.textContent = message;

  // Style the toast
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
    'background:#333;color:#fff;padding:12px 24px;border-radius:8px;' +
    'font-size:14px;font-family:Heebo,sans-serif;z-index:10000;' +
    'box-shadow:0 4px 12px rgba(0,0,0,0.3);opacity:0;' +
    'transition:opacity 0.3s ease;max-width:80vw;text-align:center;';

  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(function () {
    toast.style.opacity = '1';
  });

  // Remove after 3 seconds
  setTimeout(function () {
    toast.style.opacity = '0';
    setTimeout(function () {
      if (toast.parentNode) toast.remove();
    }, 300);
  }, 3000);
}

// ===== Helper Functions =====
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function escapeAttr(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function updateResultCount() {
  const countEl = document.getElementById('results-count');
  if (countEl) {
    countEl.textContent = filteredAttractions.length + ' מתוך ' + allAttractions.length + ' אטרקציות';
  }

  // Update count banner
  const filterCount = document.getElementById('filter-count');
  if (filterCount) {
    filterCount.textContent = filteredAttractions.length;
    filterCount.classList.remove('count-pulse');
    void filterCount.offsetWidth;
    filterCount.classList.add('count-pulse');
  }

  // Active filters text
  const filtersText = document.getElementById('active-filters-text');
  if (filtersText) {
    const hasFilters = activeFilters.area || activeFilters.category || activeFilters.babyFriendly || activeFilters.minFamilyScore > 0 || activeFilters.search || activeFilters.suitableFor;
    if (hasFilters && filteredAttractions.length !== allAttractions.length) {
      let filterDesc = 'מציג ' + filteredAttractions.length + ' מתוך ' + allAttractions.length + ' אטרקציות | מסוננות לפי: ';
      const parts = [];
      if (activeFilters.babyFriendly) parts.push('מתאים לתינוק 👶');
      if (activeFilters.area) parts.push(AREA_LABELS[activeFilters.area] || activeFilters.area);
      if (activeFilters.category) parts.push(CATEGORY_LABELS[activeFilters.category] || activeFilters.category);
      if (activeFilters.minFamilyScore > 0) parts.push('ציון ' + activeFilters.minFamilyScore + '+');
      if (activeFilters.search) parts.push('חיפוש: "' + activeFilters.search + '"');
      filtersText.textContent = filterDesc + parts.join(', ');
      filtersText.style.display = 'block';
    } else {
      filtersText.textContent = '';
      filtersText.style.display = 'none';
    }
  }

  // Show/hide clear filters button
  const clearBtn = document.getElementById('clear-filters-btn');
  if (clearBtn) {
    const hasFilters = activeFilters.area || activeFilters.category || activeFilters.babyFriendly || activeFilters.minFamilyScore > 0 || activeFilters.search || activeFilters.suitableFor;
    clearBtn.style.display = hasFilters ? 'inline-flex' : 'none';
  }

  // Flash banner on filter change
  const banner = document.querySelector('.attractions-count-banner');
  if (banner) {
    banner.classList.remove('banner-flash');
    void banner.offsetWidth;
    banner.classList.add('banner-flash');
  }
}

function updateDayPlanBadge() {
  const badge = document.getElementById('day-plan-badge');
  if (badge) {
    badge.textContent = dayPlan.length;
    badge.style.display = dayPlan.length > 0 ? 'flex' : 'none';
  }
}

function updateBottomNav(target) {
  document.querySelectorAll('.bottom-nav-item').forEach(function (item) {
    if (item.dataset.target === target) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

function openDayPlanPanel() {
  const panel = document.getElementById('day-plan-panel');
  if (panel) {
    panel.classList.add('open');
    renderDayPlanItems();
  }
}

function closeDayPlanPanel() {
  const panel = document.getElementById('day-plan-panel');
  if (panel) panel.classList.remove('open');
}

function renderDayPlanItems() {
  const list = document.getElementById('day-plan-items');
  if (!list) return;

  list.textContent = '';

  // Show/hide actions and empty state
  const actions = document.getElementById('day-plan-actions');
  const emptyState = document.getElementById('day-plan-empty');
  if (actions) actions.style.display = dayPlan.length > 0 ? 'flex' : 'none';
  if (emptyState) emptyState.style.display = dayPlan.length === 0 ? 'block' : 'none';

  if (dayPlan.length === 0) {
    return;
  }

  dayPlan.forEach(function (item, index) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'day-plan-item';

    const numberDiv = document.createElement('div');
    numberDiv.className = 'day-plan-item-number';
    numberDiv.textContent = index + 1;
    itemDiv.appendChild(numberDiv);

    const info = document.createElement('div');
    info.className = 'day-plan-item-info';

    const name = document.createElement('div');
    name.className = 'day-plan-item-name';
    name.textContent = getCategoryIcon(item.category) + ' ' + (item.nameHebrew || item.name);
    info.appendChild(name);

    const areaDiv = document.createElement('div');
    areaDiv.className = 'day-plan-item-area';
    areaDiv.textContent = AREA_LABELS[item.area] || item.area || '';
    info.appendChild(areaDiv);

    itemDiv.appendChild(info);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'day-plan-remove';
    removeBtn.title = 'הסר';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', function () {
      removeFromPlan(item.id || item.name);
    });
    itemDiv.appendChild(removeBtn);

    list.appendChild(itemDiv);
  });
}

// ===== Clear All Filters =====
function clearAllFilters() {
  activeFilters.search = '';
  activeFilters.area = '';
  activeFilters.category = '';
  activeFilters.suitableFor = '';
  activeFilters.babyFriendly = false;
  activeFilters.minFamilyScore = 0;

  // Reset UI chips
  document.querySelectorAll('.filter-chip').forEach(function(c) { c.classList.remove('active'); });
  var allArea = document.querySelector('.filter-chip[data-area="all"]');
  if (allArea) allArea.classList.add('active');
  var allCat = document.querySelector('.filter-chip[data-category="all"]');
  if (allCat) allCat.classList.add('active');

  var searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';

  applyFilters();
}

// ===== Attraction Modal =====
function openAttractionModal(attraction) {
  const modal = document.getElementById('attraction-modal');
  if (!modal) return;

  // Populate image
  const modalImage = modal.querySelector('.modal-image');
  if (modalImage) {
    if (attraction.imageUrl) {
      modalImage.style.backgroundImage = 'url(' + attraction.imageUrl + ')';
      modalImage.style.backgroundSize = 'cover';
      modalImage.style.backgroundPosition = 'center';
    } else {
      const color = getCategoryColor(attraction.category);
      modalImage.style.backgroundImage = '';
      modalImage.style.background = 'linear-gradient(135deg, ' + color + '22, ' + color + '44)';
    }
  }

  // Title
  const modalTitle = modal.querySelector('.modal-title');
  if (modalTitle) modalTitle.textContent = attraction.nameHebrew || attraction.name;

  // Age badges
  const modalBadges = modal.querySelector('.modal-age-badges');
  if (modalBadges) {
    modalBadges.textContent = '';
    const badges = getAgeBadges(attraction);
    badges.forEach(function(b) {
      const span = document.createElement('span');
      span.className = 'age-badge';
      span.style.background = b.color;
      span.textContent = b.emoji + ' ' + b.label;
      modalBadges.appendChild(span);
    });
  }

  // Full description
  const modalDesc = modal.querySelector('.modal-description');
  if (modalDesc) modalDesc.textContent = attraction.descriptionHebrew || attraction.description || '';

  // Details (price, address, distance)
  const modalDetails = modal.querySelector('.modal-details');
  if (modalDetails) {
    modalDetails.textContent = '';
    const details = [];
    if (attraction.priceAdult) details.push('💰 מבוגר: ' + attraction.priceAdult);
    if (attraction.priceChild) details.push('👧 ילד: ' + attraction.priceChild);
    if (attraction.address) details.push('📍 ' + attraction.address);
    if (attraction.distanceFromMalatiny) details.push('🚗 ' + attraction.distanceFromMalatiny);
    details.forEach(function(d) {
      const p = document.createElement('p');
      p.className = 'modal-detail-line';
      p.textContent = d;
      modalDetails.appendChild(p);
    });
  }

  // Notes
  const modalNotes = modal.querySelector('.modal-notes');
  if (modalNotes) {
    const notes = attraction.notesHebrew || attraction.notes || '';
    if (notes) {
      modalNotes.textContent = '';
      const notesTitle = document.createElement('h4');
      notesTitle.textContent = '📝 הערות';
      modalNotes.appendChild(notesTitle);
      const notesP = document.createElement('p');
      notesP.textContent = notes;
      modalNotes.appendChild(notesP);
    } else {
      modalNotes.textContent = '';
    }
  }

  // Score
  const modalScore = modal.querySelector('.modal-score');
  if (modalScore) {
    modalScore.textContent = '';
    const familyScore = attraction.familyScore || 0;
    const scoreDiv = document.createElement('div');
    scoreDiv.className = 'modal-stars';
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.textContent = i <= familyScore ? '★' : '☆';
      star.className = i <= familyScore ? 'star filled' : 'star empty';
      scoreDiv.appendChild(star);
    }
    const scoreLabel = document.createElement('span');
    scoreLabel.className = 'modal-score-label';
    scoreLabel.textContent = ' ציון משפחתיות: ' + familyScore + '/5';
    modalScore.appendChild(scoreDiv);
    modalScore.appendChild(scoreLabel);
  }

  // Actions
  const modalActions = modal.querySelector('.modal-actions');
  if (modalActions) {
    modalActions.textContent = '';

    // Maps button
    let mapsUrl = '#';
    if (attraction.coordinates && attraction.coordinates.lat && attraction.coordinates.lng) {
      mapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + attraction.coordinates.lat + ',' + attraction.coordinates.lng;
    } else if (attraction.googleMapsUrl) {
      mapsUrl = attraction.googleMapsUrl;
    }
    const mapsBtn = document.createElement('a');
    mapsBtn.className = 'modal-action-btn modal-btn-primary';
    mapsBtn.href = mapsUrl;
    mapsBtn.target = '_blank';
    mapsBtn.rel = 'noopener';
    mapsBtn.textContent = '🗺️ נווט בגוגל מפות';
    modalActions.appendChild(mapsBtn);

    // Website button
    if (attraction.website) {
      const webBtn = document.createElement('a');
      webBtn.className = 'modal-action-btn modal-btn-secondary';
      webBtn.href = attraction.website;
      webBtn.target = '_blank';
      webBtn.rel = 'noopener';
      webBtn.textContent = '🌐 אתר';
      modalActions.appendChild(webBtn);
    }

    // Add to plan button
    const isInPlan = dayPlan.some(function(item) { return item.name === attraction.name; });
    const planBtn = document.createElement('button');
    planBtn.className = 'modal-action-btn modal-btn-outline' + (isInPlan ? ' added' : '');
    planBtn.textContent = isInPlan ? '✓ בתוכנית' : '➕ הוסף לתוכנית';
    planBtn.addEventListener('click', function() {
      addToPlan(attraction.id || attraction.name);
      closeAttractionModal();
    });
    modalActions.appendChild(planBtn);
  }

  // Source
  const modalSource = modal.querySelector('.modal-source');
  if (modalSource) {
    modalSource.textContent = '';
    if (attraction.source || attraction.website) {
      const sourceLink = document.createElement('a');
      sourceLink.className = 'modal-source-link';
      sourceLink.href = attraction.source || attraction.website;
      sourceLink.target = '_blank';
      sourceLink.rel = 'noopener';
      sourceLink.textContent = '🔗 מקור מידע';
      modalSource.appendChild(sourceLink);
    }
  }

  // Show modal
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAttractionModal() {
  const modal = document.getElementById('attraction-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function setupModal() {
  const modal = document.getElementById('attraction-modal');
  if (!modal) return;

  // Close button
  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeAttractionModal);
  }

  // Click overlay to close
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeAttractionModal();
  });

  // Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeAttractionModal();
  });
}

// ===== Event Binding / Setup =====
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;

  let debounceTimer;
  searchInput.addEventListener('input', function (e) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      searchAttractions(e.target.value);
    }, 250);
  });
}

function setupFilters() {
  // Area filter chips
  document.querySelectorAll('.filter-chip[data-area]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      const area = this.dataset.area;
      document.querySelectorAll('.filter-chip[data-area]').forEach(function (c) { c.classList.remove('active'); });
      if (area === 'all' || activeFilters.area === area) {
        activeFilters.area = '';
        document.querySelector('.filter-chip[data-area="all"]').classList.add('active');
      } else {
        activeFilters.area = area;
        this.classList.add('active');
      }
      applyFilters();
    });
  });

  // Category filter chips
  document.querySelectorAll('.filter-chip[data-category]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      const category = this.dataset.category;
      document.querySelectorAll('.filter-chip[data-category]').forEach(function (c) { c.classList.remove('active'); });
      if (category === 'all' || activeFilters.category === category) {
        activeFilters.category = '';
        document.querySelector('.filter-chip[data-category="all"]').classList.add('active');
      } else {
        activeFilters.category = category;
        this.classList.add('active');
      }
      applyFilters();
    });
  });

  // Suitable for filter chips
  document.querySelectorAll('.filter-chip[data-suitable]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      const suitable = this.dataset.suitable;
      if (activeFilters.suitableFor === suitable) {
        activeFilters.suitableFor = '';
        this.classList.remove('active');
      } else {
        document.querySelectorAll('.filter-chip[data-suitable]').forEach(function (c) { c.classList.remove('active'); });
        activeFilters.suitableFor = suitable;
        this.classList.add('active');
      }
      applyFilters();
    });
  });

  // Baby-friendly filter
  var babyFilter = document.getElementById('baby-filter');
  if (babyFilter) {
    babyFilter.addEventListener('click', function () {
      activeFilters.babyFriendly = !activeFilters.babyFriendly;
      this.classList.toggle('active', activeFilters.babyFriendly);
      applyFilters();
    });
  }

  // Family score filters
  var scoreFilter4 = document.getElementById('score-filter-4');
  if (scoreFilter4) {
    scoreFilter4.addEventListener('click', function () {
      if (activeFilters.minFamilyScore === 4) {
        activeFilters.minFamilyScore = 0;
        this.classList.remove('active');
      } else {
        activeFilters.minFamilyScore = 4;
        this.classList.add('active');
        var s5 = document.getElementById('score-filter-5');
        if (s5) s5.classList.remove('active');
      }
      applyFilters();
    });
  }

  var scoreFilter5 = document.getElementById('score-filter-5');
  if (scoreFilter5) {
    scoreFilter5.addEventListener('click', function () {
      if (activeFilters.minFamilyScore === 5) {
        activeFilters.minFamilyScore = 0;
        this.classList.remove('active');
      } else {
        activeFilters.minFamilyScore = 5;
        this.classList.add('active');
        var s4 = document.getElementById('score-filter-4');
        if (s4) s4.classList.remove('active');
      }
      applyFilters();
    });
  }
}

function setupSort() {
  const sortSelect = document.getElementById('sort-select');
  if (!sortSelect) return;

  sortSelect.addEventListener('change', function () {
    currentSort = this.value;
    applyFilters();
  });
}

function setupViewToggle() {
  const gridBtn = document.getElementById('view-grid-btn');
  const mapBtn = document.getElementById('view-map-btn');

  if (gridBtn) {
    gridBtn.addEventListener('click', function () { toggleView('grid'); });
  }
  if (mapBtn) {
    mapBtn.addEventListener('click', function () { toggleView('map'); });
  }
}

function setupNavigation() {
  // Hamburger menu
  const hamburger = document.getElementById('hamburger-btn');
  const closeBtn = document.getElementById('nav-mobile-close');
  const overlay = document.getElementById('nav-overlay');

  if (hamburger) hamburger.addEventListener('click', toggleMobileMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMobileMenu);
  if (overlay) overlay.addEventListener('click', closeMobileMenu);

  // Bottom nav items
  document.querySelectorAll('.bottom-nav-item').forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      const target = this.dataset.target;

      document.querySelectorAll('.bottom-nav-item').forEach(function (i) { i.classList.remove('active'); });
      this.classList.add('active');

      if (target === 'map') {
        toggleView('map');
      } else if (target === 'list') {
        toggleView('grid');
      } else if (target === 'plan') {
        openDayPlanPanel();
      }
    });
  });
}

function setupDayPlan() {
  const fab = document.getElementById('day-plan-fab');
  const closeBtn = document.getElementById('day-plan-close');
  const clearBtn = document.getElementById('btn-clear-plan');
  const shareBtn = document.getElementById('btn-share-plan');

  if (fab) fab.addEventListener('click', openDayPlanPanel);
  if (closeBtn) closeBtn.addEventListener('click', closeDayPlanPanel);
  if (clearBtn) clearBtn.addEventListener('click', clearDayPlan);
  if (shareBtn) shareBtn.addEventListener('click', shareDayPlan);

  updateDayPlanBadge();
}

// ===== Expose globally for external use (map.html, subpages) =====
window.SlovakiaTrip = {
  get allAttractions() { return allAttractions; },
  get filteredAttractions() { return filteredAttractions; },
  get dayPlan() { return dayPlan; },
  CATEGORY_LABELS: CATEGORY_LABELS,
  AREA_LABELS: AREA_LABELS,
  loadAttractions: loadAttractions,
  applyFilters: applyFilters,
  searchAttractions: searchAttractions,
  filterByArea: filterByArea,
  filterByCategory: filterByCategory,
  filterByBabyFriendly: filterByBabyFriendly,
  filterByFamilyScore: filterByFamilyScore,
  sortAttractions: sortAttractions,
  toggleView: toggleView,
  addToPlan: addToPlan,
  removeFromPlan: removeFromPlan,
  getDayPlan: getDayPlan,
  getCategoryIcon: getCategoryIcon,
  getCategoryColor: getCategoryColor
};

// ===== Floating Buttons (Back to Top + Home) =====
function setupFloatingButtons() {
  // Remove any existing floating buttons first
  const existing = document.querySelector('.floating-btns');
  if (existing) existing.remove();

  // Create floating buttons container
  const container = document.createElement('div');
  container.className = 'floating-btns';
  container.id = 'floating-btns';

  const topBtn = document.createElement('button');
  topBtn.className = 'float-btn';
  topBtn.setAttribute('aria-label', 'חזרה למעלה');
  topBtn.title = 'חזרה למעלה';
  topBtn.textContent = '⬆️';
  container.appendChild(topBtn);

  // Determine home path based on current page depth
  const isSubpage = window.location.pathname.includes('/areas/') || window.location.pathname.includes('/categories/');
  const homePath = isSubpage ? '../index.html' : 'index.html';

  const homeBtn = document.createElement('a');
  homeBtn.className = 'float-btn home-btn';
  homeBtn.href = homePath;
  homeBtn.setAttribute('aria-label', 'דף הבית');
  homeBtn.title = 'דף הבית';
  homeBtn.textContent = '🏠';
  container.appendChild(homeBtn);

  document.body.appendChild(container);

  // Show/hide the whole container based on scroll
  window.addEventListener('scroll', function () {
    if (window.scrollY > 300) {
      container.classList.add('visible');
    } else {
      container.classList.remove('visible');
    }
  });

  topBtn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ===== Initialize on DOM Load =====
document.addEventListener('DOMContentLoaded', async function () {
  await loadAttractions();
  setupSearch();
  setupFilters();
  setupSort();
  setupViewToggle();
  setupNavigation();
  setupDayPlan();
  setupFloatingButtons();
  setupModal();
  applyFilters();

  // Update hero stat dynamically
  const heroCount = document.getElementById('total-attractions-count');
  if (heroCount) heroCount.textContent = allAttractions.length;

  // Update footer count dynamically
  const footer = document.querySelector('footer p[data-footer-count]');
  if (footer) footer.textContent = allAttractions.length + ' אטרקציות | ספורט מים, הרפתקאות, טבע, אופניים ועוד';

  // Setup clear filters button
  const clearBtn = document.getElementById('clear-filters-btn');
  if (clearBtn) clearBtn.addEventListener('click', clearAllFilters);
});
