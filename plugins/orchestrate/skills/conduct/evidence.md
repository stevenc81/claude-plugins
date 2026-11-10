# Evidence for the routing table

This file holds the numbers and sources behind the "Pick the model" table in SKILL.md, the verdict on each source, and the reason for each choice in that table. SKILL.md holds the rules, including the 5 tests for a source and how to refresh this file ("Refresh the evidence"). This file holds the facts. Do not copy benchmark scores into SKILL.md.

Checked on 2026-11-10, for Claude Fable 5.2 (released 2026-11-09) and gpt-6.1-terra. Two readers on two vendors (Claude Opus 5.5 and Codex gpt-6-astra) read the 11 used sources. A scout (Codex gpt-6-astra) found 7 new boards, and two scorers (Claude Opus 5.5 and Gemini 4 Argon) scored them against the 5 tests. The conductor checked each claim on which they disagreed. The source verdicts from 2026-10-26 stand. AA = Artificial Analysis. "Tie" = the 95% intervals overlap. Where a board gives a standard error (SE), the interval is ±1.96 × SE. What each board's "±" means is in "Sources used", "How to read it".

Fable 5.2 is new, so few boards list it yet. It is not on either primary board that decides a row (MathArena, Bug Hunt Bench), and not on arena.ai. Where a row names Fable, it is Fable 5.2: the `fable` alias in Claude Code now runs Fable 5.2, and Fable 5.1 can be picked only by its full model ID (code.claude.com/docs/en/model-config, read 2026-11-10). Fable 5.1 numbers stay below for comparison. Anthropic says to run an effort sweep rather than carry settings over from Fable 5.1 (platform.claude.com/docs/en/build-with-claude/effort), so this file does not carry Fable 5.1 results over to 5.2.

Arena notes:
- arena.ai returns 403 to plain web tools. Its own dataset on Hugging Face (lmarena-ai/leaderboard-dataset, modified 2026-11-09) holds the same boards. Text, Vision, Search and Document use its style-control subsets, the default. The website's numbers for Search and Document differ from these subsets (read 2026-11-10), so read the dataset, not the website.
- The website shows "AutoEval" rows, such as Fable 5.2 on WebDev at 1832±18. They mix an autorater's votes for the new model with human votes for the others (arena.ai/blog/autoeval-scores). They are not in the dataset and are not used.
- Agent Arena scores are "net improvement": a contrast in percentage points against a randomized baseline that stands for the average model. Positive is above average. The board turns every signal so that a higher shown value is better. This holds for tool hallucination too (help.arena.ai/articles/5432423882-how-to-use-agent-mode, read 2026-10-25).

## Why each choice

One line per row of the "Pick the model" table in SKILL.md, and one for its images paragraph. The numbers are in the sections below.

