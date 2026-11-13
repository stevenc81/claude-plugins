# Evidence for the routing table

This file holds the facts behind the "Pick the model" table in SKILL.md: the numbers, the sources and their verdicts, and the reason for each choice. SKILL.md holds the rules, including the 5 tests for a source and how to refresh this file ("Refresh the evidence"). Do not copy benchmark scores into SKILL.md.

Checked on 2026-11-13: a refresh for Gemini 4 Hydrogen, which re-read the six Vals boards that list Hydrogen and AA's 500-token times for all their models, and read Plotly's Hydrogen post, by two Claude Opus 5.5 readers. It adds to the full refresh of 2026-11-10, by two readers on two vendors (Claude Opus 5.5 and Codex gpt-6-astra).

Names and terms: Opus, Sonnet and Haiku are the Claude 5.5 models. Fable 5.2 is Claude Fable 5.2, which the Claude Code alias `fable` runs (code.claude.com/docs/en/model-config, read 2026-11-10). Astra is gpt-6-astra, 6.1 Sol is gpt-6.1-sol and Terra is gpt-6.1-terra. Argon and Hydrogen are Gemini 4 Argon and Gemini 4 Hydrogen. AA is Artificial Analysis. "Tie" means the 95% intervals overlap. Where a board gives a standard error (SE), the interval is ±1.96 × SE. What each board's "±" means is in "Sources used". The tables list only the models in the "Pick the model" table.

Models not in the table: Gemini 3.8 Flash (Hydrogen replaces it), gemini-pro-orchestrator-g1-pro (gemini plugin README, "Which model runs the review?"), and the other vendors' models in `agy models` (claude-opus-5-5, claude-sonnet-5-5 and gpt-oss-120b). In Codex: gpt-6-sol, gpt-6-luna, gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, gpt-reserve and codex-auto-review (~/.codex/models_cache.json, read 2026-11-13).

## Why each choice

One line per row of the "Pick the model" table, and one for its images paragraph. The numbers are in the sections below.

