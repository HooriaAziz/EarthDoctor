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

function erfc(x) {
  const absoluteX = Math.abs(x);
  const t = 1 / (1 + 0.5 * absoluteX);
  const answer =
    t *
    Math.exp(
      -absoluteX * absoluteX -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t *
                                  (1.48851587 +
                                    t * (-0.82215223 + t * 0.17087277))))))))
    );

  return x >= 0 ? answer : 2 - answer;
}

function normalTwoSidedPValue(zScore) {
  return Math.min(1, Math.max(0, erfc(Math.abs(zScore) / Math.SQRT2)));
}

function inverseNormal(p) {
  if (!(p > 0 && p < 1)) {
    throw new RangeError("Probability must be between 0 and 1.");
  }

  const a = [
    -39.6968302866538, 220.946098424522, -275.928510446969,
    138.357751867269, -30.6647980661472, 2.50662827745924,
  ];
  const b = [
    -54.4760987982241, 161.585836858041, -155.698979859887,
    66.8013118877197, -13.2806815528857,
  ];
  const c = [
    -0.00778489400243029, -0.322396458041136, -2.40075827716184,
    -2.54973253934373, 4.37466414146497, 2.93816398269878,
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
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    return p < low ? result : -result;
  }

  const q = p - 0.5;
  const r = q * q;
  return (
    (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

function calculateMannKendall(points) {
  const n = points.length;
  let s = 0;

  for (let i = 0; i < n - 1; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const difference = points[j].value - points[i].value;
      if (difference > 0) s += 1;
      if (difference < 0) s -= 1;
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
      tiedPairs += (count * (count - 1)) / 2;
    }
  }

  const variance =
    (n * (n - 1) * (2 * n + 5) - tieCorrection) / 18;

  let zScore = 0;
  if (variance > 0) {
    const standardDeviation = Math.sqrt(variance);
    if (s > 0) zScore = (s - 1) / standardDeviation;
    if (s < 0) zScore = (s + 1) / standardDeviation;
  }

  const totalPairs = (n * (n - 1)) / 2;
  const tauDenominator = Math.sqrt(totalPairs * (totalPairs - tiedPairs));

  return {
    s,
    variance,
    zScore,
    pValue: normalTwoSidedPValue(zScore),
    tau: tauDenominator > 0 ? s / tauDenominator : 0,
  };
}

function calculateSenSlopes(points) {
  const slopes = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const yearDifference = points[j].year - points[i].year;
      if (yearDifference > 0) {
        slopes.push(
          (points[j].value - points[i].value) / yearDifference
        );
      }
    }
  }
  return slopes;
}

function calculateSenSlopeConfidenceInterval(points, variance, alpha) {
  const slopes = calculateSenSlopes(points).sort((a, b) => a - b);
  if (!slopes.length) return null;

  if (!(variance > 0)) {
    return {
      levelPercent: (1 - alpha) * 100,
      lowerPerYear: slopes[0],
      upperPerYear: slopes[slopes.length - 1],
      method: "Descriptive slope range; Mann–Kendall variance is zero",
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
  const meanYear = points.reduce((sum, point) => sum + point.year, 0) / n;
  const meanValue = points.reduce((sum, point) => sum + point.value, 0) / n;

  let sumXX = 0;
  let sumXY = 0;
  let sumYY = 0;

  for (const point of points) {
    const dx = point.year - meanYear;
    const dy = point.value - meanValue;
    sumXX += dx * dx;
    sumXY += dx * dy;
    sumYY += dy * dy;
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
    rSquared:
      sumYY > 0
        ? Math.max(0, Math.min(1, 1 - residualSumSquares / sumYY))
        : null,
  };
}

/**
 * Non-parametric trend analysis for annual or otherwise evenly interpreted
 * time-series observations. Years may contain gaps, but must be unique.
 *
 * p-values use the two-sided asymptotic normal approximation to Mann–Kendall.
 * Standard Mann–Kendall does not correct for serial autocorrelation.
 */
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
    .filter(
      (point) =>
        point &&
        Number.isFinite(Number(point.year)) &&
        Number.isFinite(Number(point.value))
    )
    .map((point) => ({
      year: Number(point.year),
      value: Number(point.value),
    }))
    .sort((a, b) => a.year - b.year);

  for (let index = 1; index < points.length; index += 1) {
    if (points[index].year === points[index - 1].year) {
      throw new Error(`Duplicate observation year: ${points[index].year}`);
    }
  }

  const sampleSize = points.length;
  if (sampleSize < minimumObservations) {
    return {
      status: "insufficient_data",
      sampleSize,
      minimumObservations,
      alpha,
      message: `At least ${minimumObservations} valid observations are required.`,
    };
  }

  const first = points[0];
  const last = points[sampleSize - 1];
  const observedChange = last.value - first.value;
  const observedChangePercent =
    first.value !== 0
      ? (observedChange / Math.abs(first.value)) * 100
      : null;

  const mannKendall = calculateMannKendall(points);
  const senSlopePerYear = median(calculateSenSlopes(points));
  const confidenceInterval = calculateSenSlopeConfidenceInterval(
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

  const yearSpan =
    Number.isInteger(first.year) && Number.isInteger(last.year)
      ? last.year - first.year + 1
      : null;

  return {
    status: "ok",
    trend: isSignificant ? direction : "no_significant_trend",
    direction,
    isSignificant,
    alpha,
    sampleSize,
    startYear: first.year,
    endYear: last.year,
    durationYears: last.year - first.year,
    firstValue: first.value,
    lastValue: last.value,
    observedChange,
    observedChangePercent,
    senSlopePerYear,
    senSlopePerDecade: senSlopePerYear * 10,
    estimatedChangeAcrossPeriod:
      senSlopePerYear * (last.year - first.year),
    senSlopeConfidenceInterval: confidenceInterval,
    mannKendallS: mannKendall.s,
    mannKendallVariance: mannKendall.variance,
    mannKendallTau: mannKendall.tau,
    zScore: mannKendall.zScore,
    pValue: mannKendall.pValue,
    linearRegression: calculateLinearRegression(points),
    dataQuality: {
      invalidObservationCount: inputPoints.length - sampleSize,
      missingCalendarYears:
        yearSpan === null ? null : Math.max(0, yearSpan - sampleSize),
    },
    method: "Mann–Kendall test with Sen's slope",
    pValueMethod: "Two-sided asymptotic normal approximation",
    limitation:
      "Exploratory result. Standard Mann–Kendall does not adjust for temporal autocorrelation; the Sen slope confidence interval is approximate.",
  };
}
