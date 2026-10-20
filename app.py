"""
=============================================================================
Smart Weather AI - Flask Web Application & ML Forecasting Engine
-----------------------------------------------------------------------------
A complete, production-ready Flask hackathon project:
1. Real-time Weather Telemetry & 7-Day Forecast (Open-Meteo REST API)
2. Machine Learning Forecasting Engine (Scikit-Learn Random Forest Regressor)
   with non-leaking lag features, chronological train/test split, and baseline comparison
3. Composite 0-100 Weather Hazard Risk Index & Deterministic Smart Insights
4. Multi-City Comparison Studio & Historical Analytics
5. Resilient Mock Fallbacks ensuring zero crashes
=============================================================================
"""

import os
import sys
import json
import time
import datetime
import requests
import joblib
import numpy as np
import pandas as pd
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

app = Flask(__name__)
CORS(app)

# Ensure models directory exists
os.makedirs("models", exist_ok=True)

# Simple In-Memory Cache with TTL
CACHE = {}
CACHE_TTL = {
    "forecast": 600,       # 10 minutes
    "historical": 86400,   # 24 hours
    "geocoding": 3600      # 1 hour
}

def get_cache(key):
    if key in CACHE:
        item, timestamp, ttl = CACHE[key]
        if time.time() - timestamp < ttl:
            return item
    return None

def set_cache(key, value, ttl):
    CACHE[key] = (value, time.time(), ttl)


# =============================================================================
# WMO Weather Interpretation Codes
# =============================================================================
WMO_CODE_MAP = {
    0: {"desc": "Clear Sky", "icon": "☀️", "risk_type": "clear"},
    1: {"desc": "Mainly Clear", "icon": "🌤️", "risk_type": "clear"},
    2: {"desc": "Partly Cloudy", "icon": "⛅", "risk_type": "cloudy"},
    3: {"desc": "Overcast", "icon": "☁️", "risk_type": "cloudy"},
    45: {"desc": "Foggy", "icon": "🌫️", "risk_type": "fog"},
    48: {"desc": "Depositing Rime Fog", "icon": "🌫️", "risk_type": "fog"},
    51: {"desc": "Light Drizzle", "icon": "🌦️", "risk_type": "rain"},
    53: {"desc": "Moderate Drizzle", "icon": "🌦️", "risk_type": "rain"},
    55: {"desc": "Dense Drizzle", "icon": "🌧️", "risk_type": "rain"},
    56: {"desc": "Light Freezing Drizzle", "icon": "🌧️❄️", "risk_type": "freeze"},
    57: {"desc": "Dense Freezing Drizzle", "icon": "🌧️❄️", "risk_type": "freeze"},
    61: {"desc": "Slight Rain", "icon": "🌧️", "risk_type": "rain"},
    63: {"desc": "Moderate Rain", "icon": "🌧️", "risk_type": "rain"},
    65: {"desc": "Heavy Rain", "icon": "🌧️💧", "risk_type": "rain"},
    66: {"desc": "Light Freezing Rain", "icon": "🌧️❄️", "risk_type": "freeze"},
    67: {"desc": "Heavy Freezing Rain", "icon": "🌧️❄️", "risk_type": "freeze"},
    71: {"desc": "Slight Snowfall", "icon": "❄️", "risk_type": "snow"},
    73: {"desc": "Moderate Snowfall", "icon": "❄️", "risk_type": "snow"},
    75: {"desc": "Heavy Snowfall", "icon": "❄️☃️", "risk_type": "snow"},
    77: {"desc": "Snow Grains", "icon": "🌨️", "risk_type": "snow"},
    80: {"desc": "Slight Rain Showers", "icon": "🌦️", "risk_type": "rain"},
    81: {"desc": "Moderate Rain Showers", "icon": "🌧️", "risk_type": "rain"},
    82: {"desc": "Violent Rain Showers", "icon": "⛈️", "risk_type": "rain"},
    85: {"desc": "Slight Snow Showers", "icon": "🌨️", "risk_type": "snow"},
    86: {"desc": "Heavy Snow Showers", "icon": "🌨️❄️", "risk_type": "snow"},
    95: {"desc": "Thunderstorm", "icon": "⛈️⚡", "risk_type": "storm"},
    96: {"desc": "Thunderstorm with Slight Hail", "icon": "⛈️", "risk_type": "storm"},
    99: {"desc": "Thunderstorm with Heavy Hail", "icon": "⛈️🌪️", "risk_type": "storm"},
}

