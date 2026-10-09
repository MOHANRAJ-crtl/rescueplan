(() => {
  'use strict';

  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');

  if (!app || !modalRoot) return;

  const emptyState = () => ({
    drivers: [],
    vehicles: [],
    incidents: []
  });

  let snapshot = {
    session: null,
    state: emptyState()
  };

  let pullJob = null;
  let contextVersion = 0;
  let activeRoot = false;

  const bridge = {
    read: () => snapshot,
    request
  };

  const gpsFields = [
    'latitude',
    'longitude',
    'accuracyMeters',
    'positionTimestamp'
  ];

  let owner = null;
  let timer = null;
  let job = null;
  let generation = 0;
  let stopping = false;

  let map = null;
  let fitted = false;
  let mapAccount = null;
  let points = [];

  const markers = new Map();
  const panel = document.createElement('section');

  panel.className = 'tracking-panel';
  panel.setAttribute('aria-label', 'Vehicle locations');

  panel.innerHTML = `
    <div class="tracking-head">
      <div>
        <h2>Vehicle map</h2>
        <p id="gps-map-status" role="status">
          Waiting for shared locations.
        </p>
      </div>

      <button
        type="button"
        class="btn btn-light btn-sm"
        id="gps-fit"
      >
        Fit all locations
      </button>
    </div>

    <div class="tracking-controls" id="gps-controls" hidden>
      <button
        type="button"
        class="btn btn-primary"
        id="gps-start"
      >
        Start location sharing
      </button>

      <button
        type="button"
        class="btn btn-light"
        id="gps-stop"
        disabled
      >
        Stop sharing
      </button>

      <span
        id="gps-sharing-status"
        role="status"
        aria-live="polite"
      >
        Location sharing is off.
      </span>
    </div>

    <div id="gps-vehicle-map" class="tracking-map"></div>

    <p class="tracking-help">
      Green: recent shared GPS · Grey: last known position ·
      Red: reported breakdown.
      Tap a vehicle for its driver, registration and GPS accuracy.
    </p>
  `;

  const element = id => panel.querySelector('#' + id);

  const currentDriver = () => {
    const {session, state} = bridge.read();

    return state.drivers.find(
      d => d.id === session?.driverId
    );
  };

  async function fetchJSON(
    path,
    method = 'GET',
    data,
    csrfToken
  ) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      12000
    );

    const headers = {};

    if (data !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    try {
      const response = await fetch(path, {
        method,
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        ...(data !== undefined
          ? {body: JSON.stringify(data)}
          : {})
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(
          result.detail || `Request failed (${response.status}).`
        );

        error.status = response.status;
        throw error;
      }

      return result;
    } catch (error) {
      if (
        error.name === 'AbortError'
        || error instanceof TypeError
      ) {
        throw new Error(
          'Cannot reach the server. Check your connection and try again.'
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function request(path, method, data) {
    const expected = snapshot.session?.id;
    const version = contextVersion;

    if (!expected) {
      throw new Error(
        'Sign in before sharing your location.'
      );
    }

    try {
      const auth = await fetchJSON('/api/auth/me');

      if (version !== contextVersion || !activeRoot) {
        throw new Error(
          'Your session changed. Start location sharing again.'
        );
      }

      if (auth.user.id !== expected) {
        resetTracking();

        throw new Error(
          'Your account changed. Start location sharing again.'
        );
      }

      return await fetchJSON(
        path,
        method,
        data,
        auth.csrfToken
      );
    } catch (error) {
      if (error.status === 401) resetTracking();
      throw error;
    }
  }

  function resetTracking() {
    contextVersion++;

    snapshot = {
      session: null,
      state: emptyState()
    };

    pauseLocal();
    message('Location sharing is off.');

    if (map) {
      for (const marker of markers.values()) {
        map.removeLayer(marker);
      }

      map.closePopup();
    }

    markers.clear();
    points = [];
    fitted = false;
    mapAccount = null;

    element('gps-map-status').textContent =
      'Sign in to load vehicle locations.';
  }

  function refreshTracking() {
    if (pullJob || !activeRoot || document.hidden) {
      return pullJob;
    }

    const version = contextVersion;

    pullJob = (async () => {
      try {
        const next = await fetchJSON('/api/state');

        if (
          version !== contextVersion
          || !document.getElementById('main')
        ) return;

        snapshot = {
          session: next.user,
          state: next
        };

        syncView();
      } catch (error) {
        if (version !== contextVersion) return;

        if (error.status === 401) {
          resetTracking();
        } else {
          element('gps-map-status').textContent =
            'Map updates paused. ' + error.message;
        }
      }
    })().finally(() => {
      pullJob = null;
    });

    return pullJob;
  }

  function message(text) {
    element('gps-sharing-status').textContent = text;
  }

  function sameOwner() {
    const session = bridge.read().session;

    return owner
      && session?.role === 'driver'
      && session.id === owner.id
      && session.driverId === owner.driverId;
  }

  function controls() {
    element('gps-controls').hidden =
      bridge.read().session?.role !== 'driver';

    element('gps-start').disabled =
      Boolean(owner) || stopping;

    element('gps-stop').disabled =
      !owner || stopping;
  }

  function pauseLocal() {
    generation++;

    clearInterval(timer);
    timer = null;
    owner = null;

    controls();
  }

  function gpsError(error) {
    if (error.code === 1) {
      return 'Location permission denied. Allow location for this website in your browser settings.';
    }

    if (error.code === 2) {
      return 'Location unavailable. Turn on your phone location and try again.';
    }

    if (error.code === 3) {
      return 'Location timed out. Move to an open area and try again.';
    }

    return error.message || 'Could not obtain your location.';
  }

  function getGPS() {
    return new Promise((resolve, reject) => {
      if (!window.isSecureContext) {
        return reject(
          new Error(
            'Open the HTTPS website to use location.'
          )
        );
      }

      if (!navigator.geolocation) {
        return reject(
          new Error(
            'This browser does not support location.'
          )
        );
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            positionTimestamp: position.timestamp
          });
        },
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  }

  const locationText = gps =>
    `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`;

  function addGPSButton(form, input) {
    if (
      !form
      || !input
      || form.querySelector('.gps-fill-button')
    ) return;

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'btn btn-light gps-fill-button';
    button.textContent = 'Use current location';

    const status = document.createElement('small');

    status.className = 'gps-field-status';
    status.setAttribute('role', 'status');

    input.insertAdjacentElement('afterend', button);
    button.insertAdjacentElement('afterend', status);

    input.addEventListener('input', () => {
      form.querySelectorAll('[data-gps-field]')
        .forEach(field => field.remove());

      status.textContent =
        'Manual location. Use current location to attach a GPS pin.';
    });

    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = 'Finding your location…';

      try {
        const gps = await getGPS();

        if (!form.isConnected) return;

        input.value = locationText(gps);

        for (const name of gpsFields) {
          let field = form.querySelector(
            `[data-gps-field="${name}"]`
          );

          if (!field) {
            field = document.createElement('input');
            field.type = 'hidden';
            field.name = name;
            field.dataset.gpsField = name;

            form.append(field);
          }

          field.value = String(gps[name]);
        }

        status.textContent =
          `GPS captured. Approximate accuracy: ±${Math.round(gps.accuracyMeters)} m.`;
      } catch (error) {
        if (form.isConnected) {
          status.textContent = gpsError(error);
        }
      } finally {
        button.disabled = false;
      }
    });
  }

  function attachForms() {
    addGPSButton(
      document.getElementById('report-form'),
      document.getElementById('report-location')
    );

    addGPSButton(
      document.getElementById('location-form'),
      document.getElementById('current-location')
    );
  }

  function sample() {
    if (
      job
      || !sameOwner()
      || document.hidden
    ) return job;

    const version = generation;

    job = (async () => {
      try {
        const gps = await getGPS();

        if (
          version !== generation
          || !sameOwner()
        ) return;

        const payload = {
          location: locationText(gps),
          ...gps,
          trackingEnabled: true
        };

        const result = await bridge.request(
          '/api/me/location',
          'PATCH',
          payload
        );

        if (
          version !== generation
          || !sameOwner()
        ) return;

        const driver = currentDriver();

        if (driver) {
          Object.assign(driver, payload, {
            gpsUpdatedAt: result.gpsUpdatedAt
          });
        }

        message(
          `Sharing location · accuracy ±${Math.round(gps.accuracyMeters)} m.`
        );

        updateMap();
      } catch (error) {
        if (version === generation) {
          if (error.code === 1) pauseLocal();

          message(gpsError(error));
        }
      }
    })().finally(() => {
      job = null;
    });

    return job;
  }

  element('gps-start').addEventListener('click', () => {
    const session = bridge.read().session;

    if (
      owner
      || stopping
      || session?.role !== 'driver'
    ) return;

    owner = {
      id: session.id,
      driverId: session.driverId
    };

    generation++;

    message('Requesting location permission…');
    controls();

    sample();
    timer = setInterval(sample, 10000);
  });

  element('gps-stop').addEventListener('click', async () => {
    if (!sameOwner() || stopping) return;

    const previous = {...owner};

    stopping = true;
    pauseLocal();

    message('Stopping location sharing…');

    try {
      if (job) await job;

      const session = bridge.read().session;

      if (
        session?.id !== previous.id
        || session.driverId !== previous.driverId
      ) return;

      const driver = currentDriver();

      await bridge.request(
        '/api/me/location',
        'PATCH',
        {
          location: driver?.location || 'Last shared location',
          trackingEnabled: false
        }
      );

      if (
        bridge.read().session?.id !== previous.id
      ) return;

      const latest = currentDriver();

      if (latest) latest.trackingEnabled = false;

      message('Location sharing stopped.');
      updateMap();
    } catch (error) {
      message(
        'Sharing stopped on this phone. ' + gpsError(error)
      );
    } finally {
      stopping = false;
      controls();
    }
  });

  function hasGPS(item) {
    return typeof item.latitude === 'number'
      && Number.isFinite(item.latitude)
      && Math.abs(item.latitude) <= 90
      && typeof item.longitude === 'number'
      && Number.isFinite(item.longitude)
      && Math.abs(item.longitude) <= 180;
  }

  function gpsAge(item) {
    const received = Date.parse(
      item.gpsUpdatedAt || item.reportedAt || ''
    );

    if (!Number.isFinite(received)) return Infinity;

    const captured = Number.isFinite(item.positionTimestamp)
      ? Math.min(item.positionTimestamp, received)
      : received;

    return Math.max(
      0,
      (Date.now() - captured) / 1000
    );
  }

  function popup(title, lines) {
    const content = document.createElement('div');
    const strong = document.createElement('strong');

    strong.textContent = title;
    content.append(strong);

    for (const line of lines) {
      const p = document.createElement('p');

      p.textContent = line;
      content.append(p);
    }

    return content;
  }

  function fitLocations() {
    if (!map || !points.length) return;

    map.fitBounds(
      window.L.latLngBounds(points),
      {
        padding: [35, 35],
        maxZoom: 16
      }
    );

    fitted = true;
  }

  element('gps-fit').addEventListener(
    'click',
    fitLocations
  );

  function updateMap() {
    if (!map || !panel.isConnected) return;

    const {session, state} = bridge.read();

    if (!session) return;

    if (mapAccount !== session.id) {
      for (const marker of markers.values()) {
        map.removeLayer(marker);
      }

      markers.clear();
      map.closePopup();

      fitted = false;
      mapAccount = session.id;

      map.setView([11.6643, 78.146], 12);
    }

    const wanted = new Set();

    points = [];

    let recent = 0;
    let known = 0;

    for (const driver of state.drivers) {
      if (!hasGPS(driver)) continue;

      const key = 'driver:' + driver.id;

      wanted.add(key);

      const position = [
        driver.latitude,
        driver.longitude
      ];

      points.push(position);

      const age = gpsAge(driver);

      const live =
        driver.trackingEnabled === true
        && age <= 45;

      if (live) recent++;
      else known++;

      const icon = window.L.divIcon({
        className: 'gps-marker',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        html: `
          <span class="gps-vehicle-pin ${live ? 'recent' : 'last-known'}">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <path d="M3 6h12v11H3zm12 4h4l3 4v3h-7"/>
              <circle cx="7" cy="18" r="2"/>
              <circle cx="18" cy="18" r="2"/>
            </svg>
          </span>
        `
      });

      let marker = markers.get(key);

      if (!marker) {
        marker = window.L.marker(
          position,
          {icon}
        ).addTo(map);

        markers.set(key, marker);
      } else {
        marker.setLatLng(position);
        marker.setIcon(icon);
      }

      const vehicle = state.vehicles.find(
        v => v.id === driver.vehicleId
      );

      const seen = Number.isFinite(age)
        ? `${Math.floor(age / 60)} min ${Math.floor(age % 60)} sec ago`
        : 'Time unavailable';

      const accuracy =
        Number.isFinite(driver.accuracyMeters)
          ? `GPS accuracy: ±${Math.round(driver.accuracyMeters)} m`
          : 'GPS accuracy unavailable';

      marker.bindPopup(
        popup(driver.name, [
          vehicle?.registration || 'Vehicle',
          driver.status || '',
          live
            ? 'Recent shared GPS'
            : 'Last known position',
          'GPS captured: ' + seen,
          accuracy
        ])
      );
    }

    for (const incident of state.incidents) {
      if (
        ['Resolved', 'Rejected'].includes(incident.status)
        || !hasGPS(incident)
      ) continue;

      const key = 'incident:' + incident.id;

      wanted.add(key);

      const position = [
        incident.latitude,
        incident.longitude
      ];

      points.push(position);

      let marker = markers.get(key);

      if (!marker) {
        marker = window.L.circleMarker(
          position,
          {
            radius: 13,
            color: '#b42336',
            weight: 3,
            fillColor: '#b42336',
            fillOpacity: 0.2
          }
        ).addTo(map);

        markers.set(key, marker);
      } else {
        marker.setLatLng(position);
      }

      marker.bindPopup(
        popup('Reported breakdown', [
          incident.type,
          incident.location,
          incident.status
        ])
      );
    }

    for (const [key, marker] of markers) {
      if (!wanted.has(key)) {
        map.removeLayer(marker);
        markers.delete(key);
      }
    }

    element('gps-map-status').textContent = points.length
      ? `${recent} vehicle(s) with recent shared GPS · ${known} last known position(s).`
      : 'No GPS locations shared yet. The overview is centred on Salem.';

    if (points.length && !fitted) fitLocations();
  }

  function syncView() {
    const {session} = bridge.read();

    if (owner && !sameOwner()) {
      pauseLocal();
      message('Location sharing is off.');
    }

    const main = document.getElementById('main');

    if (!main || !session) return;

    if (!main.contains(panel)) {
      const schematic = main.querySelector(
        '.network.command-network'
      );

      if (schematic) {
        schematic.replaceWith(panel);
      } else {
        main.insertBefore(
          panel,
          main.querySelector('.content-footer')
        );
      }
    }

    controls();

    if (!window.L) {
      element('gps-map-status').textContent =
        'Map unavailable. Check your internet connection.';

      return;
    }

    if (!map) {
      map = window.L.map(
        element('gps-vehicle-map')
      ).setView(
        [11.6643, 78.146],
        12
      );

      window.L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        }
      ).addTo(map);
    }

    requestAnimationFrame(() => {
      if (panel.isConnected) map.invalidateSize();
    });

    updateMap();
  }

  function sync() {
    const main = document.getElementById('main');

    if (!main) {
      if (activeRoot || snapshot.session) {
        resetTracking();
      }

      activeRoot = false;
      return;
    }

    activeRoot = true;

    syncView();
    refreshTracking();
  }

  new MutationObserver(sync).observe(
    app,
    {childList: true}
  );

  new MutationObserver(attachForms).observe(
    modalRoot,
    {childList: true}
  );

  setInterval(sync, 5000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      sample();
      sync();
    }
  });

  window.addEventListener('pagehide', pauseLocal);

  sync();
  attachForms();
})();