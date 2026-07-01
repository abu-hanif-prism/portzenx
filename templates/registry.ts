import photographerRedHtml from './photographer-red/template.html?raw';
import bcsBankingGlassHtml from './bcs-banking-glass/bcs-banking-glass.template.html?raw';

export const TEMPLATE_REGISTRY: Record<string, string> = {
  'photographer-red': photographerRedHtml,
  'bcs-banking-glass': bcsBankingGlassHtml,
};
