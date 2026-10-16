# Evidence for the routing table

This file holds the numbers and sources behind the "Pick the model" table in SKILL.md. SKILL.md holds the rules. This file holds the facts. Do not copy numbers into SKILL.md.

Checked on 2026-10-16 by three research agents. Arena = arena.ai/leaderboard (Elo ± interval). AA = Artificial Analysis. TB4 = Terminal-Bench 4.0. "Vendor" = the model maker's own number. "Tie" = the intervals overlap.

Arena caveats:
- Arena ranks GPT-6 only at max, Gemini only at high, Opus 5.5 at high on text boards and at max on WebDev.
- Argon's Arena scores are preliminary and rest on 273 to 4,904 votes. Expect them to move.

## Coding and agentic work

| Fact | Numbers | Source |
|---|---|---|
| TB4, independent (all at max) | Opus 5.5 64.8±3.1, Sonnet 5.5 61.8±2.9, Astra 58.2±2.8, 6.1 Sol 58.2±3.1, Fable 5.1 57.9 | tbench.ai/leaderboard |
| TB4, Vals | Opus 65.15, Sonnet 64.14, Astra 59.60, Argon 57.58, 6.1 Sol 55.05 | vals.ai |
| TB4, 3.8 Flash | 19–20% | AA, deepmind.google/models/gemini |
| Agent Arena, Code (Claude and GPT-6 at max, Gemini at high) | Opus 18.38%±4.95, 6.1 Sol 16.13%±2.89, Sonnet 15.59%, Astra 13.66%, Argon 12.72%, Flash 1.47% (ties at the top) | arena.ai/leaderboard/agent/code, 2026-10-14 |
| Agent Arena, bash reliability | Opus 15.50%, Astra 10.71%, 6 Sol 11.05%, Fable 10.80%, 6.1 Sol 1.91%±2.28 (cause not checked) | arena.ai/leaderboard/agent |
| Vals ProgramBench | Opus 18.5, Sonnet 6.5, Astra 5.5, Argon 2.5 | vals.ai |
| Vals Time Horizon | Opus 91.33, Astra 90.50, Argon 52.50 | vals.ai |
| Vals Code Migration | Sonnet 69.83, Argon 68.17, Astra 67.74, Opus 66.65 (close, no interval published) | vals.ai |
| Text Arena, Coding | Argon 1559±17, Opus 1548±14, Astra 1543±12, 6.1 Sol 1540±17 (tie) | arena.ai, 2026-10-15 |
| Code review (ReviewBench F1) | A product on Sonnet 5.5 35.9%, Codex on gpt-5.6-sol 30.4%. No GPT-6, Opus 5.5 or Gemini 4 score exists. | review-bench.ai |
| Kubernetes test, anecdotal | Argon 0 of 3 working manifests. Opus 5.5 and 6.1 Sol 3 of 3. | computingforgeeks.com, 2026-10-13 |

## Front-end and web UI

| Fact | Numbers | Source |
|---|---|---|
| WebDev Arena | Opus 5.5 max 1811±15 (rank 1–1), Astra 1780±11, Sonnet 5.5 xhigh 1774±14, 6.1 Sol 1760±14, Fable 1743±9, Sonnet 5.5 high 1713, Argon 1678±15, Flash 1585 | arena.ai/leaderboard/code/webdev, 2026-10-13 |
| Image-to-WebDev | Opus 1749±30, Sonnet 1740±20, Astra 1731±13 (tie) | arena.ai, 2026-10-10 |
| Vals SWE-bench Multimodal | Opus 70.21, Sonnet 58.33, Argon 56.04, 6.1 Sol 43.54 | vals.ai |

## Math and science

| Fact | Numbers | Source |
|---|---|---|
| MathArena | 6.1 Sol max 90.1±2.3, Astra max 88.0±2.0, Opus 5.5 high 83.3±3.1, Fable 82.6. Argon not listed. | matharena.ai/models, 2026-10-15 |
| Arena Math | Argon 1529±34 (273 votes), Fable 1525±22, Flash 1522±14, Opus 1502±28 (tie) | arena.ai, 2026-10-15 |
| Proofs (Vals ProofBench) | Sonnet and Opus 100, 6.1 Sol and Astra 99 (saturated) | vals.ai |
| Vals Terminal-Bench Science v0.1.0, Mini-SWE-agent harness | Astra 62.86, 6.1 Sol 52.86, Opus 47.14, Argon 44.29 (no interval). Gemini reported higher numbers from OpenAI's own page. I have not checked them. | vals.ai/benchmarks/terminal-bench-science, 2026-10-14 |

## Knowledge work, writing and judgment

| Fact | Numbers | Source |
|---|---|---|
| AA GDPval-AA (max) | Opus 1866, Sonnet 1838, Fable 1754, 6.1 Sol 1594, Astra 1573 | artificialanalysis.ai |
| Vals Index | Argon 68.90±0.97, Opus 66.97, Astra 63.13 (close at the top, no interval for Opus) | vals.ai |
| Arena Hard Prompts | Argon 1549±11, Opus 1533±9, Fable 1521±7, 6.1 Sol 1506±10 | arena.ai, 2026-10-15 |
| Arena Multi-Turn | Argon 1552±23, Opus 1501±18 (Argon clear lead) | arena.ai |
| Arena Creative Writing, Writing/Literature | Opus #1, Argon #2 | arena.ai |
| Hallucination rate (AA-Omniscience) | Argon 15%, Astra 51%, 6.1 Sol 54%. No Claude rate found. | The Batch, 2026-10-09 |
| Arena Text, factuality scoring | Argon 1511±7, Opus 1509±6 (tie), Flash #26 | arena.ai, 2026-10-15 |

