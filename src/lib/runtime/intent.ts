import type { Intent } from "@/lib/types";

const URL_RE = /https?:\/\/[^\s]+/i;

/**
 * Lightweight intent classifier. Good enough for the demo loop; replace with a
 * model classifier when API access is wired. Always returns an MVP intent.
 */
export function classifyIntent(
  text: string,
  ctx: { hasActiveAudit?: boolean; pinnedUrl?: string } = {}
): Intent {
  const t = text.toLowerCase();

  if (/(start|run|begin).*(audit|crawl|scan)/.test(t) || (URL_RE.test(text) && /audit/.test(t))) {
    return "website_audit";
  }
  if (ctx.hasActiveAudit && /(fix|finding|top|first|draft|faq|task|slack|summar)/.test(t)) {
    return "audit_follow_up";
  }
  if (/draft|write|rewrite|faq|page copy/.test(t)) return "draft_content";
  if (/create (a )?task|add (a )?task|todo/.test(t)) return "create_task";
  if (/summar.*(meeting|call|transcript)/.test(t)) return "summarize_meeting";
  if (/save (this|that|it).*(brain|memory)|remember this/.test(t)) return "save_memory";
  if (/what|who|when|where|why|how|which|does|do we|our/.test(t)) return "company_question";

  return "general_chat";
}

export function extractUrl(text: string): string | null {
  const m = text.match(URL_RE);
  return m ? m[0] : null;
}