def get_wmo_info(code):
    if code is None or not (isinstance(code, (int, float)) and not np.isnan(code)):
        return {"desc": "Clear Sky", "icon": "☀️", "risk_type": "clear"}
    code_int = int(code)
    return WMO_CODE_MAP.get(code_int, {"desc": f"Code {code_int}", "icon": "🌤️", "risk_type": "clear"})


# Preset Popular Cities for Instant 1-Click Demos
DEFAULT_DEMO_CITIES = [
    {"name": "Chennai", "country": "India", "lat": 13.0878, "lon": 80.2785, "timezone": "Asia/Kolkata", "flag": "🇮🇳"},
    {"name": "New York", "country": "United States", "lat": 40.7128, "lon": -74.0060, "timezone": "America/New_York", "flag": "🇺🇸"},
    {"name": "London", "country": "United Kingdom", "lat": 51.5074, "lon": -0.1278, "timezone": "Europe/London", "flag": "🇬🇧"},
    {"name": "Tokyo", "country": "Japan", "lat": 35.6895, "lon": 139.6917, "timezone": "Asia/Tokyo", "flag": "🇯🇵"},
    {"name": "Paris", "country": "France", "lat": 48.8566, "lon": 2.3522, "timezone": "Europe/Paris", "flag": "🇫🇷"},
    {"name": "Dubai", "country": "United Arab Emirates", "lat": 25.2048, "lon": 55.2708, "timezone": "Asia/Dubai", "flag": "🇦🇪"},
    {"name": "Sydney", "country": "Australia", "lat": -33.8688, "lon": 151.2093, "timezone": "Australia/Sydney", "flag": "🇦🇺"},
    {"name": "San Francisco", "country": "United States", "lat": 37.7749, "lon": -122.4194, "timezone": "America/Los_Angeles", "flag": "🇺🇸"},
    {"name": "Mumbai", "country": "India", "lat": 19.0760, "lon": 72.8777, "timezone": "Asia/Kolkata", "flag": "🇮🇳"},
]


# =============================================================================
# Open-Meteo API Layer (Geocoding, Forecast, Historical Archive)
# =============================================================================
def fetch_geocoding(query: str):
    """Search cities using Open-Meteo Geocoding API with fallback."""
    if not query or len(query.strip()) < 2:
        return DEFAULT_DEMO_CITIES

    cache_key = f"geo_{query.strip().lower()}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    url = f"https://geocoding-api.open-meteo.com/v1/search?name={query.strip()}&count=6&language=en&format=json"
    try:
        response = requests.get(url, timeout=6)
        if response.status_code == 200:
            results = response.json().get("results", [])
            formatted = []
            for item in results:
                name = item.get("name")
                country = item.get("country", "")
                admin1 = item.get("admin1", "")
                label = f"{name}, {admin1}, {country}" if admin1 else f"{name}, {country}"
                formatted.append({
                    "name": name,
                    "label": label,
                    "country": country,
                    "lat": round(float(item.get("latitude")), 4),
                    "lon": round(float(item.get("longitude")), 4),
                    "timezone": item.get("timezone", "auto"),
                    "flag": "📍"
                })
            if formatted:
                set_cache(cache_key, formatted, CACHE_TTL["geocoding"])
                return formatted
    except Exception:
        pass

    matched = [c for c in DEFAULT_DEMO_CITIES if query.lower() in c['name'].lower()]
    return matched if matched else DEFAULT_DEMO_CITIES


def fetch_forecast(lat: float, lon: float, timezone: str = "auto"):
    """Fetch current weather and 7-day forecast from Open-Meteo."""
    cache_key = f"fc_{lat}_{lon}"
    cached = get_cache(cache_key)
    if cached:
        return cached, False

    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m"
        f"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max"
        f"&past_days=7&forecast_days=8&timezone={timezone}"
    )
    try:
        res = requests.get(url, timeout=10)
        if res.status_code == 200:
            data = res.json()
            set_cache(cache_key, data, CACHE_TTL["forecast"])
            return data, False
    except Exception:
        pass

    return generate_mock_forecast(lat, lon), True


