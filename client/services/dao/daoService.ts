import { supabase } from '../supabase/client';
import { Account, CreateAccountInput } from '../types/dao';

export class AccountService {
  
  // Get all Accounts
  async getAllAccounts(): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  }

  // Get a specific Account by slug
  async getAccountBySlug(slug: string): Promise<Account | null> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('slug', slug)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  // Get a specific Account by ID
  async getAccountById(id: string): Promise<Account | null> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  // Create a new Account
  async createAccount(account: CreateAccountInput): Promise<Account> {
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        ...account,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Update an Account
  async updateAccount(id: string, updates: Partial<CreateAccountInput>): Promise<Account> {
    const { data, error } = await supabase
      .from('accounts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Delete an Account
  async deleteAccount(id: string): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Create individual table for an Account (this will be called after creating an Account)
  async createAccountTable(slug: string): Promise<void> {
    const tableName = `account_${slug}_social_data`;
    
    // This will be implemented later with Edge Functions or server-side logic
    // For now, we'll just log what would happen
    console.log(`📝 Would create table: ${tableName}`);
    console.log(`   This will be implemented with Supabase Edge Functions`);
    
    // TODO: Implement table creation via Edge Function
    // The table structure will be:
    // - id (UUID)
    // - platform (TEXT) - twitter, discord, etc.
    // - post_id (TEXT) - unique identifier from the platform
    // - content (TEXT) - post content
    // - engagement_data (JSONB) - likes, shares, etc.
    // - posted_at (TIMESTAMP)
    // - synced_at (TIMESTAMP)
  }
}

// Backward compatibility - keep the old DAO service
export class DAOService extends AccountService {
  // Deprecated: Use getAllAccounts instead
  async getAllDAOs(): Promise<Account[]> {
    return this.getAllAccounts();
  }

  // Deprecated: Use getAccountBySlug instead
  async getDAOBySlug(slug: string): Promise<Account | null> {
    return this.getAccountBySlug(slug);
  }

  // Deprecated: Use getAccountById instead
  async getDAOById(id: string): Promise<Account | null> {
    return this.getAccountById(id);
  }

  // Deprecated: Use createAccount instead
  async createDAO(dao: CreateAccountInput): Promise<Account> {
    return this.createAccount(dao);
  }

  // Deprecated: Use updateAccount instead
  async updateDAO(id: string, updates: Partial<CreateAccountInput>): Promise<Account> {
    return this.updateAccount(id, updates);
  }

  // Deprecated: Use deleteAccount instead
  async deleteDAO(id: string): Promise<void> {
    return this.deleteAccount(id);
  }

  // Deprecated: Use createAccountTable instead
  async createDAOTable(slug: string): Promise<void> {
    return this.createAccountTable(slug);
  }
} 