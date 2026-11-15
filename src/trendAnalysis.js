
import "./CountryEmissionsProfile.css";
import { getEdgarCountryProfile } from "./assets/edgarData.js";
import { analyzeEdgarCountry } from "./assets/trendAnalysis.js";
const DEFAULT_ALPHA = 0.05;
const MINIMUM_OBSERVATIONS = 8;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function erfc(x) {
  const absoluteX = Math.abs(x);
  const t = 1 / (1 + 0.5 * absoluteX);

  const answer = t * Math.exp(
    -absoluteX * absoluteX - 1.26551223 +
    t * (1.00002368 +
    t * (0.37409196 +
    t * (0.09678418 +
    t * (-0.18628806 +
    t * (0.27886807 +
    t * (-1.13520398 +
    t * (1.48851587 +
    t * (-0.82215223 +
    t * 0.17087277))))))))
  );

  return x >= 0 ? answer : 2 - answer;
}

function calculatePValue(zScore) {
  return Math.min(1, Math.max(0, erfc(Math.abs(zScore) / Math.SQRT2)));
}

function calculateMannKendall(points) {
  const n = points.length;
  let s = 0;

  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const difference = points[j].value - points[i].value;
      if (difference > 0) s++;
      if (difference < 0) s--;
    }
  }

  const counts = new Map();
  for (const point of points) {
    counts.set(point.value, (counts.get(point.value) || 0) + 1);
  }

  let tieCorrection = 0;
  let tiedPairs = 0;

  for (const count of counts.values()) {
    if (count > 1) {
      tieCorrection += count * (count - 1) * (2 * count + 5);
      tiedPairs += count * (count - 1) / 2;
    }
  }

  const variance =
    (n * (n - 1) * (2 * n + 5) - tieCorrection) / 18;

  let zScore = 0;

  if (variance > 0) {
    const sd = Math.sqrt(variance);
    if (s > 0) zScore = (s - 1) / sd;
    if (s < 0) zScore = (s + 1) / sd;
  }

  const totalPairs = n * (n - 1) / 2;
  const denominator = Math.sqrt(totalPairs * (totalPairs - tiedPairs));

  return {
    s,
    variance,
    zScore,
    pValue: calculatePValue(zScore),
    tau: denominator > 0 ? s / denominator : 0,
  };
}

function calculateSensSlopes(points) {
  const slopes = [];

  for (let i = 0; i < points.length - 1; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const years = points[j].year - points[i].year;
      if (years > 0) {
        slopes.push((points[j].value - points[i].value) / years);
      }
    }
  }

  return slopes;
}

function calculateDescriptiveStatistics(points) {
  const values = points.map((point) => point.value);
  const n = values.length;
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const middle = median(values);

  const variance = n > 1
    ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)
    : null;

  const standardDeviation = variance === null ? null : Math.sqrt(variance);
  const q1 = percentile(values, 0.25);
  const q3 = percentile(values, 0.75);

  const minimumPoint = points.reduce((best, point) =>
    point.value < best.value ? point : best
  );

  const maximumPoint = points.reduce((best, point) =>
    point.value > best.value ? point : best
  );

  const changes = [];

  for (let i = 1; i < points.length; i++) {
    const years = points[i].year - points[i - 1].year;
    if (years > 0) {
      changes.push((points[i].value - points[i - 1].value) / years);
    }
  }

  const first = points[0];
  const last = points[n - 1];
  const duration = last.year - first.year;

  const annualizedPercentChange =
    duration > 0 && first.value > 0 && last.value > 0
      ? (Math.pow(last.value / first.value, 1 / duration) - 1) * 100
      : null;

  const yearSpan =
    Number.isInteger(first.year) && Number.isInteger(last.year)
      ? last.year - first.year + 1
      : null;

  return {
    mean,
    median: middle,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    range: Math.max(...values) - Math.min(...values),
    sampleVariance: variance,
    sampleStandardDeviation: standardDeviation,
    firstQuartile: q1,
    thirdQuartile: q3,
    interquartileRange: q3 - q1,
    medianAbsoluteDeviation: median(
      values.map((value) => Math.abs(value - middle))
    ),
    coefficientOfVariationPercent:
      mean !== 0 && standardDeviation !== null
        ? standardDeviation / Math.abs(mean) * 100
        : null,
    minimumYear: minimumPoint.year,
    maximumYear: maximumPoint.year,
    meanAnnualChange: changes.length
      ? changes.reduce((sum, value) => sum + value, 0) / changes.length
      : null,
    medianAnnualChange: median(changes),
    annualizedPercentChange,
    missingCalendarYears:
      yearSpan === null ? null : Math.max(0, yearSpan - n),
  };
}