def fetch_historical(lat: float, lon: float, timezone: str = "auto", days_back: int = 500):
    """Fetch historical daily weather observations from Open-Meteo Archive API."""
    cache_key = f"hist_{lat}_{lon}_{days_back}"
    cached = get_cache(cache_key)
    if cached is not None:
        return cached, False

    today = datetime.date.today()
    end_date = today - datetime.timedelta(days=5)
    start_date = end_date - datetime.timedelta(days=days_back)

    url = (
        f"https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_mean,surface_pressure_mean"
        f"&timezone={timezone}"
    )
    try:
        res = requests.get(url, timeout=12)
        if res.status_code == 200:
            data = res.json()
            if "daily" in data and "time" in data["daily"]:
                df = pd.DataFrame(data["daily"])
                df["time"] = pd.to_datetime(df["time"])
                df = df.sort_values("time").reset_index(drop=True)
                set_cache(cache_key, df, CACHE_TTL["historical"])
                return df, False
    except Exception:
        pass

    df = generate_mock_historical(lat, lon, days_back=days_back)
    return df, True


def generate_mock_forecast(lat, lon):
    """Realistic synthetic forecast fallback ensuring zero crashes."""
    base_temp = 28.0 if lat < 30 else 18.0
    today = datetime.date.today()
    dates = [(today + datetime.timedelta(days=i - 7)).strftime("%Y-%m-%d") for i in range(15)]
    daily_temps_max = [round(base_temp + 3 + np.sin(i * 0.8) * 4, 1) for i in range(15)]
    daily_temps_min = [round(t - 6.5, 1) for t in daily_temps_max]

    return {
        "current": {
            "temperature_2m": round(base_temp + 1.2, 1),
            "apparent_temperature": round(base_temp + 2.5, 1),
            "relative_humidity_2m": 68,
            "precipitation": 0.0,
            "weather_code": 1,
            "surface_pressure": 1012.4,
            "wind_speed_10m": 14.5
        },
        "daily": {
            "time": dates,
            "weather_code": [1, 2, 0, 3, 61, 2, 1, 0, 1, 2, 3, 61, 80, 1, 0],
            "temperature_2m_max": daily_temps_max,
            "temperature_2m_min": daily_temps_min,
            "precipitation_sum": [0.0, 0.2, 0.0, 1.2, 8.4, 0.4, 0.0, 0.0, 0.1, 0.5, 2.1, 12.0, 4.2, 0.0, 0.0],
            "precipitation_probability_max": [10, 20, 5, 35, 80, 25, 10, 5, 15, 30, 45, 85, 60, 15, 10],
            "wind_speed_10m_max": [12.0, 14.2, 11.0, 18.5, 26.0, 16.0, 13.0, 12.5, 14.0, 15.5, 20.0, 28.0, 19.0, 13.0, 11.0],
            "uv_index_max": [7.5, 8.0, 8.2, 6.0, 4.5, 7.8, 8.1, 8.0, 7.9, 7.2, 5.5, 3.8, 5.2, 7.6, 8.0]
        }
    }


def generate_mock_historical(lat, lon, days_back=500):
    """Realistic synthetic historical weather dataframe generator."""
    today = datetime.date.today()
    dates = pd.date_range(end=today - datetime.timedelta(days=5), periods=days_back, freq='D')
    base_temp = 28.0 if lat < 30 else 18.0

    day_of_year = dates.dayofyear
    seasonal = np.sin(2 * np.pi * (day_of_year - 80) / 365.25) * 7.0
    noise = np.random.normal(0, 1.8, len(dates))

    t_max = np.round(base_temp + seasonal + noise + 3.0, 1)
    t_min = np.round(t_max - np.random.uniform(5.5, 8.5, len(dates)), 1)
    t_mean = np.round((t_max + t_min) / 2.0, 1)
    precip = np.round(np.clip(np.random.exponential(1.5, len(dates)) - 1.2, 0, 45.0), 1)
    wind = np.round(np.random.gamma(3, 4, len(dates)), 1)
    humidity = np.round(np.clip(60 + seasonal * 2 + np.random.normal(0, 8, len(dates)), 35, 95), 1)
    pressure = np.round(1013.25 - (seasonal * 0.4) + np.random.normal(0, 3, len(dates)), 1)

    return pd.DataFrame({
        "time": dates,
        "temperature_2m_max": t_max,
        "temperature_2m_min": t_min,
        "temperature_2m_mean": t_mean,
        "precipitation_sum": precip,
        "wind_speed_10m_max": wind,
        "relative_humidity_2m_mean": humidity,
        "surface_pressure_mean": pressure
    })


