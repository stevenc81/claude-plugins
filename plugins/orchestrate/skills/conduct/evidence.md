# Evidence for the routing table

This file holds the numbers and sources behind the "Pick the model" table in SKILL.md. SKILL.md holds the rules. This file holds the facts. Do not copy numbers into SKILL.md beyond the short "Why" column.

Checked on 2026-10-20 by three research agents, one per vendor. Arena = arena.ai/leaderboard (Elo ± interval). AA = Artificial Analysis. TB4 = Terminal-Bench 4.0. "Vendor" = the model maker's own number. "Tie" = the intervals overlap. "One source" = no second independent source was found. Scores are at max effort for Claude and GPT and at high for Gemini, unless the row says otherwise.

Arena caveats:
- Arena ranks GPT-6 only at max, Gemini only at high, Opus 5.5 at high on text boards and at max on WebDev and Agent Arena.
- Argon's Arena scores are preliminary and rest on 273 to 4,904 votes. No votes were added between 2026-10-15 and 2026-10-20, so its text scores did not move.

## Coding and agentic work

| Fact | Numbers | Source |
|---|---|---|
| TB4, tbench.ai | Opus 5.5 64.8±3.1, Sonnet 5.5 61.8±2.9, Astra 58.2±2.8, 6.1 Sol 58.2±3.1, Fable 5.1 57.9±3.8, GPT-6 Sol 49.4±3.2, 3.8 Flash 19.1±3.4, Luna 16.4±2.7. Argon and Haiku 5.5 not listed. | tbench.ai/leaderboard, read 2026-10-20 |
| TB4, Vals (Mini-SWE-agent harness) | Opus 65.15, Sonnet 64.14, Astra 59.60, Fable 58.08, Argon 57.58, 6.1 Sol 55.05, Haiku 36.36, Flash 19.70±2.31 | vals.ai/benchmarks/terminal-bench-4, 2026-10-19 |
| TB4, AA's own run | Sonnet 63.6, Astra 60, Opus 59.6, Argon 57. The order differs from tbench.ai and Vals. | artificialanalysis.ai/evaluations/terminalbench-4-0, read 2026-10-20 |
| LiveBench 2.0, Agentic | Opus 85.0, Astra 82.4, Fable 80.8, Sonnet 78.8, 6.1 Sol 73.0, Argon 69.9, Haiku 57.6, Flash 30.1 (no intervals) | livebench.ai, 2026-10-18 |
| Epoch ECI (composite) | Opus 166.8, Astra 166.4, 6.1 Sol 166.3, Fable 164.7, Argon 164.6, Sonnet 164.5 (the top six overlap) | epoch.ai/data/eci_scores.csv, read 2026-10-20 |
| Senior SWE-bench (Snorkel, "tasteful" pass@1, Mini-SWE-agent) | Opus 5.5 high 39.3 (#1), Astra high 36.8, Fable 5.1 medium 34.7. Sonnet 5.5, Haiku 5.5, 6.1 Sol and Argon not listed. | senior-swe-bench.snorkel.ai, read 2026-10-20 |
| Agent Arena, Code (net improvement) | Opus 22.79±3.67, Astra 16.51±3.44, Sonnet 15.50±4.18, 6.1 Sol 14.89±2.55, Fable 14.86±2.92, Argon 10.49±1.57, Haiku 4.28±1.32, Flash 1.23±1.59. Opus and Astra intervals touch. The 2026-10-14 row in this file may have read the "Confirmed Success" column. I have not checked this. | arena.ai/leaderboard/agent/code, 2026-10-19 |
| Agent Arena, overall (net improvement) | Opus 20.35±2.56, Astra 15.15±2.24, Fable 14.33, 6.1 Sol 13.72±1.77, Sonnet 12.75, Argon 12.12±1.12, GPT-6 Sol 9.33, Flash 3.69±1.11, Luna 2.86, Haiku 1.49±1.00, gpt-5.6-terra 0.28±1.29. Ranks 2 to 4 overlap. | arena.ai/leaderboard/agent, 2026-10-19 |
| Agent Arena, bash reliability (first-try shell success; replaced "Bash Recovery" about 2026-10-13) | Opus 15.62±0.51, Sonnet 13.22, Flash 10.91, Fable 10.59, Astra 9.31±1.42, Haiku 7.36, 6.1 Sol 3.22±1.25, Argon 3.39±1.27 (one reader saw −3.39). Cause of the low 6.1 Sol and Argon scores not checked. One source. | arena.ai/leaderboard/agent, 2026-10-19 |
| Vals SRE Bench | Astra 56.87 (#1 of 35), 6.1 Sol 50.76 (#2). Claude and Gemini rows not read. | vals.ai model pages, 2026-10-20 |
| Vals ProgramBench | Opus 18.5, Fable 7.0, Sonnet 6.5, Astra 5.5, 6.1 Sol 3.0, Argon 2.5, Haiku 2.5 | vals.ai, 2026-10-12 |
| Vals Time Horizon (a 120-hour Kerbal Space Program campaign) | Opus 91.33, Astra 90.50, Fable 63.33, Argon 52.50±8.86, Flash 18.83. 6.1 Sol, Sonnet and Haiku not tested. | vals.ai, 2026-10-07 |
| Vals Code Migration v1.1 (new tests, not comparable with v1) | Sonnet 86.88, Opus 81.01±3.21, Astra 80.58±2.34, 6.1 Sol 77.32, Argon 70.80±3.72, Haiku 52.36, Flash 38.65 | vals.ai/benchmarks/code-migration-v1-1, 2026-10-19 |
| Text Arena, Coding (human preference) | Argon 1559±17 (1,231 votes), Opus 1548±14, Astra 1543±12, 6.1 Sol 1540±17, Fable 1537±11, Sonnet xhigh 1530±15 (tie) | arena.ai, 2026-10-15 |
| LiveBench 2.0, Coding (graded) | Fable 97.7, Opus 96.3, 6.1 Sol 96.0, Sonnet 94.7, Astra 93.7, Haiku 91.4, Argon 89.7, Flash 82.2. Disagrees with Text Arena on Argon. Likely reason: Arena votes are few and preliminary; LiveBench grades correctness. | livebench.ai, 2026-10-18 |
| Code review (ReviewBench, grounded F1) | Sources disagree. The research (read through the benchlm.ai mirror) found Laude RevEngine Prime on Opus 5.5 59.6% (#1), Klaussy on Sonnet 5.5 44.1%, Codex Max on gpt-5.6-sol 30.4%. A fact check (Flash, 2026-10-20) found Klaussy at 35.9%, as on 2026-10-16, and no Opus 5.5 entry at 59.6%. I have not checked which is current. These are review products, not bare models. No GPT-6 or Gemini 4 entry. One source. | review-bench.ai (via benchlm.ai mirror), runs to 2026-10-14, read 2026-10-19 |
| Debugging (Bug Hunt Bench, bugs fixed of 105) | Sonnet 5.5 51.3, Astra 45.0, 6.1 Sol 44.3, gpt-5.6-sol 43.5, Fable 43 (1 run), Opus 41.7. Means of 3 runs unless marked. Each model in its own CLI, two TypeScript repos. The author calls the results noisy. No Gemini 4 score. The only test with Sonnet 5.5 and Opus 5.5 side by side. | bughunt.productcompass.pm/data/benchmark.json, 2026-10-19 |
| Debugging, Snorkel root-cause study (24 terminal tasks, 200 runs) | Pass rate: Opus 5.5 68%, Opus 5 61%, Fable 5.1 49%. Sonnet 5.5 not tested. Disagrees with Bug Hunt on Opus vs Fable. Likely reason: both tests are small. | snorkel.ai/?p=19924, read 2026-10-20 |
| Debugging, anecdotal | Sonnet 5.5 beat Opus 5.5 on 2 of 3 debugging tasks. The article body was not read. | thenewstack.io/?p=22839670, 2026-10-08 |
| Debugging, vendor | OpenAI's internal "research debugging" rubric: Astra 78.05, 6.1 Sol 75.52, GPT-6 Sol 64.20. No Claude or Gemini number. | deploymentsafety.openai.com/gpt-6-1-sol, 2026-09-29 |
| Kubernetes test, anecdotal | Argon 0 of 3 working manifests. Opus 5.5 and 6.1 Sol 3 of 3. Not re-checked. | computingforgeeks.com, 2026-10-13 |

## Front-end and web UI

| Fact | Numbers | Source |
|---|---|---|
| WebDev Arena | Opus 1807±14 (rank 1–1), Astra 1774±10, Sonnet xhigh 1768±13, 6.1 Sol 1753±13, Fable 1743±9, Sonnet high 1710±10, Argon 1678±16, Haiku high 1586±11, Flash 1585±7 | arena.ai/leaderboard/code/webdev, 2026-10-19 |
| Image-to-WebDev | Opus 1753±24, Sonnet xhigh 1737±17, Astra 1726±12, Fable 1722±13, 6.1 Sol 1702±15, Flash 1593±13 (tie at the top) | arena.ai/leaderboard/code/image-to-webdev, 2026-10-19 |
| LiveBench 2.0, Design | Opus 86.9, Sonnet 85.0, Fable 83.4, Haiku 83.1, 6.1 Sol 82.1, Astra 82.0, Argon 73.7, Flash 72.7 | livebench.ai, 2026-10-18 |
| Vals SWE-bench Multimodal | Opus 70.21, Fable 61.25, Sonnet 58.33, Argon 56.04, Haiku 43.96, 6.1 Sol 43.54, Astra 43.33, Flash 40.83 | vals.ai, 2026-10-16 |
| Vals Vibe Code Bench v1.1 (working web apps from a spec) | Sonnet 92.39, Argon 91.91±1.90, Haiku 90.44, Opus 90.29, Fable 90.26, Astra 89.59, 6.1 Sol 88.93 (all within 4 points). Disagrees with WebDev Arena on Argon. Likely reason: it grades whether the app works, not how people rate the page. | benchlm.ai mirror of vals.ai, 2026-10-18 |

## Math and science

| Fact | Numbers | Source |
|---|---|---|
| MathArena | 6.1 Sol max 84.0±2.3, Astra max 81.9±3.6, GPT-6 Sol max 80.1±2.8, Opus high 79.0±2.3, Fable high 78.1±4.6, Argon 69.3±5.0 (#9), Flash 34.0±3.1. 6.1 Sol and Opus intervals miss by 0.4 points. On 2026-10-16 the board added the 09/2026 contests (ArXivMath, BrokenArXiv, ArXivLean), which and every headline score fell. A fact check (Flash, 2026-10-20) confirmed the new contests but not that they caused the drop. | matharena.ai/models, read 2026-10-20 |
| Epoch FrontierMath, Tiers 1–3 | 6.1 Sol 93.7±1.4, Astra 93.7±1.4, Opus 91.2±1.7, Fable 90.2±1.8, Sonnet 88.8, Argon 86.0±2.1 (6.1 Sol, Astra and Opus tie). Tier 4: 6.1 Sol 100, Astra 97.6±2.4, Opus 95.0±4.1, Argon 78.0±6.5. OpenAI funds FrontierMath; Epoch runs the tests. | epoch.ai/data/benchmarks.csv, runs 2026-08-30 to 2026-10-13 |
| Arena Math | Argon 1529±34 (273 votes), Fable 1525±22, Flash 1522±14, Opus 1502±28, Sonnet xhigh 1502±31, 6.1 Sol 1494±31, Astra 1486±23 (tie) | arena.ai, 2026-10-15 |
| Proofs (Vals ProofBench v1.1) | Sonnet, Opus and Fable 100; 6.1 Sol, Astra and Argon 99; Haiku 89; Flash 48 (saturated at the top) | vals.ai, 2026-10-12 |
| Vals Terminal-Bench Science v0.1.0, Mini-SWE-agent harness | Astra 62.86, 6.1 Sol 52.86, Opus 47.14, Sonnet 47.14, Argon 44.29, Fable 40.00, Haiku 10.00, Flash 8.57. One run per model, no interval. Vendor numbers are higher: Astra 68.1 (OpenAI), Argon 57.6 (Google). | vals.ai/benchmarks/terminal-bench-science, 2026-10-14 |
| Scale HLE Diamond | Astra 60.6±3.0, Opus 55.0±3.1, Argon 53.2±3.1, Fable 51.3, Sonnet 37.5. 6.1 Sol not listed. | labs.scale.com/leaderboard, read 2026-10-20 |
| Scale DrugDiscoveryBench (82 agentic science tasks) | Astra (Mini-SWE-agent) 68.7±2.5 (#1), Astra (Codex) 65.4±1.9, gpt-5.6-sol 56.5, Opus 5 (Claude Code) 53.7±2.4. No Claude 5.5 or Fable 5.1 row. | labs.scale.com/leaderboard, read 2026-10-20 |
| Vals Science Index | Astra 65.09 (#1 of 21), 6.1 Sol 59.63 (#2) | vals.ai model pages, 2026-10-20 |

## Knowledge work, writing and judgment

| Fact | Numbers | Source |
|---|---|---|
| AA GDPval-AA v2.1 | Opus 1866, Sonnet 1838, Fable 1754, Argon 1623, Haiku 1618, gpt-5.6-sol 1609, 6.1 Sol 1594, Astra 1573 (1556 on AA's Argon-vs-Astra page). Vendor: Opus 1846, Sonnet 1844. | artificialanalysis.ai/evaluations/gdpval-aa, read 2026-10-20 |
| Vals Index v2.2 | Sonnet 70.85±0.93, Opus 70.18±1.00, Argon 69.24±1.09, Astra 65.02±1.10, 6.1 Sol 63.94, Haiku 58.71, Flash 55.95, Luna 52.32 (the top three tie). If tasks served by a fallback model after a refusal count as failures: Sonnet 69.03, Opus 64.16, and Argon is first. | vals.ai/benchmarks/vals_index, 2026-10-19 |
| LiveBench 2.0, overall | Fable 88.0, Opus 86.5, Astra 86.1, 6.1 Sol 85.4, Argon 84.1, Sonnet 82.5, Haiku 75.6, Luna 69.4, Flash 67.3. Data Analysis: Argon 85.2 (#1), Astra 83.0, 6.1 Sol 82.7, Opus 80.3, Fable 80.3, Sonnet 59.5, Haiku 53.1. No intervals. | livebench.ai, 2026-10-18 |
| Scale Remote Labor Index (paid freelance tasks, pass/fail) | Opus 21.25, Astra 20.83, Fable 17.92. Disagrees with GDPval-AA on Astra. Likely reason: GDPval-AA compares deliverables in pairs; RLI scores pass/fail with a low ceiling. | labs.scale.com/leaderboard, read 2026-10-20 |
| Arena Text, overall | Argon 1524±9, Opus high 1508±7, Fable 1502±6, Flash 1496±5, 6.1 Sol 1484±8, Astra 1477±6, Sonnet xhigh 1475±8 | arena.ai/leaderboard/chat/text, 2026-10-15 |
| Arena Hard Prompts | Argon 1549±11, Opus 1533±9, Fable 1521±7, Flash 1518±6, 6.1 Sol 1506±10, Sonnet xhigh 1504±10 | arena.ai, 2026-10-15 |
| Arena Multi-Turn | Argon 1552±23 (680 votes), Flash 1503±9, Opus 1501±18, Fable 1487±14, Sonnet 1472±19 | arena.ai, 2026-10-15 |
| Arena Instruction Following | Argon 1527±15, Opus 1518±12, Fable 1499±10, Flash 1490±7, 6.1 Sol 1487±14 | arena.ai, 2026-10-15 |
| Arena Creative Writing | Opus 1519±15, Argon 1516±19 (tie), Flash 1487±8, Fable 1485±11, Sonnet 1465±16 | arena.ai, 2026-10-15 |
| Agent Arena, steerability | Opus 17.30, Astra 15.51, Argon 14.84, Fable 14.76 | arena.ai/leaderboard/agent, 2026-10-20 |

## Facts and hallucination

The sources measure two different things. Closed-book tests ask the model to answer from memory. Grounded tests give the facts in the prompt. No test measures a fact check with live search.

| Fact | Numbers | Source |
|---|---|---|
| AA-Omniscience hallucination rate (closed-book, lower is better) | Argon 15%, Haiku 40%, Astra high 45% / max 51%, Sonnet 47%, 6.1 Sol 54%, Opus 59% (xhigh 66%), Fable 73% (xhigh 71%). Argon's 15% comes from secondary reports: AA's pages today show no Argon rate. The Claude rates were read from chart order; BenchLM's mirror gives the same. One source for the Claude 5.5 and Fable 5.1 rates. The rate counts wrong answers among the answers that are not right: Fable answers more often (accuracy 67%), so it is wrong more often when it does not know. | artificialanalysis.ai/evaluations/omniscience and benchlm.ai, read 2026-10-20; The Batch, 2026-10-09 (Argon) |
| AA-Omniscience accuracy and index | Accuracy: Fable 67%, Opus 66%, Astra 63%, Sonnet 54%, Argon 50%, Haiku 36%. Index: Opus 46, Astra 43 to 44, Fable 43, Argon 42, 6.1 Sol 42, Sonnet 32, Haiku 11, Luna 1. Argon's low rate comes from declining to answer, not from knowing more. | artificialanalysis.ai, read 2026-10-20 |
| Epoch SimpleQA Verified (closed-book recall) | Argon 76.0±1.4, Astra 75.6, 6.1 Sol 73.9, Opus 72.2, Fable 70.8, Flash 69.7, Sonnet 46.5, Luna 41.4 | epoch.ai/data/benchmarks.csv, 2026-10-13 |
| Vectara HHEM (hallucination when summarizing a given text) | GPT-6 Sol 6.5%, Astra 8.7%, Argon 12.1%. 6.1 Sol, Opus 5.5 and Fable not listed. | github.com/vectara/hallucination-leaderboard, 2026-10-16 |
| Kaggle FACTS Grounding (Google-made) | Top 3: GPT-6 Sol 85%, 6.1 Sol 82%, Astra 81%. Argon is not in the top 3; its score was not read. | kaggle.com/benchmarks/google/facts, about 2026-10-13 |
| Agent Arena, tool hallucination | Argon 0.11%±0.37 (lowest), Flash 0.57, Opus 0.58, Astra 0.68, 6.1 Sol 0.72 | arena.ai/leaderboard/agent, 2026-10-20 |

## Web search and research

| Fact | Numbers | Source |
|---|---|---|
| Arena Search | gpt-5.6-sol xhigh 1261±6 (#1), Fable 5.1 high 1246±7 (#5), Astra 1234±8 (#7), 6.1 Sol 1233±9 (#8), Opus 5.5 medium 1213±7 (#14). Argon, Flash, Sonnet and Haiku not listed. | arena.ai/leaderboard/chat/search, 2026-10-13 |
| Parallel.ai Search Capability | Argon 72.2 (#5), Flash 65.1. No Claude or GPT rows on that page. Parallel sells a search API. | parallel.ai/leaderboard/gemini-4-argon.md, 2026-10-19 |
| LiveBench 2.0, Browser Use | Fable 100.0, Argon 92.0, 6.1 Sol 88.0, Astra 84.0, Sonnet 84.0, Opus 80.0. Agrees with Arena Search that Fable is the top Claude model on the web. Disagrees on the vendor order: Arena Search has gpt-5.6-sol first. | livebench.ai, 2026-10-18 |
| LiveBench 2.0, Research | Astra 85.2, Opus 85.0, Sonnet 83.6, 6.1 Sol 83.5, Argon 83.1, Fable 82.0, Flash 79.1 (near tie) | livebench.ai, 2026-10-18 |
| BrowseComp (vendor only) | Astra 91.5, gpt-5.6-sol 92.2. No Claude 5.5 or Fable 5.1 row. | leaderboard.steel.dev, 2026-09-14 |
| Codex web search | `codex --search exec ...` works with gpt-6.1-sol. | Tested locally, 2026-10-16 |

## Long context and media

| Fact | Numbers | Source |
|---|---|---|
| Context window | Claude 1M, 128k output. Argon and 3.8 Flash 1M. In Codex: 6.1 Sol 500k, Astra and Luna 272k (the API allows 1.05M). | Vendor docs, ~/.codex/models_cache.json, read 2026-10-20 |
| AA-LCR v1.1 (about 100k tokens) | Fable 85.3, Opus 84.7, Luna 83.3, 6.1 Sol 83.0, Sonnet 82.7, Haiku 82.7, Flash high 81.3, Astra 80.7, Argon 79.7 (no clear winner). Read from chart order. One independent source. | artificialanalysis.ai/evaluations/artificial-analysis-long-context-reasoning, read 2026-10-20 |
| GraphWalks 256k–1M (vendor) | Argon 84.2, Astra 71.8, Opus 66.8 | deepmind.google/models/gemini, 2026-10-20 |
| Context through `agy` 1.4.3 | `agy` cuts one message at 192,000 bytes. Sent in parts in one session, a document stays whole up to about 165k tokens. At about 169k (Argon) and 164k to 205k (Flash), `agy` compacts the conversation into a summary. This is what `agy` allows, not the API's 1M (row above). Users report compaction at 240k to 280k tokens on other setups (agy issue #1245). I have not checked why the numbers differ. | Live tests with gemini-4-argon-low and gemini-3.8-flash-low, 2026-10-20 |
| Arena Longer Query | Argon 1543±14, Opus 1523±11, Flash 1510±6, Fable 1509±9, Sonnet 1499±12 (tie at the top) | arena.ai, 2026-10-15 |
| Video (vendor only, LVBench) | Argon 91.7, Flash 87.8, Astra 87.5, Opus 83.7. No independent video test lists Argon or 3.8 Flash. | deepmind.google, 2026-10-20 |
| Media input in this setup | `codex exec` takes images only (`-i`). The Claude Code Read tool takes images and PDFs. Only Gemini takes audio and video. | `codex exec --help`, Read tool description, 2026-10-16 |
| Video effort (vendor) | Flash high for dense or fast video and videos over 60 minutes. Medium for general video Q&A. Low for transcript search. | Vertex AI guide for 3.8 Flash |
| Audio (Scale AudioMultiChallenge, text output) | Flash high 60.40±4.49 (#1), Argon high 58.41±4.53 (#3) (tie). One source. | labs.scale.com/leaderboard, read 2026-10-20 |
| Media through `agy` 1.4.3, what the model got | Read right: PNG, JPEG, WebP and GIF images; a PDF's text and a chart that exists only as pixels; video frames in MP4, WebM, MOV, MKV and AVI; MP3, WAV and OGG speech. The sound track of a video with sound: heard in 8 of 10 runs (B), then 14 of 16 without and 16 of 16 with the plugin's media sentence (F). No sound was invented for 8 silent-video runs. The model said it got about 1 frame per second: it misread 14-pixel text in a 720p video, and end times were off by up to 1 s. A YouTube link was not watched: the model searched the web. Formats, the size limit and conversions are transport facts: see the gemini plugin README, "Media". | Live tests on gemini-3.8-flash-low, mostly one run each, 2026-10-20 (r2 B-tests.md, F-build.md) |
| Vision Arena (chat preference) | 6.1 Sol 1294±13, Opus high 1293±12, Flash 1291±10, Fable 1288±9, Astra 1285±10, Sonnet 1265±13 (tie). Argon not listed. One source for Claude. | arena.ai/leaderboard/chat/vision, 2026-10-19 |
| Roboflow Vision Evals (detection, OCR, counting) | Overall at low effort: Argon 87.5 (#1 of 63), Flash 79.8 (#7). Argon low / high: detection 82.5 / 85.1, OCR 85.7 / 88.0, counting 86.0 / 90.5. Flash low / high: detection 68.1 / 74.8, OCR 72.8 / 78.7. One lab. Disagrees with Vision Arena, which tests chat about images. | playground.roboflow.com, 2026-10-13 |

## Codex CLI and plugin

| Fact | Numbers | Source |
|---|---|---|
| `codex exec` 0.163.0 output | `-o <file>` holds only the final answer. `--output-schema` gave valid JSON with every required key. The first `--json` line holds the `thread_id`. The `--json` stream left out 4 of 7 commands in one run. | Live tests with gpt-6-luna, low, 2026-10-20 (r2 C-codex.md) |
| `codex exec resume <thread_id>` access | With `-c sandbox_mode=workspace-write`: write access kept. With the same permission-profile flags as turn 1: the profile kept. With no access flag: read-only, though turn 1 was workspace-write. So "resume restores a thread's permissions" (Codex changelog, 2026-10-15) did not hold for `exec resume`. `resume` has no `-C`: it runs in the current folder. | Live tests with gpt-6-luna, low, one run each, 2026-10-20 (r2 F-build.md) |
| Sandbox reads | Every `-s` mode can read the whole disk, including `~`. A permission profile with `":minimal"="read"` blocked `~`, `$TMPDIR` and `/opt/homebrew`. With `"/opt/homebrew"="read"` added, Python ran. Sibling folders under `/private/tmp` stayed readable and writable in both profile tests. I have not checked why. | Live tests with gpt-6-luna, low, 2026-10-20 (r2 C-codex.md, F-build.md) |
| Codex plugin 1.0.6 (`codex:codex-rescue`, `/codex:*`) | Effort up to xhigh only: max and ultra fail. Sandbox only read-only or `--write`. No network, web search, images or output schema. Resumes only the newest task of the session. The agent may rewrite the prompt. | Plugin source read, 2026-10-20 (r2 C-codex.md) |

## Models not in the table

| Model | Facts | Source |
|---|---|---|
| gpt-5.6-terra | Middle tier of GPT-5.6. API price $2 / $12 per MTok; 6.1 Sol is $2 / $10. AA index max 42. TB4 21.5±3.3 (tbench.ai), 22.73 (Vals). Agent Arena overall 0.28±1.29. GDPval-AA 1452. | docs.aws.amazon.com (Bedrock model card, vendor), AA, Vals, Arena, tbench.ai, 2026-10-20 |
| gpt-reserve | OpenAI calls "Luna Reserve" extra GPT-5.6 Luna usage for some Plus and Pro accounts after regular usage runs out, "not a separate model". Hidden in models_cache.json. `-m gpt-reserve` worked for one user and gave usage-limit errors for another. | help.openai.com article 20001499 (read from a search snippet); github.com/openai/codex/issues/41520 (anecdotal) |
| codex-auto-review | The reviewer behind Codex's Auto-review. It approves or denies requests that would otherwise wait for a person. It is set with `approvals_reviewer = "auto_review"`. Not a task model. Not tested. | learn.chatgpt.com/docs/sandboxing/auto-review, read 2026-10-20 |

## Speed and bulk work

| Fact | Numbers | Source |
|---|---|---|
| Output speed, AA lab (tokens/s) | Haiku 5.5 171–234, Flash high 149, gpt-5.6-terra 122–140, Luna 117–127, Sonnet 106–136, Opus 80–95, Argon high 84, Astra max 66, Fable 56–69, 6.1 Sol max 55 | artificialanalysis.ai/leaderboards/models, read 2026-10-20 |
| Time to first token at low, AA lab | Sonnet 5.5 1.17 s, gpt-5.6-terra 1.51 s, Luna 1.78 s, Fable 2.10 s, Astra 2.31 s, 6.1 Sol 2.86 s, Opus 4.99 s, Haiku 8.39 s. At high: Flash 26.3 s, Argon 48.0 s. | artificialanalysis.ai, read 2026-10-20 |
| Gateway traffic (real requests, mixed effort) | Argon: Eden AI 38.9 tok/s, first token 5.26 s, p95 latency 65 s; Zenmux 44.9 tok/s, first token 10.2 s. 6.1 Sol: Eden AI 31–38 tok/s, first token 3.2–5.0 s. Claude on OpenRouter: Haiku 115–163 tok/s, Sonnet 66–109, Opus 54–83, Fable 42–65; latency Haiku 1.0–2.3 s, Sonnet 1.6–2.9 s, Opus 3.3–5.1 s, Fable 3.5–6.7 s. OpenRouter has Haiku first to answer, while AA at low has Sonnet first. Real traffic is slower than AA's lab numbers. Likely reason: AA uses one fixed prompt at one effort. Flash is faster than Argon in every source. | edenai.co, zenmux.ai, openrouter.ai model pages, 2026-10-20 |
| Flash latency, anecdotal (one run) | low 3.2 s, medium 5.1 s, high 8.4 s | computingforgeeks.com, 2026-09-07 |
| Weak spots | Luna: AA-Omniscience index 1, TB4 16.4%. Haiku: Agent Arena overall 1.49±1.00 (#26), TB4 Vals 36.4, TB Science 10.0, LiveBench Agentic 57.6. Flash: LiveBench Agentic 30.1; loses scope on long unattended runs (anecdotal). | AA, tbench.ai, arena.ai, vals.ai, livebench.ai |

## Effort

| Model | AA index by effort (low / medium / high / xhigh / max) | Other effort facts |
|---|---|---|
| Opus 5.5 | 42 / 51 / 54 / 56 / 58. First token 5.0 / 22.8 / 33.7 / 111 / 573 s. GDPval-AA 1235 / 1584 / 1704 / 1831 / 1866. | Vendor: SWE-bench Pro subset high 95.3, xhigh 96.7 (not re-checked). Claude Code docs: max "is prone to overthinking". |
| All Claude | — | Claude Code defaults: Opus, Sonnet and Haiku 5.5 medium, Fable 5.1 high (code.claude.com/docs/en/model-config). Anthropic: xhigh is for "long-running agentic and coding tasks (over 30 minutes)" (platform.claude.com/docs/en/build-with-claude/effort). |
| Sonnet 5.5 | 36 / 41 / 47 / 52 / 56. First token 1.2 / 1.8 / 11.0 / 31.6 / 395 s. GDPval-AA 1175 / 1323 / 1549 / 1728 / 1838. | Vendor: FrontierCode 1.1, max 46.2, xhigh 52.1. Anthropic, for agentic coding: "start with medium for well-specified tasks and move to high for harder or longer ones". |
| Fable 5.1 | 47 / 49 / 51 / 53 / 53. GDPval-AA 1469 / 1545 / 1635 / 1732 / 1754. | Flat on the AA index, not on other tests. MathArena low 64.8, high 78.1, max 77.4. |
| Haiku 5.5 | 29 / 34 / 38 / 41 / 43. GDPval-AA 1123 / 1275 / 1418 / 1513 / 1618. | Anthropic: at low, Haiku "is more likely to skip a search, stop early, or skip a check" in long agent prompts. |
| 6.1 Sol | 42 / 48 / 50 / 51 / 52. First token 2.9 / 4.9 / 49.8 / 163 / 244 s. GDPval-AA 1315 / 1450 / 1511 / 1538 / 1594. | Vendor DeepSWE v1.1: peaks at high (75.2), xhigh and max 71.9. AA Coding Agent Index: xhigh 3 points above max. |
| Astra | 46 / 50 / 51 / 52 / 53. First token 2.3 / 4.3 / 64 / 147 / 265 s. | Vendor DeepSWE: peaks at xhigh. MathArena: low 77.3 → max 81.9. |
| Luna | 22 / 30 / 33 / 35 / 38 | Gains at every step. |
| 3.8 Flash | 33 / 40 / 41 (low / medium / high). Only high re-checked on 2026-10-20. | Gain stops at medium. |
| Argon | AA index: high 53 only. ARC-AGI-1 low 76.5 / medium 98.5 / high 98.5. ARC-AGI-2 low 42.1 / medium 87.1 / high 91.3. Roboflow vision: low is 2 to 5 points below high. | arcprize.org/results/google-gemini-4-argon, 2026-10-13 (verified). Google recommends medium for most work and high for hard math, science and agent tasks (vendor). The Gemini app defaults to medium; public boards test high (press). |
| Codex ultra | No benchmark for GPT-6 | OpenAI: ultra splits work across parallel subagents. "Most tasks do not need Max or Ultra." |

## Known gaps

- Debugging: three small independent tests that disagree. Bug Hunt has Sonnet 5.5 first and Opus 5.5 last. Snorkel and Senior SWE-bench have Opus 5.5 first but do not test Sonnet 5.5. Code review: one source (ReviewBench), with product scores only, no GPT-6 or Gemini 4 entry, and an unconfirmed Opus 5.5 result.
- Long context: one independent source at about 100k tokens (AA-LCR). No independent test above that.
- Video: vendor tests only. Audio: one source (Scale AudioMultiChallenge).
- Live web search: two cross-vendor sources (Arena Search, LiveBench Browser Use) that disagree on the vendor order. No test measures a fact check with live search.
- Hallucination: closed-book and grounded tests disagree on Argon (see "Facts and hallucination").
- Argon at medium or low: ARC-AGI and Roboflow only. No coding or writing test at those levels.
- The readers disagree on two facts. Argon's Agent Arena bash reliability: 3.39 or −3.39. Epoch: one reader found Argon rows (FrontierMath, SimpleQA, ECI), the other found none. I have not checked either.

## Full research

The full findings are not kept. To refresh this file, run the research again with three agents, one per vendor, and replace each table.

- Use at least two independent sources per capability where they exist.
- Name single-source facts.
- When sources disagree, show both and the likely reason.
