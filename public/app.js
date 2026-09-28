// FAU Owl Weather — powered by the free Open-Meteo APIs (no API key needed).
// Forecast:  https://open-meteo.com/en/docs
// Geocoding: https://open-meteo.com/en/docs/geocoding-api

(() => {
  "use strict";

  const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
  const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

  // Default location: Boca Raton, FL (FAU main campus).
  const BOCA = { name: "Boca Raton", region: "Florida", latitude: 26.3683, longitude: -80.1289 };

  const STORAGE_KEY = "fau-weather-prefs";

  // WMO weather interpretation codes -> [description, day icon, night icon]
  const WEATHER_CODES = {
    0: ["Clear sky", "☀️", "🌙"],
    1: ["Mainly clear", "🌤️", "🌙"],
    2: ["Partly cloudy", "⛅", "☁️"],
    3: ["Overcast", "☁️", "☁️"],
    45: ["Fog", "🌫️", "🌫️"],
    48: ["Depositing rime fog", "🌫️", "🌫️"],
    51: ["Light drizzle", "🌦️", "🌧️"],
    53: ["Drizzle", "🌦️", "🌧️"],
    55: ["Dense drizzle", "🌧️", "🌧️"],
    56: ["Freezing drizzle", "🌧️", "🌧️"],
    57: ["Dense freezing drizzle", "🌧️", "🌧️"],
    61: ["Light rain", "🌦️", "🌧️"],
    63: ["Rain", "🌧️", "🌧️"],
    65: ["Heavy rain", "🌧️", "🌧️"],
    66: ["Freezing rain", "🌧️", "🌧️"],
    67: ["Heavy freezing rain", "🌧️", "🌧️"],
    71: ["Light snow", "🌨️", "🌨️"],
    73: ["Snow", "🌨️", "🌨️"],
    75: ["Heavy snow", "❄️", "❄️"],
    77: ["Snow grains", "🌨️", "🌨️"],
    80: ["Light showers", "🌦️", "🌧️"],
    81: ["Showers", "🌧️", "🌧️"],
    82: ["Violent showers", "⛈️", "⛈️"],
    85: ["Snow showers", "🌨️", "🌨️"],
    86: ["Heavy snow showers", "❄️", "❄️"],
    95: ["Thunderstorm", "⛈️", "⛈️"],
    96: ["Thunderstorm with hail", "⛈️", "⛈️"],
    99: ["Severe thunderstorm with hail", "⛈️", "⛈️"],
  };

  const $ = (id) => document.getElementById(id);

  const state = {
    place: BOCA,
    unit: "fahrenheit",
    data: null,
  };

  // ---------- Preferences (per-browser convenience only; the app always opens on Boca) ----------
  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (saved.unit === "celsius" || saved.unit === "fahrenheit") state.unit = saved.unit;
    } catch (_) { /* storage unavailable — use defaults */ }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ unit: state.unit }));
    } catch (_) { /* ignore */ }
  }

  // ---------- Helpers ----------
  function describe(code, isDay = 1) {
    const entry = WEATHER_CODES[code] || ["Unknown", "🌡️", "🌡️"];
    return { text: entry[0], icon: isDay ? entry[1] : entry[2] };
  }

  function setStatus(msg, isError = false) {
    const el = $("status");
    el.textContent = msg;
    el.classList.toggle("error", isError);
  }

  const deg = (v) => `${Math.round(v)}°`;

  // Open-Meteo returns local times like "2026-09-28T14:00" already in the
  // location's timezone (timezone=auto), so parse the parts directly instead
  // of letting the browser apply its own timezone.
  function parseLocal(iso) {
    const [d, t = "00:00"] = iso.split("T");
    const [y, m, day] = d.split("-").map(Number);
    const [h, min] = t.split(":").map(Number);
    return { y, m, day, h, min };
  }

  function formatHour(iso) {
    const { h } = parseLocal(iso);
    const suffix = h < 12 ? "AM" : "PM";
    return `${h % 12 || 12} ${suffix}`;
  }

  function formatClock(iso) {
    const { h, min } = parseLocal(iso);
    const suffix = h < 12 ? "AM" : "PM";
    return `${h % 12 || 12}:${String(min).padStart(2, "0")} ${suffix}`;
  }

  function dayName(iso, index) {
    if (index === 0) return "Today";
    const { y, m, day } = parseLocal(iso);
    return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  }

  function compassDir(degrees) {
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return dirs[Math.round(degrees / 22.5) % 16];
  }

  function uvLabel(uv) {
    if (uv < 3) return "Low";
    if (uv < 6) return "Moderate";
    if (uv < 8) return "High";
    if (uv < 11) return "Very high";
    return "Extreme";
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // ---------- API ----------
  async function fetchForecast(place, unit) {
    const params = new URLSearchParams({
      latitude: place.latitude,
      longitude: place.longitude,
      current: [
        "temperature_2m", "relative_humidity_2m", "apparent_temperature", "is_day",
        "precipitation", "weather_code", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
      ].join(","),
      hourly: ["temperature_2m", "precipitation_probability", "weather_code", "is_day"].join(","),
      daily: [
        "weather_code", "temperature_2m_max", "temperature_2m_min", "sunrise", "sunset",
        "uv_index_max", "precipitation_probability_max",
      ].join(","),
      temperature_unit: unit,
      wind_speed_unit: unit === "fahrenheit" ? "mph" : "kmh",
      precipitation_unit: unit === "fahrenheit" ? "inch" : "mm",
      timezone: "auto",
      forecast_days: 7,
    });
    const res = await fetch(`${FORECAST_URL}?${params}`);
    if (!res.ok) throw new Error(`Forecast request failed (${res.status})`);
    return res.json();
  }

  async function geocode(query) {
    const params = new URLSearchParams({ name: query, count: 8, language: "en", format: "json" });
    const res = await fetch(`${GEOCODE_URL}?${params}`);
    if (!res.ok) throw new Error(`Search failed (${res.status})`);
    const json = await res.json();
    return json.results || [];
  }

  // ---------- Rendering ----------
  function render() {
    const d = state.data;
    if (!d) return;
    const cur = d.current;
    const units = d.current_units;
    const { text, icon } = describe(cur.weather_code, cur.is_day);

    $("place-name").textContent = [state.place.name, state.place.region].filter(Boolean).join(", ");
    $("updated").textContent = `Updated ${formatClock(cur.time)} local time`;
    $("current-icon").textContent = icon;
    $("current-temp").textContent = deg(cur.temperature_2m) + (state.unit === "fahrenheit" ? "F" : "C");
    $("current-desc").textContent = text;
    $("hi-lo").textContent = `High ${deg(d.daily.temperature_2m_max[0])} · Low ${deg(d.daily.temperature_2m_min[0])}`;
    $("feels").textContent = deg(cur.apparent_temperature);
    $("humidity").textContent = `${cur.relative_humidity_2m}%`;
    $("wind").textContent = `${Math.round(cur.wind_speed_10m)} ${units.wind_speed_10m.replace("mp/h", "mph")} ${compassDir(cur.wind_direction_10m)}`
      + (cur.wind_gusts_10m ? ` (gusts ${Math.round(cur.wind_gusts_10m)})` : "");
    $("precip").textContent = `${cur.precipitation} ${units.precipitation === "inch" ? "in" : units.precipitation}`;
    const uv = d.daily.uv_index_max[0] ?? 0;
    $("uv").textContent = `${Math.round(uv)} · ${uvLabel(uv)}`;
    $("sun").textContent = `${formatClock(d.daily.sunrise[0])} / ${formatClock(d.daily.sunset[0])}`;

    renderHourly(d);
    renderDaily(d);
    document.title = `${deg(cur.temperature_2m)} ${state.place.name} · FAU Owl Weather`;
  }

  function renderHourly(d) {
    const container = $("hourly");
    container.replaceChildren();
    // Start at the current hour in the location's timezone.
    const nowHour = d.current.time.slice(0, 13);
    let start = d.hourly.time.findIndex((t) => t.slice(0, 13) === nowHour);
    if (start < 0) start = 0;
    for (let i = start; i < Math.min(start + 24, d.hourly.time.length); i++) {
      const { icon, text } = describe(d.hourly.weather_code[i], d.hourly.is_day[i]);
      const card = el("div", "hour");
      card.title = text;
      card.append(
        el("div", "t", i === start ? "Now" : formatHour(d.hourly.time[i])),
        el("div", "i", icon),
        el("div", "v", deg(d.hourly.temperature_2m[i])),
        el("div", "p", `💧${d.hourly.precipitation_probability[i] ?? 0}%`),
      );
      container.append(card);
    }
  }

  function renderDaily(d) {
    const list = $("daily");
    list.replaceChildren();
    const mins = d.daily.temperature_2m_min;
    const maxs = d.daily.temperature_2m_max;
    const weekLo = Math.min(...mins);
    const weekHi = Math.max(...maxs);
    const span = Math.max(weekHi - weekLo, 1);

    d.daily.time.forEach((day, i) => {
      const { icon, text } = describe(d.daily.weather_code[i], 1);
      const row = el("li", "day");
      const range = el("div", "range");
      const bar = el("div", "bar");
      const fill = el("div", "fill");
      fill.style.left = `${((mins[i] - weekLo) / span) * 100}%`;
      fill.style.right = `${((weekHi - maxs[i]) / span) * 100}%`;
      bar.append(fill);
      range.append(el("span", "lo", deg(mins[i])), bar, el("span", "hi", deg(maxs[i])));

      row.append(
        el("span", "name", dayName(day, i)),
        el("span", "i", icon),
        el("span", "d", text),
        el("span", "p", `💧${d.daily.precipitation_probability_max[i] ?? 0}%`),
        range,
      );
      list.append(row);
    });
  }

  async function refresh() {
    setStatus("Loading forecast…");
    try {
      state.data = await fetchForecast(state.place, state.unit);
      render();
      setStatus("");
      savePrefs();
    } catch (err) {
      console.error(err);
      setStatus("Couldn't load the forecast. Check your connection and try again.", true);
    }
  }

  // ---------- Search ----------
  const resultsEl = $("search-results");
  let lastResults = [];

  function hideResults() {
    resultsEl.hidden = true;
    resultsEl.replaceChildren();
  }

  function showResults(results) {
    lastResults = results;
    resultsEl.replaceChildren();
    if (!results.length) {
      const li = el("li", "", "No matching places found.");
      li.setAttribute("aria-disabled", "true");
      resultsEl.append(li);
    }
    results.forEach((r, i) => {
      const li = el("li");
      li.setAttribute("role", "option");
      li.dataset.index = i;
      const where = [r.admin1, r.country].filter(Boolean).join(", ");
      li.append(document.createTextNode(r.name + " "), el("small", "", where));
      resultsEl.append(li);
    });
    resultsEl.hidden = false;
  }

  function choose(result) {
    state.place = {
      name: result.name,
      region: result.country_code === "US" ? result.admin1 : [result.admin1, result.country].filter(Boolean).join(", "),
      latitude: result.latitude,
      longitude: result.longitude,
    };
    hideResults();
    $("search-input").value = "";
    refresh();
  }

  $("search-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("search-input").value.trim();
    if (q.length < 2) { setStatus("Type at least 2 characters to search.", true); return; }
    setStatus("Searching…");
    try {
      const results = await geocode(q);
      setStatus("");
      if (results.length === 1) choose(results[0]);
      else showResults(results);
    } catch (err) {
      console.error(err);
      setStatus("Search failed. Please try again.", true);
    }
  });

  resultsEl.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-index]");
    if (li) choose(lastResults[Number(li.dataset.index)]);
  });

  document.addEventListener("click", (e) => {
    if (!$("search-form").contains(e.target)) hideResults();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideResults(); });

  // ---------- Location buttons ----------
  $("home-btn").addEventListener("click", () => {
    state.place = BOCA;
    refresh();
  });

  $("locate-btn").addEventListener("click", () => {
    if (!navigator.geolocation) { setStatus("Geolocation isn't supported by this browser.", true); return; }
    setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.place = {
          name: "My location",
          region: "",
          latitude: Number(pos.coords.latitude.toFixed(4)),
          longitude: Number(pos.coords.longitude.toFixed(4)),
        };
        refresh();
      },
      () => setStatus("Couldn't get your location. Showing the last place instead.", true),
      { timeout: 10000, maximumAge: 600000 },
    );
  });

  // ---------- Units ----------
  const unitButtons = document.querySelectorAll(".unit-toggle button");
  function syncUnitButtons() {
    unitButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.unit === state.unit)));
  }
  unitButtons.forEach((btn) => btn.addEventListener("click", () => {
    if (btn.dataset.unit === state.unit) return;
    state.unit = btn.dataset.unit;
    syncUnitButtons();
    refresh();
  }));

  // ---------- Start ----------
  loadPrefs();
  syncUnitButtons();
  refresh();
  // Refresh every 15 minutes while the page is open.
  setInterval(refresh, 15 * 60 * 1000);
})();
