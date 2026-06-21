export type DeepgramSettings = {
  configured: boolean;
  apiKey: string | null;
  sttModel: string;
  ttsModel: string;
  agentUrl: string;
};

export type DeepgramTranscript = {
  provider: "deepgram";
  model: string;
  transcript: string;
  confidence: number | null;
};

const DEFAULT_STT_MODEL = "nova-3";
const DEFAULT_TTS_MODEL = "aura-2-thalia-en";
const DEFAULT_AGENT_URL = "wss://agent.deepgram.com/v1/agent/converse";

export function getDeepgramSettings(
  env: Partial<NodeJS.ProcessEnv> = process.env
): DeepgramSettings {
  const apiKey = env.DEEPGRAM_API_KEY?.trim() || null;
  return {
    configured: Boolean(apiKey),
    apiKey,
    sttModel: env.DEEPGRAM_STT_MODEL?.trim() || DEFAULT_STT_MODEL,
    ttsModel: env.DEEPGRAM_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL,
    agentUrl: normalizeWsUrl(env.DEEPGRAM_AGENT_URL) ?? DEFAULT_AGENT_URL,
  };
}

export async function transcribeWithDeepgram(input: {
  audio: Blob | ArrayBuffer;
  mimeType: string;
  apiKey: string;
  model?: string;
  fetcher?: typeof fetch;
}): Promise<DeepgramTranscript> {
  const fetcher = input.fetcher ?? fetch;
  const model = input.model?.trim() || DEFAULT_STT_MODEL;
  const body = input.audio instanceof Blob ? input.audio : new Blob([input.audio], { type: input.mimeType });
  const url = new URL("https://api.deepgram.com/v1/listen");
  url.searchParams.set("model", model);
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("punctuate", "true");

  const response = await fetcher(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${input.apiKey}`,
      "Content-Type": input.mimeType || "application/octet-stream",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Deepgram transcription failed with status ${response.status}`);
  }

  const json = (await response.json()) as DeepgramListenResponse;
  const alternative = json.results?.channels?.[0]?.alternatives?.[0];

  return {
    provider: "deepgram",
    model,
    transcript: alternative?.transcript?.trim() ?? "",
    confidence: typeof alternative?.confidence === "number" ? alternative.confidence : null,
  };
}

function normalizeWsUrl(value?: string): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "ws:" && url.protocol !== "wss:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

type DeepgramListenResponse = {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
      }>;
    }>;
  };
};
