import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { TemplateCategoryRow } from '../types';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<TemplateCategoryRow[]> => {
      const { data, error } = await supabase
        .from('template_categories')
        .select('id,label,sort_order,created_at')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data as TemplateCategoryRow[]) ?? [];
    },
  });
}