| Job | Why |
|---|---|
| Hard coding, large refactor | No primary source decides this row: SWE-rebench lists only gpt-5.6-sol. Opus has the best score on Agent Arena overall (it now ties Sonnet), Snorkel Senior SWE-bench and Vals Vibe Code Bench 1-100. Fable 5.2 is on none of these three boards. Astra is the best non-Claude model on Snorkel, Code Migration and Vibe Code 1-100 (ties). |
| Routine coding with a clear scope | Two Vals boards disagree on the best score. Code Migration (change existing code, graded by hidden tests) measures this job most directly, and Sonnet leads it, tied with Fable 5.2, Opus and Astra. Vibe Code v1.1 builds whole apps from a spec: Fable 5.2 leads it, tied with seven others. Astra is the only non-Claude model in the top tie on both boards: Argon ties on Vibe Code v1.1 but scores 70.80 on Code Migration. |
| Shell, infra and deploy work | Opus is clearly first on Agent Arena bash reliability. Of the non-Claude models, gpt-6.1-terra at max scores highest there, clear of 5.6 Sol. Argon scores below the average model. One board only. Fable 5.2 is not listed. |
| Debugging, root cause | Bug Hunt Bench, primary: Sonnet at max has the best mean. Its runs overlap those of Astra, 6.1 Sol, Opus, Terra (max) and Argon, so it is a tie. Astra at max is the best non-Claude model. Fable 5.2 is not listed. |
| Code review | No source passed the tests. Bug Hunt Bench finds and fixes bugs, the nearest test, so the row follows Debugging. |
| Front-end and web UI | Opus is clearly first on WebDev Arena (people's votes). Astra is the best non-Claude model. Fable 5.2 has only an AutoEval row there, which is not used (see "Arena notes"). Vals Vibe Code v1.1 puts 8 of our models in a tie. |
| Math | MathArena, primary: 6.1 Sol leads, ties Astra and Fable 5.1, and is clear of Opus. Fable 5.2 is not on MathArena. Epoch FrontierMath (secondary) puts Fable 5.2 first, tied with 6.1 Sol, Astra, Opus, Terra, Fable 5.1 and 5.6 Sol. Opus is the best non-OpenAI model on MathArena. |
| Scientific or data research that runs code | Vals MysteryMechanism: Astra leads, and ties Fable 5.2, Opus, Sonnet, Fable 5.1, 6.1 Sol and Argon. Fable 5.2 is the best non-OpenAI model. One board only. |
| Analysis, reports, documents | Six Vals boards with private sets. Fable 5.2 leads Finance Agent and Excel Modeling. Fable 5.1 leads Tax, Legal Research and Immigration, and Argon is clearly first on HLAB. Opus is in the top tie on five boards, Fable 5.2 on four: it falls far out of the tie on Tax (32.09 against 50.75). Plotly DataAnalyticsBench (one run) puts Fable 5.2, Astra and 6.1 Sol at 43 of 43, tied with Opus and Argon at 41. No clear winner, so the choice follows the tools: Claude reads PDFs and runs code. |
| Judgment, planning, critique | The boards disagree, and none measures this job more directly than the others. Argon leads Arena Hard Prompts (clear) and Instruction Following (ties Opus). Opus leads Agent Arena steerability (ties Terra, Astra and Sonnet). Astra leads ARC-AGI-2, and Fable 5.2 at xhigh leads ARC-AGI-3 on the standard harness, both with no intervals. No clear winner, so the choice follows the tools: a Claude teammate reads the repo and runs code. Argon is second. |
| Fact check of claims | FACTS Search measures answers found with web search: Astra leads, tied with 5.6 Sol and 6.1 Sol. Opus scores above Argon. Fable 5.2, Terra and Sonnet are not listed. The board has not changed since 2026-10-10. |
| Web research across many sources | Arena Search (people's votes): 5.6 Sol, 6.1 Sol and Astra tie at the top. FACTS Search (correct answers found with search) measures the job most directly, and Astra leads it, so Astra is first. Opus is the best non-OpenAI model on FACTS Search. Fable 5.2 is on neither board. |
| Long documents or code over 100k tokens | No source passed the tests. `agy` compacts Argon's conversation far below its 1M window (see "Long context and media"). Claude has a 1M context. |
| Video or audio input | No source passed the tests. Only Gemini takes video and audio in this setup. The video efforts follow Google's Vertex AI guide. |
| Bulk simple work | No source measures quality on simple work. Haiku has the Claude Code tools. Haiku and Flash are weak at long agent work (see "Weak spots"). |
| Speed-critical short answers | AA, time to a 500-token answer at low effort (first token plus 500 tokens at the output speed, computed by the conductor from AA's headline values): Sonnet 6.5 s is fastest. Of the non-Claude models, gpt-5.6-sol takes 8.2 s, Terra 9.6 s, 6.1 Sol 11.1 s. Terra has the fastest first token (2.3 s), but half of Sonnet's output speed. No intervals. |
| Images and screenshots | Roboflow: Argon leads counting, and leads detection at high effort, tied with Terra. Its OCR score is one run, so OCR is not used. Vision Arena: 6 of our models tie, and Argon is not listed. Fable 5.2 is on neither board. |

## Sources

Verdicts from 2026-10-26, and for the boards added on 2026-11-10. The tests are in SKILL.md, "Refresh the evidence".

### Sources used

A refresh reads numbers only from these sources (SKILL.md, "Refresh the evidence").

| Source | Verdict | Failed tests and why | How to read it |
|---|---|---|---|
| MathArena | Primary | None. New contests, 4 runs per problem, 95% intervals. Epoch AI funds it with a grant. | matharena.ai/models for the headline table. matharena.ai/competition_tables/<id> for each contest. Plain web tools work. "±" is a 95% interval. Skip LeanLean: one run per repository and no interval (matharena.ai/leanlean_october, read 2026-11-10). |
| Bug Hunt Bench | Primary for rows with 3 or more runs. Secondary for rows with 1 or 2 runs (test 3). | None for 3-run rows. Answer key held back, each model in its own CLI. | bughunt.productcompass.pm/data/benchmark.json. Use rows without a `superseded` note. `n_runs` gives the runs. A tie means the ranges of the runs overlap. |
| SWE-rebench | Primary, cannot decide a row | None. It lists only one of our models (see "Coding and agentic work"). | swe-rebench.com. Use the newest time window. "±" is the SEM of 5 runs. |
| arena.ai, all boards | Secondary | 1: it ranks its own Max router first on Agent Arena (arena.ai blog, 2026-10-12) and sells evaluations to model labs. | arena.ai returns 403 to plain web tools. Read the Hugging Face dataset lmarena-ai/leaderboard-dataset, files `<subset>/latest-00000-of-00001.parquet`, the `*_style_control` subsets. `[low, high]` is a 95% interval. The agent subsets hold only the category "overall", which includes its signals (bash reliability, steerability, tool hallucination). Category boards such as Code need arena.ai in a real browser. |
| Vals AI, boards with a private test set | Secondary | 1: "Companies pay Vals to test their models" (TechCrunch, 2026-09-19). | vals.ai/benchmarks/<slug>. Use a board only if its page says the test set is private or held out (vals.ai/methodology). Skip indexes that mix in public boards. "±" is a standard error (vals.ai/methodology). |
| Artificial Analysis, speed tests | Secondary | 1: it does custom benchmarking for AI companies. | artificialanalysis.ai/models/<slug>, for example `gpt-6-1-terra-low` or `claude-fable-5-2-high`. Since early November 2026 it uses "Performance v3": "The headline value averages each Performance v3 workload over the past 5 days, then averages the workloads." Read the headline output speed and the headline time to first token. The old `timescaleData` and prompt type "long" are gone, so its numbers before 2026-11-10 do not compare. No intervals. |
| Epoch FrontierMath | Secondary | 1: paid work for Google DeepMind and OpenAI (epoch.ai/about/transparency). OpenAI funds FrontierMath. | epoch.ai/data/benchmark_data.zip, files frontiermath_tiers_1_3_v2.csv and frontiermath_tier_4_v2.csv. "±" is the stderr column. |
| Snorkel Senior SWE-bench | Secondary | 1: it sells data and evaluation work to AI labs (the step-2 reviewers' verdict; their quote was not kept). | senior-swe-bench.snorkel.ai/agents. No intervals shown: pass@3 implies 3 attempts per task. |
| FACTS Search V2 (Kaggle) | Secondary | 1: Google runs it. | kaggle.com/benchmarks/google/facts-search/versions/2. The table shows only in a real browser. The page does not say what "±" means (not checked further). This file reads it as a 95% interval. |
| ARC Prize | Secondary | 3: no intervals or run counts. | arcprize.org/media/data/evaluations.json and models.json. No intervals. |
| Roboflow Vision Evals | Secondary | 4 not shown: the page does not say the set is private, and the Reasoning page shows real samples with answers. OCR also fails 3 (one run), so OCR is not used. | playground.roboflow.com/evals. WebFetch and a real browser work. curl got HTTP 429 on 2026-11-10. "±" is half the range of 3 runs. |
| Coarena, Computer Use board | Secondary. No row in the table measures computer use, so it decides no row. | 1: it sells "Eval access" and licenses training trajectories and preference data to AI labs (coarena.ai/data). Both scorers agree. | coarena.ai/leaderboard. Ratings from blind votes on user-submitted browser and desktop tasks, in one shared harness. "±" is a 95% interval. Fable 5.2 had under 30 comparisons on 2026-11-10, so it was not rated. Its Phone Use board is not used: the two scorers read very different numbers from it, and no row measures phone use. |
| Plotly DataAnalyticsBench | Secondary | 3: "Each model has been run once, so there are no error bars." Both scorers agree. | plotly.com/blog/introducing-dataanalyticsbench. 43 private questions on a made-up data warehouse. The page says "a difference of one or two questions between models is within the noise", so read scores within 2 as a tie. |

Vendor docs and model cards are not used for ranking (tests 1 and 2). They stay the source for prices, limits, effort names and the vendors' advice on effort.

### Sources not used

| Source | Failed tests and why |
|---|---|
| METR time horizons | Passed all 5 tests, but lists none of our models, and "This page is no longer actively updated" (last update 2026-09-08). Removed at the user's request on 2026-10-26. |
| Vals AI, boards on public task sets, and the Vals Index | 1 (as Vals above), 4: public task sets. The Vals Index mixes in public boards. |
| Vals Time Horizon Index: KSP | 1 (as Vals above), 3: one campaign per model, no error range. |
| Artificial Analysis, other boards | 1, and 3 or 4. The Intelligence Index includes Terminal-Bench 4 and HLE. |
| Epoch ECI and SimpleQA Verified | 1 (as Epoch above). ECI also fails 2: it takes each model's best score over all settings. SimpleQA Verified also fails 4: a public set. |
| FACTS Grounding v2 (Kaggle) | 1, 3: no interval or run count. |
| Terminal-Bench 4 (tbench.ai, Vals, AA) | 2, 4, 5: Epoch rates it "Flawed", 30 of 66 tasks (45.5%) have scoring errors. |
| LiveBench 2.0 | 1 (sponsored by Abacus.AI, which it ranks), 3 (one run per suite) |
| Scale AI Labs (HLE-Diamond, DrugDiscoveryBench, RLI, AudioMultiChallenge) | 1, and 3 or 4 |
| GitHub ReviewBench | 1 (GitHub ranks its own Copilot), 4 |
| Vectara hallucination board | 2 (setup stops at 2025 models), 3 |
| Parallel.ai search board | 1, 3, 5 |
| Gateway pages (OpenRouter, Eden AI, ZenMux) | 1 (they resell the models), 2 (live traffic, mixed prompts and settings) |
| benchlm.ai | 2: it copies other boards. |
| Deep Research Bench | 2 (setup), 3 (repeat runs), 4 (public questions). Step-2 scores. |
| HELM Long Context | 3, 4. Step-2 scores. |
| Fiction.LiveBench | 3, 4. Step-2 scores. |
| SWE-bench-Live | 2, 3. Step-2 scores. |
| Martian Code Review Bench | 3, 4. Step-2 scores. |
| tau-bench | 2, 4. Step-2 scores. |
| Video-MME | 2, 3, 4. Step-2 scores. |
| FrontierSWE v2 (Proximal Labs) | 1: paid work for labs, "worked with frontier labs and enterprises to help them train better coding agents" (proximal.ai/blog/new-frontiers). 4: all 34 tasks, with reference solutions, are in a public repo. Both scorers agree. Fable 5.2 69.9±8.6 ties Astra 65.5±8.9. |
| Zapier AutomationBench 1.0.6 | 3: single runs, no error range. 5: an audit found grading bugs in 206 of the 600 public tasks (34%). The leaderboard uses a private set that the audit could not see. Test 2 is also in doubt: the Claude models ran with different fallback rules. One scorer: not used. The other: open, leaning not used. |
| VulcanBench Frontier v4 | 1: it offers paid reports to labs ("Benchmark your model"). 4: the tasks, with reference patches, are in a public repo. Its "±" is one task standard error of one run. Both scorers: not used. |
| DuelLab GameBench 2 | 3: one program per model and game, no error range. 4: public board games such as chess and Go. One scorer: not used. The other: secondary or not used, depending on test 4. |
| Vals boards on Anthropic's tasks (BioMysteryBench) and on public tasks (ProgramBench) | As "Vals AI, boards on public task sets" above. BioMysteryBench "was developed by Anthropic", and Fable 5.2 leads it. |

## Coding and agentic work

| Fact | Numbers | Source |
|---|---|---|
| Bug Hunt Bench (primary for rows with 3 or more runs) | 105 real bugs in two TypeScript repos (a VS Code extension of about 28K lines, 45 bugs; a React/Supabase app of about 60K lines, 60 bugs). Graded blind against an answer key that is held back. Each model runs in its own CLI. Mean bugs fixed, runs, list cost: Sonnet 5.5 max 51.3 (57/54/43, $154.03), Astra max 45.0 (48/40/47, $33.03), 6.1 Sol max 44.3 (44/42/47, $5.88), 6.1 Sol xhigh 42.7 ($4.35), Opus 5.5 max 41.7 (43/39/43, $58.53), Argon high 40.7 (40/45/37, $7.16), Haiku 5.5 xhigh 18.3 ($4.80), 3.8 Flash high 18.0 ($11.03). Sonnet, Astra, 6.1 Sol, Opus and Argon tie. Rows with fewer than 3 runs: gpt-5.6-sol max 43.5 (2 runs), Fable 5.1 max 43 (1 run), Haiku max 21.5 (2 runs). The board: "Read a gap of a few points between two single runs as possible noise." gpt-6.1-terra, 3 runs each: max 40.7 (34–46, $3.88), xhigh 11.3 (9–14, $0.75), high 9.7, medium 7.3, low 6.0. Terra max ties Sonnet max. Fable 5.2: not listed. | bughunt.productcompass.pm/data/benchmark.json, updated 2026-10-27, read 2026-11-10 |
| Agent Arena, overall (net improvement) | Opus max 19.96 [17.90, 22.01], Sonnet max 15.99 [13.15, 18.84], Fable 5.1 max 14.34, Astra max 14.24, 6.1 Sol max 12.53, Terra max 12.10 [10.75, 13.46], Argon high 10.83, 5.6 Sol xhigh 4.53, Flash 2.38, Haiku high 0.43. Opus now ties Sonnet. Median cost per task: Astra $7.04, Fable 5.1 $6.87, Opus $6.31, Sonnet $3.42, 6.1 Sol $0.98, Argon $0.82, Terra $0.80, Flash $0.75, Haiku $0.08. Fable 5.2: not listed. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Agent Arena, Code (net improvement) | Opus 22.87±3.48, Sonnet 15.76±4.30, Astra 14.84±3.09, 6.1 Sol 14.46±2.31, Fable 5.1 13.89±2.92, Argon 10.18±1.24. Opus and Sonnet touch. Cost per Code task: Fable 5.1 $21.25, Opus $13.77, Astra $10.84, Sonnet $9.01, Argon $2.40, 6.1 Sol $1.76, Flash $1.57, Haiku $0.43. Not re-read on 2026-10-26 (see arena.ai in "Sources used"). | arena.ai/leaderboard/agent/code, 2026-10-23 |
| Agent Arena, bash reliability (net improvement) | "How often the model's bash commands succeed. Errors outside its control aren't counted." Opus 15.00 [14.57, 15.42] (#1 of ours), Terra max 13.31 [12.92, 13.70], Sonnet 12.70 [12.09, 13.32], 5.6 Sol 11.28 [10.62, 11.95], Fable 5.1 10.02, Flash 9.93, Astra 7.78, Haiku 7.46, 6.1 Sol 4.98, Argon −5.63 [−6.76, −4.50]. Opus is clear. Terra ties Sonnet and is clear of 5.6 Sol. Fable 5.2: not listed. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Snorkel Senior SWE-bench (Mini-SWE-agent, 95 scored tasks) | "Tasteful" pass@1: Opus 5.5 high 39.3 (#1; max 36.9, xhigh 34.1), Astra high 36.8, Fable 5.1 medium 34.7, gpt-5.6-sol xhigh 34.7, Argon medium 27.7 (new). Basic pass@1: Opus 61.8, Astra 60.0, Fable 5.1 57.9, Argon 56.4, 5.6 Sol 53.7. No intervals shown. A binomial interval on 95 tasks is about ±10 points, so the top four tie (computed by the reader, not by Snorkel). Fable 5.2, Terra, Sonnet, Haiku, 6.1 Sol and Flash not listed. | senior-swe-bench.snorkel.ai/agents, read 2026-11-10 |
| Vals Code Migration v1.1 (Pi agent harness) | Sonnet max 86.88±1.52 ($43.88 per test), Fable 5.2 high 83.27±3.12 ($69.19), Opus max 81.01±3.21, Astra max 80.58±2.34, 6.1 Sol max 77.32±2.98 ($9.51), Argon high 70.80±3.72, Haiku 52.36, Flash 38.65. Sonnet ties Fable 5.2, Opus and Astra. Grading uses a hidden suite of behavior tests, but the source programs come from open-source repos. Terra not listed. | vals.ai/benchmarks/code-migration-v1-1, updated 2026-11-09 |
| Vals Vibe Code Bench 1-100 (extend a working web app, OpenHands) | Opus xhigh 30.36±4.83, Fable 5.1 max 28.00, Astra max 27.64, Argon high 21.20, Haiku 20.41, 5.6 Sol 20.01, Flash 18.77. All tie with Opus. Fable 5.2, Terra, Sonnet and 6.1 Sol not listed. | vals.ai/benchmarks/vcb-1-100, updated 2026-10-29 |
| Vals refusals | Vals marks tasks that a fallback model served after a refusal. They fall on security work, terminal tasks, Vibe Code, BioMystery and some Legal Research, not on finance or tax. Sonnet: fallback on 3.99% of tasks. Opus: 4.28%. | vals.ai model pages, read 2026-10-25 |
| Text Arena, Coding (human preference) | Argon 1552.7 [1543.0, 1562.5], Astra 1548.0, Opus 1546.0, 6.1 Sol 1541.3, Fable 5.1 1534.2, 5.6 Sol 1533.2, Flash 1530.2, Sonnet 1516.7. Argon ties Astra, Opus, 6.1 Sol and Fable 5.1. Fable 5.2 and Terra not listed. | HF dataset, published 2026-11-08, read 2026-11-10 |
| SWE-rebench | gpt-5.6-sol medium 62.3% ±1.83 SEM, pass@5 79.3%, 5 runs, $0.85 per problem. Fable 5 high 64.5% (#1). No other model of ours. Window 2026-05-15 to 2026-07-01, unchanged. | swe-rebench.com, read 2026-11-10 |

## Front-end and web UI

| Fact | Numbers | Source |
|---|---|---|
| WebDev Arena | Opus max 1818.2 [1806.2, 1830.2] (#1 of ours), Sonnet xhigh 1773.5, Astra max 1766.9, Fable 5.1 max 1744.3, 6.1 Sol max 1742.6, Sonnet high 1713.4, Argon high 1682.8, Terra max 1678.4 [1667.2, 1689.5], 5.6 Sol xhigh 1615.4, Haiku high 1594.9, Flash high 1583.6. Opus is clear of all others. Fable 5.2: only an AutoEval row on the website, 1832±18, not used (see "Arena notes"). | HF dataset, published 2026-11-08, read 2026-11-10 |
| Image-to-WebDev Arena | Opus max 1750.7 [1731.2, 1770.3], Sonnet xhigh 1743.7, Fable 5.1 1724.0, Astra 1721.0, 6.1 Sol 1696.7, 5.6 Sol 1606.3, Flash 1593.6. Opus ties Sonnet, Fable 5.1 and Astra. Fable 5.2 and Terra not listed. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Vals Vibe Code Bench v1.1 (working web apps from a spec, OpenHands) | Fable 5.2 high 93.77±1.15 ($22.13), Sonnet max 92.39±1.26 ($31.25), Argon high 91.91±1.90 ($8.11), Haiku max 90.44, Opus max 90.29 ($57.92), Fable 5.1 max 90.26, Astra max 89.59, 6.1 Sol max 88.93 ($6.23), Terra max 84.00±2.87 ($6.00), 5.6 Sol 80.50, Flash 78.65. Fable 5.2 ties all from Sonnet to 6.1 Sol. It grades whether the app works, not how people rate the page. | vals.ai/benchmarks/vibe-code, updated 2026-11-09 |

## Math and science

| Fact | Numbers | Source |
|---|---|---|
| MathArena, headline (primary) | IRT estimate with a 95% bootstrap interval, 4 runs per problem. 6.1 Sol max 80.6±2.4, Astra max 77.8±4.4 (low 72.9±4.1), Opus high 75.3±2.7, Fable 5.1 high 73.2±5.0 (max 71.8±4.4, low 62.5±4.7), Argon 62.1±9.3, 5.6 Sol max 55.5±4.0, Flash 32.2±2.7. 6.1 Sol ties Astra, touches Fable 5.1 high (78.2), and is clear of Opus (78.0 < 78.2). All scores fell after the 10/2026 contests were added (cause not checked). Fable 5.2, Terra, Sonnet and Haiku not listed. Opus only at high. | matharena.ai/models, read 2026-11-10 (10/2026 contests added 2026-11-09) |
| MathArena, 10/2026 contests (primary) | ArXivMath: 6.1 Sol 90.43±5.95, Argon 82.98±7.60, Opus high 79.79±8.12 (all tie). BrokenArXiv (spotting false statements): 6.1 Sol 80.25±7.51, Opus 77.78±7.84 (tie), Argon 39.81±9.23. MathArena marks Argon "released after competition release". | matharena.ai/competition_tables, read 2026-11-10 by one reader (the other could not open these pages) |
| Epoch FrontierMath (private set) | Tiers 1–3 v2: Fable 5.2 max 95.09±1.28 (SE), 6.1 Sol max 93.68±1.44, Astra max 93.68, Opus max 91.23±1.68, Terra max 90.88±1.71, Fable 5.1 max 90.18, 5.6 Sol max 89.12, Sonnet max 88.77±1.87, Argon high 85.96±2.06, Haiku max 75.09, Flash high 68.42. Fable 5.2 ties 6.1 Sol, Astra, Opus, Terra, Fable 5.1 and 5.6 Sol, and is clear of Sonnet. Tier 4 v2: Fable 5.2 100.0 and 6.1 Sol 100.0 (SE 0), Astra 97.60, Opus 95.00, Terra 92.68, Fable 5.1 87.80, 5.6 Sol 82.93, Sonnet 80.49, Argon 78.05. | epoch.ai/data/benchmark_data.zip, Fable 5.2 run started 2026-11-06, read 2026-11-10 |
| Vals ProofBench v1.1 (Lean proofs, private split) | Fable 5.2, Fable 5.1, Opus and Sonnet 100; 6.1 Sol, Astra and Argon 99; Haiku 89; 5.6 Sol 83; Flash 48. At its ceiling. | vals.ai/benchmarks/proof_bench, updated 2026-11-09 |
| Vals MysteryMechanism (find hidden mechanisms by experiment) | Astra 53.15±3.36, Fable 5.2 51.80±3.36, Opus 49.55, Sonnet 49.10, Fable 5.1 47.75, 6.1 Sol 46.40, Argon 45.50, Flash 36.49, Haiku 35.14, 5.6 Sol 33.33. Astra ties the next six. Effort not shown. Terra not listed. | vals.ai/benchmarks/mysterymechanism, updated 2026-11-09 |
| Arena Math (human preference) | Argon 1527.9 [1508.8, 1547.0], Fable 5.1 1525.2, Flash 1519.2, Opus 1518.3, 6.1 Sol 1498.2, 5.6 Sol 1493.9, Sonnet 1489.0, Astra 1481.3. Argon ties Fable 5.1, Flash, Opus, 6.1 Sol and Sonnet. Fable 5.2 and Terra not listed. | HF dataset, published 2026-11-08, read 2026-11-10 |

## Knowledge work, writing and judgment

| Fact | Numbers | Source |
|---|---|---|
| Vals Finance Agent v2.1 | Fable 5.2 high 69.47±1.98 ($4.83), Opus max 67.85±2.05 ($8.91), Argon high 67.66 ($4.32), Sonnet 67.28, Flash 65.76, Haiku 65.37 ($1.64), 6.1 Sol 61.82, Astra 60.43, Terra max 55.96±2.09. Fable 5.2 ties all but Astra and Terra. | vals.ai/benchmarks/fabv2-1, updated 2026-11-09 |
| Vals Excel Modeling v1.1 | Fable 5.2 high 77.38±2.19 ($6.67), Fable 5.1 max 76.73, Sonnet 75.90, Opus 75.84, Argon 74.83, Terra max 73.33 ($0.56), Flash 72.87, Astra 72.68, 6.1 Sol 71.09, Haiku 65.48. Fable 5.2 ties all but Haiku. | vals.ai/benchmarks/emb-v1-1, updated 2026-11-09 |
| Vals Tax Agent Bench | Fable 5.1 50.75±3.61, Argon 49.22, Opus 44.54, Sonnet 41.96 (tie), Flash 32.12, Fable 5.2 high 32.09±3.37, Haiku 31.92, 5.6 Sol 31.09, 6.1 Sol 21.75, Astra 20.72, Terra 17.08. Argon, Opus and Fable 5.1 changed since 2026-10-26 (cause not checked). | vals.ai/benchmarks/tax_agent_bench, updated 2026-11-09 |
| Vals Legal Research Bench | Fable 5.1 55.29±3.46, Argon 54.81, Opus 50.48, Sonnet 48.08, 5.6 Sol 48.08, Fable 5.2 high 46.15, Haiku 43.75 (tie), Astra 39.42, Flash 38.94, 6.1 Sol 38.46, Terra 25.96 | vals.ai/benchmarks/legal_research, updated 2026-11-09 |
| Vals HLAB-Vals-1.1 (legal work with files, held-out set) | Argon 27.08±3.74 (#1, clear), Flash 12.08, Sonnet 10.42, Opus 9.17, Astra 7.08, 6.1 Sol 6.25, Fable 5.2 5.00, Haiku 4.17, Terra 1.67 | vals.ai/benchmarks/hlab, updated 2026-11-09 |
| Vals Immigration Bench (new; 262 private questions; default settings, no web search) | Fable 5.1 75.44±1.40, Fable 5.2 73.98±1.33, Opus 72.14 (tie), Sonnet 68.96, Argon 68.08, 6.1 Sol 67.81, Astra 67.69, Flash 63.41, Haiku 61.79. Terra and 5.6 Sol not listed. Built with the Talent Mobility Fund. | vals.ai/benchmarks/immigration, updated 2026-11-09 |
| Plotly DataAnalyticsBench (43 private questions, one run) | Astra 43, 6.1 Sol 43, Opus 41, Argon 41, Terra 40, Sonnet 38, Haiku 37. Fable 5.2 43 (cost $35.74 per run) and Fable 5.1 39, checked by the conductor on the page. Scores within 2 tie (the page). | plotly.com/blog/introducing-dataanalyticsbench, read 2026-11-10 |
| Arena Text, overall | Argon high 1522.0 [1516.5, 1527.5], Opus high 1505.7 [1499.6, 1511.8], Fable 5.1 max 1503.1, Flash 1497.5, 5.6 Sol 1485.0, 6.1 Sol 1481.7, Astra 1474.5, Sonnet xhigh 1471.9, Haiku 1422.6. Argon is clear. Fable 5.2 and Terra not listed. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Arena Hard Prompts | Argon 1544.6 [1538.0, 1551.2], Opus 1530.1 [1522.7, 1537.5], Fable 5.1 1521.2, Flash 1519.0, 5.6 Sol 1511.0, 6.1 Sol 1506.1, Astra 1499.8, Sonnet 1497.6. Argon is now clear of Opus. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Arena Instruction Following | Argon 1526.8 [1518.5, 1535.1], Opus 1518.5 [1509.1, 1527.9] (tie), Fable 5.1 1500.6, Flash 1492.3, 5.6 Sol 1490.2, 6.1 Sol 1483.9, Sonnet 1479.3, Astra 1473.2 | HF dataset, published 2026-11-08, read 2026-11-10 |
| Agent Arena, steerability (net improvement) | Opus 18.57 [16.55, 20.58], Terra 15.81, Fable 5.1 15.74, Astra 14.82, Sonnet 13.76 (all tie), Argon 13.53, 6.1 Sol 13.35, 5.6 Sol 6.09, Haiku 2.66, Flash −0.64. Fable 5.2 not listed. | HF dataset, published 2026-11-08, read 2026-11-10 |
| ARC-AGI-2 (semi-private) | Astra max 95.0 ($1.12 per task; xhigh 93.3), 6.1 Sol max 94.2 ($0.25), Fable 5.2 xhigh 93.75 ($0.98; max 92.5 at $2.81, high 90.4, medium 89.6, low 86.7), Opus high 93.3 ($0.41; xhigh 92.5, max 91.7), 5.6 Sol max 92.5, Argon high 91.3 ($0.32), Fable 5.1 max 90.0 ($4.49), Flash high 89.2, Sonnet xhigh 83.9, Haiku xhigh 61.3. No intervals. Terra not listed. | arcprize.org/media/data/evaluations.json, read 2026-11-10 |
| ARC-AGI-3 (interactive) | Provider Adapter harness: Astra high 99.9, Fable 5.2 high 97.7 (xhigh 97.3, max 94.9), Argon low 97.5, 6.1 Sol xhigh 96.4, Sonnet xhigh 72.4, Flash high 35.0, Haiku max 2.8. Standard harness: Fable 5.2 xhigh 81.2 (high 79.3, medium 73.3, max 65.7, low 52.0), Astra max 62.7, 6.1 Sol max 52.7, Argon low 49.8. Fable 5.2 max hit the 12-hour limit in 28 of 55 games. Opus 5.5, Fable 5.1 and Terra not listed. No intervals. | arcprize.org/media/data/evaluations.json, read 2026-11-10 |

## Facts and web search

| Fact | Numbers | Source |
|---|---|---|
| FACTS Search V2 (answers found with web search, public and private sets) | Astra 89.9±1.1, 5.6 Sol 88.5±1.4, 6.1 Sol 88.2±1.2 (tie with Astra), Opus 5.5 86.5±1.3, Argon 84.0±1.3, Haiku 77.5±1.7, Flash 76.3±1.4. Hedging rate: Argon 11.5%, Flash 21.2%, Astra 6.0%, Opus 4.8%. Fable 5.1, Fable 5.2, Terra and Sonnet not listed. | kaggle.com/benchmarks/google/facts-search/versions/2, updated 2026-10-10, unchanged when read 2026-11-10 in a browser |
| Arena Search | gpt-5.6-sol xhigh 1255.6 [1249.0, 1262.2] (#1 of ours), 6.1 Sol max 1249.0, Astra max 1244.9 [1236.9, 1253.0] (tie), Fable 5.1 high 1228.5 [1221.5, 1235.5] (no longer ties Astra), Opus medium 1213.8. Fable 5.2, Terra, Sonnet, Haiku, Argon and Flash not listed. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Vals Web Search Index (search tools inside finance and legal tasks) | Only gpt-5.6-sol is listed: with native search 43.58±1.98. | vals.ai/benchmarks/web_search, updated 2026-10-21 |
| Agent Arena, tool hallucination (net improvement, higher is better) | Astra, 6.1 Sol, Terra and 5.6 Sol each 0.92 [0.84, 1.00], the same value as the board's #1, which looks like a cap (not checked). Fable 5.1 0.81, Sonnet 0.80, Opus 0.68 (all tie with them), Flash 0.46, Argon 0.43, Haiku −1.73. It measures invented tool calls, not facts. Fable 5.2 not listed. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Codex web search | `codex --search exec ...` works with gpt-6.1-sol. | Tested locally, 2026-10-16 |

## Long context and media

| Fact | Numbers | Source |
|---|---|---|
| Context window | Claude 1M, 128k output (also Fable 5.2: platform.claude.com/docs/en/models/fable-5-2/overview, read 2026-11-10). Argon and 3.8 Flash 1M. Argon output: 65,536 tokens by default, up to 1,048,576 with long decode (background execution). The output cap through `agy`: not checked. In Codex: 6.1 Sol and 6.1 Terra 500k, Astra and Luna 272k (the API allows 1.05M; models_cache.json, read 2026-11-10). | Vendor docs, ai.google.dev (Argon output, read 2026-10-25), ~/.codex/models_cache.json, read 2026-10-20 |
| Context through `agy` | `agy` cuts one long message: for the measured cap, see the gemini plugin README, "`/gemini:ask`", the bullet on the message cap. Sent in parts in one session, a document stays whole up to about 165k tokens. At about 169k (Argon) and 164k to 205k (Flash), `agy` compacts the conversation into a summary. This is what `agy` allows, not the API's 1M (row above). agy issue #1245 (open): the issue body measures compaction at about 250k to 276k tokens on Argon, and a comment at 241,901 to 279,687. `AGY_CLI_AUTO_COMPACT_OVERRIDE` exists in 1.4.7, but comments say it has no effect. Not tested here. Neither report explains our lower numbers. The compaction numbers were not rerun on 1.4.5 or 1.4.7. | Live tests with gemini-4-argon-low and gemini-3.8-flash-low, 2026-10-20. Cap rechecked on agy 1.4.5, 2026-10-23. Issue #1245 and the local 1.4.7 binary read 2026-10-25 |
| Arena Longer Query | Argon 1542.4 [1534.6, 1550.2], Opus 1519.9 [1511.2, 1528.7], Flash 1511.6, Fable 5.1 1509.7, 5.6 Sol 1497.7, Sonnet 1489.2, 6.1 Sol 1488.6, Astra 1486.1. Argon is now clear. Long prompts, not 100k tokens. Fable 5.2 and Terra not listed. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Media input in this setup | `codex exec` takes images only (`-i`). The Claude Code Read tool takes images and PDFs. Only Gemini takes audio and video. | `codex exec --help`, Read tool description, 2026-10-16 |
| Codex images and web | With `-s workspace-write -C <folder>`, Codex made a 64x64 PNG with its `image_gen.imagegen` tool. The tool saved it under `~/.codex/generated_images/`, and Codex copied it into the `-C` folder with `sips`. In the same test, `codex --search exec` opened example.com with its `web.run` tool, a web search tool, not a JavaScript browser. | Live test on Codex CLI 0.164.0 with gpt-6.1-sol, low, one run, 2026-10-26 |
| Video effort (vendor) | Flash high for dense or fast video and videos over 60 minutes. Medium for general video Q&A. Low for transcript search. | Vertex AI guide for 3.8 Flash |
| Media through `agy` 1.4.3, what the model got | Read right: PNG, JPEG, WebP and GIF images; a PDF's text and a chart that exists only as pixels; video frames in MP4, WebM, MOV, MKV and AVI; MP3, WAV and OGG speech. The sound track of a video with sound: heard in 8 of 10 runs (B), then 14 of 16 without and 16 of 16 with the plugin's media sentence (F). No sound was invented for 8 silent-video runs. The model said it got about 1 frame per second: it misread 14-pixel text in a 720p video, and end times were off by up to 1 s. A YouTube link was not watched: the model searched the web. For AAC and FLAC, see the gemini plugin README, "Media". The rest was not rerun on 1.4.5. Formats, the size limit and conversions are transport facts: see the gemini plugin README, "Media". | Live tests on gemini-3.8-flash-low, mostly one run each, 2026-10-20 (r2 B-tests.md, F-build.md). AAC and FLAC rechecked on agy 1.4.5, 2026-10-23 |
| Vision Arena (chat about images) | Opus high 1295.2 [1285.3, 1305.0], Flash high 1293.1, 6.1 Sol max 1292.2, Fable 5.1 max 1289.3, 5.6 Sol 1288.0, Astra max 1283.9 (all tie), Sonnet xhigh 1262.9. Fable 5.2, Terra, Argon and Haiku not listed. | HF dataset, published 2026-11-08, read 2026-11-10 |
| Roboflow Vision Evals (secondary) | Overall at low effort (mean of 5 tasks; no ± shown): Argon 87.5, Terra 85.8, Astra 83.4, Opus 82.0, 6.1 Sol 81.7, Flash 79.8, Sonnet 77.6, Fable 5.1 74.7, 5.6 Sol 72.4, Haiku 69.6. Detection at high: Argon 85.1 (84.3–85.5) ties Terra 84.7 (84.2–84.9). Detection at low: Terra 84.7 is clear of Argon 82.5. Counting at high: Argon 90.5 is clear. Reasoning at high: Argon 91.4 ties Astra 91.2 and 6.1 Sol 88.7. 3 runs per tier, ± = half the range. OCR is one run. Gemini 3.5 Flash judges counting, identification and reasoning. Fable 5.2 not listed. | playground.roboflow.com/evals, evaluated 2026-10-26, read 2026-11-10 |

## Codex CLI and plugin

| Fact | Numbers | Source |
|---|---|---|
| `codex exec` 0.163.0 output | `-o <file>` holds only the final answer. `--output-schema` gave valid JSON with every required key. The first `--json` line holds the `thread_id`. The `--json` stream left out 4 of 7 commands in one run. Codex does not guarantee the schema: OpenAI says to validate the output yourself. | Live tests with gpt-6-luna, low, 2026-10-20 (r2 C-codex.md); OpenAI docs on structured output |
| `codex exec` 0.164.0 | The `--json` stream names no model. Its events are thread.started, turn.started, item.completed and turn.completed (with token usage). So `out.jsonl` cannot show which model served a job. `codex exec resume --help` lists no `-C`, `-s` or `--add-dir`, but `exec` takes them before `resume` (next row). | Two local runs with gpt-6-luna and gpt-6.1-sol, 2026-10-25; `codex exec --help` and `codex exec resume --help` |
| `codex exec resume <thread_id>` access | 2026-10-26, 0.164.0: turn 1 ran `codex exec -C <A> -s workspace-write --add-dir <t> ...`. Turn 2 ran from `/` as `codex exec -C <A> -s workspace-write --add-dir <t> resume <thread_id> ...`. In turn 2, `pwd` printed `<A>`, and Codex wrote a file in `<A>` and a file in `<t>`. The profile and the network flag were not tested in that place. 2026-10-20, flags after `resume`: with `-c sandbox_mode=workspace-write`, write access kept. With the same permission-profile flags as turn 1: the profile kept. With no access flag: read-only, though turn 1 was workspace-write. So "resume restores a thread's permissions" (Codex changelog, 2026-10-15) did not hold for `exec resume`. | Live test with gpt-6-luna, low, 2026-10-26; live tests with gpt-6-luna, low, one run each, 2026-10-20 (r2 F-build.md) |
| Sandbox reads | Every `-s` mode can read the whole disk, including `~`. A permission profile with `":minimal"="read"` blocked `~`, `$TMPDIR` and `/opt/homebrew`. With `"/opt/homebrew"="read"` added, Python ran. Sibling folders under `/private/tmp` stayed readable and writable in both profile tests. I have not checked why. The docs name the values `read`, `write` and `deny`. On 0.164.0, `"<temp>"="none"` and `"<temp>"="deny"` each blocked a read and a write. | Live tests with gpt-6-luna, low, 2026-10-20 (r2 C-codex.md, F-build.md); `codex sandbox` on 0.164.0, 2026-10-26; learn.chatgpt.com/docs/permissions, read 2026-10-26 |
| Config precedence | OpenAI docs say that a `sandbox_mode` in any loaded config file wins over `default_permissions`. Live test on 0.164.0, with `codex sandbox` (no model): the profile blocked a read under `<temp>`. The profile plus `-c sandbox_mode=read-only` still blocked it. `-c sandbox_mode=read-only` alone read it. A `sandbox_mode` line in a config file was not tested. | learn.chatgpt.com/docs/permissions, read 2026-10-26; live test, 2026-10-26 |
| Input inside a denied `<temp>` | 2026-11-10, Codex 0.167.0: a reader job ran with the profile `"<temp>"="deny"` and `"<temp>/data"="read"`. It reported that the policy denied the data folder, and read the web instead. `codex sandbox` with the same two entries, in either order, read a file in `<temp>/data`. The `--json` stream holds no record of the failed read, so the cause is not checked. | Reader job and live test, 2026-11-10 |
| Codex plugin 1.0.6 (`codex:codex-rescue`, `/codex:*`) | Effort up to xhigh only: max and ultra fail. Sandbox only read-only or `--write`. No network, web search, images or output schema. Resumes only the newest task of the session. The agent may rewrite the prompt. | Plugin source read, 2026-10-20 (r2 C-codex.md) |

## Models not in the table

| Model | Facts | Source |
|---|---|---|
| Claude Fable 5.1 | Replaced by Fable 5.2 in the table. The `fable` alias now runs Fable 5.2, and the Agent tool takes only the alias. Its numbers stay above for comparison. | code.claude.com/docs/en/model-config, read 2026-11-10 |
| Gemini 4 Carbon | Google. #1 on Arena Text overall, Coding and Hard Prompts and on Agent Arena steerability, and #1 on Vals Tax (51.79) and Legal Research (55.77). Not in `agy models` on 2026-11-10 (agy 1.5.3), so it cannot be called here. | HF dataset 2026-11-08; vals.ai, 2026-11-09; local `agy models` |
| gpt-5.6-terra | Middle tier of GPT-5.6. API price $2 / $12 per MTok. Snorkel tasteful 27.4 (high). Agent Arena overall 0.22±1.32. | docs.aws.amazon.com (Bedrock model card, vendor), 2026-10-20; Snorkel and Arena, 2026-10-25 |
| gpt-reserve | OpenAI calls "Luna Reserve" extra GPT-5.6 Luna usage for some Plus and Pro accounts after regular usage runs out: "fallback mode, not a separate model". Codex uses it only when the model id is `gpt-reserve`. When the allowance runs out, requests for other models fail with "You've hit your usage limit". Codex does not switch to Luna by itself. `-m gpt-reserve` worked for some users and failed for others (both issues open). In models_cache.json it has visibility "hide" and efforts up to max. | help.openai.com article 20001499 (search snippet only: the page returns 403); github.com/openai/codex/issues/41520 and #40939; local models_cache.json and binary, 2026-10-25; router-for-me/CLIProxyAPI#5568 (third party) |
| codex-auto-review | The reviewer behind Codex's Auto-review. It approves or denies requests that would otherwise wait for a person. It is set with `approvals_reviewer = "auto_review"`. Not a task model. Not tested. | learn.chatgpt.com/docs/sandboxing/auto-review, read 2026-10-20; Codex changelog |

## Plans, quotas and prices

Only "Low-cost mode" in SKILL.md uses these facts.

| Fact | Numbers | Source |
|---|---|---|
| Codex credits per 1M tokens (input / cached input / output) | Astra 250 / 25 / 1,250. 6.1 Sol 50 / 2.5 / 250. 6.1 Terra 25 / 1.25 / 125. GPT-6 Luna 2.5 / 0.25 / 12.5. Astra uses 5 times the credits of 6.1 Sol for input and output, and 10 times for cached input. Terra uses half the credits of 6.1 Sol. | learn.chatgpt.com/docs/pricing, read 2026-11-10 |
| Antigravity quota | Argon has its own weekly quota, separate from the 3.8 Flash quota. Google publishes no message count. One `/gemini:review` of three claims used about 1.4% of the weekly Argon quota. | Google Antigravity post; gemini plugin README |
| API prices per MTok (input / output) | Fable 5.2 $8 / $40 (Fable 5.1 was $10 / $50). Opus 5.5 $4 / $20. Sonnet 5.5 $2 / $10. Astra $10 / $50 ($1 cached input). 6.1 Sol $2 / $10 ($0.10 cached input). Argon $2 / $10 through 2026-11-30, then $4 / $20 from 2026-12-01. Argon is not on the free tier. | platform.claude.com pricing; learn.chatgpt.com/docs/pricing; ai.google.dev pricing; read 2026-10-25 |
| Why the low-cost steps | One effort step lower: on Bug Hunt, Opus at max cost 1.7 times its xhigh cost ($58.53 vs $34.98), and Sonnet 3.6 times ($154.03 vs $42.86). The scores drop at each step (see "Effort"). Astra to 6.1 Sol: one fifth of the credits per token. On Bug Hunt at max they tie (45.0 vs 44.3) at $33.03 vs $5.88. Argon high to medium: Bug Hunt 40.7 to 39.3 (3 runs each), and Google recommends medium for most work. Terra stays at max: on Bug Hunt it falls from 40.7 at max to 11.3 at xhigh, and Terra max already costs less ($3.88) than 6.1 Sol max ($5.88). The quota saving is not measured. How the Claude and Gemini plans count usage against a limit: not checked. | Rows above; "Effort" |

## Speed and bulk work

| Fact | Numbers | Source |
|---|---|---|
| AA speed (first-party API, Performance v3 headline, 5-day average) | Output tokens per second, then time to first token, by effort. Haiku: low 221.9 / 6.7 s, medium 221.2 / 9.6 s, high 226.8 / 18.3 s, max 254.3 / 180.4 s. Sonnet: low 134.2 / 2.8 s, medium 138.3 / 4.5 s, high 135.4 / 9.0 s, xhigh 135.1 / 26.0 s, max 152.4 / 262.5 s. Opus: low 105.9 / 5.0 s, medium 102.0 / 13.3 s, high 104.9 / 25.6 s, xhigh 105.4 / 76.2 s, max 114.6 / 371.3 s. Fable 5.2: low 91.4 / 6.5 s, medium 86.3 / 12.4 s, high 92.4 / 31.8 s, xhigh 102.8 / 75.9 s, max 98.3 / 215.9 s (released 2026-11-09, so its 5-day window may hold about one day; not checked). Fable 5.1: low 84.0 / 5.2 s, high 82.8 / 13.4 s. gpt-5.6-sol: low 95.0 / 2.9 s. Terra: low 68.2 / 2.3 s, medium 70.2 / 3.5 s, high 69.8 / 9.1 s, xhigh 72.7 / 24.6 s, max 73.7 / 138.4 s. 6.1 Sol: low 57.4 / 2.4 s, high 59.4 / 27.6 s, max 58.1 / 135.7 s. Astra: low 40.6 / 3.3 s, high 39.1 / 59.5 s. Argon high 66.3 / 36.6 s. Flash: low 100.9 / 3.8 s, high 111.6 / 16.7 s. No intervals. Time to a 500-token answer at low (first token + 500 / speed, conductor's computation): Sonnet 6.5 s, 5.6 Sol 8.2 s, Flash 8.8 s, Haiku 9.0 s, Terra 9.6 s, Opus 9.7 s, 6.1 Sol 11.1 s, Fable 5.2 12.0 s, Astra 15.6 s. | artificialanalysis.ai/models, read 2026-11-10 |
| Weak spots | Haiku: Agent Arena overall 0.43, Bug Hunt xhigh 18.3. Flash: Agent Arena overall 2.38, Bug Hunt high 18.0, MathArena 32.2. | Rows above |

## Effort

| Model | Effort facts | Other facts |
|---|---|---|
| Opus 5.5 | Bug Hunt, 3 runs each: low 22.3, medium 30.3, high 31.7, xhigh 36.0 ($34.98), max 41.7 ($58.53). Snorkel: high 39.3, max 36.9, xhigh 34.1 (no intervals). AA first token: low 5.0 s, high 25.6 s, xhigh 76.2 s, max 371.3 s. | Claude Code docs: max "is prone to overthinking". |
| All Claude | — | Claude Code defaults: Fable 5.2, Opus, Sonnet and Haiku 5.5 medium (code.claude.com/docs/en/model-config, read 2026-11-10). Anthropic: xhigh is for "long-running agentic and coding tasks (over 30 minutes)" (platform.claude.com/docs/en/build-with-claude/effort). |
| Sonnet 5.5 | Bug Hunt, 3 runs each: low 19.0, medium 23.3, high 34.3, xhigh 36.0 ($42.86), max 51.3 ($154.03). AA first token: low 2.8 s, high 9.0 s, max 262.5 s. | Anthropic, for agentic coding: "start with medium for well-specified tasks and move to high for harder or longer ones". |
| Fable 5.2 | ARC-AGI-2: low 86.7, medium 89.6, high 90.4, xhigh 93.75, max 92.5. ARC-AGI-3 standard harness: high 79.3, xhigh 81.2, max 65.7 (max hit the 12-hour limit in 28 of 55 games). No intervals. AA first token: high 31.8 s, xhigh 75.9 s, max 215.9 s. | Anthropic: "The API default is `high`." "Start with `high`. Most of the gain in capability is already present at `high`." "Step up to `xhigh` for your hardest long-running coding and agentic work." At `max` it "runs slower and costs more than at `xhigh`, often for only a small gain" (platform.claude.com/docs/en/build-with-claude/effort, read 2026-11-10). |
| Fable 5.1 | MathArena: low 62.5±4.7, high 73.2±5.0, max 71.8±4.4. Snorkel: medium 34.7, high 32.6. | — |
| gpt-6.1-terra | Bug Hunt, 3 runs each: low 6.0, medium 7.3, high 9.7, xhigh 11.3 ($0.75), max 40.7 ($3.88). The board gives its run spreads as "2, 2, 3, 5 and 12 going up". Codex default: low (models_cache.json). | — |
| 6.1 Sol | Bug Hunt: xhigh 42.7, max 44.3 (3 runs each, tie). AA first token: low 2.4 s, high 27.6 s, max 135.7 s. | — |
| Astra | Bug Hunt: max 45.0 (3 runs). Other efforts have one run. MathArena: low 72.9±4.1, max 77.8±4.4 (tie). Snorkel: high 36.8, xhigh 35.8. | — |
| Argon | Bug Hunt, 3 runs each: low 35.3, medium 39.3, high 40.7. Roboflow reasoning: low 89.4, high 91.4. | Google recommends medium for most work and high for hard math, science and agent tasks (vendor). The Gemini app defaults to medium; public boards test high (press). Through `agy` 1.5.0, Argon has no effort above high, though `agy --help` now lists xhigh and max (rechecked 2026-11-04). `--model=gemini-4-argon --effort=max` fails with "gemini-4-argon has no "max" effort (available: low, medium, high)", and `--effort=xhigh` also fails. `--model=gemini-4-argon-high --effort=max` fails with "conflicts with --effort=max". `--model=gemini-4-argon --effort=high` works. So the `-<effort>` model IDs already reach the highest level (live test, 2026-10-26). |
| Codex ultra | No benchmark for GPT-6 | OpenAI: ultra splits work across parallel subagents. "Most tasks do not need Max or Ultra." In models_cache.json, gpt-6.1-sol, gpt-6-astra and gpt-6-sol take low to ultra ("Maximum reasoning with automatic task delegation"). gpt-6-luna and gpt-reserve stop at max (local, 2026-10-25). |

## Known gaps

Each company counts once here (SKILL.md, "Refresh the evidence", step 5).

- Fable 5.2 was released on 2026-11-09. It is on no primary source and not on arena.ai. It decides no row's first choice yet. Refresh again when MathArena, Bug Hunt Bench or arena.ai list it.
- Primary sources cover only math and debugging. Every other row rests on secondary sources or on none.
- Code review, long context, video, audio and bulk simple work: no source passed the tests.
- Shell and infra: one board (Agent Arena bash reliability).
- Science: one board (Vals MysteryMechanism), with a 7-way tie.
- Debugging: one source with 2 TypeScript repos. Sonnet's three runs span 43 to 57.
- Hard coding: no primary source decides it (see SWE-rebench in "Sources used").
- Agent Arena Code was not re-read on 2026-10-26 or 2026-11-10 (see arena.ai in "Sources used").
- Fable 5.2, Fable 5.1 and gpt-5.6-sol have no Bug Hunt row with 3 or more runs. Fable 5.2, Terra, Sonnet and Haiku are not on MathArena.
- Roboflow: whether its test set is private is not stated. OCR is not used. One checker quoted a sentence that says so, but the conductor did not find it on the page. On 2026-11-10 one reader read it through WebFetch only.
- AA's new method makes its speed numbers before and after 2026-11-10 not comparable.
- Tool versions: this machine runs `agy` 1.5.3 and Codex 0.167.0. They were not tested beyond the jobs of 2026-11-10. The `agy` compaction and media tests ran on 1.4.3 and 1.4.5. On 1.5.0, only the gemini smoke test, the time limit and the effort levels were checked. Most `codex exec` tests ran on 0.163.0. On 0.164.0 only the `--json` stream, the flags, `exec resume` access and the profile values were checked.

## Full research

The full findings are not kept. To refresh this file, follow "Refresh the evidence" in SKILL.md.