function inverseNormal(p) {
  if (p <= 0 || p >= 1) {
    throw new RangeError("Probability must be between 0 and 1.");
  }

  const a = [
    -39.6968302866538, 220.946098424522,
    -275.928510446969, 138.357751867269,
    -30.6647980661472, 2.50662827745924,
  ];
  const b = [
    -54.4760987982241, 161.585836858041,
    -155.698979859887, 66.8013118877197,
    -13.2806815528857,
  ];
  const c = [
    -0.00778489400243029, -0.322396458041136,
    -2.40075827716184, -2.54973253934373,
    4.37466414146497, 2.93816398269878,
  ];
  const d = [
    0.00778469570904146, 0.32246712907004,
    2.445134137143, 3.75440866190742,
  ];

  const low = 0.02425;
  const high = 1 - low;

  if (p < low || p > high) {
    const probability = p < low ? p : 1 - p;
    const q = Math.sqrt(-2 * Math.log(probability));

    const result =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q +
        c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);

    return p < low ? result : -result;
  }

  const q = p - 0.5;
  const r = q * q;

  return (
    (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r +
      a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r +
      b[4]) * r + 1)
  );
}

function calculateSenSlopeConfidenceInterval(points, variance, alpha) {
  const slopes = calculateSensSlopes(points).sort((a, b) => a - b);
  if (!slopes.length) return null;

  if (variance <= 0) {
    return {
      levelPercent: (1 - alpha) * 100,
      lowerPerYear: slopes[0],
      upperPerYear: slopes[slopes.length - 1],
      method: "Degenerate variance; descriptive slope range",
    };
  }

  const criticalZ = inverseNormal(1 - alpha / 2);
  const count = slopes.length;
  const rank = criticalZ * Math.sqrt(variance);

  const lowerIndex = Math.max(
    0,
    Math.min(count - 1, Math.ceil((count - rank) / 2) - 1)
  );

  const upperIndex = Math.max(
    0,
    Math.min(count - 1, Math.floor((count + rank) / 2))
  );

  return {
    levelPercent: (1 - alpha) * 100,
    lowerPerYear: slopes[Math.min(lowerIndex, upperIndex)],
    upperPerYear: slopes[Math.max(lowerIndex, upperIndex)],
    method: "Approximate normal-based Sen slope interval",
  };
}

function calculateLinearRegression(points) {
  const n = points.length;
  const meanYear = points.reduce((sum, p) => sum + p.year, 0) / n;
  const meanValue = points.reduce((sum, p) => sum + p.value, 0) / n;

  let sumXX = 0;
  let sumXY = 0;
  let sumYY = 0;

  for (const point of points) {
    const dx = point.year - meanYear;
    const dy = point.value - meanValue;
    sumXX += dx ** 2;
    sumXY += dx * dy;
    sumYY += dy ** 2;
  }

  if (sumXX === 0) return null;

  const slopePerYear = sumXY / sumXX;
  const intercept = meanValue - slopePerYear * meanYear;

  let residualSumSquares = 0;

  for (const point of points) {
    const predicted = intercept + slopePerYear * point.year;
    residualSumSquares += (point.value - predicted) ** 2;
  }

  return {
    slopePerYear,
    slopePerDecade: slopePerYear * 10,
    intercept,
    rSquared: sumYY > 0
      ? Math.max(0, Math.min(1, 1 - residualSumSquares / sumYY))
      : null,
    correlation: sumXX > 0 && sumYY > 0
      ? sumXY / Math.sqrt(sumXX * sumYY)
      : null,
  };
}