# =============================================================================
# Machine Learning Feature Engineering & Model Pipeline
# =============================================================================
FEATURE_COLS = [
    'temperature_2m_max', 'temperature_2m_min', 'temperature_2m_mean',
    'temp_range', 'temp_max_lag1', 'temp_max_lag2', 'temp_max_lag3', 'temp_max_lag7',
    'temp_max_roll7_mean', 'temp_max_roll7_std',
    'precipitation_sum', 'precip_lag1',
    'wind_speed_10m_max', 'wind_lag1',
    'relative_humidity_2m_mean', 'surface_pressure_mean',
    'sin_dayofyear', 'cos_dayofyear', 'month'
]

def engineer_features(raw_df: pd.DataFrame):
    """
    Construct non-leaking lag features, rolling statistics, and cyclical calendar signals.
    Target is strictly: target_t_max_next_day = temperature_2m_max.shift(-1).
    All predictors at row i strictly rely on index <= i.
    """
    df = raw_df.copy()
    df['time'] = pd.to_datetime(df['time'])
    df = df.sort_values('time').reset_index(drop=True)

    df['dayofyear'] = df['time'].dt.dayofyear
    df['sin_dayofyear'] = np.sin(2 * np.pi * df['dayofyear'] / 365.25)
    df['cos_dayofyear'] = np.cos(2 * np.pi * df['dayofyear'] / 365.25)
    df['month'] = df['time'].dt.month

    df['temp_range'] = df['temperature_2m_max'] - df['temperature_2m_min']

    df['temp_max_lag1'] = df['temperature_2m_max'].shift(1)
    df['temp_max_lag2'] = df['temperature_2m_max'].shift(2)
    df['temp_max_lag3'] = df['temperature_2m_max'].shift(3)
    df['temp_max_lag7'] = df['temperature_2m_max'].shift(7)

    df['temp_max_roll7_mean'] = df['temperature_2m_max'].rolling(7).mean()
    df['temp_max_roll7_std'] = df['temperature_2m_max'].rolling(7).std().fillna(0)

    df['precip_lag1'] = df['precipitation_sum'].shift(1)
    df['wind_lag1'] = df['wind_speed_10m_max'].shift(1)

    df['target_t_max_next_day'] = df['temperature_2m_max'].shift(-1)
    return df


def train_and_evaluate_model(city_name: str, historical_df: pd.DataFrame):
    """Train RandomForestRegressor on chronological train/test split."""
    cache_key = f"ml_{city_name}"
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    df_feat = engineer_features(historical_df)
    valid_df = df_feat.dropna(subset=FEATURE_COLS + ['target_t_max_next_day']).copy()

    if len(valid_df) < 50:
        return None

    split_idx = int(len(valid_df) * 0.8)
    train_df = valid_df.iloc[:split_idx]
    test_df = valid_df.iloc[split_idx:]

    X_train, y_train = train_df[FEATURE_COLS], train_df['target_t_max_next_day']
    X_test, y_test = test_df[FEATURE_COLS], test_df['target_t_max_next_day']

    rf = RandomForestRegressor(
        n_estimators=120,
        max_depth=12,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)

    y_pred_rf = rf.predict(X_test)
    y_pred_baseline = test_df['temperature_2m_max'].values

    mae_rf = float(mean_absolute_error(y_test, y_pred_rf))
    rmse_rf = float(np.sqrt(mean_squared_error(y_test, y_pred_rf)))
    r2_rf = float(r2_score(y_test, y_pred_rf))

    mae_base = float(mean_absolute_error(y_test, y_pred_baseline))
    rmse_base = float(np.sqrt(mean_squared_error(y_test, y_pred_baseline)))
    r2_base = float(r2_score(y_test, y_pred_baseline))

    # Feature Importances
    importances = [
        {"feature": f, "importance": round(float(imp), 4)}
        for f, imp in sorted(zip(FEATURE_COLS, rf.feature_importances_), key=lambda x: x[1], reverse=True)
    ]

    # Save model locally
    safe_name = "".join(c for c in city_name if c.isalnum() or c in (' ', '_')).rstrip()
    model_path = os.path.join("models", f"{safe_name.lower()}_rf.joblib")
    try:
        joblib.dump(rf, model_path)
    except Exception:
        pass

    results = {
        "model": rf,
        "mae_rf": round(mae_rf, 2),
        "rmse_rf": round(rmse_rf, 2),
        "r2_rf": round(r2_rf, 3),
        "mae_base": round(mae_base, 2),
        "rmse_base": round(rmse_base, 2),
        "r2_base": round(r2_base, 3),
        "y_test": [round(float(v), 1) for v in y_test.values[-60:]],
        "y_pred_rf": [round(float(v), 1) for v in y_pred_rf[-60:]],
        "test_dates": test_df['time'].dt.strftime("%Y-%m-%d").values[-60:].tolist(),
        "importances": importances[:10],
        "train_size": len(train_df),
        "test_size": len(test_df)
    }

    set_cache(cache_key, results, 3600)
    return results


