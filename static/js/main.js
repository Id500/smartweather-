/**
 * Smart Weather AI - Frontend Controller & Plotly Interactive Visualizations
 */

let appState = {
    city: { name: "Chennai", country: "India", lat: 13.0878, lon: 80.2785, timezone: "Asia/Kolkata" },
    unit: "C",
    data: null
};

// Common Plotly Dark Navy Theme Defaults
const PLOTLY_DARK_LAYOUT = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(15,23,42,0.5)",
    font: { color: "#94a3b8", family: "Inter, sans-serif" },
    margin: { l: 45, r: 25, t: 40, b: 40 },
    xaxis: {
        gridcolor: "rgba(255,255,255,0.06)",
        zerolinecolor: "rgba(255,255,255,0.1)",
        tickfont: { color: "#94a3b8" }
    },
    yaxis: {
        gridcolor: "rgba(255,255,255,0.06)",
        zerolinecolor: "rgba(255,255,255,0.1)",
        tickfont: { color: "#94a3b8" }
    },
    legend: {
        bgcolor: "rgba(15,23,42,0.7)",
        bordercolor: "rgba(255,255,255,0.1)",
        font: { color: "#e2e8f0" }
    }
};

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
    initSearch();
    loadWeatherData(appState.city);
});

function escapeHTML(value) {
    const element = document.createElement("span");
    element.textContent = value;
    return element.innerHTML;
}

// Helper for Temp Unit Formatting
function formatTemp(celsius) {
    if (celsius === null || celsius === undefined || isNaN(celsius)) return "--";
    if (appState.unit === "F") {
        return (celsius * 9 / 5 + 32).toFixed(1);
    }
    return Number(celsius).toFixed(1);
}

function getUnitStr() {
    return appState.unit === "F" ? "°F" : "°C";
}

// Unit Switcher
function setUnit(unit) {
    if (appState.unit === unit) return;
    appState.unit = unit;

    document.getElementById("unitCBtn").classList.toggle("active", unit === "C");
    document.getElementById("unitFBtn").classList.toggle("active", unit === "F");

    if (appState.data) {
        renderUI(appState.data);
    }
}

// Tab Switcher
function switchTab(tabId) {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.remove("active");
        btn.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("active"));

    const clickedBtn = Array.from(document.querySelectorAll(".tab-btn"))
        .find(b => b.getAttribute("onclick").includes(tabId));
    if (clickedBtn) {
        clickedBtn.classList.add("active");
        clickedBtn.setAttribute("aria-selected", "true");
    }

    const targetPane = document.getElementById(tabId);
    if (targetPane) targetPane.classList.add("active");

    // Trigger Plotly Resize for responsive rendering
    setTimeout(() => {
        const chartIds = [
            "chartActualVsPred", "chartFeatureImp",
            "chartHistTemp", "chartRainfall",
            "chartForecastCurve", "chartDualAtm",
            "chartComparisonCurve"
        ];
        chartIds.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.data) {
                Plotly.Plots.resize(el);
            }
        });
        window.dispatchEvent(new Event("resize"));
    }, 60);

    if (tabId === "tab-compare") {
        runComparison();
    }
}

