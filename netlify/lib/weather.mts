import { RandomForestRegression } from 'ml-random-forest';
import { defaults } from './constants.mts';

type Daily = { time: string[] } & Record<'temperature_2m_max' | 'temperature_2m_min' | 'weather_code' | 'precipitation_sum' | 'precipitation_probability_max' | 'wind_speed_10m_max' | 'uv_index_max', number[]>;
// Dates and numerical columns arrive together in Open-Meteo's daily response.
export type Weather = { current: { time?: string } & Record<'temperature_2m' | 'apparent_temperature' | 'relative_humidity_2m' | 'precipitation' | 'weather_code' | 'surface_pressure' | 'wind_speed_10m', number>; daily: Daily };
type Row = { time: string; values: number[] };
export type Fetcher = typeof fetch;

export function round(value: number, decimals = 1) {
  return Number(value.toFixed(decimals));
}
function mean(values: number[]) { return values.reduce((a, b) => a + b, 0) / values.length; }
function dateOffset(days: number) { return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10); }
export function todayIndex(data: Weather) {
  const today = data.current?.time?.slice(0, 10) || dateOffset(0);
  const index = data.daily.time.indexOf(today);
  return index >= 0 ? index : Math.min(7, data.daily.time.length - 1);
}
export function wmo(code: number) {
  const map: Record<string, { desc: string; icon: string }> = defaults().WMO_CODE_MAP;
  return map[code] || { desc: `Weather code ${code}`, icon: '🌤️' };
}
export function coordinate(params: URLSearchParams, key: string, fallback: number, limit: number) {
  const raw = params.get(key);
  const value = raw === null ? fallback : raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(value) || Math.abs(value) > limit) throw new RangeError(`Invalid ${key}`);
  return value;
}
async function getJSON(url: URL, fetcher: Fetcher) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Weather provider unavailable');
  return response.json();
}
function endpoint(base: string, params: Record<string, string | number>) {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url;
}
export async function search(query: string, fetcher: Fetcher = fetch) {
  const cities = defaults().DEFAULT_DEMO_CITIES;
  if (query.trim().length < 2) return cities;
  try {
    const data = await getJSON(endpoint('https://geocoding-api.open-meteo.com/v1/search', {
      name: query.trim(), count: 6, language: 'en', format: 'json',
    }), fetcher);
    return (data.results || []).map((city: Record<string, string | number>) => ({
      name: city.name, label: [city.name, city.admin1, city.country].filter(Boolean).join(', '),
      country: city.country || '', lat: city.latitude, lon: city.longitude,
      timezone: city.timezone || 'auto', flag: '📍',
    }));
  } catch {
    return cities.filter(city => city.name.toLowerCase().includes(query.toLowerCase()));
  }
}
export async function forecast(lat: number, lon: number, timezone = 'auto', fetcher: Fetcher = fetch) {
  try {
    const data = await getJSON(endpoint('https://api.open-meteo.com/v1/forecast', {
      latitude: lat, longitude: lon, timezone, past_days: 7, forecast_days: 8,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max',
    }), fetcher);
    const fields = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'precipitation_probability_max', 'wind_speed_10m_max', 'uv_index_max'];
    if (!data.current || !Number.isFinite(data.current.temperature_2m) || !data.daily?.time?.length ||
      fields.some(key => data.daily[key]?.length !== data.daily.time.length || data.daily[key].some((v: unknown) => typeof v !== 'number' || !Number.isFinite(v)))) {
      throw new Error('Incomplete forecast');
    }
    return { data: data as Weather, mock: false };
  } catch {
    return { data: mockForecast(lat), mock: true };
  }
}
export function mockForecast(lat: number): Weather {
  const base = Math.abs(lat) < 30 ? 28 : 18;
  const times = Array.from({ length: 15 }, (_, i) => dateOffset(i - 7));
  const highs = times.map((_, i) => round(base + 3 + Math.sin(i * .8) * 4));
  return {
    current: { time: `${dateOffset(0)}T12:00`, temperature_2m: base + 1.2, apparent_temperature: base + 2.5,
      relative_humidity_2m: 68, precipitation: 0, weather_code: 1, surface_pressure: 1012.4, wind_speed_10m: 14.5 } as Weather['current'],
    daily: { time: times, temperature_2m_max: highs, temperature_2m_min: highs.map(v => round(v - 6.5)),
      weather_code: [1,2,0,3,61,2,1,0,1,2,3,61,80,1,0],
      precipitation_sum: [0,.2,0,1.2,8.4,.4,0,0,.1,.5,2.1,12,4.2,0,0],
      precipitation_probability_max: [10,20,5,35,80,25,10,5,15,30,45,85,60,15,10],
      wind_speed_10m_max: [12,14.2,11,18.5,26,16,13,12.5,14,15.5,20,28,19,13,11],
      uv_index_max: [7.5,8,8.2,6,4.5,7.8,8.1,8,7.9,7.2,5.5,3.8,5.2,7.6,8],
    } as Daily,
  };
}
export async function historical(lat: number, lon: number, timezone = 'auto', fetcher: Fetcher = fetch) {
  const fields = ['temperature_2m_max', 'temperature_2m_min', 'temperature_2m_mean', 'precipitation_sum', 'wind_speed_10m_max', 'relative_humidity_2m_mean', 'surface_pressure_mean'];
  try {
    const data = await getJSON(endpoint('https://archive-api.open-meteo.com/v1/archive', {
      latitude: lat, longitude: lon, timezone, start_date: dateOffset(-505), end_date: dateOffset(-5), daily: fields.join(','),
    }), fetcher);
    const rows: Row[] = (data.daily?.time || []).map((time: string, i: number) => ({ time, values: fields.map(key => data.daily[key]?.[i]) }))
      .filter((row: Row) => row.values.every(value => typeof value === 'number' && Number.isFinite(value)));
    if (rows.length < 60) throw new Error('Insufficient historical observations');
    return { rows, mock: false };
  } catch {
    // Deterministic synthetic observations are explicitly labelled as demo data.
    const rows = Array.from({ length: 500 }, (_, i) => {
      const time = dateOffset(i - 504);
      const day = (Date.parse(time) - Date.UTC(new Date(time).getUTCFullYear(), 0, 0)) / 86400000;
      const seasonal = Math.sin(2 * Math.PI * (day - 80) / 365.25) * 7;
      const high = round((Math.abs(lat) < 30 ? 28 : 18) + seasonal + 3 + Math.sin(i * 2.3) * 1.8);
      const low = round(high - 6.5);
      return { time, values: [high, low, round((high + low) / 2), round(Math.max(0, Math.sin(i * 1.7) * 4)), round(12 + Math.sin(i) * 7), round(60 + seasonal * 2), round(1013.25 - seasonal * .4)] };
    });
    return { rows, mock: true };
  }
}
function features(rows: Row[], i: number) {
  const [high, low, average, precip, wind, humidity, pressure] = rows[i].values;
  const date = new Date(rows[i].time);
  const day = (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000;
  const recent = rows.slice(i - 6, i + 1).map(row => row.values[0]);
  const rolling = mean(recent);
  return [high, low, average, high - low, ...[1,2,3,7].map(lag => rows[i - lag].values[0]),
    rolling, Math.sqrt(recent.reduce((sum, value) => sum + (value - rolling) ** 2, 0) / 6),
    precip, rows[i - 1].values[3], wind, rows[i - 1].values[4], humidity, pressure,
    Math.sin(2 * Math.PI * day / 365.25), Math.cos(2 * Math.PI * day / 365.25), date.getUTCMonth() + 1];
}
function metrics(actual: number[], predicted: number[]) {
  const errors = actual.map((value, i) => value - predicted[i]);
  const mse = mean(errors.map(error => error ** 2));
  const variance = mean(actual.map(value => (value - mean(actual)) ** 2));
  return { mae: round(mean(errors.map(Math.abs)), 2), rmse: round(Math.sqrt(mse), 2), r2: round(variance ? 1 - mse / variance : mse === 0 ? 1 : 0, 3) };
}
export function machineLearning(rows: Row[], data: Weather) {
  const examples = rows.slice(7, -1).map((row, offset) => ({ x: features(rows, offset + 7), y: rows[offset + 8].values[0], time: row.time }));
  const split = Math.floor(examples.length * .8);
  const train = examples.slice(0, split), test = examples.slice(split);
  if (train.length < 40 || test.length < 2) return null;
  const model = new RandomForestRegression({ nEstimators: 120, maxFeatures: defaults().FEATURE_COLS.length, replacement: false,
    seed: 42, useSampleBagging: true, noOOB: true, treeOptions: { maxDepth: 12, minNumSamples: 2 } });
  model.train(train.map(row => row.x), train.map(row => row.y));
  const actual = test.map(row => row.y);
  const predictions = model.predict(test.map(row => row.x));
  const rf = metrics(actual, predictions), baseline = metrics(actual, test.map(row => row.x[0]));
  const idx = todayIndex(data), daily = data.daily;
  const combined = new Map(rows.map(row => [row.time, row]));
  daily.time.slice(0, idx + 1).forEach((time, i) => combined.set(time, { time, values: [daily.temperature_2m_max[i], daily.temperature_2m_min[i],
    (daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2, daily.precipitation_sum[i], daily.wind_speed_10m_max[i], 65, 1013] }));
  const recent = [...combined.values()].sort((a, b) => a.time.localeCompare(b.time));
  const predicted = round(model.predict([features(recent, recent.length - 1)])[0]);
  const official = daily.temperature_2m_max[Math.min(idx + 1, daily.time.length - 1)];
  // Permutation importance measured on the held-out observations.
  const weights = defaults().FEATURE_COLS.map((feature, column) => {
    const shuffled = test.map((row, i) => row.x.map((value, j) => j === column ? test[(i + 13) % test.length].x[j] : value));
    return { feature, importance: Math.max(0, metrics(actual, model.predict(shuffled)).mae - rf.mae) };
  });
  const total = weights.reduce((sum, item) => sum + item.importance, 0);
  return { predicted_max: predicted, official_tomorrow_max: official, variance: round(Math.abs(predicted - official)),
    mae_rf: rf.mae, rmse_rf: rf.rmse, r2_rf: rf.r2, mae_base: baseline.mae, rmse_base: baseline.rmse, r2_base: baseline.r2,
    improvement_pct: baseline.mae ? round((baseline.mae - rf.mae) / baseline.mae * 100) : 0,
    y_test: actual.slice(-60), y_pred_rf: predictions.slice(-60).map(value => round(value)), test_dates: test.slice(-60).map(row => row.time),
    importances: weights.map(item => ({ ...item, importance: total ? round(item.importance / total, 4) : 0 })).sort((a, b) => b.importance - a.importance).slice(0, 10),
    train_size: train.length, test_size: test.length };
}
export function risk(data: Weather) {
  const current = data.current, d = data.daily, i = todayIndex(data);
  let score = 0;
  const factors: string[] = [];
  const add = (points: number, label: string) => { score += points; factors.push(`${label} (+${points})`); };
  if (d.precipitation_probability_max[i] >= 75 || d.precipitation_sum[i] >= 15) add(30, 'Heavy rainfall / downpour expected');
  else if (d.precipitation_probability_max[i] >= 40 || d.precipitation_sum[i] >= 4) add(15, 'Moderate rain showers anticipated');
  if (current.wind_speed_10m >= 50) add(25, 'Gale force winds');
  else if (current.wind_speed_10m >= 32) add(15, 'Brisk strong winds');
  if (current.temperature_2m >= 40) add(25, 'Severe extreme heat');
  else if (current.temperature_2m >= 35) add(15, 'Elevated heat index');
  else if (current.temperature_2m <= 0) add(20, 'Freezing temperatures / frost');
  if ([95,96,99].includes(current.weather_code)) add(20, 'Active thunderstorm / convective activity');
  else if ([82,86,65,75].includes(current.weather_code)) add(15, 'Violent precipitation or heavy snow');
  score = Math.min(score, 100);
  const [tier, css_class] = score <= 25 ? ['Low Risk','risk-low'] : score <= 50 ? ['Moderate Risk','risk-mod'] : score <= 75 ? ['High Risk','risk-high'] : ['Severe Risk','risk-severe'];
  return { score, tier, css_class, factors: factors.length ? factors : ['Ideal atmospheric conditions (No major risks detected)'] };
}
function insights(data: Weather, rows: Row[]) {
  const c = data.current, d = data.daily, i = todayIndex(data);
  const rain = d.precipitation_probability_max[i], precip = d.precipitation_sum[i];
  const items = [{ type: rain >= 60 || precip >= 5 ? 'warning' : rain >= 35 ? 'info' : 'success', icon: rain >= 35 ? '☔' : '☀️',
    title: rain >= 60 || precip >= 5 ? 'High Rain Probability Detected' : rain >= 35 ? 'Moderate Chance of Showers' : 'Dry Weather Expected Today',
    msg: `Rain probability is ${rain}% with an estimated ${precip} mm precipitation. ${rain >= 35 ? 'Carry an umbrella and allow extra travel time.' : 'Good conditions for outdoor activities.'}` }];
  if (c.temperature_2m >= 36 || c.apparent_temperature >= 38) items.push({ type: 'danger', icon: '🔥', title: 'Extreme Heat Advisory', msg: `Temperature is ${c.temperature_2m}°C (feels like ${c.apparent_temperature}°C). Stay hydrated and avoid midday sun.` });
  else if (c.temperature_2m <= 5) items.push({ type: 'info', icon: '❄️', title: 'Low Temperature Alert', msg: `Current temperature is ${c.temperature_2m}°C. Wear warm layers outdoors.` });
  if (c.wind_speed_10m >= 35) items.push({ type: 'warning', icon: '💨', title: 'High Wind Speed Advisory', msg: `Wind speed is ${c.wind_speed_10m} km/h. Secure loose outdoor objects.` });
  if (d.uv_index_max[i] >= 8) items.push({ type: 'danger', icon: '🧴', title: 'Very High UV Radiation', msg: `Peak UV index reaches ${d.uv_index_max[i]}. Use sunscreen and minimize midday exposure.` });
  const monthly = rows.filter(row => row.time.slice(5,7) === d.time[i].slice(5,7));
  if (monthly.length) {
    const baseline = mean(monthly.map(row => row.values[2])), diff = c.temperature_2m - baseline;
    if (Math.abs(diff) >= 2) items.push({ type: 'info', icon: '📈', title: 'Climate Anomaly', msg: `Current temperature is ${round(Math.abs(diff))}°C ${diff > 0 ? 'warmer' : 'cooler'} than the historical monthly baseline (${round(baseline)}°C).` });
  }
  return items;
}
export async function weatherPayload(params: URLSearchParams, fetcher: Fetcher = fetch) {
  const lat = coordinate(params, 'lat', 13.0878, 90), lon = coordinate(params, 'lon', 80.2785, 180);
  const timezone = params.get('timezone') || 'auto';
  const [fc, hist] = await Promise.all([forecast(lat, lon, timezone, fetcher), historical(lat, lon, timezone, fetcher)]);
  const data = fc.data, d = data.daily, c = data.current, idx = todayIndex(data);
  const cards = d.time.slice(idx, idx + 7).map((time, offset) => {
    const i = idx + offset, date = new Date(`${time}T12:00:00Z`);
    return { day: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      date: date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' }), full_date: time,
      weather_code: d.weather_code[i], ...wmo(d.weather_code[i]), max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
      rain_prob: d.precipitation_probability_max[i], precip_sum: d.precipitation_sum[i], wind_speed: d.wind_speed_10m_max[i], uv_index: d.uv_index_max[i] };
  });
  const sample = hist.rows.slice(-180);
  return { city: { name: params.get('city') || 'Chennai', country: params.get('country') || '', lat, lon, timezone },
    is_mock: fc.mock || hist.mock, forecast_is_mock: fc.mock, historical_is_mock: hist.mock,
    current: { temp: c.temperature_2m, feels_like: c.apparent_temperature, humidity: c.relative_humidity_2m, wind_spd: c.wind_speed_10m,
      pressure: c.surface_pressure, weather_code: c.weather_code, ...wmo(c.weather_code), today_max: d.temperature_2m_max[idx],
      today_min: d.temperature_2m_min[idx], today_rain_prob: d.precipitation_probability_max[idx], today_precip: d.precipitation_sum[idx], today_uv: d.uv_index_max[idx] },
    forecast_7day: cards, ml: machineLearning(hist.rows, data), insights: insights(data, hist.rows), risk: risk(data),
    historical: { dates: sample.map(row => row.time), t_max: sample.map(row => row.values[0]), t_min: sample.map(row => row.values[1]),
      t_mean: sample.map(row => row.values[2]), precip: sample.map(row => row.values[3]), humidity: sample.map(row => row.values[5]), pressure: sample.map(row => row.values[6]) } };
}
export async function comparison(params: URLSearchParams, fetcher: Fetcher = fetch) {
  // Validate both cities before requesting any provider data.
  const cities = [1,2].map(i => ({ lat: coordinate(params, `lat${i}`, i === 1 ? 13.0878 : 40.7128, 90),
    lon: coordinate(params, `lon${i}`, i === 1 ? 80.2785 : -74.006, 180), name: params.get(`name${i}`) || (i === 1 ? 'Chennai' : 'New York') }));
  const results = await Promise.all(cities.map(async city => {
    const fc = await forecast(city.lat, city.lon, 'auto', fetcher), { current: c, daily: d } = fc.data, idx = todayIndex(fc.data);
    return { name: city.name, temp: c.temperature_2m, feels_like: c.apparent_temperature, humidity: c.relative_humidity_2m,
      wind: c.wind_speed_10m, pressure: c.surface_pressure, ...wmo(c.weather_code), is_mock: fc.mock,
      dates: d.time.slice(idx, idx + 7), max: d.temperature_2m_max.slice(idx, idx + 7), min: d.temperature_2m_min.slice(idx, idx + 7) };
  }));
  return { city1: results[0], city2: results[1] };
}