export function analyzeTimeSeries(inputPoints, options = {}) {
  const alpha = options.alpha ?? DEFAULT_ALPHA;
  const minimumObservations =
    options.minimumObservations ?? MINIMUM_OBSERVATIONS;

  if (!Array.isArray(inputPoints)) {
    throw new TypeError("Time-series data must be an array.");
  }

  if (!(alpha > 0 && alpha < 1)) {
    throw new RangeError("Alpha must be greater than 0 and less than 1.");
  }

  if (!Number.isInteger(minimumObservations) || minimumObservations < 2) {
    throw new RangeError("Minimum observations must be an integer of at least 2.");
  }

  const points = inputPoints
    .filter((point) =>
      point &&
      Number.isFinite(Number(point.year)) &&
      Number.isFinite(Number(point.value))
    )
    .map((point) => ({
      year: Number(point.year),
      value: Number(point.value),
    }))
    .sort((a, b) => a.year - b.year);

  for (let i = 1; i < points.length; i++) {
    if (points[i].year === points[i - 1].year) {
      throw new Error(`Duplicate observation year: ${points[i].year}`);
    }
  }

  const sampleSize = points.length;

  if (sampleSize < minimumObservations) {
    return {
      status: "insufficient_data",
      trend: "insufficient_data",
      sampleSize,
      minimumObservations,
      alpha,
      message: `At least ${minimumObservations} valid observations are required.`,
    };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const observedChange = last.value - first.value;

  const observedChangePercent = first.value !== 0
    ? observedChange / Math.abs(first.value) * 100
    : null;

  const mannKendall = calculateMannKendall(points);
  const senSlopePerYear = median(calculateSensSlopes(points));
  const senSlopePerDecade = senSlopePerYear * 10;
  const descriptiveStatistics = calculateDescriptiveStatistics(points);
  const linearRegression = calculateLinearRegression(points);

  const senSlopeConfidenceInterval =
    calculateSenSlopeConfidenceInterval(
      points,
      mannKendall.variance,
      alpha
    );

  const isSignificant = mannKendall.pValue < alpha;

  const direction =
    senSlopePerYear > 0
      ? "increasing"
      : senSlopePerYear < 0
        ? "decreasing"
        : "stable";

  return {
    status: "ok",
    trend: isSignificant ? direction : "no_significant_trend",
    direction,
    isSignificant,
    alpha,
    significanceLabel: isSignificant
      ? "Statistically significant"
      : "Not statistically significant",
    sampleSize,
    startYear: first.year,
    endYear: last.year,
    durationYears: last.year - first.year,
    firstValue: first.value,
    lastValue: last.value,
    observedChange,
    observedChangePercent,
    senSlopePerYear,
    senSlopePerDecade,
    estimatedChangeAcrossPeriod:
      senSlopePerYear * (last.year - first.year),
    senSlopeConfidenceInterval,
    mannKendallS: mannKendall.s,
    mannKendallVariance: mannKendall.variance,
    mannKendallTau: mannKendall.tau,
    zScore: mannKendall.zScore,
    pValue: mannKendall.pValue,
    descriptiveStatistics,
    linearRegression,
    dataQuality: {
      invalidObservationCount: inputPoints.length - sampleSize,
      missingCalendarYears: descriptiveStatistics.missingCalendarYears,
    },
    method: "Mann-Kendall test with Sen's slope",
    pValueMethod: "Two-sided asymptotic normal approximation",
    limitation:
      "Exploratory result. Standard Mann-Kendall does not adjust for temporal autocorrelation. The Sen slope confidence interval is approximate.",
  };
}

export function analyzeEdgarCountry(location, options = {}) {
  const profile = getEdgarCountryProfile(location);

  if (!profile) {
    return {
      status: "country_not_found",
      message: `No EDGAR country profile found for: ${location}`,
    };
  }

  const years = profile.years;
  const emissions = profile.annualEmissionsMtCO2e;

  if (!Array.isArray(years) || !Array.isArray(emissions)) {
    return {
      status: "invalid_data",
      message: "The country profile does not contain valid annual emissions data.",
    };
  }

  if (years.length !== emissions.length) {
    return {
      status: "invalid_data",
      message: "The year and emissions arrays have different lengths.",
    };
  }

  const observations = years.map((year, index) => ({
    year,
    value: emissions[index],
  }));

  const result = analyzeTimeSeries(observations, options);

  return {
    ...result,
    country: profile.name,
    countryCode: profile.code,
    variable: "Total greenhouse gas emissions",
    units: "Mt CO2eq/year",
    source: "EDGAR Community GHG Database, EDGAR_2026_GHG",
  };
}
