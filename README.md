# ⛅ Smart Weather AI — Next-Gen ML Weather Forecaster & Analytics

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Framework: Flask](https://img.shields.io/badge/framework-Flask%203.1-black.svg)](https://flask.palletsprojects.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open-Meteo](https://img.shields.io/badge/Data-Open--Meteo%20API-38bdf8.svg)](https://open-meteo.com/)

> **A cutting-edge hackathon web application combining real-time meteorological sensor telemetry, multi-day forecasting, and genuine Scikit-Learn Machine Learning to predict future weather trends. Built with Python & Flask.**

---

## 🌟 Overview & Problem Statement

Standard weather applications often present static numbers or opaque forecasts without explaining the underlying statistical trends or historical context. **Smart Weather AI** bridges this gap for hackathon judges, meteorologists, and everyday users by:

1. **Integrating Live Open-Meteo APIs** for worldwide geocoding, real-time sensor telemetry, and 7-day physics-based forecasts—requiring **zero API keys**.
2. **Training a Genuine Random Forest Regressor** on up to 500 days of historical observations to forecast next-day maximum temperatures.
3. **Preventing Data Leakage** with strictly chronological train/test splitting and non-leaking lag feature engineering.
4. **Benchmarking Against a Baseline** (Persistence: Tomorrow = Today) with honest held-out MAE and RMSE metrics.
5. **Delivering Actionable Deterministic Insights & Hazard Risk Scoring** alongside an interactive Multi-City Comparison Studio.

---

## 🚀 Key Features

### 1. ⛅ Real-Time Weather & 7-Day Numerical Forecast
- **Hero Display:** Current temperature (toggleable °C/°F), feels-like index, daily high/low spans, and WMO weather condition iconography.
- **Micro-Metrics Grid:** Relative humidity, 10m wind velocity, atmospheric surface pressure, precipitation volume, precipitation probability, and UV solar index.
- **7-Day Daily Forecast Cards:** Day name, calendar date, WMO condition description, temperature range, and rain probability badges.

### 2. 🤖 Machine Learning Temperature Forecaster
- **Algorithm:** Scikit-Learn `RandomForestRegressor` with 120 estimators and tree-depth regularization.
- **Strict Temporal Features:**
  - Autoregressive temperature lags ($t-1, t-2, t-3, t-7$).
  - Diurnal temperature range ($\text{T}_{\text{max}} - \text{T}_{\text{min}}$).
  - 7-day rolling temperature mean and standard deviation.
  - Precipitation and wind speed lags.
  - Cyclical seasonal trigonometric encodings ($\sin(2\pi \cdot \text{day}/365.25)$, $\cos(2\pi \cdot \text{day}/365.25)$).
- **Zero Future Leakage:** Chronological split (earliest 80% training, final 20% held-out test).
- **Honest Evaluation:** Computes and displays Test MAE, RMSE, and $R^2$ compared against a Persistence Baseline.
- **Explainable AI:** Dynamic Gini feature importance bar chart illustrating what physical signals drove the prediction.

### 3. ⚡ Smart Rule-Based Insights & Weather Risk Index
- **Composite Risk Index (0–100):** Evaluates hazard levels (Low, Moderate, High, Severe) combining rain volume, wind gusts, extreme temperatures, and thunderstorm indicators.
- **Deterministic Actionable Insights:**
  - ☔ Rain alert & umbrella reminder when precipitation probability $\ge 40\%$.
  - 🔥 Extreme heat advisory ($\ge 36^\circ\text{C}$) or ❄️ frost alert ($\le 5^\circ\text{C}$).
  - 💨 High wind speed advisory ($\ge 35\text{ km/h}$).
  - 🧴 High UV solar radiation warning ($\ge 8.0\text{ UV Index}$).
  - 📈 Climate Anomaly indicator comparing current temperatures against the 1–2 year historical seasonal baseline for the active month.

### 4. 🏙️ Multi-City Comparison Studio
- Benchmark two cities side-by-side simultaneously (e.g., Chennai vs New York, London vs Tokyo).
- Dual interactive Plotly curves for 7-day high-temperature trends.

### 5. 🛡️ Resilient Architecture & 1-Click Demo
- **1-Click Presets:** Instant selection for Chennai (Default), New York, London, Tokyo, Paris, San Francisco, Dubai, and Sydney.
- **Fuzzy Search:** Instant worldwide city coordinate lookup via Open-Meteo Geocoding.
- **Resilient Fallback Mode:** If external APIs experience rate-limiting or network timeouts, the app smoothly switches to a verified historical cache so your demo **never crashes during judging**.

---

## 🛠️ Technology Stack

| Layer | Component | Description |
|---|---|---|
| **Web Server & Backend** | [Flask 3.1](https://flask.palletsprojects.com/) | Lightweight, production-grade Python web framework & REST API |
| **Frontend UI** | HTML5, CSS3 & JavaScript | Modern glassmorphism UI with dark navy aesthetic & responsive layout |
| **Machine Learning** | [Scikit-Learn](https://scikit-learn.org/) | Random Forest Regressor, metrics evaluation, baseline benchmarking |
| **Data Processing** | [Pandas](https://pandas.pydata.org/) & [NumPy](https://numpy.org/) | Temporal lag engineering, cyclical trigonometry, rolling statistics |
| **Interactive Charts** | [Plotly.js](https://plotly.com/javascript/) | Interactive client-side dark-themed time-series and bar charts |
| **Data Ingestion** | [Requests](https://requests.readthedocs.io/) | Open-Meteo Geocoding, Forecast, and Historical Archive REST APIs |
| **Model Persistence** | [Joblib](https://joblib.readthedocs.io/) | Model serialization and caching for instantaneous reloads |

---

## 📁 Repository Structure

```text
smartweather/
├── static/
│   ├── css/
│   │   └── style.css        # Modern glassmorphism dark navy stylesheet
│   └── js/
│       └── main.js          # Interactive frontend controller & Plotly charts
├── templates/
│   └── index.html           # Main dashboard template
├── models/                  # Local cache directory for serialized ML models
├── app.py                   # Flask web server & ML modeling pipeline
├── requirements.txt         # Project Python dependencies
├── .gitignore               # Git ignore rules for virtual environments & cache
└── README.md                # Comprehensive project documentation
```

---

## 💻 Local Installation & Quick Start

### 1. Navigate to the project directory
```bash
cd c:\Users\Hp\OneDrive\Documents\smartweather
```

### 2. (Optional) Create and activate a virtual environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install required packages
```bash
pip install -r requirements.txt
```

### 4. Launch the application
```bash
python app.py
```

Open your browser and navigate to **`http://127.0.0.1:5000`** to view the live dashboard!

---

## 🌐 REST API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | `GET` | Main interactive dashboard |
| `/api/search?q={city}` | `GET` | Worldwide fuzzy city geocoding lookup |
| `/api/weather?city=...&lat=...&lon=...` | `GET` | Live telemetry, 7-day forecast, ML predictions, risk index, and insights |
| `/api/compare?lat1=...&lon1=...&lat2=...&lon2=...` | `GET` | Side-by-side multi-city meteorological comparison |

---

## 📜 License
This project is licensed under the MIT License — feel free to use and extend it for hackathons and research!
