// Test-only SC-003 procedure. Thresholds are declared before collecting observations.
export const meterPolicy = {
  pairsPerRound: 4,
  minimumBaselineFps: 24,
  maximumBaselineP95ToMedian: 2,
  maximumBaselineSpread: 0.2,
  minimumFpsRatio: 0.8,
  maximumInteractionRatio: 1.2,
};

function positiveSamples(samples) {
  if (
    !Array.isArray(samples) ||
    samples.length === 0 ||
    samples.some((value) => !Number.isFinite(value) || value <= 0)
  ) {
    throw new Error('Missing or invalid paired measurement samples');
  }
  return [...samples].sort((left, right) => left - right);
}

function median(sorted) {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function phaseMetrics(phase) {
  if (!phase || typeof phase.visible !== 'boolean') throw new Error('Missing phase visibility');
  const frames = positiveSamples(phase.frameIntervalsMs);
  const interactions = positiveSamples(phase.interactionBatchesMs);
  if (frames.length < 2 || interactions.length !== 5)
    throw new Error('Incomplete paired measurement phase');
  const elapsedMs = frames.reduce((total, value) => total + value, 0);
  if (elapsedMs + 1e-6 < 1500) throw new Error('Frame measurement window did not complete');
  return {
    fps: (frames.length * 1000) / elapsedMs,
    frameMedianMs: median(frames),
    frameP95Ms: frames[Math.ceil(frames.length * 0.95) - 1],
    interactionMs: median(interactions),
    visible: phase.visible,
  };
}

export function evaluateMeterComparisons(rounds) {
  if (!rounds.length) throw new Error('No meter comparison rounds');
  const pairs = rounds.flatMap((round) => {
    if (round.comparisons?.length !== meterPolicy.pairsPerRound) {
      throw new Error(`Expected four meter comparison pairs in round ${round.round}`);
    }
    return round.comparisons.map((pair, index) => {
      const expectedOrder = index % 2 === 0 ? ['baseline', 'metered'] : ['metered', 'baseline'];
      if (
        pair.benchmark !== 'mixer-metering' ||
        pair.pair !== index ||
        JSON.stringify(pair.order) !== JSON.stringify(expectedOrder)
      ) {
        throw new Error('Missing, duplicate, or incorrectly ordered meter comparison pair');
      }
      const baseline = phaseMetrics(pair.baseline);
      const metered = phaseMetrics(pair.metered);
      return {
        round: round.round,
        pair: index,
        baseline,
        metered,
        fpsRatio: metered.fps / baseline.fps,
        interactionRatio: metered.interactionMs / baseline.interactionMs,
      };
    });
  });
  const baselineRates = pairs.map((pair) => pair.baseline.fps);
  const baselineSpread =
    (Math.max(...baselineRates) - Math.min(...baselineRates)) / Math.max(...baselineRates);
  const reasons = [];
  if (pairs.some(({ baseline, metered }) => !baseline.visible || !metered.visible))
    reasons.push('A measurement page was hidden');
  if (pairs.some(({ baseline }) => baseline.fps < meterPolicy.minimumBaselineFps))
    reasons.push('Baseline throughput was below 24 FPS');
  if (
    pairs.some(
      ({ baseline }) =>
        baseline.frameP95Ms > baseline.frameMedianMs * meterPolicy.maximumBaselineP95ToMedian,
    )
  )
    reasons.push('Baseline frame-time p95 exceeded twice its median');
  if (baselineSpread > meterPolicy.maximumBaselineSpread)
    reasons.push('Baseline throughput varied by more than 20% across planned pairs');
  const fpsRatio = median(pairs.map((pair) => pair.fpsRatio).sort((a, b) => a - b));
  const interactionRatio = median(pairs.map((pair) => pair.interactionRatio).sort((a, b) => a - b));
  const exceedsBudget =
    fpsRatio < meterPolicy.minimumFpsRatio ||
    interactionRatio > meterPolicy.maximumInteractionRatio;
  return {
    benchmark: 'mixer-metering',
    status: reasons.length ? 'inconclusive' : exceedsBudget ? 'failed' : 'passed',
    reasons,
    policy: meterPolicy,
    pairs,
    aggregate: { fpsRatio, interactionRatio, baselineSpread },
  };
}