## Web search and research

| Fact | Numbers | Source |
|---|---|---|
| Arena Search | gpt-5.6-sol xhigh 1261±6 (#1), Fable 5.1 high 1246±7 (#5), Astra 1234±8 (#7), 6.1 Sol 1233±9 (#8), Opus 5.5 medium 1213±7 (#14). Argon and 3.8 Flash not listed. | arena.ai/leaderboard/chat/search, 2026-10-13 |
| Codex web search | `codex --search exec ...` works with gpt-6.1-sol. | Tested locally, 2026-10-16 |
| Search-grounded benchmarks for Gemini 4 (FACTS, BrowseComp, SimpleQA) | None found | — |

## Long context and media

| Fact | Numbers | Source |
|---|---|---|
| Context window | Claude 1M. Argon and 3.8 Flash 1M. In Codex: 6.1 Sol 500k, Astra and Luna 272k. | Vendor docs, ~/.codex/models_cache.json |
| AA-LCR (about 100k tokens) | Opus 85%, Fable 85%, Flash medium 84%, 6.1 Sol max 83%, Luna 83%, Argon 80% (no clear winner) | artificialanalysis.ai |
| GraphWalks 256k–1M (vendor) | Argon 84.2, Astra 71.8, Opus 66.8 | deepmind.google/models/gemini |
| Arena Longer Query | Argon 1543±14, Opus 1523±11 (tie) | arena.ai |
| Video (vendor, LVBench) | Argon 91.7, Flash 87.8, Astra 87.5, Opus 83.7 | deepmind.google |
| Media input in this setup | `codex exec` takes images only (`-i`). The Claude Code Read tool takes images and PDFs. Only Gemini takes audio and video. | `codex exec --help`, Read tool description, 2026-10-16 |
| Video effort (vendor) | Flash high for dense or fast video and videos over 60 minutes. Medium for general video Q&A. Low for transcript search. | Vertex AI guide for 3.8 Flash |
| Audio | Both Gemini models accept audio. No benchmark found. | ai.google.dev |
| Vision Arena | 6.1 Sol 1294±14, Opus 1293±13, Flash 1289±11, Astra 1286±11 (tie). Argon not listed. | arena.ai, 2026-10-09 |

## Speed and bulk work

| Fact | Numbers | Source |
|---|---|---|
| Output speed (tokens/s) | Haiku 5.5 173–240, Flash 147, Sonnet 110–131, Luna 118, Opus 82–95, Fable 65–71, 6.1 Sol 45–56 | artificialanalysis.ai |
| Time to first token at low | Sonnet 5.5 1.3 s, Luna 2.3 s, Astra 2.4 s, 6.1 Sol 3.1 s, Fable 3.1 s, Haiku 6.3 s, Opus 7.7 s | artificialanalysis.ai |
| Flash latency, anecdotal (one run) | low 3.2 s, medium 5.1 s, high 8.4 s | computingforgeeks.com, 2026-09-07 |
| Weak spots | Luna: AA-Omniscience 1 (vs 42 for 6.1 Sol), TB4 16.4%. Haiku: Agent Arena 1.88%. Flash: loses scope on long unattended runs (anecdotal). | AA, tbench.ai, arena.ai |

## Effort

| Model | AA index by effort (low / medium / high / xhigh / max) | Other effort facts |
|---|---|---|
| Opus 5.5 | 42 / 51 / 54 / 56 / 58. First token 7.7 / 17.7 / 47 / 140 / 667 s. | Vendor: SWE-bench Pro subset high 95.3, xhigh 96.7. Claude Code docs: max "is prone to overthinking". |
| All Claude | — | Claude Code docs: Opus, Sonnet and Haiku 5.5 default to medium (code.claude.com/docs/en/model-config). Anthropic: xhigh is for "long-running agentic and coding tasks (over 30 minutes)" (platform.claude.com/docs/en/build-with-claude/effort). |
| Sonnet 5.5 | 36 / 41 / 47 / 52 / 56. First token 1.3 / 2.9 / 13 / 34 / 386 s. | Vendor: on FrontierCode, max scored lower than xhigh. |
| Fable 5.1 | 47 / 49 / 51 / 53 / 53 | Almost flat. Vendor: DeepResearch Bench II low 66, high 65. |
| Haiku 5.5 | 29 / 34 / 38 / 41 / 43 | — |
| 6.1 Sol | 42 / 48 / 50 / 51 / 52. First token 3.1 / 4.3 / 41.6 / 122 / 277 s. | Vendor DeepSWE: peaks at high (75.2), xhigh and max 71.9. AA Coding Agent Index: xhigh 3 points above max. |
| Astra | 46 / 50 / 51 / 52 / 53 | Vendor DeepSWE: peaks at xhigh. MathArena: low 82.2 → max 88.0. |
| Luna | 22 → 38 from low to max | Gains at every step. |
| 3.8 Flash | 33 / 40 / 41 (low / medium / high) | Gain stops at medium. |
| Argon | Tested at high only | Google recommends medium for most work and high for hard math, science and agent tasks (vendor). |
| Codex ultra | No benchmark for GPT-6 | OpenAI: ultra splits work across parallel subagents. "Most tasks do not need Max or Ultra." |

## Known gaps

- No debugging benchmark. No current code-review score for any top model.
- No independent test above 256k tokens.
- No audio benchmark. No search-grounding benchmark for Gemini 4.
- No independent test shows Fable 5.1 ahead of Opus 5.5, except Arena Search.
- No Argon score at low or medium.

## Full research

The full findings are not kept. To refresh this file, run the research again with three agents, one per vendor, and replace each table.
