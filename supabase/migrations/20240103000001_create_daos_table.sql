-- Create the main daos table
CREATE TABLE IF NOT EXISTS daos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier
  twitter_handle TEXT,
  description TEXT,
  website_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_daos_slug ON daos(slug);
CREATE INDEX IF NOT EXISTS idx_daos_twitter_handle ON daos(twitter_handle);

-- Insert all DAOs from data folder
INSERT INTO daos (name, slug, twitter_handle, description) VALUES
  ('VitaDAO', 'vitadao', 'vita_dao', 'Decentralized collective funding longevity research'),
  ('SpineDAO', 'spinedao', 'Spine_DAO', 'Decentralized autonomous organization focused on spine health research'),
  ('MycoDAO', 'mycodao', 'MycoDAO', 'Decentralized collective advancing mycology and fungal research'),
  ('ReflexDAO', 'reflexdao', 'ReflexDAO', 'Decentralized organization focused on reflex and neurological research'),
  ('KidneyDAO', 'kidneydao', 'KidneyDAO', 'Decentralized collective funding kidney disease research'),
  ('MicrobiomeDAO', 'microbiomedao', 'MicrobiomeDAO', 'Decentralized organization advancing microbiome research'),
  ('SpectruthaiDAO', 'spectruthaidao', 'SpectruthAI', 'Decentralized collective focused on spectral analysis and AI research')
ON CONFLICT (slug) DO NOTHING; 