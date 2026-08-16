import type {
  ExposomeInput,
  MultiOmicState,
  TwinParameters,
  TwinSimulationResult,
  TwinTrajectoryPoint,
} from "@graves/upm-shared";

/**
 * Biological Digital Twin as a stochastic differential equation:
 *   dS(t) = f(S(t), θ, E(t)) dt + G(S(t)) dW(t)
 *
 * Integrated with Euler–Maruyama. State channels are multi-omic proxies
 * (inflammation, metabolic load, immune activation, tumor burden,
 * epigenetic age acceleration, microbiome dysbiosis).
 */
export function simulateDigitalTwin(opts: {
  initial: MultiOmicState;
  params: TwinParameters;
  exposome: ExposomeInput;
  horizonDays: number;
  dtDays?: number;
  seed?: number;
  therapyEffect?: Partial<MultiOmicState>;
}): TwinSimulationResult {
  const dt = opts.dtDays ?? 0.5;
  const steps = Math.max(1, Math.floor(opts.horizonDays / dt));
  const rng = mulberry32(opts.seed ?? 42);
  const therapy = opts.therapyEffect ?? {};

  let state: MultiOmicState = { ...opts.initial };
  const trajectory: TwinTrajectoryPoint[] = [
    { tDays: 0, state: { ...state }, riskIndex: riskIndex(state) },
  ];

  for (let i = 1; i <= steps; i++) {
    const drift = deterministicDrift(state, opts.params, opts.exposome, therapy);
    const next: MultiOmicState = { ...state };
    for (const key of STATE_KEYS) {
      const noise =
        opts.params.noiseScale *
        diffusionScale(state[key]) *
        Math.sqrt(dt) *
        gaussian(rng);
      next[key] = clamp01(state[key] + drift[key] * dt + noise);
    }
    state = next;
    if (i % Math.max(1, Math.round(1 / dt)) === 0 || i === steps) {
      trajectory.push({
        tDays: i * dt,
        state: { ...state },
        riskIndex: riskIndex(state),
      });
    }
  }

  const finalRisk = riskIndex(state);
  const onsetProbability90d = logistic(2.2 * finalRisk - 0.9);
  const predictedResponseScore = clamp01(
    1 -
      0.45 * state.tumorBurden -
      0.25 * state.inflammation +
      0.2 * opts.params.immuneResponsiveness -
      0.15 * state.metabolicLoad,
  );

  return {
    horizonDays: opts.horizonDays,
    trajectory,
    onsetProbability90d,
    predictedResponseScore,
    narrative: narrate(state, onsetProbability90d, predictedResponseScore),
  };
}

const STATE_KEYS: (keyof MultiOmicState)[] = [
  "inflammation",
  "metabolicLoad",
  "immuneActivation",
  "tumorBurden",
  "epigeneticAgeAccel",
  "microbiomeDysbiosis",
];

function deterministicDrift(
  s: MultiOmicState,
  θ: TwinParameters,
  e: ExposomeInput,
  therapy: Partial<MultiOmicState>,
): MultiOmicState {
  const air = e.airQualityIndex / 500;
  const diet = e.dietaryInflammatoryIndex;
  const toxin = e.toxinLoad;
  const pathogen = e.pathogenPressure;

  return {
    inflammation: clamp(
      -θ.recoveryRate * s.inflammation +
        0.35 * diet +
        0.25 * air +
        0.2 * s.microbiomeDysbiosis +
        0.15 * pathogen -
        (therapy.inflammation ?? 0),
      -1,
      1,
    ),
    metabolicLoad: clamp(
      -0.4 * θ.recoveryRate * s.metabolicLoad +
        θ.metabolicSensitivity * (0.5 * diet + 0.3 * toxin) +
        0.15 * s.inflammation -
        (therapy.metabolicLoad ?? 0),
      -1,
      1,
    ),
    immuneActivation: clamp(
      θ.immuneResponsiveness * (0.3 * pathogen + 0.25 * s.tumorBurden) -
        0.35 * s.metabolicLoad -
        (therapy.immuneActivation ?? 0) * 0.2,
      -1,
      1,
    ),
    tumorBurden: clamp(
      0.08 * s.tumorBurden * (1 - s.tumorBurden) +
        0.12 * s.inflammation -
        0.35 * θ.immuneResponsiveness * s.immuneActivation -
        (therapy.tumorBurden ?? 0),
      -1,
      1,
    ),
    epigeneticAgeAccel: clamp(
      0.05 * toxin + 0.04 * s.inflammation + 0.03 * s.metabolicLoad - 0.02 * θ.recoveryRate,
      -1,
      1,
    ),
    microbiomeDysbiosis: clamp(
      -0.3 * θ.recoveryRate * s.microbiomeDysbiosis +
        0.25 * diet +
        0.15 * pathogen -
        (therapy.microbiomeDysbiosis ?? 0),
      -1,
      1,
    ),
  };
}

function diffusionScale(x: number): number {
  return 0.08 + 0.12 * Math.sqrt(Math.max(0, x * (1 - x)));
}

export function riskIndex(s: MultiOmicState): number {
  return clamp01(
    0.28 * s.tumorBurden +
      0.2 * s.inflammation +
      0.16 * s.metabolicLoad +
      0.14 * s.epigeneticAgeAccel +
      0.12 * s.microbiomeDysbiosis +
      0.1 * Math.abs(s.immuneActivation - 0.45),
  );
}

function narrate(
  s: MultiOmicState,
  onset: number,
  response: number,
): string {
  const drivers: string[] = [];
  if (s.tumorBurden > 0.45) drivers.push("elevated tumor-burden proxy");
  if (s.inflammation > 0.5) drivers.push("persistent inflammatory tone");
  if (s.metabolicLoad > 0.5) drivers.push("metabolic stress");
  if (s.microbiomeDysbiosis > 0.45) drivers.push("microbiome dysbiosis");
  if (s.epigeneticAgeAccel > 0.4) drivers.push("epigenetic age acceleration");
  const driverText =
    drivers.length > 0 ? drivers.join(", ") : "balanced multi-omic channels";
  return `Twin projects ${(onset * 100).toFixed(0)}% 90-day adverse-onset probability with predicted therapy response ${(response * 100).toFixed(0)}%. Dominant drivers: ${driverText}.`;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function gaussian(rng: () => number): number {
  const u = Math.max(1e-12, rng());
  const v = Math.max(1e-12, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