// Fetch Weather & ML Data
async function loadWeatherData(city) {
    showLoading(true);
    appState.city = city;
    const errorBanner = document.getElementById("weatherError");
    errorBanner.classList.add("hidden");

    try {
        const url = `/api/weather?city=${encodeURIComponent(city.name)}&country=${encodeURIComponent(city.country || '')}&lat=${city.lat}&lon=${city.lon}&timezone=${encodeURIComponent(city.timezone || 'auto')}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        appState.data = data;
        renderUI(data);
    } catch (err) {
        console.error("Error loading weather telemetry:", err);
        errorBanner.textContent = "Weather data could not be loaded. Check your connection and select Refresh to try again.";
        errorBanner.classList.remove("hidden");
    } finally {
        showLoading(false);
    }
}

function refreshData() {
    loadWeatherData(appState.city);
}

function showLoading(show) {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) {
        overlay.classList.toggle("hidden", !show);
    }
}

// Main Render Dispatcher
function renderUI(data) {
    const unitStr = getUnitStr();

    // 1. Header Info
    document.getElementById("activeCityTitle").textContent = `${data.city.name}, ${data.city.country || ''}`;
    document.getElementById("coordBadge").textContent = `(Lat: ${data.city.lat}°, Lon: ${data.city.lon}°)`;

    const liveBadge = document.getElementById("liveFeedBadge");
    if (data.is_mock) {
        liveBadge.className = "badge-mock";
        liveBadge.textContent = data.forecast_is_mock === false ? "⚠️ Live weather · Demo historical data & ML" : "⚠️ Demo weather data";
    } else {
        liveBadge.className = "badge-live";
        liveBadge.innerHTML = '<span class="pulse-dot"></span> Live Open-Meteo Feed';
    }

    // 2. Hero Section
    const curr = data.current;
    document.getElementById("heroIcon").textContent = curr.icon || "☀️";
    document.getElementById("heroConditionText").textContent = curr.desc || "Clear";
    document.getElementById("heroTemp").textContent = formatTemp(curr.temp);
    document.getElementById("heroTempUnit").textContent = unitStr;
    document.getElementById("heroFeelsLike").textContent = `${formatTemp(curr.feels_like)}${unitStr}`;
    document.getElementById("heroTodayMax").textContent = `${formatTemp(curr.today_max)}${unitStr}`;
    document.getElementById("heroTodayMin").textContent = `${formatTemp(curr.today_min)}${unitStr}`;
    document.getElementById("heroCityName").textContent = data.city.name;
    document.getElementById("heroTimestamp").textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 3. Metric Tiles
    document.getElementById("mHumidity").textContent = curr.humidity;
    document.getElementById("mWind").textContent = Number(curr.wind_spd).toFixed(1);
    document.getElementById("mPressure").textContent = Math.round(curr.pressure);
    document.getElementById("mRainProb").textContent = curr.today_rain_prob;
    document.getElementById("mPrecip").textContent = Number(curr.today_precip).toFixed(1);
    
    const uvVal = Number(curr.today_uv).toFixed(1);
    const uvElem = document.getElementById("mUv");
    uvElem.textContent = uvVal;
    if (curr.today_uv < 3) {
        uvElem.style.color = "#34d399";
        document.getElementById("mUvDesc").textContent = "Low Hazard";
    } else if (curr.today_uv < 6) {
        uvElem.style.color = "#fbbf24";
        document.getElementById("mUvDesc").textContent = "Moderate";
    } else if (curr.today_uv < 8) {
        uvElem.style.color = "#f97316";
        document.getElementById("mUvDesc").textContent = "High";
    } else {
        uvElem.style.color = "#f43f5e";
        document.getElementById("mUvDesc").textContent = "Very High / Extreme";
    }

    // 4. 7-Day Forecast Cards
    render7DayForecast(data.forecast_7day);

    // 5. ML Forecaster Section
    if (data.ml) {
        renderMLSection(data.ml);
    }

    // 6. Analytics Section (Plotly Charts)
    renderAnalyticsCharts(data);

    // 7. Risk Index & Smart Insights
    renderRiskAndInsights(data.risk, data.insights);

    // 8. Update Compare City A
    document.getElementById("compareCityAName").textContent = data.city.name;
}

// Render 7-Day Forecast Row
function render7DayForecast(forecastList) {
    const container = document.getElementById("forecastCardsRow");
    container.innerHTML = "";
    const unitStr = getUnitStr();

    forecastList.forEach(item => {
        const card = document.createElement("div");
        card.className = "forecast-card";
        card.innerHTML = `
            <div>
                <div class="forecast-day">${item.day}</div>
                <div class="forecast-date">${item.date}</div>
                <span class="forecast-icon">${item.icon}</span>
                <div class="forecast-desc">${item.desc}</div>
            </div>
            <div>
                <div class="forecast-temps">
                    <span class="temp-high">${formatTemp(item.max)}${unitStr}</span>
                    <span style="color: #64748b; margin: 0 4px;">/</span>
                    <span class="temp-low">${formatTemp(item.min)}${unitStr}</span>
                </div>
                <div class="forecast-rain">💧 ${item.rain_prob}%</div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Render Machine Learning Forecaster Tab
function renderMLSection(ml) {
    const unitStr = getUnitStr();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById("mlTargetDate").textContent = tomorrow.toLocaleDateString("en-US", { weekday: 'long', month: 'short', day: 'numeric' });

    document.getElementById("mlPredVal").textContent = `${formatTemp(ml.predicted_max)}${unitStr}`;
    document.getElementById("mlOfficialVal").textContent = `${formatTemp(ml.official_tomorrow_max)}${unitStr}`;
    document.getElementById("mlVarianceVal").textContent = `±${ml.variance}°C`;

    const confLow = formatTemp(ml.predicted_max - ml.mae_rf);
    const confHigh = formatTemp(ml.predicted_max + ml.mae_rf);
    document.getElementById("mlConfidenceInterval").textContent = `Confidence Interval: [${confLow} - ${confHigh}${unitStr}]`;

    document.getElementById("mlMae").textContent = `${ml.mae_rf}°C`;
    document.getElementById("mlRmse").textContent = `${ml.rmse_rf}°C`;
    document.getElementById("mlBaseMae").textContent = `${ml.mae_base}°C`;
    document.getElementById("mlImprovement").textContent = `${ml.improvement_pct > 0 ? "+" : ""}${ml.improvement_pct}%`;

    // Charts: Actual vs Pred
    renderPlotlyActualVsPred(ml);
    // Charts: Feature Importances
    renderPlotlyFeatureImportance(ml.importances);
}

// Plotly: Actual vs Predicted
function renderPlotlyActualVsPred(ml) {
    const unitStr = getUnitStr();
    const yTest = ml.y_test.map(v => appState.unit === "F" ? (v * 9 / 5 + 32) : v);
    const yPred = ml.y_pred_rf.map(v => appState.unit === "F" ? (v * 9 / 5 + 32) : v);

    const traceActual = {
        x: ml.test_dates,
        y: yTest,
        name: "Actual Max Temp",
        mode: "lines+markers",
        line: { color: "#38bdf8", width: 2.5 },
        marker: { size: 5 }
    };

    const tracePred = {
        x: ml.test_dates,
        y: yPred,
        name: "Random Forest Prediction",
        mode: "lines+markers",
        line: { color: "#a855f7", width: 2.5, dash: "dash" },
        marker: { size: 5 }
    };

    const layout = {
        ...PLOTLY_DARK_LAYOUT,
        title: { text: `ML Model Validation: Actual vs Predicted Max Temp (${unitStr})`, font: { color: "#f8fafc", size: 15 } },
        hovermode: "x unified",
        height: 350
    };

    Plotly.newPlot("chartActualVsPred", [traceActual, tracePred], layout, { responsive: true, displayModeBar: false });
}

// Plotly: Feature Importance
function renderPlotlyFeatureImportance(importances) {
    const labelsMap = {
        'temperature_2m_max': 'Today Max Temp',
        'temperature_2m_mean': 'Today Mean Temp',
        'temp_max_roll7_mean': '7-Day Rolling Mean',
        'temp_max_lag1': 'Lag 1 (Yesterday Max)',
        'temp_max_lag2': 'Lag 2 Days Max',
        'temp_max_lag3': 'Lag 3 Days Max',
        'temp_max_lag7': 'Lag 7 Days Max',
        'temp_range': 'Diurnal Temp Range',
        'wind_speed_10m_max': 'Max Wind Speed',
        'relative_humidity_2m_mean': 'Relative Humidity',
        'surface_pressure_mean': 'Surface Pressure',
        'precipitation_sum': 'Precipitation',
        'sin_dayofyear': 'Cyclical Day of Year',
        'cos_dayofyear': 'Cyclical Seasonality',
        'month': 'Calendar Month'
    };

    const top10 = importances.slice(0, 10).reverse();
    const yLabels = top10.map(item => labelsMap[item.feature] || item.feature);
    const xVals = top10.map(item => item.importance);

    const trace = {
        x: xVals,
        y: yLabels,
        type: "bar",
        orientation: "h",
        marker: {
            color: xVals,
            colorscale: [[0, "#6366f1"], [1, "#a855f7"]]
        }
    };

    const layout = {
        ...PLOTLY_DARK_LAYOUT,
        title: { text: "Top Machine Learning Predictive Drivers", font: { color: "#f8fafc", size: 15 } },
        xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: { text: "Gini Feature Importance", font: { color: "#94a3b8" } } },
        height: 350
    };

    Plotly.newPlot("chartFeatureImp", [trace], layout, { responsive: true, displayModeBar: false });
}

// Plotly: Analytics Charts
function renderAnalyticsCharts(data) {
    const hist = data.historical;
    const unitStr = getUnitStr();

    // 1. Historical Temp Band
    const tMax = hist.t_max.map(v => appState.unit === "F" ? (v * 9 / 5 + 32) : v);
    const tMin = hist.t_min.map(v => appState.unit === "F" ? (v * 9 / 5 + 32) : v);
    const tMean = hist.t_mean.map(v => appState.unit === "F" ? (v * 9 / 5 + 32) : v);

    const traceMax = {
        x: hist.dates,
        y: tMax,
        name: "Max Temp",
        mode: "lines",
        line: { color: "#f43f5e", width: 2 }
    };

    const traceMin = {
        x: hist.dates,
        y: tMin,
        name: "Min Temp",
        mode: "lines",
        line: { color: "#38bdf8", width: 2 },
        fill: "tonexty",
        fillcolor: "rgba(56, 189, 248, 0.1)"
    };

    const traceMean = {
        x: hist.dates,
        y: tMean,
        name: "Mean Temp",
        mode: "lines",
        line: { color: "#fbbf24", width: 1.5, dash: "dot" }
    };

    Plotly.newPlot("chartHistTemp", [traceMax, traceMin, traceMean], {
        ...PLOTLY_DARK_LAYOUT,
        title: { text: `Historical Daily Temperature Range (${unitStr})`, font: { color: "#f8fafc", size: 15 } },
        height: 350,
        hovermode: "x unified"
    }, { responsive: true, displayModeBar: false });

    // 2. Rainfall Bar Chart
    const traceRain = {
        x: hist.dates,
        y: hist.precip,
        type: "bar",
        marker: {
            color: hist.precip,
            colorscale: [[0, "#0284c7"], [0.5, "#38bdf8"], [1, "#818cf8"]]
        }
    };

    Plotly.newPlot("chartRainfall", [traceRain], {
        ...PLOTLY_DARK_LAYOUT,
        title: { text: "Daily Precipitation Observations (mm)", font: { color: "#f8fafc", size: 15 } },
        height: 350
    }, { responsive: true, displayModeBar: false });

    // 3. Official 7-Day Forecast vs ML Prediction
    const fc = data.forecast_7day;
    const fcDates = fc.map(item => item.date);
    const fcMax = fc.map(item => appState.unit === "F" ? (item.max * 9 / 5 + 32) : item.max);
    const fcMin = fc.map(item => appState.unit === "F" ? (item.min * 9 / 5 + 32) : item.min);

    const traceFcMax = {
        x: fcDates,
        y: fcMax,
        name: "Official Forecast Max",
        mode: "lines+markers",
        line: { color: "#38bdf8", width: 3 },
        marker: { size: 7 }
    };

    const traceFcMin = {
        x: fcDates,
        y: fcMin,
        name: "Official Forecast Min",
        mode: "lines+markers",
        line: { color: "#818cf8", width: 2, dash: "dot" }
    };

    const tracesForecast = [traceFcMax, traceFcMin];

    if (data.ml && fcDates.length >= 2) {
        const mlTomorrow = appState.unit === "F" ? (data.ml.predicted_max * 9 / 5 + 32) : data.ml.predicted_max;
        const mlError = appState.unit === "F" ? (data.ml.mae_rf * 9 / 5) : data.ml.mae_rf;

        tracesForecast.push({
            x: [fcDates[1]],
            y: [mlTomorrow],
            name: "ML Predicted Max",
            mode: "markers",
            marker: { size: 14, color: "#f43f5e", symbol: "diamond", line: { color: "white", width: 2 } },
            error_y: { type: "data", array: [mlError], visible: true, color: "#f43f5e", thickness: 2, width: 6 }
        });
    }

    Plotly.newPlot("chartForecastCurve", tracesForecast, {
        ...PLOTLY_DARK_LAYOUT,
        title: { text: `Official 7-Day Forecast vs Smart Weather ML Model (${unitStr})`, font: { color: "#f8fafc", size: 15 } },
        height: 350,
        hovermode: "x unified"
    }, { responsive: true, displayModeBar: false });

    // 4. Dual Atmospheric Trend
    const traceHum = {
        x: hist.dates,
        y: hist.humidity,
        name: "Relative Humidity (%)",
        mode: "lines",
        line: { color: "#38bdf8", width: 1.5 },
        yaxis: "y1"
    };

    const tracePress = {
        x: hist.dates,
        y: hist.pressure,
        name: "Surface Pressure (hPa)",
        mode: "lines",
        line: { color: "#fbbf24", width: 1.5, dash: "dash" },
        yaxis: "y2"
    };

    Plotly.newPlot("chartDualAtm", [traceHum, tracePress], {
        ...PLOTLY_DARK_LAYOUT,
        title: { text: "Atmospheric Pressure vs Relative Humidity", font: { color: "#f8fafc", size: 15 } },
        yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: { text: "Humidity (%)", font: { color: "#38bdf8" } } },
        yaxis2: {
            title: { text: "Pressure (hPa)", font: { color: "#fbbf24" } },
            overlaying: "y",
            side: "right",
            gridcolor: "rgba(0,0,0,0)"
        },
        height: 340,
        hovermode: "x unified"
    }, { responsive: true, displayModeBar: false });
}

