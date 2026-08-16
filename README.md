# Thomas (Tommy) — process agent
# Graves Continuum — Universal Personalized Medicine platform

## Graves Continuum (production UPM platform)

Continuum operationalizes the five-stage universal personalized medicine blueprint:

1. Continuous multi-omic biosensing & diagnostic ingestion  
2. Federated data processing & trans-ancestry risk profiling  
3. Biological digital twin simulation (SDE)  
4. Preclinical organoid validation & neoantigen therapy design  
5. Outcomes-based reimbursement (OBRSA) & closed-loop feedback  

### Quick start

```bash
npm install
npm run build:continuum   # shared + engines + api types
npm run dev:continuum-api # http://localhost:8790
npm run dev:continuum     # http://localhost:5175
```

Open http://localhost:5175 — use the seeded cohort (Amara Okonkwo, Li Wei, Sofía Méndez) or admit a new patient. Each patient dossier runs real engines:

| Engine | What it computes |
|---|---|
| Trans-ancestry PRS | `Σ_j Σ_k w_jk · β_jk · X_ij` blended by admixture |
| Digital Twin | Euler–Maruyama integration of `dS = f(S,θ,E)dt + G(S)dW` |
| Diagnostic router | NGS / DETECTR / SHERLOCK / liquid biopsy selection |
| Liquid biopsy MRD | log(AF) OLS kinetics, doubling time, clearance probability |
| Neoantigen rank | MHC-I binding IC50 + immunogenicity → mRNA/SLP/exosome |
| Organoid gate | PERK-CHOP / IRE1-XBP1s stress + viability |
| Federated Beacon | Aggregate thresholding against membership inference |
| OBRSA | Tiered manufacturer rebates on missed molecular milestones |

### Layout

```
apps/continuum            # Clinical console (Vite/React)
services/continuum-api    # Express API on :8790
packages/bio-engines      # Pure scientific engines + tests
packages/upm-shared       # Shared domain types
data/continuum            # Local patient / contract store
```

### Tests

```bash
npm run test:engines
```

---

## Thomas (legacy process agent)

Thin React feeder + visuals; 14-stage Graves thinking pipeline.

```bash
npm run dev:api        # http://localhost:8787
npm run dev:feeder     # http://localhost:5173
npm run dev:visuals    # http://localhost:5174
```

See prior commits for Thomas personality / Vertex adapters. GCP notes remain in [infra/README.md](infra/README.md).
