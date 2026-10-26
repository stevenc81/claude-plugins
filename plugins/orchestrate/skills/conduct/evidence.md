# Evidence for the routing table

This file holds the numbers and sources behind the "Pick the model" table in SKILL.md, the verdict on each source, and the reason for each choice in that table. SKILL.md holds the rules, including the 5 tests for a source and how to refresh this file ("Refresh the evidence"). This file holds the facts. Do not copy benchmark scores into SKILL.md.

Checked on 2026-10-26. Two reviewers on two vendors (Claude Opus 5.5 and Gemini 4 Argon) scored 29 sources against the 5 tests. Two readers on the same two vendors then read the numbers from the sources that passed. The conductor checked each claim on which they disagreed. Rows that were not re-read keep their old date. AA = Artificial Analysis. "Tie" = the 95% intervals overlap. Where a board gives a standard error (SE), the interval is ±1.96 × SE. For Bug Hunt Bench, a tie means the ranges of the runs overlap.

Arena notes:
- arena.ai returns 403 to plain web tools. Its own dataset on Hugging Face (lmarena-ai/leaderboard-dataset, modified 2026-10-24) holds the same boards. Text, Vision and Search use its style-control subsets, the default.
- Agent Arena scores are "net improvement": a contrast in percentage points against a randomized baseline that stands for the average model. Positive is above average. The board turns every signal so that a higher shown value is better. This holds for tool hallucination too (help.arena.ai/articles/5432423882-how-to-use-agent-mode, read 2026-10-25).

## Why each choice

One line per row of the "Pick the model" table in SKILL.md. The numbers are in the sections below.

| Job | Why |
|---|---|
| Hard coding, large refactor | No primary source lists our models. Opus is clearly first on Agent Arena overall and first on Snorkel Senior SWE-bench and Vals Vibe Code Bench 1-100 (ties). Astra is the best non-Claude model on Snorkel, Code Migration and Vibe Code 1-100 (ties). |
| Routine coding with a clear scope | Sonnet leads Vals Vibe Code Bench and Code Migration (ties). 6.1 Sol ties Sonnet on Vibe Code Bench at a fifth of the cost. |
| Shell, infra and deploy work | Opus is clearly first on Agent Arena bash reliability. Of the non-Claude models, gpt-5.6-sol scores highest there. Argon scores below the average model. One board only. |
| Debugging, root cause | Bug Hunt Bench, primary: Sonnet at max has the best mean. Its runs overlap those of Astra, 6.1 Sol, Opus and Argon, so it is a tie. Astra at max is the best non-Claude model. |
| Code review | No source passed the tests. Bug Hunt Bench finds and fixes bugs, the nearest test, so the row follows Debugging. |
| Front-end and web UI | Opus is clearly first on WebDev Arena. Astra is second. Vals Vibe Code Bench puts 7 of our models in a tie. |
| Math | MathArena, primary: 6.1 Sol leads, ties Astra and Fable, and is clear of Opus. Epoch FrontierMath agrees. Opus is the best non-OpenAI model. |
| Scientific or data research that runs code | Vals MysteryMechanism: Astra leads, and ties Opus, Sonnet, Fable, 6.1 Sol and Argon. One board only. |
| Analysis, reports, documents | Five Vals boards: Opus, Fable, Sonnet and Argon tie on four. Argon is clearly first on HLAB (legal work with files). No clear winner, so the choice follows the tools: Claude reads PDFs and runs code. |
| Judgment, planning, critique | Opus leads Agent Arena steerability and Arena Instruction Following, and ties Argon on Arena Hard Prompts. Opus leads Vals KSP. Astra leads ARC-AGI-2 and 3, with no intervals. |
| Fact check of claims | FACTS Search measures answers found with web search: Astra leads, tied with 5.6 Sol and 6.1 Sol. Opus scores above Argon. Fable and Sonnet are not listed. |
| Web research across many sources | Arena Search: 5.6 Sol, 6.1 Sol and Astra tie at the top, and Fable ties Astra. Astra also leads FACTS Search. Fable is the best non-OpenAI model on Arena Search. |
| Long documents or code over 100k tokens | No source passed the tests. `agy` compacts Argon's conversation far below its 1M window (see "Long context and media"). Claude has a 1M context. |
| Video or audio input | No source passed the tests. Only Gemini takes video and audio in this setup. The video efforts follow Google's Vertex AI guide. |
| Bulk simple work | No source measures quality on simple work. Haiku has the Claude Code tools. Haiku and Flash are weak at long agent work (see "Weak spots"). |
| Speed-critical short answers | AA: Sonnet at low has the fastest first token (1.2 s). Of the non-Claude models at low, gpt-5.6-sol is fastest (2.1 s). AA tests the Gemini models at high only. |
| Images and screenshots | Roboflow: Argon leads detection, counting and OCR. Vision Arena: 6 of our models tie, and Argon is not listed. |

## Sources

Verdicts from 2026-10-26. The tests are in SKILL.md, "Refresh the evidence". Test 1 fails an operator that a model maker pays to test its models, also when no lab is named.

### Sources used

A refresh reads numbers only from these sources (SKILL.md, "Refresh the evidence").

