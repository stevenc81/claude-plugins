# Evidence for the routing table

This file holds the facts behind the "Pick the model" table in SKILL.md: the sources and their verdicts, the numbers, and the reason for each choice. SKILL.md holds the rules, including the 5 tests for a source and how to refresh this file ("Refresh the evidence"). Do not copy benchmark scores into SKILL.md.

Checked on 2026-11-18: a full refresh from the six sources in "Sources used". The user cut the sources from 13 to 6 that day. Two Claude Opus 5.5 readers read every number, at the user's request, not one reader on Claude and one on Codex (SKILL.md, "Refresh the evidence", step 3). The two readers agreed on every number.

Names and terms: Opus, Sonnet and Haiku are the Claude 5.5 models. Fable 5.2 is Claude Fable 5.2, which the Claude Code alias `fable` runs. Astra is gpt-6-astra, 6.1 Sol is gpt-6.1-sol, Terra is gpt-6.1-terra, 6.2 Sol is gpt-6.2-sol and 6.2 Astra is gpt-6.2-astra (both released 2026-11-17). Argon and Hydrogen are Gemini 4 Argon and Gemini 4 Hydrogen (released 2026-11-12). AA is Artificial Analysis. "Tie" means the 95% intervals overlap. Where a board gives a standard error (SE), the interval is ±1.96 × SE. On Bug Hunt, a tie means the ranges of the runs overlap. The tables list only the models in the "Pick the model" table.

Models not in the table: Gemini 3.8 Flash (Hydrogen replaces it), gemini-pro-orchestrator-g1-pro (gemini plugin README, "Which model runs the review?"), and the other vendors' models in `agy models`. In Codex: gpt-6-sol, gpt-6-luna, gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, gpt-reserve and codex-auto-review (~/.codex/models_cache.json, read 2026-11-18).

## Why each choice

One line per row of the "Pick the model" table. The numbers are in the sections below.