def predict_next_day_max(model, historical_df: pd.DataFrame, forecast_daily: dict):
    """Predict tomorrow's max temperature by feeding today's lag vector into the model."""
    recent_dates = forecast_daily.get("time", [])
    today_str = datetime.date.today().strftime("%Y-%m-%d")

    today_idx = recent_dates.index(today_str) if today_str in recent_dates else min(7, len(recent_dates) - 1)

    recent_df = pd.DataFrame({
        "time": pd.to_datetime(recent_dates[:today_idx + 1]),
        "temperature_2m_max": forecast_daily.get("temperature_2m_max", [])[:today_idx + 1],
        "temperature_2m_min": forecast_daily.get("temperature_2m_min", [])[:today_idx + 1],
        "temperature_2m_mean": [
            (h + l) / 2.0 for h, l in zip(
                forecast_daily.get("temperature_2m_max", [])[:today_idx + 1],
                forecast_daily.get("temperature_2m_min", [])[:today_idx + 1]
            )
        ],
        "precipitation_sum": forecast_daily.get("precipitation_sum", [])[:today_idx + 1],
        "wind_speed_10m_max": forecast_daily.get("wind_speed_10m_max", [])[:today_idx + 1],
        "relative_humidity_2m_mean": [65.0] * (today_idx + 1),
        "surface_pressure_mean": [1013.0] * (today_idx + 1)
    })

    combined = pd.concat([historical_df, recent_df], ignore_index=True)
    combined = combined.drop_duplicates(subset=["time"]).sort_values("time").reset_index(drop=True)

    feat_df = engineer_features(combined)
    latest_row = feat_df.iloc[-1:][FEATURE_COLS]
    latest_row = latest_row.fillna(feat_df[FEATURE_COLS].median())

    predicted_tmax = float(model.predict(latest_row)[0])
    return round(predicted_tmax, 1)


