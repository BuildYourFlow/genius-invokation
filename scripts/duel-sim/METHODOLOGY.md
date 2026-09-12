# Preregistered real-engine comparison

Frozen before main sample execution, 2026-09-12.

Engine: repository core 0.20.8, data v7.0.0. This is the open-source rules
implementation, not the proprietary official client. Exact share codes and
decoded cards are retained in every result. Never replace matches with a model.

Primary: 2,000 attempts, seeds 710000–711999. Even trial index uses deck 0
in seat 0; odd index uses deck 1. Engine initializes currentTurn to 0.
Thus 1,000 starts for each deck. Independent seed per attempt; no outcome-based
stopping. Execution may run in parallel; trial order is the numerical index.
Sensitivity: 400 attempts, seeds 810000–810399, same alternation, resource policy.
Smoke seeds 700012–700031 are excluded from estimates. Policy coefficients
must not be tuned on the main/sensitivity results.

Both seats use exactly the same policy function and budget. Inputs are the
engine's player-specific exposed state, legal candidates/previews and public
character element metadata. No opponent hands, piles, seed, full Game state,
deck label or special rules by character/card identity enter the policy.
The primary greedy policy scores signed health changes, defeats, public entity
creation, energy, dice cost and utility of active elements; keeps active-element
and omni dice, and uses deterministic candidate-order tie breaks. Mulligan is
disabled and card selection uses first candidate. The resource variant adds
fast-card preference, efficiency, health-sensitive switches and omni conservation.
It is a richer candidate, not assumed stronger. Its comparison is a policy
sensitivity check; results do not establish optimal play or ladder strength.

Validity: only engine terminal outcomes without thrown errors or onIoError
are usable. Technical forfeits have no winnerDeck. Draws and technical errors
are counted separately; neither becomes a win. No silent replacements. If any
error occurs, stop dispatching new shards, diagnose, and preserve original rows.
Every attempt is appended immediately to JSONL, including seed, seat assignment,
terminal phase, health, rounds, duration and action counts. Durations are wall
clock under parallel load, not human game time. Source SHA256 hashes accompany
each shard. Never compare duration as pure algorithmic speed across load levels.

Analysis: Wilson 95% intervals for decisive-game win proportions, overall and
within starting seat; also report all-valid-game win fractions if draws exist.
Seat effect is overall seat-0 win rate and deck-specific first-minus-second
win-rate difference. Report rounds/time mean, median, p95 and ranges.
Sensitivity includes second policy and primary first/second halves. These
secondary comparisons are descriptive without multiple-testing correction.
Wilson intervals describe randomness under fixed policies, not policy/model error.

Blind mapping: SHA256('duel-blind-20260912') first byte modulo 2 chooses which
deck becomes A. Only aggregate A/B statistics are written to blind-input.json.
A separate deterministic judge program receives only that file. Rule fixed
before results: choose A if primary A Wilson lower bound > .5, B if upper < .5,
otherwise inconclusive. Opposite statistically clear sensitivity winner changes
verdict to policy-dependent. Missing sensitivity is disclosed. Technical errors
or incomplete primary sample prevent a definitive verdict. Save verdict before
opening the mapping for the report. This is a transparent statistical judge,
not an independent human or an LLM claiming access to hidden information.