| Job | Why |
|---|---|
| Hard coding, large refactor | No primary source. AA FrontierCode-AA 2.0 (code changes to real repositories, graded by tests and a rubric) measures this job most directly: Fable 5.2 at high has the best score, just above 6.2 Astra at xhigh, with no intervals. Agent Arena agrees: Fable 5.2 is clearly first. 6.2 Astra is the best non-Claude model on FrontierCode, and Agent Arena does not list it. Fable 5.2 runs at high because its higher efforts score no higher on FrontierCode. SKILL.md "Effort" raises a job over 30 minutes to xhigh. |
| Routine coding with a clear scope | Vals Code Migration (change existing code, graded by hidden tests) measures this job most directly: Sonnet leads it, tied with Fable 5.2, Opus and Astra. Code Migration does not list 6.2 Astra, so the other boards rank it: on FrontierCode at medium it scores above Astra, and on Vibe Code v1.1 they tie. Medium follows Anthropic's advice for well-specified tasks (see "Effort"). |
| Shell, infra and deploy work | Agent Arena bash reliability: Opus has the best score, tied with Fable 5.2. Terra at max is the best non-Claude model, clear of Astra. Argon and Hydrogen score below the average model. One board only. |
| Debugging, root cause | Bug Hunt Bench, primary: Fable 5.2 at max has the best mean. It ties Sonnet at max and Fable 5.2 at xhigh, and is clear of all others. Astra at max is the best non-Claude model. It ties 6.1 Sol, Opus, Argon, Terra and Hydrogen. Bug Hunt does not list 6.2 Sol or 6.2 Astra, and no other board measures debugging, so they are not ranked. |
| Code review | No source passed the tests. Bug Hunt Bench finds and fixes bugs, the nearest test, so the row follows Debugging. |
| Front-end and web UI | WebDev Arena (people's votes on web apps) measures this job most directly: Fable 5.2 at xhigh has the best score, tied with Opus at max, and clear of the rest. Astra is the best non-Claude model. WebDev does not list 6.2 Astra, and Vibe Code v1.1 ties it with Astra. |
| Math | MathArena, primary: Fable 5.2 has the best score, but MathArena flags that Fable 5.2 came out after its contests, so that score fails test 4 and does not count. 6.1 Sol leads the rest, tied with Astra and Opus. Opus is the best non-OpenAI model. |
| Scientific or data research that runs code | WeirdML v3, primary: Fable 5.2 at xhigh leads, tied with Astra at xhigh, and clear of 6.1 Sol. WeirdML does not list 6.2 Astra: Vals MysteryMechanism and AA CritPt put it level with Astra, and CritPt puts it below Fable 5.2. |
| Analysis, reports, documents | Six Vals boards with private sets, and their leaders differ: Fable 5.2 leads Finance Agent, Excel Modeling and Immigration, Hydrogen leads Tax, and Argon leads Legal Research and HLAB. Opus and Argon are each in the top tie on 5 of the 6 boards: Opus falls out on HLAB, and Argon on Immigration. AA-AnalystAgent (no intervals) puts 6.2 Astra first, and lists neither Fable 5.2 nor Hydrogen. None measures this job more directly than the others. No clear winner, so the choice follows the tools: Claude reads PDFs and runs code. Of the Claude models, Opus and Sonnet are each in 5 top ties, and Opus scores higher on 4 of those 5. Fable 5.2 falls out on Tax and HLAB. Argon is second. |
| Judgment, planning, critique | The boards disagree, and none measures this job more directly than the others. Argon leads Arena Hard Prompts (clear of Opus) and Instruction Following (tied with Opus). Fable 5.2 is on neither board, so Agent Arena steerability ranks it: Fable 5.2 is clearly first there, ahead of Opus. No clear winner, so the choice follows the tools: a Claude teammate reads the repo and runs code. Argon is second. |
| Fact check of claims | No source passed the tests. The row follows Web research. |
| Web research across many sources | Arena Search: 6.1 Sol has the best score, tied with Astra, and clear of Opus. It lists only these 3 table models. Opus is the best non-OpenAI model. High, not the board's max, keeps the wait short (see "Effort"). |
| Long documents or code over 100k tokens | No source passed the tests. Claude has a 1M context. Through `agy`, Gemini keeps far less before it compacts (see "Long context and media"). Argon is second: in the gemini plugin README's long-prompt test ("`/gemini:ask`"), Argon passed in October 2026, and Hydrogen failed some runs on `agy` 1.5.7. |
| Video or audio input | No source passed the tests. Only Gemini takes video and audio in this setup. Hydrogen at medium: Google's Vertex guide names medium for video understanding, and high for complex multimodal analysis (see "Effort"). At low, Hydrogen lost the last spoken word of a video that medium heard (gemini plugin README, "Media"). No test covers long or dense video. |
| Bulk simple work | No source measures quality on simple work. Haiku has the Claude Code tools. Google's Vertex guide names Hydrogen low for classification, summarization and metadata extraction (see "Effort"). Haiku is weak at long agent work: near the average model on Agent Arena, and under half the bugs of the top tie on Bug Hunt. |
| Speed-critical short answers | AA, time to a 500-token answer at low effort: Sonnet is fastest, and 6.2 Sol is the fastest non-Claude model, 0.55 s ahead of Hydrogen. No intervals. 6.2 Sol's 5-day average holds about 1 day. |

## Sources

### Sources used

A refresh reads numbers only from these six sources.

| Source | Verdict | Failed tests and why | How to read it |
|---|---|---|---|
| Bug Hunt Bench | Primary for rows with 3 runs. Secondary for rows with 1 or 2 runs (test 3). | None for 3-run rows. 105 real bugs in two TypeScript repos, a held-back answer key, each model in its own CLI. Doubt on test 2: the judge model differs between rows (gpt-5.5, grok-4.7, gpt-6.1-sol). | bughunt.productcompass.pm/data/benchmark.json. Use rows where `superseded` is null. `n_runs` gives the runs, and the row's `caveat` or `note` gives each run's score. `cost_usd` is a list cost per run. |
| MathArena | Primary | None. New contests, 4 runs per problem. Epoch AI funds it with a grant. Test 4 fails for a model released after the contests: the site flags it, and that model's score does not count. | matharena.ai/models, the headline table. "±" is a 95% bootstrap interval. Cost is per problem. |
| WeirdML v3 | Primary | None. One researcher at the Norwegian Defence Research Establishment runs it, and Epoch AI pays most API costs. Each model runs in its own CLI. The test answers are hidden, and the site shows only 4 of its 11 tasks. Epoch's review of v2: "Verified". | htihle.github.io/assets/data/weirdml_v3.json, list `models`: `score` and `interval` (95%, multiply by 100), `runs`, `reasoning_effort`, `mean_api_cost_usd` per run. |
| Vals AI, boards with a private test set | Secondary | 1: "Companies pay Vals to test their models" (TechCrunch, 2026-09-19). | vals.ai/benchmarks/<slug>: html.unescape the Astro props, and read `benchmarkView.tasks.overall`. "±" is a standard error. Effort is in `compute_effort` or `reasoning_effort`. MysteryMechanism, HLAB and Immigration show no effort: their runs use each model's default (Claude 5.5 and the Codex models max, Fable 5.2 and Argon high, Hydrogen xhigh). HLAB's `dataset_type` says "public", but its page says the results come from the held-out set. |
| arena.ai | Secondary | 1: it ranks its own Max router first on Agent Arena, and sells evaluations to model labs. | The Hugging Face dataset lmarena-ai/leaderboard-dataset, files `<subset>/latest-00000-of-00001.parquet`. Subsets: `agent`, `agent_bash_reliability`, `agent_steerability` and `webdev` (no style-control version exists), `text_style_control` (categories hard_prompts and instruction_following) and `search_style_control`. `[low, high]` is a 95% interval. Agent scores are "net improvement" against the average model, multiplied by 100. arena.ai returns 403 to plain web tools. |
| Artificial Analysis | Secondary | 1: it sells custom benchmarking and "technical testing for models listed (& not listed) in our public benchmarks" to AI providers (artificialanalysis.ai/contact). | Speed: artificialanalysis.ai/models/<base slug>. The page holds one variant object per effort. Read `headline` (output speed, time to first token) only from inside the variant object `{"id":…,"slug":"<slug>",…}`. The suffix-less slug is the top effort. No intervals. Tests: FrontierCode-AA 2.0 (132 private tasks, 3 attempts each), CritPt v2 full set (private, 5 repeats) and AA-AnalystAgent (80 private questions, pass^5 over 5 runs), at artificialanalysis.ai/evaluations/<slug>. Only a headless browser with all variants selected shows every effort. No intervals. Use no other AA board or index. |

Vendor docs and model cards are not used for ranking (tests 1 and 2). They stay the source for prices, limits, effort names and the vendors' advice on effort.

### Sources not used

| Source | Failed tests and why |
|---|---|
| SWE-rebench | None, but it lists none of the table's models. Its newest window ends 2026-07-01. |
| Epoch FrontierMath, ECI, SimpleQA Verified | 1: OpenAI funds FrontierMath, and Epoch does paid work for OpenAI and Google DeepMind. |
| Snorkel Senior SWE-bench | 1: it sells data and evaluation work to AI labs. 50 of its 100 tasks are public. |
| FACTS Search V2 and FACTS Grounding (Kaggle) | 1: Google runs them. FACTS Search was last updated 2026-10-10. |
| ARC Prize | 1: Google and xAI donate, and its donor page offers "Influence" and advisory groups on "next-gen benchmark criteria". 3: no intervals or run counts. |
| Roboflow Vision Evals | 4: the page does not say the set is private. It decides no row. |
| Coarena | 1: it sells eval access and licenses data to AI labs. It decides no row. |
| Plotly DataAnalyticsBench | 3: one run per model. |
| Vals: public task sets, the Vals Index, BioMysteryBench, ProgramBench, KSP | 1, and 3 or 4. |
| Artificial Analysis: Intelligence Index and other boards | 1, and 3 or 4. |
| Terminal-Bench 4 (tbench.ai, Vals, AA) | 2, 4, 5: Epoch found scoring errors in 30 of 66 tasks (45.5%). |
| METR time horizons | It lists none of the table's models. Dropped by the user on 2026-10-26. |
| LiveBench 2.0 | 1: Abacus.AI sponsors it and is ranked on it. 3. |
| Scale AI Labs, Surge AI boards | 1: data vendors to labs. 3 or 4. |
| DesignArena, Toloka Arena | 1: they sell data or evaluations to labs. |
| Exa ATLAS, GitHub ReviewBench, Qodo code review | 1: each ranks its own product. |
| Kagi LLM benchmark, gateway pages (OpenRouter, Eden AI, ZenMux) | 1: they resell model access. 3 or 2. |
| Fireworks Specialized Intelligence Index, benchlm.ai and other aggregators | 2: they copy other boards. |
| SimpleBench | Test 1 not checked. It fits no row. |
| o11y-bench (Grafana) | 2: open submissions. 4: public tasks. |
| Lech Mazur boards | 3 or 4. They fit no row. |
| FrontierSWE v2, VulcanBench | 1: paid work for labs. 4: public tasks. |
| Zapier AutomationBench | 3, 5: grading bugs in 34% of the public tasks. |
| Vectara, Parallel.ai, Deep Research Bench, HELM Long Context, Fiction.LiveBench, SWE-bench-Live, Martian, tau-bench, Video-MME, DuelLab GameBench | 2 or more of tests 2 to 5. |

## Numbers

All read on 2026-11-18. Effort is in brackets where the board gives it.

### Bug Hunt Bench (primary for 3-run rows)

Mean bugs fixed of 105, the runs, and the list cost per run. The file was updated 2026-11-13.

| Model | 3-run rows | Rows with 1 or 2 runs |
|---|---|---|
| Fable 5.2 | max 58.0 (56/53/65) $139.65; xhigh 49.0 (54/45/48) $61.01 | high 43.0, medium 41.5, low 41.0 |
| Sonnet | max 51.3 (57/54/43) $154.03; xhigh 36.0 $42.86; high 34.3; medium 23.3; low 19.0 | — |
| Astra | max 45.0 (48/40/47) $33.03 | xhigh 43, high 35, medium 34, low 27 |
| 6.1 Sol | max 44.3 (44/42/47) $5.88; xhigh 42.7 (41/43/44) $4.35 | high 36.5, medium 29.0, low 22.5 |
| Opus | max 41.7 (43/39/43) $58.53; xhigh 36.0 $34.98; high 31.7; medium 30.3; low 22.3 | — |
| Argon | high 40.7 (40/45/37) $7.16; medium 39.3 (33/39/46); low 35.3 | — |
| Terra | max 40.7 (34/42/46) $3.88; xhigh 11.3; high 9.7; medium 7.3; low 6.0 | — |
| Hydrogen | xhigh 32.7 (43/27/28) $7.07; high 28.3; medium 24.7; low 10.3 | — |
| Haiku | xhigh 18.3 $4.80 | max 21.5, high 16.0, medium 12, low 11 |

Not listed: 6.2 Sol, 6.2 Astra.

### MathArena (primary)

Headline, with 95% intervals: Fable 5.2 [max] 82.8 ±5.3 (flagged: released after the contests), 6.1 Sol [max] 80.6 ±2.7, Astra [max] 78.0 ±4.1, Opus [high] 75.3 ±3.2, Argon [high] 62.1 ±9.9. Cost per problem: 6.1 Sol $1.07, Astra $4.03, Opus $3.92, Fable 5.2 $40.20. Updated 2026-11-13. Not listed: Sonnet, Haiku, Terra, 6.2 Sol, 6.2 Astra, Hydrogen.

### WeirdML v3 (primary)

Score with a 95% interval, runs, and API cost per run, all at xhigh except Argon at high: Fable 5.2 43.1 [41.7, 44.5] 105 runs $28.93; Astra 42.2 [40.2, 44.1] 76 runs $27.85; 6.1 Sol 38.3 [36.1, 40.3] $5.29; Opus 31.2 [30.0, 32.4] $10.25; Terra 28.1 [26.6, 29.6] $2.86; Argon 20.3 [18.7, 21.8] $16.21; Sonnet 19.9 [18.3, 21.6] $9.27; Haiku 11.7 [10.1, 13.3] $2.30. Generated 2026-11-13. Not listed: 6.2 Sol, 6.2 Astra, Hydrogen.

### Vals AI (secondary)

Score ±SE. Claude 5.5 and the Codex models ran at max, Fable 5.2 and Argon at high, and Hydrogen at xhigh, except where the row says otherwise. "Top tie" lists the models that tie the leader.

| Board (updated) | Scores | Top tie |
|---|---|---|
| Code Migration v1.1 (11-09) | Sonnet 86.88±1.52, Fable 5.2 83.27±3.12, Opus 81.01±3.21, Astra 80.58±2.34, 6.1 Sol 77.32±2.98, Argon 70.80±3.72, Haiku 52.36±3.49 | Sonnet, Fable 5.2, Opus, Astra |
| Vibe Code Bench v1.1 (11-16) | Fable 5.2 93.77±1.15, Sonnet 92.39, Argon 91.91, Haiku 90.44, Opus 90.29, 6.2 Astra 89.90±2.04, Astra 89.59±2.17, 6.1 Sol 88.93, Hydrogen 87.78, 6.2 Sol 87.62, Terra 84.00±2.87 | All but Terra |
| MysteryMechanism (11-16) | Astra 53.15±3.36, 6.2 Astra 53.15, Fable 5.2 51.80, Opus 49.55, Sonnet 49.10, 6.1 Sol 46.40, Argon 45.50, 6.2 Sol 36.94, Haiku 35.14 | Astra to Argon |
| Finance Agent v2.1 (11-16) | Fable 5.2 69.47±1.98, Opus 67.85, Argon 67.66, Sonnet 67.28, Haiku 65.37, Hydrogen 65.12, 6.1 Sol 61.82±2.11, 6.2 Astra 60.75, Astra 60.43, 6.2 Sol 58.91, Terra 55.96 | Fable 5.2 to 6.1 Sol |
| Excel Modeling v1.1 (11-16) | Fable 5.2 77.38±2.19, 6.2 Astra 76.03, Sonnet 75.90, Opus 75.84, Hydrogen 75.80, Argon 74.83, 6.2 Sol 74.29, Terra 73.33, Astra 72.68, 6.1 Sol 71.09±2.75, Haiku 65.48±3.69 | All but Haiku |
| Tax Agent (11-16) | Hydrogen 52.31±3.60, Argon 49.22, Opus 44.54, Sonnet 41.96, Fable 5.2 32.09, Haiku 31.92, 6.2 Sol 24.84, 6.2 Astra 21.84, 6.1 Sol 21.75, Astra 20.72, Terra 17.08 | Hydrogen, Argon, Opus, Sonnet |
| Legal Research (11-16) | Argon 54.81±3.46, Hydrogen 53.85, Opus 50.48, Sonnet 48.08, Fable 5.2 46.15, Haiku 43.75, 6.2 Astra 42.79±3.44, Astra 39.42, 6.1 Sol 38.46, 6.2 Sol 37.02, Terra 25.96 | Argon to 6.2 Astra |
| HLAB-Vals-1.1, held-out set (11-16) | Argon 27.08±3.74, 6.2 Astra 16.25±3.08, 6.2 Sol 12.08, Hydrogen 11.25, Sonnet 10.42, Opus 9.17, Astra 7.08, 6.1 Sol 6.25, Fable 5.2 5.00, Haiku 4.17, Terra 1.67 | Argon, 6.2 Astra |
| Immigration, 262 private questions (11-09) | Fable 5.2 73.98±1.33, Opus 72.14±1.45, Sonnet 68.96±1.54, Argon 68.08±1.45, 6.1 Sol 67.81, Astra 67.69, Haiku 61.79 | Fable 5.2, Opus, Sonnet |

Each board also shows the cost per test.

### arena.ai (secondary)

| Board (published) | Scores, with 95% intervals for the top models | Result |
|---|---|---|
| Agent Arena overall (11-15) | Fable 5.2 [max] 28.61 [24.89, 32.33], Opus [max] 18.19 [16.17, 20.22], Sonnet [max] 15.29, Hydrogen [high] 14.91 [13.02, 16.79], Astra [max] 13.91 [11.88, 15.94], 6.1 Sol [max] 11.78, Terra [max] 11.34, Argon [high] 10.00, Haiku [high] −0.37 | Fable 5.2 is clear. |
| Bash reliability (11-15) | Opus [max] 14.35 [13.94, 14.76], Fable 5.2 [max] 13.57 [12.95, 14.19], Terra [max] 12.82 [12.47, 13.18], Sonnet [max] 11.94, Astra [max] 6.68 [5.58, 7.78], Haiku 6.64, 6.1 Sol 4.03, Hydrogen −4.64, Argon −5.76 | Opus ties Fable 5.2. Terra is clear of Astra. |
| Steerability (11-15) | Fable 5.2 [max] 25.51 [21.21, 29.81], Hydrogen [high] 18.37 [16.68, 20.06], Opus [max] 17.52 [15.66, 19.38], Terra 15.80, Sonnet 13.69, Astra 13.51, 6.1 Sol 12.20, Argon 11.79, Haiku 1.10 | Fable 5.2 is clear. |
| WebDev (11-15) | Fable 5.2 [xhigh] 1826.0 [1807.2, 1844.8], Opus [max] 1815.6 [1804.0, 1827.1], Sonnet [xhigh] 1772.2 [1762.5, 1781.9], Astra [max] 1762.9 [1754.4, 1771.3], 6.1 Sol [max] 1742.3 [1732.7, 1752.0], Hydrogen 1703.9, Terra 1680.7, Argon 1679.1, Haiku 1593.2 | Fable 5.2 ties Opus. Astra is clear of 6.1 Sol. |
| Hard Prompts (11-11) | Argon [high] 1545.0 [1538.6, 1551.5], Opus [high] 1530.3 [1523.1, 1537.5], Hydrogen 1514.0, 6.1 Sol 1504.5, Astra 1499.8, Sonnet 1499.0, Haiku 1449.4 | Argon is clear. |
| Instruction Following (11-11) | Argon [high] 1527.6 [1519.5, 1535.6], Opus [high] 1518.1 [1508.9, 1527.2], Hydrogen 1502.9, Sonnet 1481.9, 6.1 Sol 1481.7, Astra 1473.8, Haiku 1425.8 | Argon ties Opus. |
| Search (11-09) | 6.1 Sol [max] 1248.5 [1240.5, 1256.4], Astra [max] 1244.8 [1236.7, 1252.9], Opus [medium] 1213.0 [1206.2, 1219.8] | 6.1 Sol ties Astra. |

Not listed on any board: 6.2 Sol, 6.2 Astra. Fable 5.2 and Terra are not on Hard Prompts or Instruction Following.

### Artificial Analysis (secondary)

| Test | Numbers (no intervals) |
|---|---|
| Time to a 500-token answer at low effort | First token plus 500 tokens at the output speed, computed by the conductor: Sonnet 6.2 s, Haiku 7.9 s, 6.2 Sol 8.7 s, Hydrogen 9.3 s, Opus 9.6 s, Terra 11.1 s, 6.2 Astra 11.3 s, Fable 5.2 11.6 s, 6.1 Sol 12.6 s, Astra 14.3 s. Argon has no low variant: at medium, 23.3 s. |
| FrontierCode-AA 2.0, best effort per model | Fable 5.2 [high] 49.1, 6.2 Astra [xhigh] 49.0, Opus [max] 46.4, 6.2 Sol [max] 44.4, Astra [max] 42.4, Terra [max] 42.3, Sonnet [max] 41.7, 6.1 Sol [max] 40.6, Hydrogen [xhigh] 39.0, Haiku [max] 34.9, Argon [high] 25.7. Fable 5.2 at other efforts: xhigh 47.6, max 48.8. At medium: 6.2 Astra 46.6, Astra 36.6. |
| CritPt v2 full set, best effort per model | Fable 5.2 [max] 86.3, Astra [medium] 84.0, 6.2 Astra [high] 83.7, 6.1 Sol [xhigh] 82.6, Opus [max] 81.7, Terra [max] 81.4, Hydrogen [xhigh] 80.6, 6.2 Sol [max] 78.6, Sonnet [max] 75.7, Argon [high] 72.9, Haiku [xhigh] 66.3. |
| AA-AnalystAgent, pass^5 | 6.2 Astra [max] 62.5, Sonnet [max] 57.5, Opus [max] 56.3, 6.2 Sol [max] 53.8, Haiku [max] 53.8, Astra [max] 51.2, 6.1 Sol [max] 50.0, Argon [high] 48.8. Not listed: Fable 5.2, Terra, Hydrogen. |

## Effort

Scores at each effort are in "Numbers" (Bug Hunt Bench, FrontierCode-AA 2.0).

| Model or topic | Limits and vendor advice |
|---|---|
| Opus | Claude Code docs: max "is prone to overthinking". |
| Sonnet | Anthropic, for agentic coding: "start with medium for well-specified tasks and move to high for harder or longer ones". |
| Fable 5.2 | Anthropic: "Start with `high`. Most of the gain in capability is already present at `high`." "Step up to `xhigh` for your hardest long-running coding and agentic work." At `max` it "runs slower and costs more than at `xhigh`, often for only a small gain" (platform.claude.com/docs/en/build-with-claude/effort, read 2026-11-10). |
| All Claude | Anthropic: xhigh is for "long-running agentic and coding tasks (over 30 minutes)". |
| Codex ultra | No benchmark for GPT-6. OpenAI: ultra splits work across parallel subagents. "Most tasks do not need Max or Ultra." In models_cache.json, the Astra, Sol and Terra models take low to ultra, and gpt-6-luna stops at max. |
| Argon | Through `agy`, Argon stops at high: `--effort=xhigh` and `--effort=max` fail (live test, 2026-10-26). Google: medium for most work, high for hard math, science and agent tasks. |
| Hydrogen | Through `agy` 1.5.7: low, medium, high and xhigh work, and `--effort max` fails (live test, 2026-11-13). Google: high is the default, and xhigh is for hard multi-step problems (aistudio.google.com/docs/thinking). Vertex guide: high for "multi-step agentic tool loops, code generation, architectural refactoring, and complex multimodal analysis", medium for "general coding, tool use, document Q&A, and video understanding", low for "high-throughput classification, routing, summarization, and structured metadata extraction" (read 2026-11-13). |
| Wait time | AA time to first token: Opus low 4.9 s, high 19.8 s, xhigh 63.4 s, max 355.1 s. Sonnet low 2.5 s, high 9.6 s, max 290.3 s. Fable 5.2 high 23.9 s, xhigh 54.3 s, max 215.0 s. 6.1 Sol low 3.0 s, high 26.3 s, max 145.2 s. Terra max 144.4 s. 6.2 Astra high 16.9 s, xhigh 44.6 s. Argon high 47.0 s. Hydrogen low 6.1 s, medium 12.5 s, high 17.4 s, xhigh 42.7 s. |

## Long context and media

| Fact | Numbers | Source |
|---|---|---|
| Context window | Claude, Fable 5.2 too: 1M, 128k output. Argon and Hydrogen: 1M, 65,536 output tokens by default. The output cap through `agy`: not checked. Codex: 6.1 Sol and Terra 500k, Astra 272k. 6.2 Sol and 6.2 Astra: not checked. | platform.claude.com (read 2026-11-10); ai.google.dev (read 2026-10-25); aistudio.google.com (read 2026-11-13); ~/.codex/models_cache.json (read 2026-11-10) |
| Context through `agy` | Sent in parts in one session, a document stayed whole up to about 165k tokens. At about 169k tokens on Argon, `agy` compacted the conversation into a summary. This is what `agy` allows, not the API's 1M. agy issue #1245 reports compaction on Argon at about 240k to 280k tokens. The gap is not explained. The caps and the long-prompt tests: gemini plugin README, "`/gemini:ask`". | Live tests with gemini-4-argon-low, 2026-10-20; issue #1245, read 2026-10-25 |
| Media input in this setup | `codex exec` takes images only (`-i`). The Claude Code Read tool takes images and PDFs. Only Gemini takes audio and video. What Gemini got from each format: gemini plugin README, "Media". | `codex exec --help`, Read tool description, 2026-10-16 |

## Plans, quotas and prices

Only "Low-cost mode" in SKILL.md uses these facts.

| Fact | Numbers | Source |
|---|---|---|
| Codex credits per 1M tokens (input / cached input / output) | 6.2 Astra 200 / 10 / 1,000. Astra 250 / 25 / 1,250. 6.2 Sol and 6.1 Sol 50 / 2.5 / 250. Terra 25 / 1.25 / 125. | learn.chatgpt.com/docs/pricing, read 2026-11-18 |
| Antigravity quota | Which Gemini models share a quota, and how much of it one review used: gemini plugin README, "`/gemini:ask`" and "Which model runs the review?". Google publishes no message count. | Google Antigravity post; gemini plugin README |
| Why the low-cost steps | One effort step lower: on Bug Hunt, Opus at max costs 1.7 times its xhigh cost, Sonnet 3.6 times and Fable 5.2 2.3 times (see "Numbers"). Astra to 6.1 Sol: one fifth of the credits per token, and on Bug Hunt at max they tie at under a fifth of the cost. 6.2 Astra has no such pair, so it drops one effort step. Argon high to medium: close on Bug Hunt (see "Numbers"), and Google recommends medium for most work. Terra stays at max: at xhigh and below it fixes far fewer bugs (see "Numbers"). Hydrogen stays as it is: the table runs it at high only for long or dense video, and SKILL.md "Effort" keeps medium for speech in video. How the Claude and Gemini plans count usage against a limit: not checked. | Rows above |

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

The sections above state what each row lacks. Not stated there:

- Speed: AA measures each vendor's API. The time that `agy`, `codex exec` or a Claude Code teammate adds is not measured.
- Tool versions on 2026-11-13: `agy` 1.5.7 and Codex 0.169.0. On `agy` 1.5.7, only the tests in the gemini plugin README ran. On Codex 0.169.0, one smoke test passed: `exec` with `--output-schema`, `resume` with the access flags before it, `--search`, and the permission profile in `codex sandbox`. The compaction test in "Long context and media" ran on 2026-10-20. Most `codex exec` tests ran on 0.163.0 and 0.164.0.