# =============================================================================
# Smart Insights & Risk Score Computation
# =============================================================================
def generate_smart_insights(current_data, forecast_daily, historical_df):
    """Generate deterministic, rule-based weather insights based on real observations."""
    insights = []
    rain_probs = forecast_daily.get("precipitation_probability_max", [])
    precip_sums = forecast_daily.get("precipitation_sum", [])

    today_rain_prob = rain_probs[7] if len(rain_probs) > 7 else (rain_probs[0] if rain_probs else 0)
    today_precip = precip_sums[7] if len(precip_sums) > 7 else (precip_sums[0] if precip_sums else 0.0)

    if today_rain_prob >= 60 or today_precip >= 5.0:
        insights.append({
            "type": "warning", "icon": "☔", "title": "High Rain Probability Detected",
            "msg": f"Rain probability is {today_rain_prob}% with an estimated {today_precip:.1f} mm precipitation. Don't forget your umbrella and expect slower road transit."
        })
    elif today_rain_prob >= 35:
        insights.append({
            "type": "info", "icon": "🌂", "title": "Moderate Chance of Showers",
            "msg": f"Chance of rain is {today_rain_prob}%. Carrying a compact umbrella or light raincoat is recommended."
        })
    else:
        insights.append({
            "type": "success", "icon": "☀️", "title": "Dry Weather Expected Today",
            "msg": f"Rain probability is very low ({today_rain_prob}%). Great conditions for outdoor sports and travel."
        })

    curr_temp = current_data.get("temperature_2m", 25.0)
    feels_like = current_data.get("apparent_temperature", curr_temp)

    if curr_temp >= 36.0 or feels_like >= 38.0:
        insights.append({
            "type": "danger", "icon": "🔥", "title": "Extreme Heat Advisory",
            "msg": f"Temperature is {curr_temp:.1f}°C (Feels like {feels_like:.1f}°C). Stay hydrated, avoid midday sun exposure, and seek air conditioning."
        })
    elif curr_temp <= 5.0:
        insights.append({
            "type": "info", "icon": "❄️", "title": "Low Temperature Alert",
            "msg": f"Current temperature is {curr_temp:.1f}°C. Heavy winter layering is recommended to prevent hypothermia."
        })

    wind_spd = current_data.get("wind_speed_10m", 10.0)
    if wind_spd >= 35.0:
        insights.append({
            "type": "warning", "icon": "💨", "title": "High Wind Speed Advisory",
            "msg": f"Wind speeds are gusting at {wind_spd:.1f} km/h. Secure loose outdoor objects and exercise caution while driving."
        })

    uv_max_list = forecast_daily.get("uv_index_max", [])
    today_uv = uv_max_list[7] if len(uv_max_list) > 7 else (uv_max_list[0] if uv_max_list else 5.0)
    if today_uv >= 8.0:
        insights.append({
            "type": "danger", "icon": "🧴", "title": "Very High UV Radiation",
            "msg": f"Peak UV index reaches {today_uv:.1f}. Apply SPF 30+ sunscreen, wear UV sunglasses, and minimize direct midday exposure."
        })

    if not historical_df.empty:
        current_month = datetime.date.today().month
        hist_month_df = historical_df[historical_df['time'].dt.month == current_month]
        if not hist_month_df.empty:
            hist_mean = hist_month_df['temperature_2m_mean'].mean()
            diff = curr_temp - hist_mean
            if abs(diff) >= 2.0:
                direction = "warmer" if diff > 0 else "cooler"
                insights.append({
                    "type": "info", "icon": "📈", "title": f"Climate Anomaly ({abs(diff):.1f}°C {direction})",
                    "msg": f"Current temperature ({curr_temp:.1f}°C) is {abs(diff):.1f}°C {direction} than the seasonal historical baseline ({hist_mean:.1f}°C) for this month."
                })

    return insights


def calculate_weather_risk_score(current_data, forecast_daily):
    """Compute composite 0-100 Weather Hazard Risk Index."""
    score = 0
    factors = []

    rain_probs = forecast_daily.get("precipitation_probability_max", [])
    precip_sums = forecast_daily.get("precipitation_sum", [])
    rain_prob = rain_probs[7] if len(rain_probs) > 7 else 10
    precip_sum = precip_sums[7] if len(precip_sums) > 7 else 0.0

    if rain_prob >= 75 or precip_sum >= 15.0:
        score += 30
        factors.append("Heavy rainfall / downpour expected (+30)")
    elif rain_prob >= 40 or precip_sum >= 4.0:
        score += 15
        factors.append("Moderate rain showers anticipated (+15)")

    wind_spd = current_data.get("wind_speed_10m", 10.0)
    if wind_spd >= 50:
        score += 25
        factors.append("Gale force winds (+25)")
    elif wind_spd >= 32:
        score += 15
        factors.append("Brisk strong winds (+15)")

    temp = current_data.get("temperature_2m", 25.0)
    if temp >= 40.0:
        score += 25
        factors.append("Severe extreme heat (+25)")
    elif temp >= 35.0:
        score += 15
        factors.append("Elevated heat index (+15)")
    elif temp <= 0.0:
        score += 20
        factors.append("Freezing temperatures / frost (+20)")

    wmo = current_data.get("weather_code", 0)
    if wmo in [95, 96, 99]:
        score += 20
        factors.append("Active thunderstorm / convective activity (+20)")
    elif wmo in [82, 86, 65, 75]:
        score += 15
        factors.append("Violent precipitation or heavy snow (+15)")

    score = min(score, 100)

    if score <= 25:
        tier, css_class = "Low Risk", "risk-low"
    elif score <= 50:
        tier, css_class = "Moderate Risk", "risk-mod"
    elif score <= 75:
        tier, css_class = "High Risk", "risk-high"
    else:
        tier, css_class = "Severe Risk", "risk-severe"

    return {
        "score": score,
        "tier": tier,
        "css_class": css_class,
        "factors": factors if factors else ["Ideal atmospheric conditions (No major risks detected)"]
    }


# =============================================================================
# Flask Web Routes & API Endpoints
# =============================================================================
@app.route("/")
def index():
    """Render main interactive dashboard."""
    return render_template("index.html", default_cities=DEFAULT_DEMO_CITIES)


