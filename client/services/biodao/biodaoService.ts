import { supabase } from '../supabase/client';
import { 
  BioDAO, 
  BioDAOSocialAccount, 
  BioDAOSyncStatus, 
  BioDAOSocialData,
  SocialPlatform,
  SocialDataQuery,
  BioDAOWithAccounts 
} from '../types/biodao';

export class BioDAOService {
  
  // Get all BioDAOs
  async getAllBioDAOs(): Promise<BioDAO[]> {
    const { data, error } = await supabase
      .from('biodaos')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  }

  // Get a specific BioDAO by slug
  async getBioDAOBySlug(slug: string): Promise<BioDAO | null> {
    const { data, error } = await supabase
      .from('biodaos')
      .select('*')
      .eq('slug', slug)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  // Get BioDAO with its social accounts
  async getBioDAOWithAccounts(slug: string): Promise<BioDAOWithAccounts | null> {
    const { data, error } = await supabase
      .from('biodaos')
      .select(`
        *,
        social_accounts:biodao_social_accounts(*)
      `)
      .eq('slug', slug)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  // Create a new BioDAO
  async createBioDAO(bioDAO: Omit<BioDAO, 'id' | 'created_at' | 'updated_at'>): Promise<BioDAO> {
    const { data, error } = await supabase
      .from('biodaos')
      .insert(bioDAO)
      .select()
      .single();
    
    if (error) throw error;

    // Create the social data table for this DAO
    await this.createSocialDataTable(bioDAO.slug);
    
    return data;
  }

  // Create social data table for a BioDAO
  async createSocialDataTable(daoSlug: string): Promise<void> {
    const { error } = await supabase.rpc('create_biodao_social_table', {
      dao_slug: daoSlug
    });
    
    if (error) throw error;
  }

  // Add social account for a BioDAO
  async addSocialAccount(account: Omit<BioDAOSocialAccount, 'id' | 'created_at' | 'updated_at'>): Promise<BioDAOSocialAccount> {
    const { data, error } = await supabase
      .from('biodao_social_accounts')
      .insert(account)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Get social accounts for a BioDAO
  async getSocialAccounts(biodaoId: string, platform?: SocialPlatform): Promise<BioDAOSocialAccount[]> {
    let query = supabase
      .from('biodao_social_accounts')
      .select('*')
      .eq('biodao_id', biodaoId)
      .eq('is_active', true);
    
    if (platform) {
      query = query.eq('platform', platform);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Store social data for a BioDAO
  async storeSocialData(
    daoSlug: string,
    socialData: Omit<BioDAOSocialData, 'id' | 'synced_at' | 'created_at'>
  ): Promise<void> {
    const { error } = await supabase.rpc('upsert_biodao_social_data', {
      dao_slug: daoSlug,
      p_platform: socialData.platform,
      p_post_id: socialData.post_id,
      p_post_type: socialData.post_type,
      p_content: socialData.content,
      p_author_info: socialData.author_info,
      p_engagement_metrics: socialData.engagement_metrics,
      p_platform_data: socialData.platform_data,
      p_posted_at: socialData.posted_at
    });
    
    if (error) throw error;
  }

  // Get social data for a BioDAO
  async getSocialData(query: SocialDataQuery): Promise<BioDAOSocialData[]> {
    const { data, error } = await supabase.rpc('get_biodao_social_data', {
      dao_slug: query.dao_slug,
      p_platform: query.platform || null,
      limit_count: query.limit || 100
    });
    
    if (error) throw error;
    return data || [];
  }

  // Update sync status
  async updateSyncStatus(
    biodaoId: string, 
    platform: SocialPlatform, 
    syncData: Partial<BioDAOSyncStatus>
  ): Promise<void> {
    const { error } = await supabase
      .from('biodao_sync_status')
      .upsert({
        biodao_id: biodaoId,
        platform,
        ...syncData,
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
  }

  // Get sync status
  async getSyncStatus(biodaoId: string, platform?: SocialPlatform): Promise<BioDAOSyncStatus[]> {
    let query = supabase
      .from('biodao_sync_status')
      .select('*')
      .eq('biodao_id', biodaoId);
    
    if (platform) {
      query = query.eq('platform', platform);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Get engagement metrics for a BioDAO
  async getEngagementMetrics(daoSlug: string, platform?: SocialPlatform, days: number = 30): Promise<any> {
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    // This would need to be implemented as a custom function in Supabase
    // For now, we'll get the data and calculate metrics in TypeScript
    const socialData = await this.getSocialData({
      dao_slug: daoSlug,
      platform,
      limit: 1000
    });

    const metrics = socialData.reduce((acc, post) => {
      const metrics = post.engagement_metrics;
      return {
        total_posts: acc.total_posts + 1,
        total_likes: acc.total_likes + (metrics.likes || 0),
        total_shares: acc.total_shares + (metrics.shares || 0),
        total_comments: acc.total_comments + (metrics.comments || 0),
        total_views: acc.total_views + (metrics.views || 0),
      };
    }, {
      total_posts: 0,
      total_likes: 0,
      total_shares: 0,
      total_comments: 0,
      total_views: 0,
    });

    return {
      ...metrics,
      avg_likes: metrics.total_posts > 0 ? Math.round(metrics.total_likes / metrics.total_posts) : 0,
      avg_shares: metrics.total_posts > 0 ? Math.round(metrics.total_shares / metrics.total_posts) : 0,
      avg_comments: metrics.total_posts > 0 ? Math.round(metrics.total_comments / metrics.total_posts) : 0,
      period_days: days,
      platform: platform || 'all'
    };
  }
} 