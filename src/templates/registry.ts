import photographerRedHtml from './photographer-portfolio-red.html?raw';
import photographerRoseHtml from './photographer-portfolio-rose.html?raw';
import photographerForestHtml from './photographer-portfolio-forest.html?raw';

export const TEMPLATE_REGISTRY: Record<string, string> = {
  'photographer-red': photographerRedHtml,
  'photographer-rose': photographerRoseHtml,
  'photographer-forest': photographerForestHtml,
};