@app.route("/api/search")
def api_search():
    """Geocoding city search endpoint."""
    q = request.args.get("q", "").strip()
    results = fetch_geocoding(q)
    return jsonify(results)


@app.route("/api/weather")
def api_weather():
    """Main weather & ML prediction payload endpoint."""
    city_name = request.args.get("city", "Chennai")
    country = request.args.get("country", "India")
    lat = float(request.args.get("lat", 13.0878))
    lon = float(request.args.get("lon", 80.2785))
    timezone = request.args.get("timezone", "Asia/Kolkata")

    # 1. Fetch forecast & historical
    forecast_data, is_mock_fc = fetch_forecast(lat, lon, timezone)
    hist_df, is_mock_hist = fetch_historical(lat, lon, timezone, days_back=500)

    # 2. Train or retrieve cached ML model
    ml_results = train_and_evaluate_model(city_name, hist_df)

    # 3. Predict next-day max temp
    current = forecast_data.get("current", {})
    daily = forecast_data.get("daily", {})

    time_list = daily.get("time", [])
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    today_idx = time_list.index(today_str) if today_str in time_list else min(7, len(time_list) - 1)

    tomorrow_idx = min(today_idx + 1, len(time_list) - 1)
    official_tomorrow_max = daily.get("temperature_2m_max", [28.0])[tomorrow_idx]

    if ml_results:
        ml_pred_tomorrow = predict_next_day_max(ml_results["model"], hist_df, daily)
        variance = round(abs(ml_pred_tomorrow - official_tomorrow_max), 1)
        ml_payload = {
            "predicted_max": ml_pred_tomorrow,
            "official_tomorrow_max": official_tomorrow_max,
            "variance": variance,
            "mae_rf": ml_results["mae_rf"],
            "rmse_rf": ml_results["rmse_rf"],
            "r2_rf": ml_results["r2_rf"],
            "mae_base": ml_results["mae_base"],
            "rmse_base": ml_results["rmse_base"],
            "r2_base": ml_results["r2_base"],
            "improvement_pct": round(max(0, (ml_results["mae_base"] - ml_results["mae_rf"]) / ml_results["mae_base"] * 100), 1),
            "y_test": ml_results["y_test"],
            "y_pred_rf": ml_results["y_pred_rf"],
            "test_dates": ml_results["test_dates"],
            "importances": ml_results["importances"],
            "train_size": ml_results["train_size"],
            "test_size": ml_results["test_size"]
        }
    else:
        ml_payload = None

    # 4. Smart Insights & Risk Score
    insights = generate_smart_insights(current, daily, hist_df)
    risk_info = calculate_weather_risk_score(current, daily)

    # 5. Format 7-Day Forecast Cards data
    cards_7day = []
    fc_dates = time_list[today_idx:today_idx + 7]
    for i, dt_str in enumerate(fc_dates):
        idx = today_idx + i
        dt_obj = datetime.datetime.strptime(dt_str, "%Y-%m-%d")
        w_code = daily.get("weather_code", [0])[idx]
        w_info = get_wmo_info(w_code)
        cards_7day.append({
            "day": "Today" if i == 0 else ("Tomorrow" if i == 1 else dt_obj.strftime("%a")),
            "date": dt_obj.strftime("%b %d"),
            "full_date": dt_str,
            "weather_code": w_code,
            "desc": w_info["desc"],
            "icon": w_info["icon"],
            "max": daily.get("temperature_2m_max", [28.0])[idx],
            "min": daily.get("temperature_2m_min", [20.0])[idx],
            "rain_prob": daily.get("precipitation_probability_max", [0])[idx],
            "precip_sum": daily.get("precipitation_sum", [0.0])[idx],
            "wind_speed": daily.get("wind_speed_10m_max", [10.0])[idx],
            "uv_index": daily.get("uv_index_max", [5.0])[idx]
        })

    # 6. Sample Historical Trend data for Plotly
    hist_sample = {
        "dates": hist_df["time"].dt.strftime("%Y-%m-%d").tolist()[-180:],
        "t_max": hist_df["temperature_2m_max"].tolist()[-180:],
        "t_min": hist_df["temperature_2m_min"].tolist()[-180:],
        "t_mean": hist_df["temperature_2m_mean"].tolist()[-180:],
        "precip": hist_df["precipitation_sum"].tolist()[-180:],
        "humidity": hist_df["relative_humidity_2m_mean"].tolist()[-180:],
        "pressure": hist_df["surface_pressure_mean"].tolist()[-180:]
    }

    # WMO info for current condition
    curr_wmo = get_wmo_info(current.get("weather_code", 0))

    response_data = {
        "city": {"name": city_name, "country": country, "lat": lat, "lon": lon, "timezone": timezone},
        "is_mock": is_mock_fc or is_mock_hist,
        "current": {
            "temp": current.get("temperature_2m", 25.0),
            "feels_like": current.get("apparent_temperature", 26.0),
            "humidity": current.get("relative_humidity_2m", 65),
            "wind_spd": current.get("wind_speed_10m", 12.0),
            "pressure": current.get("surface_pressure", 1013.0),
            "weather_code": current.get("weather_code", 0),
            "desc": curr_wmo["desc"],
            "icon": curr_wmo["icon"],
            "today_max": daily.get("temperature_2m_max", [28.0])[today_idx],
            "today_min": daily.get("temperature_2m_min", [20.0])[today_idx],
            "today_rain_prob": daily.get("precipitation_probability_max", [0])[today_idx],
            "today_precip": daily.get("precipitation_sum", [0.0])[today_idx],
            "today_uv": daily.get("uv_index_max", [5.0])[today_idx]
        },
        "forecast_7day": cards_7day,
        "ml": ml_payload,
        "insights": insights,
        "risk": risk_info,
        "historical": hist_sample
    }
    return jsonify(response_data)


