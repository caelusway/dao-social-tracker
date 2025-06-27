import { supabase } from '../supabase/client';
import { DAO, CreateDAOInput } from '../types/dao';

export class DAOService {
  
  // Get all DAOs
  async getAllDAOs(): Promise<DAO[]> {
    const { data, error } = await supabase
      .from('daos')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  }

  // Get a specific DAO by slug
  async getDAOBySlug(slug: string): Promise<DAO | null> {
    const { data, error } = await supabase
      .from('daos')
      .select('*')
      .eq('slug', slug)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  // Get a specific DAO by ID
  async getDAOById(id: string): Promise<DAO | null> {
    const { data, error } = await supabase
      .from('daos')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  // Create a new DAO
  async createDAO(dao: CreateDAOInput): Promise<DAO> {
    const { data, error } = await supabase
      .from('daos')
      .insert({
        ...dao,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Update a DAO
  async updateDAO(id: string, updates: Partial<CreateDAOInput>): Promise<DAO> {
    const { data, error } = await supabase
      .from('daos')
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

  // Delete a DAO
  async deleteDAO(id: string): Promise<void> {
    const { error } = await supabase
      .from('daos')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Create individual table for a DAO (this will be called after creating a DAO)
  async createDAOTable(slug: string): Promise<void> {
    const tableName = `dao_${slug}_social_data`;
    
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