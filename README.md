# ISM4421 — FAU Owl Weather 🦉

A weather app in Florida Atlantic University colors. It opens on **Boca Raton, FL** (FAU's main campus) and runs on the free
[Open-Meteo](https://open-meteo.com/) APIs, which need no account or API key.

## Features
- Current conditions: temperature, feels-like, humidity, wind and gusts, precipitation, UV index, sunrise and sunset
- Hourly forecast for the next 24 hours
- 7-day forecast with high/low range bars
- City search (Open-Meteo Geocoding API)
- "My location" button (browser geolocation) and a "Boca" button to jump back to campus
- °F / °C toggle (your choice is remembered in the browser)
- Refreshes itself every 15 minutes; works on phones; supports dark mode

## Project layout
```
netlify.toml          Netlify config: publish folder, security headers, caching
public/
  index.html          Page markup
  styles.css          FAU branding (FAU Blue #003366, FAU Red #CC0000)
  app.js              Open-Meteo API calls and rendering
  assets/fau-logo.svg Logo (also the favicon)
```
It's plain HTML/CSS/JS with **no build step and no dependencies**.

## Run locally
Any static server works, for example:
```bash
npx serve public
# or
python3 -m http.server 8080 --directory public
```

## Deploy to Netlify
**Option A: connect the GitHub repo (recommended)**
1. In Netlify, choose **Add new site → Import an existing project → GitHub** and pick this repository/branch.
2. Netlify reads `netlify.toml` on its own: **Build command** empty, **Publish directory** `public`.
3. Click **Deploy**. Every later push redeploys the site.

**Option B: drag and drop**
Drag the `public/` folder onto https://app.netlify.com/drop. (With this option `netlify.toml` isn't used, so the custom headers aren't applied.)

**Option C: Netlify CLI**
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=public
```

## Logo
`public/assets/fau-logo.svg` is a **placeholder** owl mark in FAU colors. To use the official FAU logo, download it from FAU's
brand resources and save it over that file with the same name, or change the `src` in `index.html`.
If the official file is a PNG, update both `<img>` and `<link rel="icon">` in `index.html`.

## APIs used
- Forecast: `https://api.open-meteo.com/v1/forecast`
- Geocoding: `https://geocoding-api.open-meteo.com/v1/search`

Weather data by Open-Meteo.com, licensed CC BY 4.0.