@app.route("/api/compare")
def api_compare():
    """Compare two cities endpoint."""
    lat1 = float(request.args.get("lat1", 13.0878))
    lon1 = float(request.args.get("lon1", 80.2785))
    name1 = request.args.get("name1", "Chennai")

    lat2 = float(request.args.get("lat2", 40.7128))
    lon2 = float(request.args.get("lon2", -74.0060))
    name2 = request.args.get("name2", "New York")

    fc1, _ = fetch_forecast(lat1, lon1)
    fc2, _ = fetch_forecast(lat2, lon2)

    curr1 = fc1.get("current", {})
    daily1 = fc1.get("daily", {})
    curr2 = fc2.get("current", {})
    daily2 = fc2.get("daily", {})

    wmo1 = get_wmo_info(curr1.get("weather_code", 0))
    wmo2 = get_wmo_info(curr2.get("weather_code", 0))

    # Slice 7 forecast days
    times1 = daily1.get("time", [])
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    idx1 = times1.index(today_str) if today_str in times1 else min(7, len(times1) - 1)
    idx2 = fc2.get("daily", {}).get("time", []).index(today_str) if today_str in fc2.get("daily", {}).get("time", []) else idx1

    return jsonify({
        "city1": {
            "name": name1,
            "temp": curr1.get("temperature_2m", 25.0),
            "feels_like": curr1.get("apparent_temperature", 25.0),
            "humidity": curr1.get("relative_humidity_2m", 60),
            "wind": curr1.get("wind_speed_10m", 10.0),
            "pressure": curr1.get("surface_pressure", 1013.0),
            "desc": wmo1["desc"],
            "icon": wmo1["icon"],
            "dates": daily1.get("time", [])[idx1:idx1 + 7],
            "max": daily1.get("temperature_2m_max", [])[idx1:idx1 + 7],
            "min": daily1.get("temperature_2m_min", [])[idx1:idx1 + 7]
        },
        "city2": {
            "name": name2,
            "temp": curr2.get("temperature_2m", 18.0),
            "feels_like": curr2.get("apparent_temperature", 18.0),
            "humidity": curr2.get("relative_humidity_2m", 65),
            "wind": curr2.get("wind_speed_10m", 14.0),
            "pressure": curr2.get("surface_pressure", 1012.0),
            "desc": wmo2["desc"],
            "icon": wmo2["icon"],
            "dates": daily2.get("time", [])[idx2:idx2 + 7],
            "max": daily2.get("temperature_2m_max", [])[idx2:idx2 + 7],
            "min": daily2.get("temperature_2m_min", [])[idx2:idx2 + 7]
        }
    })


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    print("\n========================================================")
    print(" [*] Smart Weather AI - Flask Web Server Running")
    print(" Dashboard URL: http://127.0.0.1:5000")
    print(" Press Ctrl+C in terminal to stop.")
    print("========================================================\n")
    app.run(debug=True, host="127.0.0.1", port=5000)