| Source | Verdict | Failed tests and why | How to read it |
|---|---|---|---|
| MathArena | Primary | None. New contests, 4 runs per problem, 95% intervals. Epoch AI funds it with a grant. | matharena.ai/models for the headline table. matharena.ai/competition_tables/<id> for each contest. Plain web tools work. |
| Bug Hunt Bench | Primary for rows with 3 or more runs. Secondary for rows with 1 or 2 runs (test 3). | None for 3-run rows. Answer key held back, each model in its own CLI. | bughunt.productcompass.pm/data/benchmark.json. Use rows without a `superseded` note. `n_runs` gives the runs. |
| SWE-rebench | Primary, cannot decide a row | Only gpt-5.6-sol (medium, 62.3% ±1.83 SEM, 5 runs). Its newest window ends 2026-07-01. | swe-rebench.com. Use the newest time window. |
| arena.ai, all boards | Secondary | 1: it ranks its own Max router first on Agent Arena (arena.ai blog, 2026-10-12) and sells evaluations to model labs. | arena.ai returns 403 to plain web tools. Read the Hugging Face dataset lmarena-ai/leaderboard-dataset, files `<subset>/latest-00000-of-00001.parquet`, the `*_style_control` subsets. Its agent subsets hold only "overall": Agent Arena sub-boards such as Code need arena.ai in a real browser. |
| Vals AI, boards with a private test set | Secondary | 1: "Companies pay Vals to test their models" (TechCrunch, 2026-09-19). | vals.ai/benchmarks/<slug>. Use a board only if its page says the test set is private or held out (vals.ai/methodology). Skip indexes that mix in public boards. |
| Artificial Analysis, speed tests | Secondary | 1: it does custom benchmarking for AI companies. | artificialanalysis.ai/models/<slug>. The values are in the page's embedded data (`timescaleData`), prompt type "long". |
| Epoch FrontierMath | Secondary | 1: paid work for Google DeepMind and OpenAI (epoch.ai/about/transparency). OpenAI funds FrontierMath. | epoch.ai/data/benchmark_data.zip, files frontiermath_tiers_1_3_v2.csv and frontiermath_tier_4_v2.csv |
| Snorkel Senior SWE-bench | Secondary | 1. No intervals shown: pass@3 implies 3 attempts per task. | senior-swe-bench.snorkel.ai/agents |
| FACTS Search V2 (Kaggle) | Secondary | 1: Google runs it. | kaggle.com/benchmarks/google/facts-search/versions/2. The table shows only in a real browser. |
| ARC Prize | Secondary | 3: no intervals or run counts. | arcprize.org/media/data/evaluations.json and models.json |
| Roboflow Vision Evals | Secondary | 4 not shown: the page does not say the set is private, and the Reasoning page shows real samples with answers. OCR is a single run. | playground.roboflow.com/evals. WebFetch and a real browser work. |

Vendor docs and model cards are not used for ranking (tests 1 and 2). They stay the source for prices, limits and effort names.

### Sources not used

| Source | Failed tests and why |
|---|---|
| METR time horizons | Passed all 5 tests, but lists none of our models, and "This page is no longer actively updated" (last update 2026-09-08). Removed at the user's request on 2026-10-26. |
| Vals AI, boards on public task sets, and the Vals Index | 1, 4 |
| Artificial Analysis, other boards | 1, and 3 or 4. The Intelligence Index includes Terminal-Bench 4 and HLE. |
| Epoch ECI and SimpleQA Verified | 1, and 3 or 4 |
| FACTS Grounding v2 (Kaggle) | 1, 3: no interval or run count. |
| Terminal-Bench 4 (tbench.ai, Vals, AA) | 2, 4, 5: Epoch rates it "Flawed", 30 of 66 tasks (45.5%) have scoring errors. |
| LiveBench 2.0 | 1 (sponsored by Abacus.AI, which it ranks), 3 (one run per suite) |
| Scale AI Labs (HLE-Diamond, DrugDiscoveryBench, RLI, AudioMultiChallenge) | 1, and 3 or 4 |
| GitHub ReviewBench | 1 (GitHub ranks its own Copilot), 4 |
| Vectara hallucination board | 2 (setup stops at 2025 models), 3 |
| Parallel.ai search board | 1, 3, 5 |
| Gateway pages (OpenRouter, Eden AI, ZenMux) | 1 (they resell the models), 2 (live traffic, mixed prompts and settings) |
| benchlm.ai | 2: it copies other boards. |
| Deep Research Bench, HELM Long Context, Fiction.LiveBench, SWE-bench-Live, Martian Code Review Bench, tau-bench, Video-MME | 2 or more each |

## Coding and agentic work

