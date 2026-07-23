/**
 * area-explorer.js — Dynamic "What's around?" page (explore.html)
 *
 * The map viewport IS the filter: at any zoom/pan, only the attractions inside
 * the current view are shown — both as map markers and as cards below the map —
 * and they update live as the user moves the map. Searching a place (OpenStreetMap
 * Nominatim) or clicking/dragging sets an optional anchor point used for
 * distances and the dashed drive line.
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
  var markersById = {};        // attraction id -> Leaflet marker (lazy cache, reused across renders)
  var shownIds = [];           // ids of attraction markers currently on the map
  var centerMarker = null;     // draggable marker for the chosen anchor point
  var center = null;           // { lat, lng } chosen anchor point (optional)
  var lastViewKey = null;      // signature of last render (skip identical re-renders)
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

    // Click anywhere on the map to choose that point as the anchor (for
    // distances / drive lines). It does NOT filter — the viewport does that.
    areaMap.on('click', function (e) {
      setCenter(e.latlng.lat, e.latlng.lng, { fly: false });
    });

    // The map viewport IS the filter: on every zoom/pan, re-render both the
    // markers and the cards so only what's in the current view is shown.
    areaMap.on('moveend', renderInView);
  }

  // ===== Anchor point (for distances + drive lines) =====
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

    // Dragging the anchor updates distances/drive-lines live.
    centerMarker.on('drag', function (e) {
      var p = e.target.getLatLng();
      center = { lat: p.lat, lng: p.lng };
    });
    centerMarker.on('dragend', function () {
      lastViewKey = null;   // distances changed → force re-render
      renderInView();
    });
  }

  // Set the chosen anchor point (for distances + drive lines). The viewport,
  // not this point, decides which attractions are shown.
  function setCenter(lat, lng, opts) {
    opts = opts || {};
    center = { lat: lat, lng: lng };
    lastViewKey = null;  // distances changed → force re-render

    ensureCenterMarker();
    centerMarker.setLatLng([lat, lng]);

    if (opts.fly) {
      // Zoom in around the chosen place. animate:false → bounds update
      // synchronously so the render below uses the correct (new) viewport.
      areaMap.setView([lat, lng], Math.max(areaMap.getZoom(), 10), { animate: false });
    }
    renderInView();
  }

  // ===== Viewport-driven filtering + rendering =====
  // Get (or lazily build & cache) the marker for an attraction. Markers are
  // reused across renders so panning back and forth is cheap and flicker-free.
  function getMarker(a) {
    if (markersById[a.id]) return markersById[a.id];
    var marker = buildAttractionMarker(a);
    if (!marker) return null;
    marker.__attraction = a;
    marker.on('mouseover', function () {
      showTravelLine(a, center ? distanceKm(center.lat, center.lng, a.coordinates.lat, a.coordinates.lng) : null);
    });
    marker.on('mouseout', clearTravelLine);
    markersById[a.id] = marker;
    return marker;
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

  // Prefer the Hebrew name; fall back to the English one.
  function attractionName(attraction) {
    return attraction.nameHebrew || attraction.name || 'היעד';
  }

  function esc(s) {
    return (typeof escapeHtml === 'function') ? escapeHtml(s) : String(s);
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

  // Two-line label: destination name on top, drive time + distance below.
  function travelTooltipHtml(attraction, distKm) {
    return '<span class="travel-dest">📍 ' + esc(attractionName(attraction)) + '</span>' +
           '<span class="travel-meta">' + formatDrive(distKm) + '</span>';
  }

  function showTravelLine(attraction, distKm) {
    clearTravelLine();
    if (!center || !hasCoords(attraction)) return;
    var c = attraction.coordinates;
    travelLine = L.polyline(
      [[center.lat, center.lng], [c.lat, c.lng]],
      { color: '#1F2937', weight: 3, dashArray: '8, 9', opacity: 0.9 }
    ).addTo(areaMap);
    travelLine.bindTooltip(travelTooltipHtml(attraction, distKm), {
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

  function formatDist(km) {
    if (km < 1) return Math.round(km * 1000) + ' מ׳'; // meters
    return (km < 10 ? km.toFixed(1) : Math.round(km)) + ' ק״מ';
  }

  // THE core function: show ONLY attractions inside the current map viewport,
  // both as markers and as cards. Re-runs on every zoom/pan (moveend).
  function renderInView() {
    if (!areaMap) return;
    var grid = $('area-results');
    var bounds = areaMap.getBounds();

    // Which attractions fall inside the current view?
    var inView = attractions.filter(function (a) {
      return bounds.contains([a.coordinates.lat, a.coordinates.lng]);
    });

    // If an anchor point is chosen, annotate with distance and sort by nearest.
    inView = inView.map(function (a) {
      return {
        attraction: a,
        dist: center ? distanceKm(center.lat, center.lng, a.coordinates.lat, a.coordinates.lng) : null
      };
    });
    if (center) {
      inView.sort(function (x, y) { return x.dist - y.dist; });
    }

    // Skip a full re-render if the visible set is unchanged (avoids flicker).
    var key = (center ? 'c' : 'n') + ':' + inView.map(function (i) { return i.attraction.id; }).join('|');
    if (key === lastViewKey) return;
    lastViewKey = key;

    // --- Sync markers: add newly-visible, remove now-hidden (reuse cache) ---
    var wantIds = {};
    inView.forEach(function (item) {
      var a = item.attraction;
      wantIds[a.id] = true;
      if (shownIds.indexOf(a.id) === -1) {
        var marker = getMarker(a);
        if (marker) marker.addTo(areaMap);
      }
    });
    shownIds.filter(function (id) { return !wantIds[id]; })
      .forEach(function (id) {
        if (markersById[id]) areaMap.removeLayer(markersById[id]);
      });
    shownIds = Object.keys(wantIds);
    clearTravelLine();

    // --- Cards: exactly mirror what's on the map ---
    if (grid) {
      grid.textContent = '';
      if (inView.length === 0) {
        grid.appendChild(buildEmptyState(
          '🔍',
          'אין אטרקציות בתצוגה הנוכחית',
          'הזיזו את המפה או הקטינו את הזום כדי לראות אטרקציות באזור.'
        ));
      } else {
        inView.forEach(function (item, index) {
          var card = renderAttractionCard(item.attraction, index);
          if (item.dist != null) injectDistance(card, item.dist);
          card.addEventListener('mouseenter', function () {
            showTravelLine(item.attraction, item.dist);
          });
          card.addEventListener('mouseleave', clearTravelLine);
          grid.appendChild(card);
        });
      }
    }

    updateCount(inView.length);
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
    if (n === 0) {
      el.textContent = 'אין אטרקציות בתצוגה הנוכחית';
    } else if (n === 1) {
      el.textContent = 'אטרקציה אחת בתצוגה הנוכחית';
    } else {
      el.textContent = n + ' אטרקציות בתצוגה הנוכחית';
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

  // ===== Init =====
  function init() {
    initAreaMap();
    setupSearchBox();

    var grid = $('area-results');
    if (grid) {
      grid.textContent = '';
      grid.appendChild(buildEmptyState('⏳', 'טוען אטרקציות…', ''));
    }

    loadData()
      .then(function () {
        // Populate immediately from the default view — no need to pick a point
        // first. Panning/zooming then updates markers + cards live.
        renderInView();
      })
      .catch(function (err) {
        console.error('area-explorer: failed to load attractions', err);
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