| Job | Why |
|---|---|
| Hard coding, large refactor | No primary source decides this row: SWE-rebench lists none of the table's models. Opus has the best score on Agent Arena overall (tied with Sonnet), Snorkel Senior SWE-bench and Vals Vibe Code Bench 1-100. Sonnet has it on Code Migration, tied with Opus. Snorkel Senior SWE-bench (multi-file feature, migration and bug tasks, graded also for code quality) measures this job most directly, so it decides. Sonnet is not on Snorkel. Astra is the best non-Claude model on Snorkel, Code Migration and Vibe Code 1-100. |
| Routine coding with a clear scope | Two Vals boards disagree on the best score. Code Migration (change existing code, graded by hidden tests) measures this job most directly: Sonnet leads it, tied with Fable 5.2, Opus and Astra. Vibe Code v1.1 (whole apps from a spec): Fable 5.2 leads it, tied with seven others. Astra is the only non-Claude model in the top tie on both boards: Argon and Hydrogen tie on Vibe Code v1.1, but Argon falls out of the tie on Code Migration, and Hydrogen is not on it. |
| Shell, infra and deploy work | Agent Arena bash reliability: Opus is clearly first. Terra at max is the best non-Claude model, and Argon scores below the average model. One board only. |
| Debugging, root cause | Bug Hunt Bench, primary: Sonnet at max has the best mean. Its runs overlap those of Astra, 6.1 Sol, Opus, Terra (max) and Argon, so it is a tie. Astra at max is the best non-Claude model. |
| Code review | No source passed the tests. Bug Hunt Bench finds and fixes bugs, the nearest test, so the row follows Debugging. |
| Front-end and web UI | WebDev Arena (people's votes): Opus is clearly first, and Astra is the best non-Claude model. Vals Vibe Code v1.1, which grades whether the app works, puts 8 of the table's models in a tie, with Fable 5.2 at the best score. WebDev Arena measures a web UI most directly, so it decides. |
| Math | MathArena, primary: 6.1 Sol leads, ties Astra, and is clear of Opus, the best non-OpenAI model there. Epoch FrontierMath (secondary) puts Fable 5.2 first, tied with 6.1 Sol, Astra, Opus and Terra, but Fable 5.2 is not on MathArena. |
| Scientific or data research that runs code | Vals MysteryMechanism: Astra leads, and ties Fable 5.2, Opus, Sonnet, 6.1 Sol and Argon. Fable 5.2 is the best non-OpenAI model. One board only. |
| Analysis, reports, documents | Six Vals boards with private sets, and their leaders differ: Fable 5.2 leads Finance Agent, Excel Modeling and Immigration, Hydrogen leads Tax, and Argon leads Legal Research and is clearly first on HLAB. Opus is in the top tie on all but HLAB. Plotly DataAnalyticsBench (one run) ties Hydrogen, Fable 5.2, Astra, 6.1 Sol, Opus and Argon. None measures this job more directly than the others. No clear winner, so the choice follows the tools: Claude reads PDFs and runs code. Of the Claude models, Opus is in the most top ties: Fable 5.2 falls out on Tax and HLAB. Argon is second: it leads two boards and is in the top tie on Tax, Finance Agent and Excel Modeling. |
| Judgment, planning, critique | The boards disagree, and none measures this job more directly than the others. Argon leads Arena Hard Prompts (clear) and Instruction Following (tied with Opus). Opus leads Agent Arena steerability (tied with Terra, Astra and Sonnet). Astra leads ARC-AGI-2, and Fable 5.2 at xhigh leads ARC-AGI-3 on the standard harness, both with no intervals. No clear winner, so the choice follows the tools: a Claude teammate reads the repo and runs code. Argon is second. |
| Fact check of claims | FACTS Search measures answers found with web search: Astra leads, tied with 6.1 Sol. Opus scores above Argon. |
| Web research across many sources | Arena Search (people's votes): 6.1 Sol and Astra tie at the top. FACTS Search (correct answers found with search) measures the job most directly, and Astra leads it, so Astra is first. Opus is the best non-OpenAI model on FACTS Search. |
| Long documents or code over 100k tokens | No source passed the tests. Claude has a 1M context. Through `agy`, Gemini keeps far less before it compacts (see "Long context and media"). Argon is second: in the gemini plugin README's long-prompt test ("`/gemini:ask`"), Argon passed in October 2026, and Hydrogen failed some runs on `agy` 1.5.7. |
| Video or audio input | No source passed the tests. Only Gemini takes video and audio in this setup. Hydrogen at medium: Google's Vertex guide names medium for video understanding, and high for complex multimodal analysis (see "Effort"). At low, Hydrogen lost the last spoken word of a video that medium heard (gemini plugin README, "Media"). No test covers long or dense video. |
| Bulk simple work | No source measures quality on simple work. Haiku has the Claude Code tools. Google's Vertex guide names Hydrogen low for classification, summarization and metadata extraction (see "Effort"). Haiku is weak at long agent work (see "Weak spots"). |
| Speed-critical short answers | AA, time to a 500-token answer at low effort (see "Speed and bulk work"): Sonnet is fastest, and Hydrogen is the fastest non-Claude model. No intervals. |
| Images and screenshots | Roboflow: Argon is clearly first on counting, and first on detection at high effort, tied with Terra. Vision Arena (chat about images): Opus, 6.1 Sol and Astra tie, and Argon is not listed. |

## Sources

### Sources used

A refresh reads numbers only from these sources.

| Source | Verdict | Failed tests and why | How to read it |
|---|---|---|---|
| MathArena | Primary | None. New contests, 4 runs per problem, 95% intervals. Epoch AI funds it with a grant. | matharena.ai/models, the headline table. "±" is a 95% interval. Skip LeanLean: one run per repository, no interval. |
| Bug Hunt Bench | Primary for rows with 3 or more runs. Secondary for rows with 1 or 2 runs (test 3). | None for 3-run rows. Answer key held back, each model in its own CLI. | bughunt.productcompass.pm/data/benchmark.json. Use rows without a `superseded` note. `n_runs` gives the runs. A tie means the ranges of the runs overlap. |
| SWE-rebench | Primary, but it cannot decide a row: it lists none of the table's models. | None | swe-rebench.com, the newest time window. "±" is the SEM of 5 runs. |
| arena.ai, all boards | Secondary | 1: it ranks its own Max router first on Agent Arena, and sells evaluations to model labs. | Read the Hugging Face dataset lmarena-ai/leaderboard-dataset, files `<subset>/latest-00000-of-00001.parquet`, the `*_style_control` subsets, not the website: arena.ai returns 403 to plain web tools, and its Search and Document numbers differ from the dataset. `[low, high]` is a 95% interval. Skip the website's "AutoEval" rows, which mix an autorater's votes with human votes. Agent Arena scores are "net improvement": points against a baseline that stands for the average model, so above 0 is above average, and higher is always better. The Agent Arena subsets hold only the category "overall", which includes its signals (bash reliability, steerability). |
| Vals AI, boards with a private test set | Secondary | 1: "Companies pay Vals to test their models" (TechCrunch, 2026-09-19). | vals.ai/benchmarks/<slug>. Use a board only if its page says the test set is private or held out. Skip indexes that mix in public boards. "±" is a standard error (vals.ai/methodology). |
| Artificial Analysis, speed tests | Secondary | 1: it does custom benchmarking for AI companies. | artificialanalysis.ai/models/<slug>, for example `gemini-4-hydrogen-low`. Read the headline output speed and time to first token (Performance v3: each workload averaged over the past 5 days, then the workloads averaged). No intervals. |
| Epoch FrontierMath | Secondary | 1: paid work for Google DeepMind and OpenAI (epoch.ai/about/transparency). OpenAI funds FrontierMath. | epoch.ai/data/benchmark_data.zip, file frontiermath_tiers_1_3_v2.csv. "±" is the stderr column. |
| Snorkel Senior SWE-bench | Secondary | 1: it sells data and evaluation work to AI labs. | senior-swe-bench.snorkel.ai/agents. No intervals shown: pass@3 implies 3 attempts per task. |
| FACTS Search V2 (Kaggle) | Secondary | 1: Google runs it. | kaggle.com/benchmarks/google/facts-search/versions/2, in a real browser. The page does not say what "±" means. This file reads it as a 95% interval. |
| ARC Prize | Secondary | 3: no intervals or run counts. | arcprize.org/media/data/evaluations.json and models.json. |
| Roboflow Vision Evals | Secondary | 4 not shown: the page does not say the set is private, and its Reasoning page shows real samples with answers. OCR also fails 3 (one run), so OCR is not used. | playground.roboflow.com/evals, with WebFetch or a real browser (curl got HTTP 429). "±" is half the range of 3 runs. |
| Coarena, Computer Use board | Secondary. It decides no row: no row measures computer use. | 1: it sells eval access and licenses training data to AI labs (coarena.ai/data). | coarena.ai/leaderboard. "±" is a 95% interval. Its Phone Use board is not used. |
| Plotly DataAnalyticsBench | Secondary | 3: "Each model has been run once, so there are no error bars." | plotly.com/blog/introducing-dataanalyticsbench, and plotly.com/blog/gemini-4-hydrogen-plotly-data-analytics-bench for Hydrogen. 43 private questions. "A difference of one or two questions between models is within the noise", so scores within 2 tie. |

Vendor docs and model cards are not used for ranking (tests 1 and 2). They stay the source for prices, limits, effort names and the vendors' advice on effort.

### Sources not used

| Source | Failed tests and why |
|---|---|
| METR time horizons | None, but it lists none of the table's models and has not been updated since 2026-09-08. Dropped at the user's request on 2026-10-26. |
| Vals AI, boards on public task sets, and the Vals Index | 1 (as Vals above), 4: public task sets. The Vals Index mixes in public boards. |
| Vals boards on Anthropic's tasks (BioMysteryBench) and on public tasks (ProgramBench) | As the row above. Anthropic developed BioMysteryBench. |
| Vals Time Horizon Index: KSP | 1 (as Vals above), 3: one campaign per model, no error range. |
| Artificial Analysis, other boards | 1, and 3 or 4. |
| Epoch ECI and SimpleQA Verified | 1 (as Epoch above). ECI also fails 2: it takes each model's best score over all settings. SimpleQA Verified also fails 4: a public set. |
| FACTS Grounding v2 (Kaggle) | 1, 3: no interval or run count. |
| Terminal-Bench 4 (tbench.ai, Vals, AA) | 2, 4, 5: Epoch found scoring errors in 30 of 66 tasks (45.5%). |
| LiveBench 2.0 | 1: Abacus.AI sponsors it and is ranked on it. 3: one run per suite. |
| Scale AI Labs (HLE-Diamond, DrugDiscoveryBench, RLI, AudioMultiChallenge) | 1, and 3 or 4. |
| GitHub ReviewBench | 1: GitHub ranks its own Copilot. 4. |
| Vectara hallucination board | 2: the setup stops at 2025 models. 3. |
| Parallel.ai search board | 1, 3, 5. |
| Gateway pages (OpenRouter, Eden AI, ZenMux) | 1: they resell the models. 2: live traffic, mixed prompts and settings. |
| benchlm.ai | 2: it copies other boards. |
| Deep Research Bench | 2, 3, 4. |
| HELM Long Context | 3, 4. |
| Fiction.LiveBench | 3, 4. |
| SWE-bench-Live | 2, 3. |
| Martian Code Review Bench | 3, 4. |
| tau-bench | 2, 4. |
| Video-MME | 2, 3, 4. |
| FrontierSWE v2 (Proximal Labs) | 1: paid work for labs (proximal.ai/blog/new-frontiers). 4: all tasks, with reference solutions, are in a public repo. |
| Zapier AutomationBench 1.0.6 | 3: single runs, no error range. 5: an audit found grading bugs in 206 of the 600 public tasks (34%). Test 2 is in doubt: the Claude models ran with different fallback rules. |
| VulcanBench Frontier v4 | 1: it offers paid reports to labs. 4: the tasks, with reference patches, are in a public repo. |
| DuelLab GameBench 2 | 3: one program per model and game, no error range. 4: public board games such as chess and Go. |

## Coding and agentic work

| Fact | Numbers | Source |
|---|---|---|
| Bug Hunt Bench (primary for rows with 3 or more runs) | 105 real bugs in two TypeScript repos (a VS Code extension of about 28K lines, a React/Supabase app of about 60K lines), graded blind against a held-back answer key, each model in its own CLI. Mean bugs fixed over 3 runs (the runs): Sonnet max 51.3 (57/54/43), Astra max 45.0 (48/40/47), 6.1 Sol max 44.3 (44/42/47), Opus max 41.7 (43/39/43), Argon high 40.7 (40/45/37), Terra max 40.7 (34 to 46), Haiku xhigh 18.3. All from Sonnet to Terra tie. Other efforts: see "Effort". List costs: see "Plans, quotas and prices". | bughunt.productcompass.pm/data/benchmark.json, updated 2026-10-27, read 2026-11-10 |
| Agent Arena, overall (net improvement) | Opus max 19.96 [17.90, 22.01], Sonnet max 15.99 [13.15, 18.84], Astra max 14.24, 6.1 Sol max 12.53, Terra max 12.10 [10.75, 13.46], Argon high 10.83, Haiku high 0.43. Opus ties Sonnet. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Agent Arena, bash reliability (net improvement) | "How often the model's bash commands succeed. Errors outside its control aren't counted." Opus 15.00 [14.57, 15.42], Terra max 13.31 [12.92, 13.70], Sonnet 12.70 [12.09, 13.32], Astra 7.78, Haiku 7.46, 6.1 Sol 4.98, Argon −5.63 [−6.76, −4.50]. Opus is clear. Terra ties Sonnet. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Snorkel Senior SWE-bench (Mini-SWE-agent, 95 scored tasks) | The tasks are multi-file feature, migration, bug and performance PRs ("an average of 11 files touched per feature task"). A "tasteful" solve must pass all tests and also meet code-quality thresholds, graded against the reference solution (senior-swe-bench.snorkel.ai and its how-it-works post, read 2026-11-13). "Tasteful" pass@1: Opus high 39.3, Astra high 36.8, Argon medium 27.7. No intervals shown. A binomial interval on 95 tasks is about ±10 points (the reader's computation), so Opus ties Astra. | senior-swe-bench.snorkel.ai/agents, read 2026-11-10 |
| Vals Code Migration v1.1 (Pi agent harness) | Sonnet max 86.88±1.52, Fable 5.2 high 83.27±3.12, Opus max 81.01±3.21, Astra max 80.58±2.34, 6.1 Sol max 77.32±2.98, Argon high 70.80±3.72, Haiku 52.36. Sonnet ties Fable 5.2, Opus and Astra. A hidden suite of behavior tests grades it, but the source programs come from open-source repos. | vals.ai/benchmarks/code-migration-v1-1, updated 2026-11-09 |
| Vals Vibe Code Bench 1-100 (extend a working web app, OpenHands) | Opus xhigh 30.36±4.83, Astra max 27.64, Argon high 21.20, Haiku 20.41. All tie with Opus. | vals.ai/benchmarks/vcb-1-100, updated 2026-10-29 |

## Front-end and web UI

| Fact | Numbers | Source |
|---|---|---|
| WebDev Arena | Opus max 1818.2 [1806.2, 1830.2], Sonnet xhigh 1773.5, Astra max 1766.9, 6.1 Sol max 1742.6, Argon high 1682.8, Terra max 1678.4, Haiku high 1594.9. Opus is clear of all others. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Vals Vibe Code Bench v1.1 (working web apps from a spec, OpenHands) | Fable 5.2 high 93.77±1.15, Sonnet max 92.39±1.26, Argon high 91.91±1.90, Haiku max 90.44, Opus max 90.29, Astra max 89.59, 6.1 Sol max 88.93, Hydrogen 87.78±2.29, Terra max 84.00±2.87. Fable 5.2 ties all from Sonnet to Hydrogen. It grades whether the app works, not how people rate the page. | vals.ai/benchmarks/vibe-code, updated 2026-11-11, read 2026-11-13 |

## Math and science

| Fact | Numbers | Source |
|---|---|---|
| MathArena, headline (primary) | IRT estimate with a 95% bootstrap interval, 4 runs per problem: 6.1 Sol max 80.6±2.4, Astra max 77.8±4.4, Opus high 75.3±2.7, Argon 62.1±9.3. 6.1 Sol ties Astra and is clear of Opus (78.0 < 78.2). | matharena.ai/models, read 2026-11-10 |
| Epoch FrontierMath, tiers 1–3 v2 (private set) | Fable 5.2 max 95.09±1.28 (SE), 6.1 Sol max 93.68±1.44, Astra max 93.68, Opus max 91.23±1.68, Terra max 90.88±1.71, Sonnet max 88.77±1.87, Argon high 85.96±2.06, Haiku max 75.09. Fable 5.2 ties 6.1 Sol, Astra, Opus and Terra, and is clear of Sonnet. | epoch.ai/data/benchmark_data.zip, read 2026-11-10 |
| Vals MysteryMechanism (find hidden mechanisms by experiment) | Astra 53.15±3.36, Fable 5.2 51.80±3.36, Opus 49.55, Sonnet 49.10, 6.1 Sol 46.40, Argon 45.50, Haiku 35.14. Astra ties the next five. Effort not shown. | vals.ai/benchmarks/mysterymechanism, updated 2026-11-09 |

## Knowledge work and judgment

| Fact | Numbers | Source |
|---|---|---|
| Vals Finance Agent v2.1 | Fable 5.2 high 69.47±1.98, Opus max 67.85±2.05, Argon high 67.66, Sonnet 67.28, Haiku 65.37, Hydrogen 65.12±2.04, 6.1 Sol 61.82, Astra 60.43, Terra max 55.96±2.09. Fable 5.2 ties all but Astra and Terra. | vals.ai/benchmarks/fabv2-1, updated 2026-11-11, read 2026-11-13 |
| Vals Excel Modeling v1.1 | Fable 5.2 high 77.38±2.19, Sonnet 75.90, Opus 75.84, Hydrogen 75.80±2.03, Argon 74.83, Terra max 73.33, Astra 72.68, 6.1 Sol 71.09, Haiku 65.48. Fable 5.2 ties all but Haiku. | vals.ai/benchmarks/emb-v1-1, updated 2026-11-11, read 2026-11-13 |
| Vals Tax Agent Bench | Hydrogen xhigh 52.30±3.60, Argon 49.22, Opus 44.54, Sonnet 41.96, Fable 5.2 high 32.09±3.37, Haiku 31.92, 6.1 Sol 21.75, Astra 20.72, Terra 17.08. Hydrogen ties Argon, Opus and Sonnet, and is clear of the rest. | vals.ai/benchmarks/tax_agent_bench, updated 2026-11-11, read 2026-11-13 |
| Vals Legal Research Bench | Argon 54.81, Hydrogen 53.85±3.46, Opus 50.48, Sonnet 48.08, Fable 5.2 high 46.15, Haiku 43.75 (all tie), Astra 39.42, 6.1 Sol 38.46, Terra 25.96. | vals.ai/benchmarks/legal_research, updated 2026-11-11, read 2026-11-13 |
| Vals HLAB-Vals-1.1 (legal work with files, held-out set) | Argon 27.08±3.74 (clear), Hydrogen 11.25±2.68, Sonnet 10.42, Opus 9.17, Astra 7.08, 6.1 Sol 6.25, Fable 5.2 5.00, Haiku 4.17, Terra 1.67. | vals.ai/benchmarks/hlab, updated 2026-11-11, read 2026-11-13 |
| Vals Immigration Bench (262 private questions, default settings, no web search) | Fable 5.2 73.98±1.33, Opus 72.14 (tie), Sonnet 68.96, Argon 68.08, 6.1 Sol 67.81, Astra 67.69, Haiku 61.79. Whether the models below Opus tie Fable 5.2: not checked. Built with the Talent Mobility Fund. | vals.ai/benchmarks/immigration, updated 2026-11-09 |
| Plotly DataAnalyticsBench (43 private questions, one run) | Hydrogen, Fable 5.2, Astra and 6.1 Sol 43, Opus and Argon 41, Terra 40, Sonnet 38, Haiku 37. Scores within 2 tie. | plotly.com blog, read 2026-11-10 (Hydrogen: its own post, read 2026-11-13) |
| Arena Hard Prompts | Argon 1544.6 [1538.0, 1551.2], Opus 1530.1 [1522.7, 1537.5], 6.1 Sol 1506.1, Astra 1499.8, Sonnet 1497.6. Argon is clear of Opus. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Arena Instruction Following | Argon 1526.8 [1518.5, 1535.1], Opus 1518.5 [1509.1, 1527.9] (tie), 6.1 Sol 1483.9, Sonnet 1479.3, Astra 1473.2. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Agent Arena, steerability (net improvement) | Opus 18.57 [16.55, 20.58], Terra 15.81, Astra 14.82, Sonnet 13.76 (all tie), Argon 13.53, 6.1 Sol 13.35, Haiku 2.66. | HF dataset, published 2026-11-08, read 2026-11-10 |
| ARC-AGI-2 (semi-private) | Astra max 95.0, 6.1 Sol max 94.2, Fable 5.2 xhigh 93.75, Opus high 93.3, Argon high 91.3, Sonnet xhigh 83.9, Haiku xhigh 61.3. No intervals. Fable 5.2 at other efforts: see "Effort". | arcprize.org/media/data/evaluations.json, read 2026-11-10 |
| ARC-AGI-3 (interactive), standard harness | Fable 5.2 xhigh 81.2, Astra max 62.7, 6.1 Sol max 52.7, Argon low 49.8. No intervals. Fable 5.2 at other efforts: see "Effort". | arcprize.org/media/data/evaluations.json, read 2026-11-10 |

## Facts and web search

| Fact | Numbers | Source |
|---|---|---|
| FACTS Search V2 (answers found with web search, public and private sets) | Astra 89.9±1.1, 6.1 Sol 88.2±1.2 (tie), Opus 86.5±1.3, Argon 84.0±1.3, Haiku 77.5±1.7. | kaggle.com/benchmarks/google/facts-search/versions/2, updated 2026-10-10, read 2026-11-10 |
| Arena Search | 6.1 Sol max 1249.0, Astra max 1244.9 [1236.9, 1253.0] (tie), Opus medium 1213.8. | HF dataset, published 2026-11-08, read 2026-11-10 |

## Long context and media

| Fact | Numbers | Source |
|---|---|---|
| Context window | Claude, Fable 5.2 too: 1M, 128k output. Argon and Hydrogen: 1M, 65,536 output tokens by default. The output cap through `agy`: not checked. Codex: 6.1 Sol and Terra 500k, Astra 272k. | platform.claude.com (Fable 5.2 overview, read 2026-11-10); ai.google.dev (Argon, read 2026-10-25); aistudio.google.com/docs/models/gemini-4-hydrogen (read 2026-11-13); ~/.codex/models_cache.json (read 2026-11-10) |
| Context through `agy` | Sent in parts in one session, a document stayed whole up to about 165k tokens. At about 169k tokens on Argon, `agy` compacted the conversation into a summary. This is what `agy` allows, not the API's 1M. agy issue #1245 reports compaction on Argon at about 240k to 280k tokens. The gap is not explained. The message cap, the prompt cap and the long-prompt tests: gemini plugin README, "`/gemini:ask`". | Live tests with gemini-4-argon-low, 2026-10-20; issue #1245, read 2026-10-25 |
| Media input in this setup | `codex exec` takes images only (`-i`). The Claude Code Read tool takes images and PDFs. Only Gemini takes audio and video. What Gemini got from each format: gemini plugin README, "Media". | `codex exec --help`, Read tool description, 2026-10-16 |
| Vision Arena (chat about images) | Opus high 1295.2 [1285.3, 1305.0], 6.1 Sol max 1292.2, Astra max 1283.9 (all tie), Sonnet xhigh 1262.9. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Roboflow Vision Evals | Detection at high: Argon 85.1 (84.3–85.5) ties Terra 84.7 (84.2–84.9). Detection at low: Terra 84.7 is clear of Argon 82.5. Counting at high: Argon 90.5 is clear. 3 runs per tier. | playground.roboflow.com/evals, evaluated 2026-10-26, read 2026-11-10 |

## Speed and bulk work

| Fact | Numbers | Source |
|---|---|---|
| AA time to a 500-token answer at low effort | First token plus 500 tokens at the output speed, computed by the conductor from AA's headline values: Sonnet 6.3 s, Hydrogen 8.5 s, Opus 9.5 s, Haiku 9.6 s, Terra 10.7 s, 6.1 Sol 13.1 s, Fable 5.2 13.5 s, Astra 16.8 s. No intervals. Hydrogen came out on 2026-11-12, so its 5-day average holds 1 to 2 days (not checked). | artificialanalysis.ai/models, read 2026-11-13 |
| Weak spots | Haiku is near the average model on Agent Arena overall, and fixes under half as many bugs as the top tie on Bug Hunt (see "Coding and agentic work"). | Rows above |

## Effort

| Model or topic | Effort facts | Vendor advice |
|---|---|---|
| Opus 5.5 | Bug Hunt, 3 runs each: low 22.3, medium 30.3, high 31.7, xhigh 36.0, max 41.7. Snorkel tasteful: high 39.3, xhigh 34.1, max 36.9 (no intervals). | Claude Code docs: max "is prone to overthinking". |
| Sonnet 5.5 | Bug Hunt, 3 runs each: low 19.0, medium 23.3, high 34.3, xhigh 36.0, max 51.3. | Anthropic, for agentic coding: "start with medium for well-specified tasks and move to high for harder or longer ones". |
| Fable 5.2 | ARC-AGI-2: low 86.7, medium 89.6, high 90.4, xhigh 93.75, max 92.5. ARC-AGI-3 standard harness: low 52.0, medium 73.3, high 79.3, xhigh 81.2, max 65.7 (max hit the 12-hour limit in 28 of 55 games). No intervals. | Anthropic: "Start with `high`. Most of the gain in capability is already present at `high`." "Step up to `xhigh` for your hardest long-running coding and agentic work." At `max` it "runs slower and costs more than at `xhigh`, often for only a small gain" (platform.claude.com/docs/en/build-with-claude/effort, read 2026-11-10). |
| All Claude | — | Anthropic: xhigh is for "long-running agentic and coding tasks (over 30 minutes)" (platform.claude.com/docs/en/build-with-claude/effort). |
| gpt-6.1-terra | Bug Hunt, 3 runs each: low 6.0, medium 7.3, high 9.7, xhigh 11.3, max 40.7. The board gives the run spreads as "2, 2, 3, 5 and 12 going up". | — |
| Codex ultra | No benchmark for GPT-6. | OpenAI: ultra splits work across parallel subagents. "Most tasks do not need Max or Ultra." In models_cache.json, gpt-6.1-sol and gpt-6-astra take low to ultra, and gpt-6-luna stops at max (local, 2026-10-25). |
| Argon | Bug Hunt, 3 runs each: low 35.3, medium 39.3, high 40.7. Through `agy`, Argon stops at high: `--effort=xhigh` and `--effort=max` fail (live test, 2026-10-26). | Google: medium for most work, high for hard math, science and agent tasks. |
| Hydrogen | Through `agy` 1.5.7: low, medium, high and xhigh work, and `--effort max` fails (live test, 2026-11-13). | Google: high is the default. Start with high for complex tasks, and use xhigh for hard multi-step problems (aistudio.google.com/docs/thinking). Vertex guide: high for "multi-step agentic tool loops, code generation, architectural refactoring, and complex multimodal analysis", medium for "general coding, tool use, document Q&A, and video understanding", low for "high-throughput classification, routing, summarization, and structured metadata extraction" (read 2026-11-13). |
| Wait time (AA headline time to first token) | Opus low 5.0 s, high 25.6 s, xhigh 76.2 s, max 371.3 s. Sonnet low 2.8 s, high 9.0 s, max 262.5 s. 6.1 Sol low 2.4 s, high 27.6 s, max 135.7 s. Terra low 2.3 s, max 138.4 s. Argon high 36.6 s. These were read 2026-11-10. Hydrogen low 5.71 s, medium 11.80 s, high 18.89 s, xhigh 37.77 s, read 2026-11-13. | — |

## Plans, quotas and prices

Only "Low-cost mode" in SKILL.md uses these facts.

| Fact | Numbers | Source |
|---|---|---|
| Codex credits per 1M tokens (input / cached input / output) | Astra 250 / 25 / 1,250. 6.1 Sol 50 / 2.5 / 250. Terra 25 / 1.25 / 125. Astra uses 5 times the credits of 6.1 Sol for input and output, and 10 times for cached input. | learn.chatgpt.com/docs/pricing, read 2026-11-10 |
| Antigravity quota | Which Gemini models share a quota, and how much of it one review used: gemini plugin README, "`/gemini:ask`" and "Which model runs the review?". Google publishes no message count. | Google Antigravity post; gemini plugin README |
| Bug Hunt list cost per run | Sonnet max $154.03, xhigh $42.86. Opus max $58.53, xhigh $34.98. Astra max $33.03. 6.1 Sol max $5.88. Terra max $3.88. | bughunt.productcompass.pm/data/benchmark.json, read 2026-11-10 |
| Why the low-cost steps | One effort step lower: on Bug Hunt, Opus at max costs 1.7 times its xhigh cost, and Sonnet 3.6 times, and the scores drop at each step (see "Effort"). Astra to 6.1 Sol: one fifth of the credits per token, and on Bug Hunt at max they tie (see "Coding and agentic work") at under a fifth of the cost. Argon high to medium: close on Bug Hunt (see "Effort"), and Google recommends medium for most work. Terra stays at max: at xhigh and below it fixes far fewer bugs (see "Effort"), and Terra max costs less than 6.1 Sol max. Hydrogen stays as it is: the table runs it at high only for long or dense video, which no test covers, and SKILL.md "Effort" keeps medium for speech in video. The quota saving is not measured. How the Claude and Gemini plans count usage against a limit: not checked. | Rows above; "Effort" |

## Codex CLI and plugin

| Fact | Numbers | Source |
|---|---|---|
| `codex exec` output | `-o <file>` holds only the final answer. The first `--json` line holds the `thread_id`. `--output-schema` gave valid JSON with every required key, but Codex does not guarantee the schema: OpenAI says to validate the output yourself. | Live tests on 0.163.0 with gpt-6-luna, low, 2026-10-20; OpenAI docs on structured output |
| `codex exec resume <thread_id>` access | 2026-10-26, 0.164.0: turn 1 ran `codex exec -C <A> -s workspace-write --add-dir <t> ...`. Turn 2 ran from `/` as `codex exec -C <A> -s workspace-write --add-dir <t> resume <thread_id> ...`. In turn 2, `pwd` printed `<A>`, and Codex wrote a file in `<A>` and a file in `<t>`. `codex exec resume --help` lists no `-C`, `-s` or `--add-dir`, but `exec` takes them before `resume`. The profile and the network flag were not tested in that place. 2026-10-20, flags after `resume`: with `-c sandbox_mode=workspace-write`, write access kept. With the turn-1 permission-profile flags, the profile kept. With no access flag: read-only, though turn 1 was workspace-write. So "resume restores a thread's permissions" (Codex changelog, 2026-10-15) did not hold for `exec resume`. | Live tests with gpt-6-luna, low, 2026-10-26 and 2026-10-20 |
| Sandbox reads | Every `-s` mode can read the whole disk, including `~`. A permission profile with `":minimal"="read"` blocked `~`, `$TMPDIR` and `/opt/homebrew`. With `"/opt/homebrew"="read"` added, Python ran. Sibling folders under `/private/tmp` stayed readable and writable in both profile tests. I have not checked why. The docs name the values `read`, `write` and `deny`. On 0.164.0, `"<temp>"="none"` and `"<temp>"="deny"` each blocked a read and a write. | Live tests with gpt-6-luna, low, 2026-10-20; `codex sandbox` on 0.164.0, 2026-10-26; learn.chatgpt.com/docs/permissions, read 2026-10-26 |
| Config precedence | OpenAI docs say that a `sandbox_mode` in any loaded config file wins over `default_permissions`. Live test on 0.164.0, with `codex sandbox` (no model): the profile blocked a read under `<temp>`. The profile plus `-c sandbox_mode=read-only` still blocked it. `-c sandbox_mode=read-only` alone read it. A `sandbox_mode` line in a config file was not tested. | learn.chatgpt.com/docs/permissions, read 2026-10-26; live test, 2026-10-26 |
| Input inside a denied `<temp>` | Codex 0.167.0: a reader job ran with the profile `"<temp>"="deny"` and `"<temp>/data"="read"`. It reported that the policy denied the data folder, and read the web instead. `codex sandbox` with the same two entries, in either order, read a file in `<temp>/data`. The `--json` stream holds no record of the failed read, so the cause is not checked. | Reader job and live test, 2026-11-10 |
| Web search and images | `codex --search exec ...` works with gpt-6.1-sol (2026-10-16). With `-s workspace-write -C <folder>`, Codex made a PNG with its `image_gen.imagegen` tool, which saved it under `~/.codex/generated_images/`, and Codex copied it into the `-C` folder. In the same test, `codex --search exec` opened example.com with its `web.run` tool, a web search tool, not a JavaScript browser. | Live tests; the image test on Codex CLI 0.164.0 with gpt-6.1-sol, low, one run, 2026-10-26 |
| Codex plugin 1.0.6 (`codex:codex-rescue`, `/codex:*`) | Effort up to xhigh only: max and ultra fail. Sandbox only read-only or `--write`. No network, web search, images or output schema. Resumes only the newest task of the session. The agent may rewrite the prompt. | Plugin source, read 2026-10-20 |

## Known gaps

Each company counts once here (SKILL.md, "Refresh the evidence", step 5).

- Fable 5.2 is on no primary source, and it is the first choice in no row. The arena.ai dataset lists Fable 5.2 since 2026-11-11 (one reader saw it on 2026-11-13), but its numbers are not read into this file, so the rows that use arena.ai boards do not weigh Fable 5.2.
- Hydrogen (released 2026-11-12) is only on six Vals boards, Plotly and AA. Its refresh had two Claude readers, at the user's request, not one on Claude and one on Codex (SKILL.md, "Refresh the evidence", step 3).
- Primary sources cover only math and debugging. Every other row rests on secondary sources or on none.
- Code review, long context, video, audio and bulk simple work: no source passed the tests.
- Shell and infra: one board (Agent Arena bash reliability). Science: one board (Vals MysteryMechanism), with a 6-way tie.
- Debugging: one source with 2 TypeScript repos. Sonnet's three runs span 43 to 57. Fable 5.2 and Hydrogen have no Bug Hunt row with 3 or more runs.
- Fable 5.2, Terra, Sonnet, Haiku and Hydrogen are not on MathArena.
- Roboflow: whether its test set is private is not stated.
- Speed: AA measures each vendor's API. The time that `agy`, `codex exec` or a Claude Code teammate adds is not measured.
- Tool versions on 2026-11-13: `agy` 1.5.7 and Codex 0.169.0. On `agy` 1.5.7, only the tests in the gemini plugin README ran. On Codex 0.169.0, one smoke test passed: `exec` with `--output-schema`, `resume` with the access flags before it, `--search`, and the permission profile in `codex sandbox`. The compaction test in "Long context and media" ran on 2026-10-20. Most `codex exec` tests ran on 0.163.0 and 0.164.0.
