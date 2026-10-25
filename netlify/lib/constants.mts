export function defaults() {
  return {
  "WMO_CODE_MAP": {
    "0": {
      "desc": "Clear Sky",
      "icon": "☀️",
      "risk_type": "clear"
    },
    "1": {
      "desc": "Mainly Clear",
      "icon": "🌤️",
      "risk_type": "clear"
    },
    "2": {
      "desc": "Partly Cloudy",
      "icon": "⛅",
      "risk_type": "cloudy"
    },
    "3": {
      "desc": "Overcast",
      "icon": "☁️",
      "risk_type": "cloudy"
    },
    "45": {
      "desc": "Foggy",
      "icon": "🌫️",
      "risk_type": "fog"
    },
    "48": {
      "desc": "Depositing Rime Fog",
      "icon": "🌫️",
      "risk_type": "fog"
    },
    "51": {
      "desc": "Light Drizzle",
      "icon": "🌦️",
      "risk_type": "rain"
    },
    "53": {
      "desc": "Moderate Drizzle",
      "icon": "🌦️",
      "risk_type": "rain"
    },
    "55": {
      "desc": "Dense Drizzle",
      "icon": "🌧️",
      "risk_type": "rain"
    },
    "56": {
      "desc": "Light Freezing Drizzle",
      "icon": "🌧️❄️",
      "risk_type": "freeze"
    },
    "57": {
      "desc": "Dense Freezing Drizzle",
      "icon": "🌧️❄️",
      "risk_type": "freeze"
    },
    "61": {
      "desc": "Slight Rain",
      "icon": "🌧️",
      "risk_type": "rain"
    },
    "63": {
      "desc": "Moderate Rain",
      "icon": "🌧️",
      "risk_type": "rain"
    },
    "65": {
      "desc": "Heavy Rain",
      "icon": "🌧️💧",
      "risk_type": "rain"
    },
    "66": {
      "desc": "Light Freezing Rain",
      "icon": "🌧️❄️",
      "risk_type": "freeze"
    },
    "67": {
      "desc": "Heavy Freezing Rain",
      "icon": "🌧️❄️",
      "risk_type": "freeze"
    },
    "71": {
      "desc": "Slight Snowfall",
      "icon": "❄️",
      "risk_type": "snow"
    },
    "73": {
      "desc": "Moderate Snowfall",
      "icon": "❄️",
      "risk_type": "snow"
    },
    "75": {
      "desc": "Heavy Snowfall",
      "icon": "❄️☃️",
      "risk_type": "snow"
    },
    "77": {
      "desc": "Snow Grains",
      "icon": "🌨️",
      "risk_type": "snow"
    },
    "80": {
      "desc": "Slight Rain Showers",
      "icon": "🌦️",
      "risk_type": "rain"
    },
    "81": {
      "desc": "Moderate Rain Showers",
      "icon": "🌧️",
      "risk_type": "rain"
    },
    "82": {
      "desc": "Violent Rain Showers",
      "icon": "⛈️",
      "risk_type": "rain"
    },
    "85": {
      "desc": "Slight Snow Showers",
      "icon": "🌨️",
      "risk_type": "snow"
    },
    "86": {
      "desc": "Heavy Snow Showers",
      "icon": "🌨️❄️",
      "risk_type": "snow"
    },
    "95": {
      "desc": "Thunderstorm",
      "icon": "⛈️⚡",
      "risk_type": "storm"
    },
    "96": {
      "desc": "Thunderstorm with Slight Hail",
      "icon": "⛈️",
      "risk_type": "storm"
    },
    "99": {
      "desc": "Thunderstorm with Heavy Hail",
      "icon": "⛈️🌪️",
      "risk_type": "storm"
    }
  },
  "DEFAULT_DEMO_CITIES": [
    {
      "name": "Chennai",
      "country": "India",
      "lat": 13.0878,
      "lon": 80.2785,
      "timezone": "Asia/Kolkata",
      "flag": "🇮🇳"
    },
    {
      "name": "New York",
      "country": "United States",
      "lat": 40.7128,
      "lon": -74.006,
      "timezone": "America/New_York",
      "flag": "🇺🇸"
    },
    {
      "name": "London",
      "country": "United Kingdom",
      "lat": 51.5074,
      "lon": -0.1278,
      "timezone": "Europe/London",
      "flag": "🇬🇧"
    },
    {
      "name": "Tokyo",
      "country": "Japan",
      "lat": 35.6895,
      "lon": 139.6917,
      "timezone": "Asia/Tokyo",
      "flag": "🇯🇵"
    },
    {
      "name": "Paris",
      "country": "France",
      "lat": 48.8566,
      "lon": 2.3522,
      "timezone": "Europe/Paris",
      "flag": "🇫🇷"
    },
    {
      "name": "Dubai",
      "country": "United Arab Emirates",
      "lat": 25.2048,
      "lon": 55.2708,
      "timezone": "Asia/Dubai",
      "flag": "🇦🇪"
    },
    {
      "name": "Sydney",
      "country": "Australia",
      "lat": -33.8688,
      "lon": 151.2093,
      "timezone": "Australia/Sydney",
      "flag": "🇦🇺"
    },
    {
      "name": "San Francisco",
      "country": "United States",
      "lat": 37.7749,
      "lon": -122.4194,
      "timezone": "America/Los_Angeles",
      "flag": "🇺🇸"
    },
    {
      "name": "Mumbai",
      "country": "India",
      "lat": 19.076,
      "lon": 72.8777,
      "timezone": "Asia/Kolkata",
      "flag": "🇮🇳"
    }
  ],
  "FEATURE_COLS": [
    "temperature_2m_max",
    "temperature_2m_min",
    "temperature_2m_mean",
    "temp_range",
    "temp_max_lag1",
    "temp_max_lag2",
    "temp_max_lag3",
    "temp_max_lag7",
    "temp_max_roll7_mean",
    "temp_max_roll7_std",
    "precipitation_sum",
    "precip_lag1",
    "wind_speed_10m_max",
    "wind_lag1",
    "relative_humidity_2m_mean",
    "surface_pressure_mean",
    "sin_dayofyear",
    "cos_dayofyear",
    "month"
  ]
};
}
