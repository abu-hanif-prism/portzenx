import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Template, TemplateFilter } from '../types';

export function useTemplates(filter: TemplateFilter) {
  return useQuery({
    queryKey: ['templates', filter],
    queryFn: async (): Promise<Template[]> => {
      let query = supabase
        .from('templates')
        .select('id,name,category,preview_url,tags,is_active,created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (filter !== 'All') {
        query = query.eq('category', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as Template[]) ?? [];
    },
  });
}

export function useTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: ['template', templateId],
    enabled: Boolean(templateId),
    queryFn: async (): Promise<Template> => {
      const { data, error } = await supabase
        .from('templates')
        .select('id,name,category,preview_url,tags,is_active,created_at')
        .eq('id', templateId ?? '')
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data as Template;
    },
  });
}