// Render Risk Score & Actionable Insights
function renderRiskAndInsights(risk, insights) {
    document.getElementById("riskScoreVal").innerHTML = `${risk.score}<span class="risk-max">/100</span>`;
    const pill = document.getElementById("riskTierPill");
    pill.textContent = risk.tier;
    pill.className = `risk-pill ${risk.css_class}`;

    const factorsContainer = document.getElementById("riskFactorsList");
    factorsContainer.innerHTML = "";
    risk.factors.forEach(f => {
        const item = document.createElement("div");
        item.className = "factor-item";
        item.innerHTML = `<span>🛡️</span><span>${f}</span>`;
        factorsContainer.appendChild(item);
    });

    const insightsContainer = document.getElementById("insightsList");
    insightsContainer.innerHTML = "";
    insights.forEach(ins => {
        const card = document.createElement("div");
        card.className = `insight-card insight-${ins.type}`;
        card.innerHTML = `
            <div class="insight-icon">${ins.icon}</div>
            <div>
                <div class="insight-title">${ins.title}</div>
                <div class="insight-msg">${ins.msg}</div>
            </div>
        `;
        insightsContainer.appendChild(card);
    });
}

// 1-Click Demo City Selection
function selectCity(name, country, lat, lon, timezone) {
    document.querySelectorAll(".demo-chip").forEach(chip => {
        chip.classList.toggle("active", chip.textContent.includes(name));
    });
    loadWeatherData({ name, country, lat, lon, timezone });
}

