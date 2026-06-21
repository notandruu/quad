#!/usr/bin/env python3
"""generate a simple black/white quadchain observability demo."""

from __future__ import annotations

import hashlib
import json
from html import escape
from pathlib import Path

from token_diet import classify_line, estimate_tokens
from token_diet_answer_eval import score_items


ROOT = Path(__file__).resolve().parent.parent
INPUT_DIR = ROOT / "work/token-diet-inputs"
RESULT_DIR = ROOT / "work/token-diet-results"
OUTPUT = ROOT / "outputs/quadchain-observability-demo.html"


def load_json(name: str) -> object:
    return json.loads((RESULT_DIR / name).read_text(encoding="utf-8"))


def short_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def omitted_lines(raw: str, compressed: str) -> list[dict[str, object]]:
    compressed_lines = {line.strip() for line in compressed.splitlines() if line.strip()}
    rows = []
    for index, line in enumerate(raw.splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped in compressed_lines:
            continue
        segment = classify_line(line)
        if segment in {"trace_noise", "low_signal", "chatter", "blank", "normal"}:
            rows.append({"line": index, "segment": segment, "text": line})
    return rows[:60]


def case_payload(name: str, task: dict[str, object], cert: dict[str, object]) -> dict[str, object]:
    raw = (INPUT_DIR / name).read_text(encoding="utf-8")
    compressed_name = name.replace(".md", ".compressed.md").replace(".log", ".compressed.log")
    compressed = (RESULT_DIR / "batch" / compressed_name).read_text(encoding="utf-8")
    evidence_kept, evidence_total, missing_evidence = score_items(compressed, task["required_evidence"])
    concept_kept, concept_total, missing_concepts = score_items(compressed + "\n" + task["question"], task["answer_concepts"])
    raw_tokens = estimate_tokens(raw)
    compressed_tokens = estimate_tokens(compressed)
    return {
        "name": name,
        "raw": raw,
        "compressed": compressed,
        "rawTokens": raw_tokens,
        "compressedTokens": compressed_tokens,
        "savedTokens": raw_tokens - compressed_tokens,
        "reduction": round(((raw_tokens - compressed_tokens) / raw_tokens) * 100, 2),
        "rawHash": short_hash(raw),
        "compressedHash": short_hash(compressed),
        "evidence": f"{evidence_kept}/{evidence_total}",
        "concepts": f"{concept_kept}/{concept_total}",
        "missingEvidence": missing_evidence,
        "missingConcepts": missing_concepts,
        "omitted": omitted_lines(raw, compressed),
        "certificate": cert,
    }


def build_payload() -> dict[str, object]:
    tasks = json.loads((INPUT_DIR / "tasks.json").read_text(encoding="utf-8"))
    proof = load_json("proof-certificate.json")
    quad = load_json("quad-chain-eval.json")
    certs = {cert["name"]: cert for cert in proof["certificates"]}
    names = ["agent-trace.md", "failing-test.log", "long-agent-history.md", "noisy-issue.md", "research-notes.md"]
    events = [
        ["packet.received", "raw packet received; source hash and token count computed"],
        ["spans.protected", "paths, errors, ids, dates, and code blocks protected"],
        ["compression.delta", "low-signal trace/chatter deleted"],
        ["evidence.audit", f"{proof['aggregate']['evidence']} evidence and {proof['aggregate']['answer_concepts']} concepts preserved"],
        ["certificate.minted", f"{proof['aggregate']['accepted']}/{proof['aggregate']['certificates']} certificates accepted"],
        ["route.researcher", "researcher receives research-notes + noisy-issue"],
        ["route.implementer", "implementer receives trace + failing-test + long-history"],
        ["route.reviewer", "reviewer receives certificate summaries"],
        ["registry.anchor", "registry anchor contains 0 raw context bytes"],
        ["verifier.accepted", "hashes, evidence, concepts, and route obligations pass"],
    ]
    return {
        "cases": [case_payload(name, tasks[name], certs[name]) for name in names],
        "routes": quad["multiagent_workflow"]["roles"],
        "events": events,
        "summary": {
            "inputTokens": proof["aggregate"]["input_tokens_est"],
            "outputTokens": proof["aggregate"]["output_tokens_est"],
            "savedTokens": proof["aggregate"]["tokens_saved_est"],
            "evidence": proof["aggregate"]["evidence"],
            "concepts": proof["aggregate"]["answer_concepts"],
            "workflowReduction": quad["multiagent_workflow"]["workflow_percent_reduction"],
            "frontierRows": quad["frontier_benchmark"]["rows"],
            "rolePayloadEvidence": quad["frontier_benchmark"]["role_payload_preservation"],
        },
    }


def render() -> str:
    payload = build_payload()
    payload_json = json.dumps(payload).replace("</", "<\\/")
    options = "\n".join(f'<option value="{index}">{escape(case["name"])}</option>' for index, case in enumerate(payload["cases"]))
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>quadchain observability demo</title>
</head>
<body>
  <h1>quadchain observability demo</h1>
  <p><a href="token-diet-booth-dashboard.html">dashboard</a> | <a href="quad-chain-eval-report.md">eval report</a> | <a href="quadchain-benchmark-report.md">benchmark report</a></p>

  <h2>controls</h2>
  <p>
    <label for="caseSelect">trace</label>
    <select id="caseSelect">{options}</select>
    <button id="playBtn" type="button">play simulated sse</button>
    <button id="resetBtn" type="button">reset stream</button>
  </p>

  <h2>headline</h2>
  <table border="1" cellpadding="6" cellspacing="0">
    <tbody>
      <tr><th>raw tokens</th><td id="rawTokens"></td><th>compressed tokens</th><td id="compressedTokens"></td><th>saved</th><td id="savedTokens"></td></tr>
      <tr><th>reduction</th><td id="reduction"></td><th>evidence</th><td id="evidence"></td><th>concepts</th><td id="concepts"></td></tr>
      <tr><th>raw hash</th><td id="rawHash"></td><th>compressed hash</th><td id="compressedHash"></td><th>stream</th><td id="streamState">idle</td></tr>
    </tbody>
  </table>

  <h2>side by side trace</h2>
  <table border="1" cellpadding="6" cellspacing="0" width="100%">
    <thead>
      <tr><th width="50%">raw trace</th><th width="50%">quadchain compressed packet</th></tr>
    </thead>
    <tbody>
      <tr>
        <td valign="top"><pre id="rawTrace"></pre></td>
        <td valign="top"><pre id="compressedTrace"></pre></td>
      </tr>
    </tbody>
  </table>

  <h2>simulated sse stream</h2>
  <pre id="eventLog"></pre>

  <h2>proof certificate</h2>
  <table border="1" cellpadding="6" cellspacing="0">
    <tbody id="certificateRows"></tbody>
  </table>

  <h2>omitted spans</h2>
  <table border="1" cellpadding="6" cellspacing="0" width="100%">
    <thead><tr><th>line</th><th>segment</th><th>text</th></tr></thead>
    <tbody id="omitRows"></tbody>
  </table>

  <h2>multiagent routes</h2>
  <table border="1" cellpadding="6" cellspacing="0" width="100%">
    <thead><tr><th>role</th><th>mode</th><th>tokens</th><th>saved</th><th>evidence</th></tr></thead>
    <tbody id="routeRows"></tbody>
  </table>

  <script>
    const payload = {payload_json};
    let active = payload.cases[0];
    let streamIndex = 0;
    let timer = null;
    const $ = (id) => document.getElementById(id);

    function esc(value) {{
      return String(value).replace(/[&<>"']/g, (c) => ({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}}[c]));
    }}

    function num(value) {{
      return Number(value).toLocaleString();
    }}

    function setCase(index) {{
      active = payload.cases[index];
      $('rawTokens').textContent = num(active.rawTokens);
      $('compressedTokens').textContent = num(active.compressedTokens);
      $('savedTokens').textContent = num(active.savedTokens);
      $('reduction').textContent = active.reduction + '%';
      $('evidence').textContent = active.evidence;
      $('concepts').textContent = active.concepts;
      $('rawHash').textContent = active.rawHash;
      $('compressedHash').textContent = active.compressedHash;
      $('rawTrace').textContent = active.raw;
      $('compressedTrace').textContent = active.compressed;
      $('certificateRows').innerHTML = [
        ['verdict', active.certificate.verdict],
        ['answer ready', active.certificate.answer_ready_score],
        ['evidence', active.certificate.evidence],
        ['answer concepts', active.certificate.answer_concepts],
        ['input tokens', active.certificate.input_tokens_est],
        ['output tokens', active.certificate.output_tokens_est],
        ['tokens saved', active.certificate.tokens_saved_est],
        ['omission ranges', active.certificate.omission_ranges],
        ['missing evidence', active.missingEvidence.length ? active.missingEvidence.join(', ') : 'none'],
        ['missing concepts', active.missingConcepts.length ? active.missingConcepts.join(', ') : 'none']
      ].map((row) => '<tr><th>' + esc(row[0]) + '</th><td>' + esc(row[1]) + '</td></tr>').join('');
      $('omitRows').innerHTML = active.omitted.map((row) => '<tr><td>' + row.line + '</td><td>' + esc(row.segment) + '</td><td><pre>' + esc(row.text) + '</pre></td></tr>').join('');
      $('routeRows').innerHTML = payload.routes.map((route) => '<tr><td>' + esc(route.role) + '</td><td>' + esc(route.mode) + '</td><td>' + num(route.quad_chain_tokens) + '</td><td>' + num(route.tokens_saved) + '</td><td>' + esc(route.evidence) + '</td></tr>').join('');
      resetStream();
    }}

    function resetStream() {{
      if (timer) clearInterval(timer);
      timer = null;
      streamIndex = 0;
      $('streamState').textContent = 'idle';
      $('eventLog').textContent = payload.events.map((event) => 'event: ' + event[0] + '\\ndata: waiting\\n').join('\\n');
    }}

    function pushEvent() {{
      if (streamIndex >= payload.events.length) {{
        $('streamState').textContent = 'complete';
        clearInterval(timer);
        timer = null;
        return;
      }}
      const event = payload.events[streamIndex];
      const prefix = payload.events.slice(0, streamIndex + 1).map((item) => 'event: ' + item[0] + '\\ndata: ' + item[1] + '\\n').join('\\n');
      const suffix = payload.events.slice(streamIndex + 1).map((item) => 'event: ' + item[0] + '\\ndata: waiting\\n').join('\\n');
      $('eventLog').textContent = prefix + '\\n' + suffix;
      $('streamState').textContent = 'streaming ' + (streamIndex + 1) + '/' + payload.events.length;
      streamIndex += 1;
    }}

    function play() {{
      if (timer) return;
      pushEvent();
      timer = setInterval(pushEvent, 650);
    }}

    $('caseSelect').addEventListener('change', (event) => setCase(Number(event.target.value)));
    $('playBtn').addEventListener('click', play);
    $('resetBtn').addEventListener('click', resetStream);
    setCase(0);
  </script>
</body>
</html>
"""


def main() -> None:
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(render(), encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
