/* ===== Slovakia Family Trip - Main Application ===== */
/* Uses DOMPurify for safe HTML rendering (loaded from CDN in index.html) */

(function () {
  'use strict';

  // ===== State =====
  const state = {
    attractions: [],
    filtered: [],
    filters: {
      search: '',
      area: '',
      category: '',
      suitableFor: ''
    },
    sort: 'name',
    view: 'grid',
    dayPlan: JSON.parse(localStorage.getItem('dayPlan') || '[]'),
    map: null,
    markers: []
  };

  // ===== Constants =====
  const CATEGORY_LABELS = {
    'nature': 'טבע',
    'adventure': 'אתגר והרפתקאות',
    'water-sports': 'ספורט מים',
    'cycling': 'אופניים',
    'family': 'משפחה',
    'other': 'אחר'
  };

  const AREA_LABELS = {
    'bratislava': 'ברטיסלבה',
    'high-tatras': 'הרי הטטרה',
    'other-slovakia': 'סלובקיה - אחר',
    'vienna': 'וינה',
    'budapest': 'בודפשט',
    'czech': 'צ\'כיה'
  };

  const SUITABLE_FOR_OPTIONS = {
    'baby': 'תינוקות',
    'toddlers': 'פעוטות',
    'children': 'ילדים',
    'teens': 'נוער',
    'adults': 'מבוגרים',
    'families': 'משפחות'
  };

  const CATEGORY_ICONS = {
    'nature': '\u{1F332}',
    'adventure': '\u{1F9D7}',
    'water-sports': '\u{1F6A3}',
    'cycling': '\u{1F6B4}',
    'family': '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}',
    'other': '\u{1F4CD}'
  };

  const CATEGORY_COLORS = {
    'nature': '#5CB85C',
    'adventure': '#F0AD4E',
    'water-sports': '#5BC0DE',
    'cycling': '#9B59B6',
    'family': '#D9534F',
    'other': '#6B7280'
  };

  // ===== Sanitization helper =====
  function sanitize(html) {
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(html);
    }
    // Fallback: basic text escaping
    var div = document.createElement('div');
    div.textContent = html;
    return div.textContent;
  }

  function safeSetHTML(element, html) {
    if (typeof DOMPurify !== 'undefined') {
      element.innerHTML = DOMPurify.sanitize(html);
    } else {
      element.textContent = html;
    }
  }

  // ===== DOM Ready =====
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await loadAttractions();
    setupSearch();
    setupFilters();
    setupSort();
    setupViewToggle();
    setupNavigation();
    setupDayPlan();
    applyFilters();
  }

  // ===== Data Loading =====
  async function loadAttractions() {
    var grid = document.getElementById('attractions-grid');
    if (grid) {
      grid.textContent = '';
      var spinnerWrap = document.createElement('div');
      spinnerWrap.className = 'loading-spinner';
      var spinner = document.createElement('div');
      spinner.className = 'spinner';
      spinnerWrap.appendChild(spinner);
      grid.appendChild(spinnerWrap);
    }

    try {
      var response = await fetch('data/attractions.json');
      if (!response.ok) {
        response = await fetch('../data/attractions.json');
      }
      if (!response.ok) throw new Error('Failed to load attractions');
      state.attractions = await response.json();

      // Apply page-level filter from body data attributes (for area/category subpages)
      var pageFilterType = document.body.dataset.filterType;
      var pageFilterValue = document.body.dataset.filterValue;
      if (pageFilterType && pageFilterValue) {
        state.attractions = state.attractions.filter(function(a) {
          return a[pageFilterType] === pageFilterValue;
        });
      }

      state.filtered = state.attractions.slice();

      // Update area count display if present
      var areaCountEl = document.getElementById('area-count');
      if (areaCountEl) {
        areaCountEl.textContent = state.attractions.length;
      }
    } catch (error) {
      console.error('Error loading attractions:', error);
      if (grid) {
        grid.textContent = '';
        var emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        var iconDiv = document.createElement('div');
        iconDiv.className = 'empty-state-icon';
        iconDiv.textContent = '⚠️';
        var textDiv = document.createElement('div');
        textDiv.className = 'empty-state-text';
        textDiv.textContent = 'שגיאה בטעינת הנתונים';
        emptyDiv.appendChild(iconDiv);
        emptyDiv.appendChild(textDiv);
        grid.appendChild(emptyDiv);
      }
    }
  }

  // ===== Search =====
  function setupSearch() {
    var searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    var debounceTimer;
    searchInput.addEventListener('input', function (e) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        state.filters.search = e.target.value.trim().toLowerCase();
        applyFilters();
      }, 250);
    });
  }

  // ===== Filters =====
  function setupFilters() {
    document.querySelectorAll('.filter-chip[data-area]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var area = this.dataset.area;
        if (state.filters.area === area) {
          state.filters.area = '';
          this.classList.remove('active');
        } else {
          document.querySelectorAll('.filter-chip[data-area]').forEach(function (c) { c.classList.remove('active'); });
          state.filters.area = area;
          this.classList.add('active');
        }
        applyFilters();
      });
    });

    document.querySelectorAll('.filter-chip[data-category]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var category = this.dataset.category;
        if (state.filters.category === category) {
          state.filters.category = '';
          this.classList.remove('active');
        } else {
          document.querySelectorAll('.filter-chip[data-category]').forEach(function (c) { c.classList.remove('active'); });
          state.filters.category = category;
          this.classList.add('active');
        }
        applyFilters();
      });
    });

    document.querySelectorAll('.filter-chip[data-suitable]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var suitable = this.dataset.suitable;
        if (state.filters.suitableFor === suitable) {
          state.filters.suitableFor = '';
          this.classList.remove('active');
        } else {
          document.querySelectorAll('.filter-chip[data-suitable]').forEach(function (c) { c.classList.remove('active'); });
          state.filters.suitableFor = suitable;
          this.classList.add('active');
        }
        applyFilters();
      });
    });
  }

  // ===== Filtering Logic =====
  function applyFilters() {
    var results = state.attractions.slice();

    if (state.filters.search) {
      var query = state.filters.search;
      results = results.filter(function (a) {
        return (a.nameHebrew && a.nameHebrew.toLowerCase().indexOf(query) !== -1) ||
          (a.name && a.name.toLowerCase().indexOf(query) !== -1) ||
          (a.description && a.description.toLowerCase().indexOf(query) !== -1) ||
          (a.address && a.address.toLowerCase().indexOf(query) !== -1) ||
          (a.notes && a.notes.toLowerCase().indexOf(query) !== -1);
      });
    }

    if (state.filters.area) {
      results = results.filter(function (a) { return a.area === state.filters.area; });
    }

    if (state.filters.category) {
      results = results.filter(function (a) { return a.category === state.filters.category; });
    }

    if (state.filters.suitableFor) {
      var suitableQuery = state.filters.suitableFor;
      results = results.filter(function (a) {
        return a.suitableFor && a.suitableFor.some(function (s) {
          return s.toLowerCase().indexOf(suitableQuery) !== -1;
        });
      });
    }

    results = sortAttractions(results);
    state.filtered = results;
    renderAttractions();
    updateResultsCount();
    if (state.view === 'map') {
      updateMapMarkers();
    }
  }

  // ===== Sorting =====
  function setupSort() {
    var sortSelect = document.getElementById('sort-select');
    if (!sortSelect) return;

    sortSelect.addEventListener('change', function () {
      state.sort = this.value;
      applyFilters();
    });
  }

  function sortAttractions(attractions) {
    var sorted = attractions.slice();

    switch (state.sort) {
      case 'name':
        sorted.sort(function (a, b) { return (a.nameHebrew || a.name).localeCompare(b.nameHebrew || b.name, 'he'); });
        break;
      case 'area':
        sorted.sort(function (a, b) { return a.area.localeCompare(b.area); });
        break;
      case 'category':
        sorted.sort(function (a, b) { return a.category.localeCompare(b.category); });
        break;
      case 'distance':
        sorted.sort(function (a, b) { return parseDistance(a.distanceFromMalatiny) - parseDistance(b.distanceFromMalatiny); });
        break;
      case 'price':
        sorted.sort(function (a, b) { return parsePrice(a.priceAdult) - parsePrice(b.priceAdult); });
        break;
    }

    return sorted;
  }

  function parseDistance(distStr) {
    if (!distStr) return 9999;
    var match = distStr.match(/(\d+)\s*km/i);
    return match ? parseInt(match[1]) : 9999;
  }

  function parsePrice(priceStr) {
    if (!priceStr) return 0;
    if (priceStr.toLowerCase().indexOf('free') !== -1 || priceStr.indexOf('חינם') !== -1) return 0;
    var match = priceStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  // ===== View Toggle =====
  function setupViewToggle() {
    var gridBtn = document.getElementById('view-grid-btn');
    var mapBtn = document.getElementById('view-map-btn');
    var attractionsSection = document.querySelector('.attractions-section');
    var mapSection = document.querySelector('.map-section');

    if (gridBtn) {
      gridBtn.addEventListener('click', function () {
        state.view = 'grid';
        gridBtn.classList.add('active');
        if (mapBtn) mapBtn.classList.remove('active');
        if (attractionsSection) attractionsSection.style.display = 'block';
        if (mapSection) mapSection.classList.remove('visible');
        updateBottomNav('list');
      });
    }

    if (mapBtn) {
      mapBtn.addEventListener('click', function () {
        state.view = 'map';
        mapBtn.classList.add('active');
        if (gridBtn) gridBtn.classList.remove('active');
        if (attractionsSection) attractionsSection.style.display = 'none';
        if (mapSection) mapSection.classList.add('visible');
        initMap();
        updateMapMarkers();
        updateBottomNav('map');
      });
    }
  }

  // ===== Map =====
  function initMap() {
    if (state.map) return;

    var mapEl = document.getElementById('map');
    if (!mapEl) return;

    state.map = L.map('map').setView([48.9, 19.1], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(state.map);

    setTimeout(function () { state.map.invalidateSize(); }, 100);
  }

  function updateMapMarkers() {
    if (!state.map) return;

    state.markers.forEach(function (m) { state.map.removeLayer(m); });
    state.markers = [];

    state.filtered.forEach(function (attraction) {
      if (!attraction.coordinates) return;

      var color = CATEGORY_COLORS[attraction.category] || '#6B7280';
      var iconEmoji = CATEGORY_ICONS[attraction.category] || '\u{1F4CD}';
      var icon = L.divIcon({
        className: 'custom-marker',
        html: DOMPurify.sanitize('<div style="background:' + color + ';width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">' + iconEmoji + '</div>'),
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });

      var marker = L.marker(
        [attraction.coordinates.lat, attraction.coordinates.lng],
        { icon: icon }
      ).addTo(state.map);

      var categoryLabel = CATEGORY_LABELS[attraction.category] || attraction.category;
      var areaLabel = AREA_LABELS[attraction.area] || attraction.area;
      var desc = attraction.description ? attraction.description.substring(0, 150) + '...' : '';
      var navUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + attraction.coordinates.lat + ',' + attraction.coordinates.lng;

      var popupContent = DOMPurify.sanitize(
        '<div class="popup-title">' + sanitize(attraction.nameHebrew || attraction.name) + '</div>' +
        '<div class="popup-category">' + sanitize(categoryLabel) + ' | ' + sanitize(areaLabel) + '</div>' +
        '<div class="popup-description">' + sanitize(desc) + '</div>' +
        '<a class="popup-btn" href="' + sanitize(navUrl) + '" target="_blank" rel="noopener">\u{1F5FA}️ ניווט</a>'
      );

      marker.bindPopup(popupContent, { maxWidth: 280, direction: 'right' });
      state.markers.push(marker);
    });

    if (state.markers.length > 0) {
      var group = L.featureGroup(state.markers);
      state.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  // ===== Render Attractions =====
  function renderAttractions() {
    var grid = document.getElementById('attractions-grid');
    if (!grid) return;

    grid.textContent = '';

    if (state.filtered.length === 0) {
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      var iconDiv = document.createElement('div');
      iconDiv.className = 'empty-state-icon';
      iconDiv.textContent = '\u{1F50D}';
      var textDiv = document.createElement('div');
      textDiv.className = 'empty-state-text';
      textDiv.textContent = 'לא נמצאו אטרקציות מתאימות';
      emptyDiv.appendChild(iconDiv);
      emptyDiv.appendChild(textDiv);
      grid.appendChild(emptyDiv);
      return;
    }

    state.filtered.forEach(function (attraction, index) {
      grid.appendChild(createCardElement(attraction, index));
    });

    setupLazyLoading();
  }

  function createCardElement(attraction, index) {
    var isInPlan = state.dayPlan.some(function (item) { return item.name === attraction.name; });
    var categoryLabel = CATEGORY_LABELS[attraction.category] || attraction.category;
    var areaLabel = AREA_LABELS[attraction.area] || attraction.area;
    var iconEmoji = CATEGORY_ICONS[attraction.category] || '\u{1F4CD}';
    var tags = (attraction.suitableFor || []).slice(0, 3);

    var card = document.createElement('article');
    card.className = 'attraction-card fade-in';
    card.style.animationDelay = Math.min(index * 0.05, 0.5) + 's';
    card.dataset.name = attraction.name;

    // Card image
    var cardImage = document.createElement('div');
    cardImage.className = 'card-image';
    var placeholderIcon = document.createElement('span');
    placeholderIcon.className = 'placeholder-icon';
    placeholderIcon.textContent = iconEmoji;
    cardImage.appendChild(placeholderIcon);

    var badge = document.createElement('span');
    badge.className = 'card-category-badge ' + attraction.category;
    badge.textContent = categoryLabel;
    cardImage.appendChild(badge);
    card.appendChild(cardImage);

    // Card body
    var cardBody = document.createElement('div');
    cardBody.className = 'card-body';

    var title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = attraction.nameHebrew || attraction.name;
    cardBody.appendChild(title);

    var area = document.createElement('div');
    area.className = 'card-area';
    area.textContent = '\u{1F4CD} ' + areaLabel + (attraction.distanceFromMalatiny ? ' • ' + attraction.distanceFromMalatiny : '');
    cardBody.appendChild(area);

    var desc = document.createElement('p');
    desc.className = 'card-description';
    desc.textContent = attraction.description || '';
    cardBody.appendChild(desc);

    // Tags
    var tagsDiv = document.createElement('div');
    tagsDiv.className = 'card-tags';
    tags.forEach(function (tagText) {
      var tagSpan = document.createElement('span');
      tagSpan.className = 'card-tag';
      tagSpan.textContent = tagText;
      tagsDiv.appendChild(tagSpan);
    });
    cardBody.appendChild(tagsDiv);

    // Footer
    var footer = document.createElement('div');
    footer.className = 'card-footer';

    var price = document.createElement('span');
    price.className = 'card-price';
    price.textContent = attraction.priceAdult || 'לא צוין';
    footer.appendChild(price);

    var actions = document.createElement('div');
    actions.className = 'card-actions';

    // Navigate button
    var navBtn = document.createElement('button');
    navBtn.className = 'card-btn card-btn-primary btn-navigate';
    navBtn.title = 'פתח בגוגל מפות';
    navBtn.textContent = '\u{1F5FA}️';
    if (attraction.coordinates) {
      navBtn.addEventListener('click', function () {
        window.open('https://www.google.com/maps/dir/?api=1&destination=' + attraction.coordinates.lat + ',' + attraction.coordinates.lng, '_blank');
      });
    }
    actions.appendChild(navBtn);

    // Add to plan button
    var planBtn = document.createElement('button');
    planBtn.className = 'card-btn card-btn-outline btn-add-plan' + (isInPlan ? ' added' : '');
    planBtn.title = isInPlan ? 'הוסר מהתוכנית' : 'הוסף לתוכנית יומית';
    planBtn.textContent = isInPlan ? '✓' : '➕';
    planBtn.addEventListener('click', function () {
      toggleDayPlanItem({
        name: attraction.name,
        nameHebrew: attraction.nameHebrew || attraction.name,
        area: attraction.area
      });
    });
    actions.appendChild(planBtn);

    footer.appendChild(actions);
    cardBody.appendChild(footer);
    card.appendChild(cardBody);

    return card;
  }

  // ===== Lazy Loading =====
  function setupLazyLoading() {
    var images = document.querySelectorAll('.card-image[data-src]');
    if (!images.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var img = document.createElement('img');
          img.src = entry.target.dataset.src;
          img.alt = '';
          img.loading = 'lazy';
          entry.target.appendChild(img);
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '100px' });

    images.forEach(function (img) { observer.observe(img); });
  }

  // ===== Results Count =====
  function updateResultsCount() {
    var countEl = document.getElementById('results-count');
    if (countEl) {
      countEl.textContent = state.filtered.length + ' מתוך ' + state.attractions.length + ' אטרקציות';
    }
  }

  // ===== Navigation =====
  function setupNavigation() {
    var hamburger = document.getElementById('hamburger-btn');
    var mobileNav = document.getElementById('nav-mobile');
    var overlay = document.getElementById('nav-overlay');
    var closeBtn = document.getElementById('nav-mobile-close');

    function openNav() {
      if (mobileNav) mobileNav.classList.add('open');
      if (overlay) overlay.classList.add('visible');
      if (hamburger) hamburger.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeNav() {
      if (mobileNav) mobileNav.classList.remove('open');
      if (overlay) overlay.classList.remove('visible');
      if (hamburger) hamburger.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (hamburger) hamburger.addEventListener('click', openNav);
    if (closeBtn) closeBtn.addEventListener('click', closeNav);
    if (overlay) overlay.addEventListener('click', closeNav);

    // Bottom nav items
    document.querySelectorAll('.bottom-nav-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        var target = this.dataset.target;

        document.querySelectorAll('.bottom-nav-item').forEach(function (i) { i.classList.remove('active'); });
        this.classList.add('active');

        if (target === 'map') {
          state.view = 'map';
          var attSection = document.querySelector('.attractions-section');
          var mapSec = document.querySelector('.map-section');
          if (attSection) attSection.style.display = 'none';
          if (mapSec) mapSec.classList.add('visible');
          var mapBtnEl = document.getElementById('view-map-btn');
          var gridBtnEl = document.getElementById('view-grid-btn');
          if (mapBtnEl) mapBtnEl.classList.add('active');
          if (gridBtnEl) gridBtnEl.classList.remove('active');
          initMap();
          updateMapMarkers();
        } else if (target === 'list') {
          state.view = 'grid';
          var attSection2 = document.querySelector('.attractions-section');
          var mapSec2 = document.querySelector('.map-section');
          if (attSection2) attSection2.style.display = 'block';
          if (mapSec2) mapSec2.classList.remove('visible');
          var gridBtnEl2 = document.getElementById('view-grid-btn');
          var mapBtnEl2 = document.getElementById('view-map-btn');
          if (gridBtnEl2) gridBtnEl2.classList.add('active');
          if (mapBtnEl2) mapBtnEl2.classList.remove('active');
        } else if (target === 'plan') {
          openDayPlanPanel();
        }
      });
    });
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

  // ===== Day Plan =====
  function setupDayPlan() {
    var fab = document.getElementById('day-plan-fab');
    var closeBtn = document.getElementById('day-plan-close');
    var clearBtn = document.getElementById('btn-clear-plan');
    var shareBtn = document.getElementById('btn-share-plan');

    if (fab) fab.addEventListener('click', openDayPlanPanel);
    if (closeBtn) closeBtn.addEventListener('click', closeDayPlanPanel);
    if (clearBtn) clearBtn.addEventListener('click', clearDayPlan);
    if (shareBtn) shareBtn.addEventListener('click', shareDayPlan);

    updateDayPlanBadge();
  }

  function openDayPlanPanel() {
    var panel = document.getElementById('day-plan-panel');
    if (panel) {
      panel.classList.add('open');
      renderDayPlanItems();
    }
  }

  function closeDayPlanPanel() {
    var panel = document.getElementById('day-plan-panel');
    if (panel) panel.classList.remove('open');
  }

  function toggleDayPlanItem(item) {
    var index = -1;
    for (var i = 0; i < state.dayPlan.length; i++) {
      if (state.dayPlan[i].name === item.name) {
        index = i;
        break;
      }
    }
    if (index > -1) {
      state.dayPlan.splice(index, 1);
    } else {
      state.dayPlan.push(item);
    }
    saveDayPlan();
    updateDayPlanBadge();
    renderAttractions();
  }

  function removeDayPlanItem(name) {
    state.dayPlan = state.dayPlan.filter(function (item) { return item.name !== name; });
    saveDayPlan();
    updateDayPlanBadge();
    renderDayPlanItems();
    renderAttractions();
  }

  function clearDayPlan() {
    state.dayPlan = [];
    saveDayPlan();
    updateDayPlanBadge();
    renderDayPlanItems();
    renderAttractions();
  }

  function shareDayPlan() {
    if (state.dayPlan.length === 0) return;

    var text = 'תוכנית יומית - סלובקיה קיץ 2026:\n\n';
    state.dayPlan.forEach(function (item, i) {
      text += (i + 1) + '. ' + (item.nameHebrew || item.name) + ' (' + (AREA_LABELS[item.area] || item.area) + ')\n';
    });

    if (navigator.share) {
      navigator.share({ title: 'תוכנית יומית', text: text });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        alert('הועתק ללוח!');
      });
    }
  }

  function saveDayPlan() {
    localStorage.setItem('dayPlan', JSON.stringify(state.dayPlan));
  }

  function updateDayPlanBadge() {
    var badge = document.getElementById('day-plan-badge');
    if (badge) {
      badge.textContent = state.dayPlan.length;
      badge.style.display = state.dayPlan.length > 0 ? 'flex' : 'none';
    }
  }

  function renderDayPlanItems() {
    var list = document.getElementById('day-plan-list');
    if (!list) return;

    list.textContent = '';

    if (state.dayPlan.length === 0) {
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'day-plan-empty';
      emptyDiv.textContent = 'התוכנית ריקה. הוסיפו אטרקציות מהרשימה!';
      list.appendChild(emptyDiv);
      return;
    }

    state.dayPlan.forEach(function (item) {
      var itemDiv = document.createElement('div');
      itemDiv.className = 'day-plan-item';

      var info = document.createElement('div');
      info.className = 'day-plan-item-info';

      var name = document.createElement('div');
      name.className = 'day-plan-item-name';
      name.textContent = item.nameHebrew || item.name;
      info.appendChild(name);

      var areaDiv = document.createElement('div');
      areaDiv.className = 'day-plan-item-area';
      areaDiv.textContent = AREA_LABELS[item.area] || item.area;
      info.appendChild(areaDiv);

      itemDiv.appendChild(info);

      var removeBtn = document.createElement('button');
      removeBtn.className = 'day-plan-remove';
      removeBtn.title = 'הסר';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', function () {
        removeDayPlanItem(item.name);
      });
      itemDiv.appendChild(removeBtn);

      list.appendChild(itemDiv);
    });
  }

  // ===== Global functions for subpage inline onclick handlers =====
  window.searchAttractions = function(query) {
    state.filters.search = query.toLowerCase().trim();
    applyFilters();
  };

  window.filterByCategory = function(category) {
    state.filters.category = category;
    // Update chip active states
    document.querySelectorAll('.chip[onclick*="filterByCategory"], .filter-chip[data-category]').forEach(function(chip) {
      chip.classList.remove('active');
    });
    if (event && event.target) event.target.classList.add('active');
    applyFilters();
  };

  window.filterByArea = function(area) {
    state.filters.area = area;
    document.querySelectorAll('.chip[onclick*="filterByArea"], .filter-chip[data-area]').forEach(function(chip) {
      chip.classList.remove('active');
    });
    if (event && event.target) event.target.classList.add('active');
    applyFilters();
  };

  window.filterByBabyFriendly = function(checked) {
    if (checked) {
      state.filters.suitableFor = 'baby';
    } else {
      state.filters.suitableFor = '';
    }
    applyFilters();
  };

  window.toggleView = function(view) {
    var grid = document.getElementById('attractions-grid');
    var mapEl = document.getElementById('map');
    var gridBtns = document.querySelectorAll('.view-btn');

    if (view === 'map') {
      state.view = 'map';
      if (grid) grid.style.display = 'none';
      if (mapEl) mapEl.style.display = 'block';
      initMap();
      updateMapMarkers();
    } else {
      state.view = 'grid';
      if (grid) grid.style.display = '';
      if (mapEl) mapEl.style.display = 'none';
    }

    gridBtns.forEach(function(btn, i) {
      btn.classList.toggle('active', (view === 'grid' && i === 0) || (view === 'map' && i === 1));
    });
  };

  window.toggleMobileMenu = function() {
    var nav = document.querySelector('.nav-links');
    if (nav) nav.classList.toggle('open');
  };

  // Expose map variable globally for map.html
  window.map = state.map;
  window.initMap = initMap;
  window.renderMarkers = updateMapMarkers;

  // ===== Expose for map.html =====
  window.SlovakiaTrip = {
    state: state,
    CATEGORY_LABELS: CATEGORY_LABELS,
    AREA_LABELS: AREA_LABELS,
    CATEGORY_ICONS: CATEGORY_ICONS,
    CATEGORY_COLORS: CATEGORY_COLORS,
    loadAttractions: loadAttractions,
    applyFilters: applyFilters
  };

})();
