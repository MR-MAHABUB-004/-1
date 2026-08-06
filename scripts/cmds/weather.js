"use strict";

const https = require("https");

function fetchWeather(location) {
  return new Promise((resolve, reject) => {
    const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;
    https.get(url, { headers: { "User-Agent": "curl/7.68.0" } }, res => {
      let buf = "";
      res.on("data", c => buf += c);
      res.on("end", () => {
        try { resolve(JSON.parse(buf)); }
        catch { reject(new Error("Could not parse weather data")); }
      });
    }).on("error", reject);
  });
}

const DIRECTIONS = ["N","NE","E","SE","S","SW","W","NW"];
function degToDir(deg) {
  return DIRECTIONS[Math.round(deg / 45) % 8];
}

function weatherEmoji(code) {
  const n = parseInt(code);
  if (n === 113) return "☀️";
  if (n === 116) return "⛅";
  if ([119,122].includes(n)) return "☁️";
  if ([143,248,260].includes(n)) return "🌫️";
  if ([176,263,266,293,296].includes(n)) return "🌦️";
  if ([299,302,305,308].includes(n)) return "🌧️";
  if ([200,386,389,392,395].includes(n)) return "⛈️";
  if ([179,182,185,227,230,281,284,311,314,317,320,323,326,329,332,335,338,350,368,371,374,377].includes(n)) return "❄️";
  return "🌡️";
}

module.exports = {
  config: {
    name:      "weather",
    aliases:   ["w", "wt"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "utility",
    countDown: 10,
    description: { en: "Get current weather and 3-day forecast for any location" },
    guide:       { en: "{pn} <city> — e.g. {pn} Dhaka" },
  },

  langs: {
    en: {
      noLocation: "❌ Please provide a location. Example: `/weather Dhaka`",
      fetching:   "🌍 Fetching weather for **%1**...",
      error:      "❌ Could not get weather for **%1**. Check the city name.",
      current:    "🌤️ *Weather in %1, %2*\n\n%3 *%4*\n🌡️ Temp: %5°C (feels like %6°C)\n💧 Humidity: %7%\n💨 Wind: %8 km/h %9\n👁️ Visibility: %10 km\n☁️ Cloud cover: %11%\n\n📅 *3-Day Forecast*\n%12",
      forecastRow: "%1 %2: %3°C – %4°C  %5",
    },
  },

  onStart: async function ({ message, args, getLang }) {
    if (!args.length) return message.reply(getLang("noLocation"));

    const location = args.join(" ");
    const waiting  = await message.reply(getLang("fetching").replace("%1", location));

    try {
      const data    = await fetchWeather(location);
      const current = data.current_condition[0];
      const nearest = data.nearest_area?.[0];

      const cityName    = nearest?.areaName?.[0]?.value || location;
      const countryName = nearest?.country?.[0]?.value  || "";
      const desc        = current.weatherDesc?.[0]?.value || "Unknown";
      const code        = current.weatherCode;
      const emoji       = weatherEmoji(code);
      const tempC       = current.temp_C;
      const feelsC      = current.FeelsLikeC;
      const humidity    = current.humidity;
      const windKmph    = current.windspeedKmph;
      const windDir     = degToDir(parseInt(current.winddirDegree));
      const visibility  = current.visibility;
      const cloudCover  = current.cloudcover;

      // 3-day forecast
      const forecastLines = (data.weather || []).slice(0, 3).map(day => {
        const date     = day.date;
        const minC     = day.mintempC;
        const maxC     = day.maxtempC;
        const dayDesc  = day.hourly?.[4]?.weatherDesc?.[0]?.value || "";
        const dayCode  = day.hourly?.[4]?.weatherCode || "113";
        return getLang("forecastRow")
          .replace("%1", weatherEmoji(dayCode))
          .replace("%2", date)
          .replace("%3", minC)
          .replace("%4", maxC)
          .replace("%5", dayDesc);
      }).join("\n");

      try { await message.delete(waiting.message_id); } catch {}

      return message.reply(
        getLang("current")
          .replace("%1",  cityName)
          .replace("%2",  countryName)
          .replace("%3",  emoji)
          .replace("%4",  desc)
          .replace("%5",  tempC)
          .replace("%6",  feelsC)
          .replace("%7",  humidity)
          .replace("%8",  windKmph)
          .replace("%9",  windDir)
          .replace("%10", visibility)
          .replace("%11", cloudCover)
          .replace("%12", forecastLines)
      );
    } catch (e) {
      try { await message.delete(waiting.message_id); } catch {}
      return message.reply(getLang("error").replace("%1", location));
    }
  },
};