// Search Autocomplete
function initSearch() {
    const input = document.getElementById("citySearchInput");
    const dropdown = document.getElementById("searchResultsDropdown");
    let debounceTimer = null;

    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        const query = input.value.trim();
        if (query.length < 2) {
            dropdown.classList.add("hidden");
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                const cities = await res.json();
                renderSearchDropdown(cities);
            } catch (e) {
                console.error("Search error:", e);
            }
        }, 300);
    });

    document.addEventListener("click", (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add("hidden");
        }
    });
}

function renderSearchDropdown(cities) {
    const dropdown = document.getElementById("searchResultsDropdown");
    dropdown.innerHTML = "";

    if (!cities || cities.length === 0) {
        dropdown.classList.add("hidden");
        return;
    }

    cities.forEach(c => {
        const item = document.createElement("div");
        item.className = "search-item";
        item.innerHTML = `
            <span class="search-item-name">${c.flag || '📍'} ${c.name}</span>
            <span class="search-item-country">${c.country || ''}</span>
        `;
        item.onclick = () => {
            document.getElementById("citySearchInput").value = "";
            dropdown.classList.add("hidden");
            selectCity(c.name, c.country, c.lat, c.lon, c.timezone);
        };
        dropdown.appendChild(item);
    });

    dropdown.classList.remove("hidden");
}

