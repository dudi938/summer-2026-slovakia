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
  cardImage.style.background = 'linear-gradient(135deg, ' + categoryColor + '22, ' + categoryColor + '44)';

  const placeholderIcon = document.createElement('span');
  placeholderIcon.className = 'placeholder-icon';
  placeholderIcon.textContent = iconEmoji;
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
  const list = document.getElementById('day-plan-list');
  if (!list) return;

  list.textContent = '';

  if (dayPlan.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'day-plan-empty';
    emptyDiv.textContent = 'התוכנית ריקה. הוסיפו אטרקציות מהרשימה!';
    list.appendChild(emptyDiv);
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
      if (activeFilters.area === area) {
        activeFilters.area = '';
        this.classList.remove('active');
      } else {
        document.querySelectorAll('.filter-chip[data-area]').forEach(function (c) { c.classList.remove('active'); });
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
      if (activeFilters.category === category) {
        activeFilters.category = '';
        this.classList.remove('active');
      } else {
        document.querySelectorAll('.filter-chip[data-category]').forEach(function (c) { c.classList.remove('active'); });
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

// ===== Initialize on DOM Load =====
document.addEventListener('DOMContentLoaded', async function () {
  await loadAttractions();
  setupSearch();
  setupFilters();
  setupSort();
  setupViewToggle();
  setupNavigation();
  setupDayPlan();
  applyFilters();
});
