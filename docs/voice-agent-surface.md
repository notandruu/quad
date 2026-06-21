# Voice agent surface

Quad should treat voice as a first-class surface over the same runtime as chat, dashboard, and fetch.

## Product position

Voice mode is not a dictation widget. It is the fastest way to work with the company-aware AI employee while staying in flow.

The user should be able to say:

- "Audit this page."
- "What is the strongest trust gap?"
- "Draft the fix."
- "What should I tell the customer?"
- "What did we learn?"
- "Make this approval-ready."

Quad should respond using the same company brain, audit report, approval state, and run ledger that the dashboard uses.

## Current shipped slice

The dashboard voice button now works as a voice input surface:

- If Deepgram is configured, push-to-talk records microphone audio and transcribes it server-side with Deepgram before sending the transcript into Quad.
- If Moshi is configured with a browser-reachable websocket, the voice button uses the Moshi transport path.
- If neither Deepgram nor Moshi is configured, supported browsers fall back to browser speech recognition.
- Voice transcripts are submitted into the same chat runtime as typed messages.
- The UI does not claim full-duplex voice unless the Moshi websocket is configured.

This gives us a demo-safe voice mode today without pretending we are already hosting a GPU voice model.

## Deepgram production path

Deepgram is the right hackathon voice path because it gives Quad a production-grade voice surface without requiring us to host GPU speech infrastructure during the demo.

The shipped path:

1. User holds the voice button.
2. Browser records microphone audio with MediaRecorder.
3. Dashboard posts the audio to `/api/voice/transcribe`.
4. The server sends the audio to Deepgram streaming-grade speech-to-text using the configured model.
5. Quad receives the transcript as a normal chat command.
6. The same company brain, audit runtime, proof packet, approvals, and run ledger handle the work.

This means voice is not bolted on. It is a natural input surface for the same AI employee runtime.

The next Deepgram upgrade is to use the Voice Agent websocket for speech-to-speech responses, interruption events, and function calls. The function calls should map to Quad actions such as `start_audit`, `explain_finding`, `draft_fix`, `approve_change`, and `create_trust_packet`.

## Moshi target architecture

Moshi is the right north-star voice backend because it is designed for real-time full-duplex spoken dialogue rather than a slow STT -> LLM -> TTS pipeline.

The production target:

1. Browser captures microphone audio.
2. Browser streams audio to a Moshi websocket.
3. Moshi produces low-latency speech/text events.
4. Quad runtime receives transcript/intents.
5. Quad runtime retrieves context, plans, runs tools, and emits response text/actions.
6. Moshi speaks responses while continuing to listen.
7. Redis records voice session events for replay.
8. Arize captures voice-agent traces and evals.
9. Sentry captures transport, websocket, and runtime failures.

Moshi is the speech interface. Quad remains the brain and tool runtime.

## Meeting agent roadmap

After dashboard voice mode, the next surface is a meeting agent.

The meeting agent is not a notetaker. It is an active company copilot that can join a meeting, listen for gaps, retrieve relevant context, interject when useful, and update docs after approval.

Target workflow:

1. Join Google Meet or Zoom as Quad.
2. Stream meeting audio into the voice/transcript service.
3. Detect open questions, commitments, risks, and missing evidence.
4. Retrieve company-brain context in real time.
5. Suggest concise interjections only when confidence is high.
6. Produce meeting memory proposals after the call.
7. Ask for approval before writing docs, tasks, or customer-facing notes.
8. Attach receipts and source transcript spans to every update.

This extends the same runtime primitives: voice session, context retrieval, evidence, approval ledger, run receipts, observability, and memory writeback.

## Sponsor alignment

- Kyutai/Moshi: voice surface and full-duplex speech architecture.
- Deepgram: production push-to-talk transcription today; Voice Agent websocket for the next speech-to-speech layer.
- Browserbase: meeting/browser agent can join web meetings and inspect customer surfaces.
- Redis: live voice session events, transcript replay, and run state.
- Arize: voice-agent evals for grounding, interruption quality, and action readiness.
- Sentry: websocket, audio, browser session, and model failure monitoring.
- Fetch.ai: voice is another surface that can invoke the same external Quad agent.
- OpenAI/Anthropic: reasoning, summarization, and evidence-backed response generation.

## Demo-safe messaging

Say:

> Quad now has a voice surface. Today it can accept spoken commands into the same audit/chat runtime through Deepgram or a browser fallback, and the architecture is ready for Deepgram Voice Agent or Moshi full-duplex response audio.

Do not say:

> We fully host Moshi in production.

Say:

> The next step is a meeting agent that can join calls, retrieve company context live, ask useful questions, and propose approved doc updates after the meeting.
