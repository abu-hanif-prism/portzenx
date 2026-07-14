export type TemplateCategory = string;
export type TemplateFilter = 'All' | TemplateCategory;
export type PlanKey = 'trial' | 'six_months' | 'one_year' | 'custom';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type Template = {
  id: string;
  name: string;
  category: TemplateCategory;
  preview_url: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  subdomain: string;
  plan: PlanKey;
  template_id: string;
  is_active: boolean;
  password_hash: string;
  expires_at: string;
  user_id: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  name: string;
  phone: string;
  created_at: string;
};

export type TemplateCategoryRow = {
  id: string;
  label: string;
  sort_order: number;
  created_at: string;
};

export type EditToken = {
  id: string;
  customer_id: string;
  token: string;
  used: boolean;
  expires_at: string;
  created_at: string;
};

export type Order = {
  id: string;
  customer_id: string;
  plan: PlanKey;
  amount: number;
  payment_status: PaymentStatus;
  whatsapp_confirmed: boolean;
  created_at: string;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13';
  };
  public: {
    Tables: {
      templates: {
        Row: Template;
        Insert: Omit<Template, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Template, 'id' | 'created_at'>>;
        Relationships: [];
      };
      customers: {
        Row: Customer;
        Insert: Omit<Customer, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Customer, 'id' | 'created_at'>>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'> & { created_at?: string };
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
        Relationships: [];
      };
      template_categories: {
        Row: TemplateCategoryRow;
        Insert: Omit<TemplateCategoryRow, 'created_at'> & { created_at?: string };
        Update: Partial<Omit<TemplateCategoryRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      edit_tokens: {
        Row: EditToken;
        Insert: Omit<EditToken, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<EditToken, 'id' | 'created_at'>>;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Order, 'id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

export type GenerateTokenResponse = {
  magicLink: string;
  expiresAt: string;
};
