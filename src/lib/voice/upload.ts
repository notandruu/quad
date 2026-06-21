export type VoiceTranscriptUploadContext = {
  orgId?: string | null;
  runId?: string | null;
  remember?: boolean;
};

export function appendVoiceTranscriptContext(form: FormData, context: VoiceTranscriptUploadContext): FormData {
  if (context.orgId?.trim()) form.append("orgId", context.orgId.trim());
  if (context.runId?.trim()) form.append("runId", context.runId.trim());
  if (context.remember !== undefined) form.append("remember", String(context.remember));
  return form;
}