// City Comparison Studio
async function runComparison() {
    const cityA = appState.city;
    const selectB = document.getElementById("cityBSelect");
    if (!selectB || !selectB.options || selectB.selectedIndex < 0) return;
    const selectedOption = selectB.options[selectB.selectedIndex];
    if (!selectedOption) return;

    const cityBName = selectB.value;
    const latB = parseFloat(selectedOption.getAttribute("data-lat"));
    const lonB = parseFloat(selectedOption.getAttribute("data-lon"));

    try {
        const url = `/api/compare?lat1=${cityA.lat}&lon1=${cityA.lon}&name1=${encodeURIComponent(cityA.name)}&lat2=${latB}&lon2=${lonB}&name2=${encodeURIComponent(cityBName)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        renderComparisonUI(data.city1, data.city2);
    } catch (e) {
        console.error("Comparison error:", e);
        document.getElementById("compareCardA").textContent = "Comparison could not be loaded. Select a city to try again.";
        document.getElementById("compareCardB").textContent = "";
    }
}

function renderComparisonUI(c1, c2) {
    const unitStr = getUnitStr();

    document.getElementById("compareCardA").innerHTML = `
        <h3 style="margin: 0; color: #f8fafc;">${escapeHTML(c1.name)}${c1.is_mock ? " (Demo)" : ""}</h3>
        <div style="font-size: 2.8rem; font-weight: 800; color: #ffffff; margin: 10px 0; font-family: 'JetBrains Mono', monospace;">
            ${formatTemp(c1.temp)}<span style="font-size: 1.4rem; color: #94a3b8;">${unitStr}</span>
        </div>
        <div style="color: #38bdf8; font-weight: 600; margin-bottom: 14px;">${c1.icon} ${c1.desc}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.88rem; color: #cbd5e1;">
            <div>💧 Humidity: <b>${c1.humidity}%</b></div>
            <div>💨 Wind: <b>${Number(c1.wind).toFixed(1)} km/h</b></div>
            <div>🌡️ Feels Like: <b>${formatTemp(c1.feels_like)}${unitStr}</b></div>
            <div>📊 Pressure: <b>${Math.round(c1.pressure)} hPa</b></div>
        </div>
    `;

    document.getElementById("compareCardB").innerHTML = `
        <h3 style="margin: 0; color: #f8fafc;">${escapeHTML(c2.name)}${c2.is_mock ? " (Demo)" : ""}</h3>
        <div style="font-size: 2.8rem; font-weight: 800; color: #ffffff; margin: 10px 0; font-family: 'JetBrains Mono', monospace;">
            ${formatTemp(c2.temp)}<span style="font-size: 1.4rem; color: #94a3b8;">${unitStr}</span>
        </div>
        <div style="color: #a855f7; font-weight: 600; margin-bottom: 14px;">${c2.icon} ${c2.desc}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.88rem; color: #cbd5e1;">
            <div>💧 Humidity: <b>${c2.humidity}%</b></div>
            <div>💨 Wind: <b>${Number(c2.wind).toFixed(1)} km/h</b></div>
            <div>🌡️ Feels Like: <b>${formatTemp(c2.feels_like)}${unitStr}</b></div>
            <div>📊 Pressure: <b>${Math.round(c2.pressure)} hPa</b></div>
        </div>
    `;

    // Comparative Plotly Curve
    const max1 = c1.max.map(v => appState.unit === "F" ? (v * 9 / 5 + 32) : v);
    const max2 = c2.max.map(v => appState.unit === "F" ? (v * 9 / 5 + 32) : v);

    const trace1 = {
        x: c1.dates,
        y: max1,
        name: `${c1.name} (High)`,
        mode: "lines+markers",
        line: { color: "#38bdf8", width: 3 },
        marker: { size: 8 }
    };

    const trace2 = {
        x: c2.dates,
        y: max2,
        name: `${c2.name} (High)`,
        mode: "lines+markers",
        line: { color: "#a855f7", width: 3, dash: "dash" },
        marker: { size: 8 }
    };

    Plotly.newPlot("chartComparisonCurve", [trace1, trace2], {
        ...PLOTLY_DARK_LAYOUT,
        title: { text: `7-Day High Temperature Comparison (${unitStr})`, font: { color: "#f8fafc", size: 15 } },
        height: 350,
        hovermode: "x unified"
    }, { responsive: true, displayModeBar: false });
}
