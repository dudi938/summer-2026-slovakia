/**
 * area-explorer.js — Dynamic "What's around?" page (explore.html)
 *
 * Lets the user pick a point on the map — by searching a place (OpenStreetMap
 * Nominatim geocoder) or clicking/dragging on the map — then instantly shows
 * every attraction within an adjustable radius, both as map markers and as
 * cards below the map.
 *
 * Reuses functions from js/app.js (loaded before this file):
 *   - buildAttractionMarker(attraction)  → Leaflet marker with RTL popup
 *   - renderAttractionCard(attraction, i) → full attraction card element
 *   - getCategoryColor / getCategoryIcon  → marker/legend styling
 * The two files never fight over the DOM: app.js auto-bootstraps against
 * #map / #attractions-grid / #search-input (all absent here), while this
 * module owns #area-map / #area-results / #place-search.
 */
(function () {
  'use strict';

  // ===== Module state =====
  var areaMap = null;          // Leaflet map instance
  var attractions = [];        // all attractions loaded from JSON
  var nearbyMarkers = [];      // attraction markers currently on the map
  var centerMarker = null;     // draggable marker for the chosen point
  var radiusCircle = null;     // L.circle showing the search radius
  var center = null;           // { lat, lng } chosen point (null until picked)
  var radiusKm = 30;           // current radius in km (matches slider default)
  var currentResults = [];     // radius-filtered {attraction,dist}, kept for viewport re-filtering
  var lastVisibleKey = null;   // signature of last-rendered card set (skip identical re-renders)
  var searchDebounce = null;   // debounce timer for Nominatim
  var searchAbort = null;      // AbortController for in-flight geocode request

  // Trip region bounding box (approx): Slovakia + Vienna + Budapest + Czech.
  // Used to bias/limit Nominatim results to relevant places.
  var REGION_VIEWBOX = '12.0,50.5,23.0,45.7'; // lon_min,lat_max,lon_max,lat_min
  var REGION_COUNTRIES = 'sk,at,hu,cz,pl';

  // ===== Small helpers =====
  function $(id) { return document.getElementById(id); }

  // Haversine great-circle distance in km. (app.js only has parseDistance on
  // free text — real point-to-point distance does not exist there, so we add it.)
  function distanceKm(lat1, lng1, lat2, lng2) {
    var R = 6371; // Earth radius, km
    var toRad = function (d) { return d * Math.PI / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function hasCoords(a) {
    return a && a.coordinates &&
      typeof a.coordinates.lat === 'number' &&
      typeof a.coordinates.lng === 'number';
  }

  // ===== Data loading =====
  function loadData() {
    return fetch('data/attractions.json')
      .then(function (r) {
        if (!r.ok) throw new Error('load failed');
        return r.json();
      })
      .then(function (data) {
        attractions = (data || []).filter(hasCoords);
      });
  }

  // ===== Map setup =====
  function initAreaMap() {
    var el = $('area-map');
    if (!el || typeof L === 'undefined') return;

    areaMap = L.map('area-map').setView([48.9, 19.1], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18
    }).addTo(areaMap);

    setTimeout(function () { areaMap.invalidateSize(); }, 300);

    // Click anywhere on the map to choose that point as the center.
    areaMap.on('click', function (e) {
      setCenter(e.latlng.lat, e.latlng.lng, { fly: false });
    });

    // When the user zooms/pans, re-render the cards to match what's on screen.
    areaMap.on('moveend', function () {
      if (center) renderVisibleCards();
    });
  }

  // ===== Center point + radius rendering =====
  function ensureCenterMarker() {
    if (centerMarker) return;

    // A deliberately distinct marker for the CHOSEN point — bigger, dark
    // (no category uses this color), a 🎯 icon, and a pulsing halo — so it can
    // never be mistaken for a nearby attraction marker.
    var icon = L.divIcon({
      className: 'area-center-marker',
      html: '<div class="acm-pulse"></div>' +
            '<div class="acm-pin"><span class="acm-emoji">🎯</span></div>',
      iconSize: [48, 54],
      iconAnchor: [24, 48],
      tooltipAnchor: [0, -46]
    });

    centerMarker = L.marker([center.lat, center.lng], {
      icon: icon,
      draggable: true,
      zIndexOffset: 2000
    }).addTo(areaMap);

    // Always-visible label naming the chosen point.
    centerMarker.bindTooltip('הנקודה שבחרת', {
      permanent: true,
      direction: 'top',
      className: 'area-center-tooltip'
    });

    // Dragging the pin re-runs the search live.
    centerMarker.on('drag', function (e) {
      var p = e.target.getLatLng();
      center = { lat: p.lat, lng: p.lng };
      if (radiusCircle) radiusCircle.setLatLng(p);
    });
    centerMarker.on('dragend', function () {
      renderNearby({ fit: false });
    });
  }

  function renderRadiusCircle() {
    if (radiusCircle) {
      radiusCircle.setLatLng([center.lat, center.lng]);
      radiusCircle.setRadius(radiusKm * 1000);
      return;
    }
    radiusCircle = L.circle([center.lat, center.lng], {
      radius: radiusKm * 1000,
      color: '#4A90D9',
      weight: 2,
      fillColor: '#4A90D9',
      fillOpacity: 0.08
    }).addTo(areaMap);
  }

  // Set the chosen center point and refresh everything.
  function setCenter(lat, lng, opts) {
    opts = opts || {};
    center = { lat: lat, lng: lng };
    lastVisibleKey = null;  // force card re-render (distances changed)

    ensureCenterMarker();
    centerMarker.setLatLng([lat, lng]);
    renderRadiusCircle();

    if (opts.fly) {
      areaMap.setView([lat, lng], Math.max(areaMap.getZoom(), 10));
    }
    renderNearby({ fit: opts.fly !== false });
  }

  // ===== Nearby filtering + rendering =====
  function clearNearbyMarkers() {
    nearbyMarkers.forEach(function (m) { areaMap.removeLayer(m); });
    nearbyMarkers = [];
  }

  // ===== Travel line (shown on hover over a marker or a card) =====
  var travelLine = null;

  // Rough drive estimate from the straight-line distance (no routing API here):
  // add a detour factor and assume a regional average speed.
  function estimateDrive(distKm) {
    var roadKm = distKm * 1.3;                    // road detour over great-circle
    var minutes = Math.max(1, Math.round(roadKm / 70 * 60)); // ~70 km/h avg
    return { roadKm: roadKm, minutes: minutes };
  }

  function formatDrive(distKm) {
    var e = estimateDrive(distKm);
    var t;
    if (e.minutes < 60) {
      t = e.minutes + ' דק׳';
    } else {
      var h = Math.floor(e.minutes / 60);
      var m = e.minutes % 60;
      t = h + ' ש׳' + (m ? ' ' + m + ' דק׳' : '');
    }
    var km = e.roadKm < 10 ? e.roadKm.toFixed(1) : Math.round(e.roadKm);
    return '🚗 כ-' + t + ' · כ-' + km + ' ק״מ';
  }

  function showTravelLine(attraction, distKm) {
    clearTravelLine();
    if (!center || !hasCoords(attraction)) return;
    var c = attraction.coordinates;
    travelLine = L.polyline(
      [[center.lat, center.lng], [c.lat, c.lng]],
      { color: '#1F2937', weight: 3, dashArray: '8, 9', opacity: 0.9 }
    ).addTo(areaMap);
    travelLine.bindTooltip(formatDrive(distKm), {
      permanent: true,
      direction: 'center',
      className: 'travel-tooltip'
    }).openTooltip();
  }

  function clearTravelLine() {
    if (travelLine) {
      areaMap.removeLayer(travelLine);
      travelLine = null;
    }
  }

  function computeNearby() {
    return attractions
      .map(function (a) {
        return {
          attraction: a,
          dist: distanceKm(center.lat, center.lng, a.coordinates.lat, a.coordinates.lng)
        };
      })
      .filter(function (item) { return item.dist <= radiusKm; })
      .sort(function (x, y) { return x.dist - y.dist; });
  }

  function formatDist(km) {
    if (km < 1) return Math.round(km * 1000) + ' מ׳'; // meters
    return (km < 10 ? km.toFixed(1) : Math.round(km)) + ' ק״מ';
  }

  function renderNearby(opts) {
    opts = opts || {};
    if (!center) return;

    var results = computeNearby();
    currentResults = results;

    // --- Map markers (reuse app.js buildAttractionMarker) ---
    clearNearbyMarkers();
    clearTravelLine();
    results.forEach(function (item) {
      var marker = buildAttractionMarker(item.attraction);
      if (!marker) return;
      marker.__dist = item.dist;
      marker.__attraction = item.attraction;
      // Hovering a marker draws the dashed "drive" line from the chosen point.
      marker.on('mouseover', function () {
        showTravelLine(item.attraction, item.dist);
      });
      marker.on('mouseout', clearTravelLine);
      marker.addTo(areaMap);
      nearbyMarkers.push(marker);
    });

    // --- Fit map to center + markers ---
    if (opts.fit !== false) {
      var pts = nearbyMarkers.map(function (m) { return m.getLatLng(); });
      pts.push(L.latLng(center.lat, center.lng));
      if (pts.length > 1) {
        // animate:false → bounds update synchronously, so getBounds() below is
        // correct even if moveend doesn't fire (e.g. bounds unchanged).
        areaMap.fitBounds(L.latLngBounds(pts).pad(0.15), { animate: false });
      }
    }
    // Always render directly; the dedup key makes any moveend echo a no-op.
    renderVisibleCards();
  }

  // Render cards ONLY for attractions currently inside the map viewport, so the
  // list below mirrors exactly what the user sees on the map. Re-runs on zoom/pan.
  function renderVisibleCards() {
    var grid = $('area-results');
    if (!grid || !center) return;

    var bounds = areaMap.getBounds();
    var visible = currentResults.filter(function (item) {
      var c = item.attraction.coordinates;
      return bounds.contains([c.lat, c.lng]);
    });

    // Skip re-render if the visible set is identical (avoids flicker on tiny pans).
    var key = visible.map(function (i) { return i.attraction.id; }).join('|');
    if (key === lastVisibleKey) {
      updateCount(visible.length);
      return;
    }
    lastVisibleKey = key;

    grid.textContent = '';
    if (currentResults.length === 0) {
      grid.appendChild(buildEmptyState(
        '😕',
        'אין אטרקציות ברדיוס של ' + radiusKm + ' ק״מ',
        'נסו להגדיל את הרדיוס או לבחור נקודה אחרת.'
      ));
    } else if (visible.length === 0) {
      grid.appendChild(buildEmptyState(
        '🔍',
        'אין אטרקציות בתצוגה הנוכחית',
        'הזיזו או הקטינו את הזום כדי לראות אטרקציות באזור.'
      ));
    } else {
      visible.forEach(function (item, index) {
        var card = renderAttractionCard(item.attraction, index);
        injectDistance(card, item.dist);
        // Hovering a card also highlights the drive line on the map.
        card.addEventListener('mouseenter', function () {
          showTravelLine(item.attraction, item.dist);
        });
        card.addEventListener('mouseleave', clearTravelLine);
        grid.appendChild(card);
      });
    }

    updateCount(visible.length);
  }

  // Insert a "~X km from the point" line under the card title.
  function injectDistance(card, dist) {
    var line = document.createElement('div');
    line.className = 'card-distance-from-point';
    line.textContent = '📌 כ-' + formatDist(dist) + ' מהנקודה';
    var body = card.querySelector('.card-body');
    var areaEl = card.querySelector('.card-area');
    if (body && areaEl) {
      body.insertBefore(line, areaEl.nextSibling);
    } else if (body) {
      body.insertBefore(line, body.firstChild);
    }
  }

  function buildEmptyState(icon, title, sub) {
    var wrap = document.createElement('div');
    wrap.className = 'empty-state';
    var i = document.createElement('div');
    i.className = 'empty-state-icon';
    i.textContent = icon;
    var t = document.createElement('div');
    t.className = 'empty-state-text';
    t.textContent = title;
    wrap.appendChild(i);
    wrap.appendChild(t);
    if (sub) {
      var s = document.createElement('div');
      s.className = 'empty-state-sub';
      s.textContent = sub;
      wrap.appendChild(s);
    }
    return wrap;
  }

  function updateCount(n) {
    var el = $('area-count');
    if (!el) return;
    if (!center) {
      el.textContent = 'בחרו נקודה כדי להתחיל';
      return;
    }
    var total = currentResults.length;
    if (n === total) {
      el.textContent = 'מציג ' + n + ' אטרקציות ברדיוס ' + radiusKm + ' ק״מ';
    } else {
      el.textContent = 'מציג ' + n + ' מתוך ' + total + ' אטרקציות ברדיוס ' + radiusKm + ' ק״מ (בתצוגה הנוכחית)';
    }
  }

  // ===== Nominatim place search =====
  function runGeocode(query) {
    if (searchAbort) searchAbort.abort();
    searchAbort = new AbortController();

    var url = 'https://nominatim.openstreetmap.org/search' +
      '?format=json&addressdetails=0&limit=5&accept-language=he' +
      '&countrycodes=' + REGION_COUNTRIES +
      '&viewbox=' + REGION_VIEWBOX + '&bounded=0' +
      '&q=' + encodeURIComponent(query);

    fetch(url, { signal: searchAbort.signal, headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (list) { showSuggestions(list || []); })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
        showSuggestions([]);
      });
  }

  function showSuggestions(list) {
    var box = $('place-suggestions');
    if (!box) return;
    box.textContent = '';

    if (!list.length) {
      box.classList.remove('open');
      return;
    }

    list.forEach(function (place) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'place-suggestion';
      item.textContent = place.display_name;
      item.addEventListener('click', function () {
        var input = $('place-search');
        if (input) input.value = place.display_name;
        box.classList.remove('open');
        box.textContent = '';
        setCenter(parseFloat(place.lat), parseFloat(place.lon), { fly: true });
      });
      box.appendChild(item);
    });
    box.classList.add('open');
  }

  function setupSearchBox() {
    var input = $('place-search');
    var box = $('place-suggestions');
    if (!input) return;

    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(searchDebounce);
      if (q.length < 3) {
        if (box) { box.classList.remove('open'); box.textContent = ''; }
        return;
      }
      // Debounce ~450ms to respect Nominatim's 1 req/sec usage policy.
      searchDebounce = setTimeout(function () { runGeocode(q); }, 450);
    });

    // Pressing Enter picks the first suggestion, if any.
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var first = box && box.querySelector('.place-suggestion');
        if (first) first.click();
      }
    });

    // Close suggestions when clicking outside the search widget.
    document.addEventListener('click', function (e) {
      if (box && !e.target.closest('.place-search-wrapper')) {
        box.classList.remove('open');
      }
    });
  }

  // ===== Radius slider =====
  function setupRadiusSlider() {
    var slider = $('radius-slider');
    var label = $('radius-value');
    if (!slider) return;

    radiusKm = parseInt(slider.value, 10) || 30;
    if (label) label.textContent = radiusKm;

    slider.addEventListener('input', function () {
      radiusKm = parseInt(slider.value, 10) || 30;
      if (label) label.textContent = radiusKm;
      if (center) {
        renderRadiusCircle();
        renderNearby({ fit: false });
      } else {
        updateCount(0);
      }
    });
  }

  // ===== Init =====
  function init() {
    initAreaMap();
    setupSearchBox();
    setupRadiusSlider();
    updateCount(0);

    loadData().catch(function (err) {
      console.error('area-explorer: failed to load attractions', err);
      var grid = $('area-results');
      if (grid) {
        grid.textContent = '';
        grid.appendChild(buildEmptyState('⚠️', 'שגיאה בטעינת הנתונים', 'נסו לרענן את הדף.'));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