| Fact | Numbers | Source |
|---|---|---|
| Bug Hunt Bench (primary for rows with 3 or more runs) | 105 real bugs in two TypeScript repos (a VS Code extension of about 28K lines, 45 bugs; a React/Supabase app of about 60K lines, 60 bugs). Graded blind against an answer key that is held back. Each model runs in its own CLI. Mean bugs fixed, runs, list cost: Sonnet 5.5 max 51.3 (57/54/43, $154.03), Astra max 45.0 (48/40/47, $33.03), 6.1 Sol max 44.3 (44/42/47, $5.88), 6.1 Sol xhigh 42.7 ($4.35), Opus 5.5 max 41.7 (43/39/43, $58.53), Argon high 40.7 (40/45/37, $7.16), Haiku 5.5 xhigh 18.3 ($4.80), 3.8 Flash high 18.0 ($11.03). Sonnet, Astra, 6.1 Sol, Opus and Argon tie. Rows with fewer than 3 runs: gpt-5.6-sol max 43.5 (2 runs), Fable 5.1 max 43 (1 run), Haiku max 21.5 (2 runs). The board: "Read a gap of a few points between two single runs as possible noise." | bughunt.productcompass.pm/data/benchmark.json, updated 2026-10-23, read 2026-10-26 |
| Agent Arena, overall (net improvement) | Opus max 20.8 [18.4, 23.2], Sonnet max 14.0, Astra max 14.0, Fable max 13.9, 6.1 Sol max 13.6, Argon high 11.8 [10.8, 12.7], 5.6 Sol xhigh 6.1, 3.8 Flash 3.2, Haiku high 1.1. Opus is clear. Ranks 2 to 6 tie. Median cost per task on 2026-10-23: Fable $8.07, Opus $6.37, Sonnet $4.47, Astra $4.38, Argon $1.07, Flash $0.81, 6.1 Sol $0.80, Haiku $0.10. | HF dataset, published 2026-10-23, read 2026-10-26; costs from arena.ai/leaderboard/agent, read 2026-10-25 |
| Agent Arena, Code (net improvement) | Opus 22.87±3.48, Sonnet 15.76±4.30, Astra 14.84±3.09, 6.1 Sol 14.46±2.31, Fable 13.89±2.92, Argon 10.18±1.24. Opus and Sonnet touch. Cost per Code task: Fable $21.25, Opus $13.77, Astra $10.84, Sonnet $9.01, Argon $2.40, 6.1 Sol $1.76, Flash $1.57, Haiku $0.43. The dataset holds only "overall" for agent boards, so this board was not re-read on 2026-10-26. | arena.ai/leaderboard/agent/code, 2026-10-23 |
| Agent Arena, bash reliability (net improvement) | "How often the model's bash commands succeed. Errors outside its control aren't counted." Opus 15.8 [15.3, 16.3] (#1), Sonnet 13.2, 5.6 Sol 12.0, Flash 10.9, Fable 10.6, Astra 9.3, Haiku 7.6, 6.1 Sol 3.9, Argon −4.0 [−5.2, −2.9]. Opus is clear. Sonnet ties 5.6 Sol. | HF dataset, published 2026-10-23, read 2026-10-26 |
| Snorkel Senior SWE-bench (Mini-SWE-agent, 95 scored tasks) | "Tasteful" pass@1: Opus 5.5 high 39.3 (#1; max 36.9, xhigh 34.1), Astra high 36.8, Fable 5.1 medium 34.7, gpt-5.6-sol xhigh 34.7. Basic pass@1: Opus 61.8, Astra 60.0, Fable 57.9, 5.6 Sol 53.7. No intervals shown. A binomial interval on 95 tasks is about ±10 points, so all four tie (computed by the reader, not by Snorkel). Sonnet, Haiku, 6.1 Sol, Argon and Flash not listed. | senior-swe-bench.snorkel.ai/agents, read 2026-10-26 |
| Vals Code Migration v1.1 (Pi agent harness) | Sonnet max 86.88±1.52 ($43.88 per test), Opus max 81.01±3.21, Astra max 80.58±2.34, 6.1 Sol max 77.32±2.98 ($9.51), Argon high 70.80±3.72, Haiku 52.36, Flash 38.65. Sonnet ties Opus and Astra. Grading uses a hidden suite of behavior tests, but the source programs come from open-source repos. | vals.ai/benchmarks/code-migration-v1-1, updated 2026-10-20 |
| Vals Vibe Code Bench 1-100 (extend a working web app, OpenHands) | Opus xhigh 30.36±4.83, Fable max 28.00, Astra max 27.64, Argon high 21.20, Haiku 20.41, 5.6 Sol 20.01, Flash 18.77. All tie with Opus. Sonnet and 6.1 Sol not listed. | vals.ai/benchmarks/vcb-1-100, updated 2026-10-17 |
| Vals refusals | Vals marks tasks that a fallback model served after a refusal. They fall on security work, terminal tasks, Vibe Code, BioMystery and some Legal Research, not on finance or tax. Sonnet: fallback on 3.99% of tasks. Opus: 4.28%. | vals.ai model pages, read 2026-10-25 |
| Text Arena, Coding (human preference) | Argon 1551.6 [1539.0, 1564.1], Opus 1548.0, Astra 1543.1, Fable 1537.5, 6.1 Sol 1537.2, 5.6 Sol 1533.6, Flash 1528.1, Sonnet 1528.0. Argon ties all but Flash and Haiku. | HF dataset, published 2026-10-22, read 2026-10-26 |
| SWE-rebench | gpt-5.6-sol medium 62.3% ±1.83 SEM, pass@5 79.3%, 5 runs, $0.85 per problem. Fable 5 high 64.5% (#1). No other model of ours. Window 2026-05-15 to 2026-07-01. | swe-rebench.com, read 2026-10-26 |

## Front-end and web UI

| Fact | Numbers | Source |
|---|---|---|
| WebDev Arena | Opus max 1806.9 [1793.6, 1820.3] (#1), Astra max 1774.3, Sonnet xhigh 1768.9, 6.1 Sol max 1749.3, Fable max 1742.5, Sonnet high 1709.2, Argon high 1674.2 (#11), 5.6 Sol xhigh 1615.1, Haiku high 1585.6, Flash high 1584.9. Opus is clear of all others. | HF dataset, published 2026-10-23, read 2026-10-26 |
| Image-to-WebDev Arena | Opus max 1752.6 [1728.5, 1776.6], Sonnet xhigh 1737.1, Astra 1726.2, Fable 1722.2, 6.1 Sol 1701.7, 5.6 Sol 1609.2, Flash 1592.7. Opus ties Sonnet, Astra and Fable. | HF dataset, published 2026-10-19, read 2026-10-26 |
| Vals Vibe Code Bench v1.1 (working web apps from a spec, OpenHands) | Sonnet max 92.39±1.26 ($31.25), Argon high 91.91±1.90 ($8.11), Haiku max 90.44, Opus max 90.29 ($57.92), Fable max 90.26, Astra max 89.59, 6.1 Sol max 88.93 ($6.23), 5.6 Sol 80.50, Flash 78.65. Sonnet ties all but 5.6 Sol and Flash. It grades whether the app works, not how people rate the page. | vals.ai/benchmarks/vibe-code, updated 2026-10-24 |

## Math and science

| Fact | Numbers | Source |
|---|---|---|
| MathArena, headline (primary) | IRT estimate with a 95% bootstrap interval, 4 runs per problem. 6.1 Sol max 84.0±2.3 ($0.74 per problem), Astra max 81.9±3.6 ($3.07; low 77.3±3.5), Opus high 79.0±2.3 ($3.19), Fable high 78.1±4.6 ($17.90; max 77.4±3.9, low 64.8±5.8), Argon 69.3±5.0 ($9.46), 5.6 Sol max 62.9±3.7, Flash 34.0±3.1. 6.1 Sol ties Astra and Fable high, and is clear of Opus (81.7 > 81.3). Sonnet and Haiku not listed. Opus only at high. | matharena.ai/models, read 2026-10-26 (09/2026 contests added 2026-10-16) |
| MathArena, 09/2026 contests (primary) | ArXivMath: 6.1 Sol 91.51±5.31, Argon 87.74±6.24, Opus high 82.08±7.30 (all tie), Flash 50.00. BrokenArXiv (spotting false statements): 6.1 Sol 82.70±7.20, Opus 76.73±8.04 (tie), Argon 49.69, Flash 26.73. ArXivLean: Opus 47.17±13.44, Argon 39.62, Astra 37.74, 6.1 Sol 35.85 (all tie). | matharena.ai/competition_tables, read 2026-10-26 |
| Epoch FrontierMath (private set) | Tiers 1–3 v2: 6.1 Sol max 93.68±1.44 (SE), Astra max 93.68, Opus max 91.23±1.68, Fable max 90.18, 5.6 Sol max 89.12, Sonnet max 88.77, Argon high 85.96±2.06, Haiku max 75.09, Flash high 68.42. 6.1 Sol ties Astra, Opus, Fable, 5.6 Sol and Sonnet. Tier 4 v2: 6.1 Sol 100.0, Astra 97.60, Opus 95.00, Fable 87.80, 5.6 Sol 82.93, Sonnet 80.49, Argon 78.05. | epoch.ai/data/benchmark_data.zip, newest run 2026-10-19, read 2026-10-26 |
| Vals ProofBench v1.1 (Lean proofs, private split) | Opus, Sonnet and Fable 100; 6.1 Sol, Astra and Argon 99; Haiku 89; 5.6 Sol 83; Flash 48. At its ceiling. | vals.ai/benchmarks/proof_bench, updated 2026-10-20 |
| Vals MysteryMechanism (find hidden mechanisms by experiment) | Astra 53.15±3.36, Opus 49.55, Sonnet 49.10, Fable 47.75, 6.1 Sol 46.40, Argon 45.50, Flash 36.49, Haiku 35.14, 5.6 Sol 33.33. Astra ties the next five. Effort not shown. | vals.ai/benchmarks/mysterymechanism, updated 2026-10-20 |
| Arena Math (human preference) | Argon 1531.7 [1507.5, 1555.8], Fable 1529.0, Flash 1525.9, 6.1 Sol 1513.4, Opus 1512.3, Sonnet 1501.1, 5.6 Sol 1496.0, Astra 1487.1. Argon ties all but Haiku. | HF dataset, published 2026-10-22, read 2026-10-26 |

## Knowledge work, writing and judgment

| Fact | Numbers | Source |
|---|---|---|
| Vals Finance Agent v2.1 | Opus max 67.85±2.05 ($8.91), Argon high 67.66 ($4.32), Sonnet 67.28, Flash 65.76, Haiku 65.37 ($1.64), 6.1 Sol 61.82, Astra 60.43. All tie with Opus. | vals.ai/benchmarks/fabv2-1, updated 2026-10-24 |
| Vals Excel Modeling v1.1 | Fable max 76.73±2.13, Sonnet 75.90, Opus 75.84, Argon 74.83, Flash 72.87, Astra 72.68, 6.1 Sol 71.09, Haiku 65.48. All tie with Fable. | vals.ai/benchmarks/emb-v1-1, updated 2026-10-24 |
| Vals Tax Agent Bench | Fable 49.19±3.61, Opus 45.57, Argon 44.56, Sonnet 41.96 (tie), Flash 32.12, Haiku 31.92, 5.6 Sol 31.09, 6.1 Sol 21.75, Astra 20.72 | vals.ai/benchmarks/tax_agent_bench, updated 2026-10-24 |
| Vals Legal Research Bench | Fable 55.29±3.46, Argon 54.81, Opus 50.48, Sonnet 48.08, 5.6 Sol 48.08, Haiku 43.27 (tie), Astra 39.42, Flash 38.94, 6.1 Sol 38.46 | vals.ai/benchmarks/legal_research, updated 2026-10-24 |
| Vals HLAB-Vals-1.1 (legal work with files, held-out set) | Argon 27.08±3.74 (#1, clear), Flash 12.08, Sonnet 10.42, Opus 9.17, Astra 7.08, 6.1 Sol 6.25, Haiku 4.17 | vals.ai/benchmarks/hlab, updated 2026-10-24 |
| Arena Text, overall | Argon high 1517.2 [1510.6, 1523.8], Opus high 1508.7 (tie), Fable max 1503.2, Flash 1495.7, 5.6 Sol 1485.1, 6.1 Sol 1479.9, Sonnet xhigh 1477.5, Astra 1476.5, Haiku 1424.6 | HF dataset, published 2026-10-22, read 2026-10-26 |
| Arena Hard Prompts | Argon 1540.3, Opus 1534.6 (tie), Fable 1522.9, Flash 1517.3, 5.6 Sol 1511.5, Sonnet 1504.5, 6.1 Sol 1504.1, Astra 1501.1 | HF dataset, published 2026-10-22, read 2026-10-26 |
| Arena Instruction Following | Opus 1521.4 [1510.7, 1532.1], Argon 1519.2 (tie), Fable 1500.5, 5.6 Sol 1490.7, Flash 1490.2, Sonnet 1485.1, 6.1 Sol 1485.0, Astra 1473.3 | HF dataset, published 2026-10-22, read 2026-10-26 |
| Agent Arena, steerability (net improvement) | Opus 17.6 [15.6, 19.6], Fable 15.3, Astra 14.5 (tie), Argon 14.4, 6.1 Sol 13.7, Sonnet 10.8, 5.6 Sol 8.4, Haiku 4.5, Flash 1.2 | HF dataset, published 2026-10-23, read 2026-10-26 |
| ARC-AGI-2 (semi-private) | Astra max 95.0 ($1.12 per task; xhigh 93.3), 6.1 Sol max 94.2 ($0.25), Opus high 93.3 ($0.41; xhigh 92.5, max 91.7), 5.6 Sol max 92.5, Argon high 91.3 ($0.32), Fable max 90.0 ($4.49), Flash high 89.2, Sonnet xhigh 83.9, Haiku xhigh 61.3. No intervals. | arcprize.org/media/data/evaluations.json, modified 2026-10-21, read 2026-10-26 |
| ARC-AGI-3 (interactive, Provider Adapter harness) | Astra high 99.9, Argon low 97.5 / high 97.3, 6.1 Sol xhigh 96.4, Sonnet xhigh 72.4, Flash high 35.0, Haiku max 2.8. Opus 5.5 and Fable 5.1 not listed. The standard harness scores far lower (Astra max 62.7). No intervals. | arcprize.org/media/data/evaluations.json, read 2026-10-26 |
| Vals Time Horizon Index: KSP (one campaign per model) | Opus 91.33 ($1,303), Astra 90.50 ($4,207), Fable 63.33, Argon 52.50, 5.6 Sol 23.83, Flash 18.83. "These are individual campaigns, not repeated-trial averages." | vals.ai/benchmarks/time_horizon_index, updated 2026-10-07 |

## Facts and web search

| Fact | Numbers | Source |
|---|---|---|
| FACTS Search V2 (answers found with web search, public and private sets) | Astra 89.9±1.1, 5.6 Sol 88.5±1.4, 6.1 Sol 88.2±1.2 (tie with Astra), Opus 5.5 86.5±1.3, Argon 84.0±1.3, Haiku 77.5±1.7, Flash 76.3±1.4. Hedging rate: Argon 11.5%, Flash 21.2%, Astra 6.0%, Opus 4.8%. Fable and Sonnet not listed. | kaggle.com/benchmarks/google/facts-search/versions/2, updated 2026-10-10, read 2026-10-26 in a browser |
| Arena Search | gpt-5.6-sol xhigh 1257.9 [1251.5, 1264.4] (#1), 6.1 Sol max 1249.9, Astra max 1246.2 (tie), Fable high 1233.4 (ties Astra), Opus medium 1211.2 (#11). Sonnet, Haiku, Argon and Flash not listed. | HF dataset, published 2026-10-13, read 2026-10-26 |
| Vals Web Search Index (search tools inside finance and legal tasks) | Only gpt-5.6-sol is listed: with native search 43.58±1.98. | vals.ai/benchmarks/web_search, updated 2026-10-21 |
| Agent Arena, tool hallucination (net improvement, higher is better) | 6.1 Sol 0.75 [0.68, 0.81] (#1), Astra 0.71, Sonnet 0.65, 5.6 Sol 0.62, Fable 0.61, Opus 0.57 (all tie with 6.1 Sol), Flash 0.56, Argon 0.35, Haiku −0.89. It measures invented tool calls, not facts. | HF dataset, published 2026-10-23, read 2026-10-26 |
| Codex web search | `codex --search exec ...` works with gpt-6.1-sol. | Tested locally, 2026-10-16 |

## Long context and media

| Fact | Numbers | Source |
|---|---|---|
| Context window | Claude 1M, 128k output. Argon and 3.8 Flash 1M. Argon output: 65,536 tokens by default, up to 1,048,576 with long decode (background execution). The output cap through `agy`: not checked. In Codex: 6.1 Sol 500k, Astra and Luna 272k (the API allows 1.05M). | Vendor docs, ai.google.dev (Argon output, read 2026-10-25), ~/.codex/models_cache.json, read 2026-10-20 |
| Context through `agy` | `agy` cuts one long message: for the measured cap, see the gemini plugin README, "`/gemini:ask`", the bullet on the message cap. Sent in parts in one session, a document stays whole up to about 165k tokens. At about 169k (Argon) and 164k to 205k (Flash), `agy` compacts the conversation into a summary. This is what `agy` allows, not the API's 1M (row above). agy issue #1245 (open): the issue body measures compaction at about 250k to 276k tokens on Argon, and a comment at 241,901 to 279,687. `AGY_CLI_AUTO_COMPACT_OVERRIDE` exists in 1.4.7, but comments say it has no effect. Not tested here. Neither report explains our lower numbers. The compaction numbers were not rerun on 1.4.5 or 1.4.7. | Live tests with gemini-4-argon-low and gemini-3.8-flash-low, 2026-10-20. Cap rechecked on agy 1.4.5, 2026-10-23. Issue #1245 and the local 1.4.7 binary read 2026-10-25 |
| Arena Longer Query | Argon 1534.5, Opus 1524.4 (tie), Fable 1510.5, Flash 1509.9, Sonnet 1499.5, 5.6 Sol 1498.5, Astra 1489.1, 6.1 Sol 1489.0. Long prompts, not 100k tokens. | HF dataset, published 2026-10-22, read 2026-10-26 |
| Media input in this setup | `codex exec` takes images only (`-i`). The Claude Code Read tool takes images and PDFs. Only Gemini takes audio and video. | `codex exec --help`, Read tool description, 2026-10-16 |
| Codex images and web | With `-s workspace-write -C <folder>`, Codex made a 64x64 PNG with its `image_gen.imagegen` tool. The tool saved it under `~/.codex/generated_images/`, and Codex copied it into the `-C` folder with `sips`. In the same test, `codex --search exec` opened example.com with its `web.run` tool, a web search tool, not a JavaScript browser. | Live test on Codex CLI 0.164.0 with gpt-6.1-sol, low, one run, 2026-10-26 |
| Video effort (vendor) | Flash high for dense or fast video and videos over 60 minutes. Medium for general video Q&A. Low for transcript search. | Vertex AI guide for 3.8 Flash |
| Media through `agy` 1.4.3, what the model got | Read right: PNG, JPEG, WebP and GIF images; a PDF's text and a chart that exists only as pixels; video frames in MP4, WebM, MOV, MKV and AVI; MP3, WAV and OGG speech. The sound track of a video with sound: heard in 8 of 10 runs (B), then 14 of 16 without and 16 of 16 with the plugin's media sentence (F). No sound was invented for 8 silent-video runs. The model said it got about 1 frame per second: it misread 14-pixel text in a 720p video, and end times were off by up to 1 s. A YouTube link was not watched: the model searched the web. For AAC and FLAC, see the gemini plugin README, "Media". The rest was not rerun on 1.4.5. Formats, the size limit and conversions are transport facts: see the gemini plugin README, "Media". | Live tests on gemini-3.8-flash-low, mostly one run each, 2026-10-20 (r2 B-tests.md, F-build.md). AAC and FLAC rechecked on agy 1.4.5, 2026-10-23 |
| Vision Arena (chat about images) | 6.1 Sol max 1293.5 [1280.6, 1306.5], Opus high 1293.0, Flash high 1291.0, Fable max 1287.6, 5.6 Sol 1286.2, Astra max 1284.8 (all tie), Sonnet xhigh 1264.9. Argon and Haiku not listed. | HF dataset, published 2026-10-19, read 2026-10-26 |
| Roboflow Vision Evals (secondary) | Overall at low effort (mean of 5 tasks; no ± shown): Argon 87.5 (#1 of 63), Astra 83.4, Opus 82.0, 6.1 Sol 81.7, Flash 79.8, Sonnet 77.6, Fable 74.7, 5.6 Sol 72.4, Haiku 69.6. Argon detection / counting / OCR at low: 82.5 / 86.0 / 85.7. Reasoning at high: Argon 91.4±0.7 ties Astra 91.2±0.3. 3 runs per tier, ± = half the range. OCR is one run. Gemini 3.5 Flash judges counting, identification and reasoning. | playground.roboflow.com/evals, evaluated 2026-10-13, read 2026-10-26 |

## Codex CLI and plugin

| Fact | Numbers | Source |
|---|---|---|
| `codex exec` 0.163.0 output | `-o <file>` holds only the final answer. `--output-schema` gave valid JSON with every required key. The first `--json` line holds the `thread_id`. The `--json` stream left out 4 of 7 commands in one run. Codex does not guarantee the schema: OpenAI says to validate the output yourself. | Live tests with gpt-6-luna, low, 2026-10-20 (r2 C-codex.md); OpenAI docs on structured output |
| `codex exec` 0.164.0 | The `--json` stream names no model. Its events are thread.started, turn.started, item.completed and turn.completed (with token usage). So `out.jsonl` cannot show which model served a job. `codex exec resume --help` lists no `-C`, `-s` or `--add-dir`, but `exec` takes them before `resume` (next row). | Two local runs with gpt-6-luna and gpt-6.1-sol, 2026-10-25; `codex exec --help` and `codex exec resume --help` |
| `codex exec resume <thread_id>` access | 2026-10-26, 0.164.0: turn 1 ran `codex exec -C <A> -s workspace-write --add-dir <t> ...`. Turn 2 ran from `/` as `codex exec -C <A> -s workspace-write --add-dir <t> resume <thread_id> ...`. In turn 2, `pwd` printed `<A>`, and Codex wrote a file in `<A>` and a file in `<t>`. The profile and the network flag were not tested in that place. 2026-10-20, flags after `resume`: with `-c sandbox_mode=workspace-write`, write access kept. With the same permission-profile flags as turn 1: the profile kept. With no access flag: read-only, though turn 1 was workspace-write. So "resume restores a thread's permissions" (Codex changelog, 2026-10-15) did not hold for `exec resume`. | Live test with gpt-6-luna, low, 2026-10-26; live tests with gpt-6-luna, low, one run each, 2026-10-20 (r2 F-build.md) |
| Sandbox reads | Every `-s` mode can read the whole disk, including `~`. A permission profile with `":minimal"="read"` blocked `~`, `$TMPDIR` and `/opt/homebrew`. With `"/opt/homebrew"="read"` added, Python ran. Sibling folders under `/private/tmp` stayed readable and writable in both profile tests. I have not checked why. The docs name the values `read`, `write` and `deny`. On 0.164.0, `"<temp>"="none"` and `"<temp>"="deny"` each blocked a read and a write. | Live tests with gpt-6-luna, low, 2026-10-20 (r2 C-codex.md, F-build.md); `codex sandbox` on 0.164.0, 2026-10-26; learn.chatgpt.com/docs/permissions, read 2026-10-26 |
| Config precedence | OpenAI docs say that a `sandbox_mode` in any loaded config file wins over `default_permissions`. Live test on 0.164.0, with `codex sandbox` (no model): the profile blocked a read under `<temp>`. The profile plus `-c sandbox_mode=read-only` still blocked it. `-c sandbox_mode=read-only` alone read it. A `sandbox_mode` line in a config file was not tested. | learn.chatgpt.com/docs/permissions, read 2026-10-26; live test, 2026-10-26 |
| Codex plugin 1.0.6 (`codex:codex-rescue`, `/codex:*`) | Effort up to xhigh only: max and ultra fail. Sandbox only read-only or `--write`. No network, web search, images or output schema. Resumes only the newest task of the session. The agent may rewrite the prompt. | Plugin source read, 2026-10-20 (r2 C-codex.md) |

## Models not in the table

| Model | Facts | Source |
|---|---|---|
| gpt-5.6-terra | Middle tier of GPT-5.6. API price $2 / $12 per MTok. Snorkel tasteful 27.4 (high). Agent Arena overall 0.22±1.32. | docs.aws.amazon.com (Bedrock model card, vendor), 2026-10-20; Snorkel and Arena, 2026-10-25 |
| gpt-reserve | OpenAI calls "Luna Reserve" extra GPT-5.6 Luna usage for some Plus and Pro accounts after regular usage runs out: "fallback mode, not a separate model". Codex uses it only when the model id is `gpt-reserve`. When the allowance runs out, requests for other models fail with "You've hit your usage limit". Codex does not switch to Luna by itself. `-m gpt-reserve` worked for some users and failed for others (both issues open). In models_cache.json it has visibility "hide" and efforts up to max. | help.openai.com article 20001499 (search snippet only: the page returns 403); github.com/openai/codex/issues/41520 and #40939; local models_cache.json and binary, 2026-10-25; router-for-me/CLIProxyAPI#5568 (third party) |
| codex-auto-review | The reviewer behind Codex's Auto-review. It approves or denies requests that would otherwise wait for a person. It is set with `approvals_reviewer = "auto_review"`. Not a task model. Not tested. | learn.chatgpt.com/docs/sandboxing/auto-review, read 2026-10-20; Codex changelog |

## Plans, quotas and prices

Only "Low-cost mode" in SKILL.md uses these facts.

| Fact | Numbers | Source |
|---|---|---|
| Codex credits per 1M tokens (input / cached input / output) | Astra 250 / 25 / 1,250. 6.1 Sol 50 / 2.5 / 250. GPT-6 Luna 2.5 / 0.25 / 12.5. Astra uses 5 times the credits of 6.1 Sol for input and output, and 10 times for cached input. | learn.chatgpt.com/docs/pricing, read 2026-10-25 |
| Antigravity quota | Argon has its own weekly quota, separate from the 3.8 Flash quota. Google publishes no message count. One `/gemini:review` of three claims used about 1.4% of the weekly Argon quota. | Google Antigravity post; gemini plugin README |
| API prices per MTok (input / output) | Opus 5.5 $4 / $20. Sonnet 5.5 $2 / $10. Astra $10 / $50 ($1 cached input). 6.1 Sol $2 / $10 ($0.10 cached input). Argon $2 / $10 through 2026-11-30, then $4 / $20 from 2026-12-01. Argon is not on the free tier. | platform.claude.com pricing; learn.chatgpt.com/docs/pricing; ai.google.dev pricing; read 2026-10-25 |
| Why the low-cost steps | One effort step lower: on Bug Hunt, Opus at max cost 1.7 times its xhigh cost ($58.53 vs $34.98), and Sonnet 3.6 times ($154.03 vs $42.86). The scores drop at each step (see "Effort"). Astra to 6.1 Sol: one fifth of the credits per token. On Bug Hunt at max they tie (45.0 vs 44.3) at $33.03 vs $5.88. Argon high to medium: Bug Hunt 40.7 to 39.3 (3 runs each), and Google recommends medium for most work. The quota saving is not measured. How the Claude and Gemini plans count usage against a limit: not checked. | Rows above; "Effort" |

## Speed and bulk work

| Fact | Numbers | Source |
|---|---|---|
| AA speed (first-party API medians, "long" prompt) | Output tokens per second, then time to first token, by effort. Haiku: low 176.8 / 8.6 s, medium 174.2 / 11.9 s, high 185.0 / 26.3 s. Sonnet: low 106.3 / 1.2 s, medium 104.3 / 1.3 s, high 106.0 / 12.0 s, max 140.9 / 427.4 s. Opus: low 81.1 / 9.0 s, medium 82.2 / 18.1 s, high 80.0 / 32.3 s, max 97.6 / 706.0 s. Fable: low 56.4 / 1.9 s, high 58.2 / 18.1 s. gpt-5.6-sol: low 79.1 / 2.1 s, high 82.5 / 9.7 s. Astra: low 50.0 / 2.5 s, high 60.4 / 62.4 s. 6.1 Sol: low 49.7 / 2.7 s, high 57.2 / 69.0 s. Argon high 80.9 / 52.4 s. Flash high 132.2 / 27.3 s. AA shows the Gemini models at high only. No intervals. | artificialanalysis.ai/models, read 2026-10-26 |
| Weak spots | Haiku: Agent Arena overall 1.1, Bug Hunt xhigh 18.3. Flash: Agent Arena overall 3.2, Bug Hunt high 18.0, MathArena 34.0. | Rows above |

## Effort

| Model | Effort facts | Other facts |
|---|---|---|
| Opus 5.5 | Bug Hunt, 3 runs each: low 22.3, medium 30.3, high 31.7, xhigh 36.0 ($34.98), max 41.7 ($58.53). Snorkel: high 39.3, max 36.9, xhigh 34.1 (no intervals). AA first token: low 9.0 s, high 32.3 s, xhigh 119.1 s, max 706.0 s. | Claude Code docs: max "is prone to overthinking". |
| All Claude | — | Claude Code defaults: Opus, Sonnet and Haiku 5.5 medium, Fable 5.1 high (code.claude.com/docs/en/model-config). Anthropic: xhigh is for "long-running agentic and coding tasks (over 30 minutes)" (platform.claude.com/docs/en/build-with-claude/effort). |
| Sonnet 5.5 | Bug Hunt, 3 runs each: low 19.0, medium 23.3, high 34.3, xhigh 36.0 ($42.86), max 51.3 ($154.03). AA first token: low 1.2 s, high 12.0 s, max 427.4 s. | Anthropic, for agentic coding: "start with medium for well-specified tasks and move to high for harder or longer ones". |
| Fable 5.1 | MathArena: low 64.8±5.8, high 78.1±4.6, max 77.4±3.9. Snorkel: medium 34.7, high 32.6. | — |
| 6.1 Sol | Bug Hunt: xhigh 42.7, max 44.3 (3 runs each, tie). AA first token: low 2.7 s, high 69.0 s, max 254.8 s. | — |
| Astra | Bug Hunt: max 45.0 (3 runs). Other efforts have one run. MathArena: low 77.3±3.5, max 81.9±3.6 (tie). Snorkel: high 36.8, xhigh 35.8. | — |
| Argon | Bug Hunt, 3 runs each: low 35.3, medium 39.3, high 40.7. Roboflow reasoning: low 89.4, high 91.4. | Google recommends medium for most work and high for hard math, science and agent tasks (vendor). The Gemini app defaults to medium; public boards test high (press). Through `agy` 1.4.7, Argon has no effort above high. `--model=gemini-4-argon --effort=max` fails with "gemini-4-argon has no "max" effort (available: low, medium, high)", and `--effort=xhigh` also fails. `--model=gemini-4-argon-high --effort=max` fails with "conflicts with --effort=max". `--model=gemini-4-argon --effort=high` works. So the `-<effort>` model IDs already reach the highest level (live test, 2026-10-26). |
| Codex ultra | No benchmark for GPT-6 | OpenAI: ultra splits work across parallel subagents. "Most tasks do not need Max or Ultra." In models_cache.json, gpt-6.1-sol, gpt-6-astra and gpt-6-sol take low to ultra ("Maximum reasoning with automatic task delegation"). gpt-6-luna and gpt-reserve stop at max (local, 2026-10-25). |

## Known gaps

Each company counts once here (see "Sources").

- Primary sources cover only math and debugging. Every other row rests on secondary sources or on none.
- Code review, long context, video, audio and bulk simple work: no source passed the tests.
- Shell and infra: one board (Agent Arena bash reliability).
- Science: one board (Vals MysteryMechanism), with a 6-way tie.
- Debugging: one source with 2 TypeScript repos. Sonnet's three runs span 43 to 57.
- Hard coding: SWE-rebench passes all 5 tests but lists only gpt-5.6-sol, from a window that ended on 2026-07-01.
- Agent Arena Code was not re-read on 2026-10-26: the dataset holds only "overall" for agent boards, and arena.ai returns 403.
- Fable 5.1 and gpt-5.6-sol have no Bug Hunt row with 3 or more runs. Sonnet and Haiku are not on MathArena.
- Roboflow: whether its test set is private is not stated. One checker quoted a sentence that says so, but the conductor did not find it on the page.
- Tool versions: this machine runs `agy` 1.4.7 and Codex 0.164.0. The `agy` compaction and media tests ran on 1.4.3 and 1.4.5. Most `codex exec` tests ran on 0.163.0. On 0.164.0 only the `--json` stream, the flags, `exec resume` access and the profile values were checked.

## Full research

The full findings are not kept. To refresh this file, follow "Refresh the evidence" in SKILL.md.
