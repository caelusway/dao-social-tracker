import { TwitterSyncService } from '../twitter/twitterSyncService';
import { BioDAOService } from '../biodao/biodaoService';
import { ENV_CONFIG } from '../../config/environment';
import { TWITTER_CONFIG } from '../twitter/config';

export class BioDAOSyncManager {
  private twitterSyncService: TwitterSyncService | null = null;
  private biodaoService: BioDAOService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.biodaoService = new BioDAOService();
    
    // Initialize Twitter sync if token is available
    if (ENV_CONFIG.TWITTER_BEARER_TOKEN) {
      this.twitterSyncService = new TwitterSyncService(ENV_CONFIG.TWITTER_BEARER_TOKEN);
    }
  }

  async syncAllPlatforms(): Promise<void> {
    if (this.isRunning) {
      console.log('🔄 Sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('🚀 Starting BioDAO social media sync...');
      
      // Get all BioDAOs
      const bioDAOs = await this.biodaoService.getAllBioDAOs();
      console.log(`📊 Found ${bioDAOs.length} BioDAOs to sync`);

      if (bioDAOs.length === 0) {
        console.log('⚠️  No BioDAOs found. Please add some BioDAOs first.');
        return;
      }

      // Sync Twitter data if service is available
      if (this.twitterSyncService) {
        console.log('🐦 Starting Twitter sync...');
        await this.twitterSyncService.syncAllBioDAOs();
      } else {
        console.log('⚠️  Twitter sync disabled (no bearer token)');
      }

      // TODO: Add other platform syncs here
      // if (this.discordSyncService) {
      //   console.log('💬 Starting Discord sync...');
      //   await this.discordSyncService.syncAllBioDAOs();
      // }

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`✅ Completed BioDAO sync in ${duration}s`);

    } catch (error) {
      console.error('❌ Error in BioDAO sync:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async syncSpecificBioDAO(daoSlug: string, platforms?: string[]): Promise<void> {
    try {
      const bioDAO = await this.biodaoService.getBioDAOBySlug(daoSlug);
      if (!bioDAO) {
        throw new Error(`BioDAO not found: ${daoSlug}`);
      }

      console.log(`🔄 Syncing ${bioDAO.name}...`);

      // Sync Twitter if requested and available
      if ((!platforms || platforms.includes('twitter')) && this.twitterSyncService) {
        console.log(`🐦 Syncing Twitter for ${bioDAO.name}...`);
        await this.twitterSyncService.syncBioDAOTwitterData(bioDAO);
      }

      // TODO: Add other platform syncs here based on platforms array

      console.log(`✅ Completed sync for ${bioDAO.name}`);
    } catch (error) {
      console.error(`❌ Error syncing ${daoSlug}:`, error);
      throw error;
    }
  }

  startPeriodicSync(): void {
    if (this.syncInterval) {
      console.log('⚠️  Periodic sync already started');
      return;
    }

    // Run initial sync
    this.syncAllPlatforms().catch(error => {
      console.error('❌ Error in initial sync:', error);
    });

    // Set up periodic sync
    this.syncInterval = setInterval(
      () => {
        this.syncAllPlatforms().catch(error => {
          console.error('❌ Error in periodic sync:', error);
        });
      },
      TWITTER_CONFIG.FETCH_INTERVAL
    );

    console.log(`⏰ Periodic sync started (every ${TWITTER_CONFIG.FETCH_INTERVAL / 1000 / 60} minutes)`);
  }

  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('🛑 Periodic sync stopped');
    }
  }

  async getSystemStatus(): Promise<any> {
    try {
      const bioDAOs = await this.biodaoService.getAllBioDAOs();
      const status = {
        total_biodaos: bioDAOs.length,
        sync_running: this.isRunning,
        periodic_sync_active: !!this.syncInterval,
        platforms: {
          twitter: !!this.twitterSyncService,
          discord: false, // TODO: Add when Discord service is ready
          telegram: false, // TODO: Add when Telegram service is ready
        },
        biodaos: [] as Array<{
          name: string;
          slug: string;
          social_accounts: number;
          platforms: string[];
          last_syncs: Record<string, any>;
        }>
      };

      // Get sync status for each BioDAO
      for (const bioDAO of bioDAOs) {
        const syncStatuses = await this.biodaoService.getSyncStatus(bioDAO.id);
        const socialAccounts = await this.biodaoService.getSocialAccounts(bioDAO.id);
        
        status.biodaos.push({
          name: bioDAO.name,
          slug: bioDAO.slug,
          social_accounts: socialAccounts.length,
          platforms: socialAccounts.map(acc => acc.platform),
          last_syncs: syncStatuses.reduce((acc, sync) => {
            acc[sync.platform] = {
              last_sync: sync.last_sync_time,
              has_errors: sync.sync_errors.length > 0,
              is_syncing: sync.is_syncing
            };
            return acc;
          }, {} as Record<string, any>)
        });
      }

      return status;
    } catch (error) {
      console.error('Error getting system status:', error);
      throw error;
    }
  }

  // Helper method to add a new BioDAO with social accounts
  async addBioDAO(
    name: string,
    slug: string,
    description: string,
    socialAccounts: Array<{ platform: string; account_identifier: string; account_data?: any }>
  ): Promise<void> {
    try {
      // Create the BioDAO
      const bioDAO = await this.biodaoService.createBioDAO({
        name,
        slug,
        description
      });

      console.log(`✅ Created BioDAO: ${name}`);

      // Add social accounts
      for (const account of socialAccounts) {
        await this.biodaoService.addSocialAccount({
          biodao_id: bioDAO.id,
          platform: account.platform as any,
          account_identifier: account.account_identifier,
          account_data: account.account_data || {},
          is_active: true
        });
        
        console.log(`✅ Added ${account.platform} account: ${account.account_identifier}`);
      }

      console.log(`🎉 Successfully set up ${name} with ${socialAccounts.length} social accounts`);
    } catch (error) {
      console.error(`❌ Error adding BioDAO ${name}:`, error);
      throw error;
    }
  }
} 