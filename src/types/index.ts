export type TemplateCategory = 'Developer' | 'Designer' | 'Medical' | 'Student' | 'Creative';
export type TemplateFilter = 'All' | TemplateCategory;
export type PlanKey = 'trial' | 'six_months' | 'one_year' | 'custom';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  preview_url: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  subdomain: string;
  plan: PlanKey;
  password_hash: string;
  expires_at: string;
  created_at: string;
}

export interface EditToken {
  id: string;
  customer_id: string;
  token: string;
  used: boolean;
  expires_at: string;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  plan: PlanKey;
  amount: number;
  payment_status: PaymentStatus;
  whatsapp_confirmed: boolean;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      templates: {
        Row: Template;
        Insert: Omit<Template, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Template, 'id' | 'created_at'>>;
      };
      customers: {
        Row: Customer;
        Insert: Omit<Customer, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Customer, 'id' | 'created_at'>>;
      };
      edit_tokens: {
        Row: EditToken;
        Insert: Omit<EditToken, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<EditToken, 'id' | 'created_at'>>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Order, 'id' | 'created_at'>>;
      };
    };
  };
}

export interface GenerateTokenResponse {
  magicLink: string;
  expiresAt: string;
}
