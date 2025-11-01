import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
config();

async function applyMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  try {
    console.log('🔌 Connecting to database...');
    const sql = neon(process.env.DATABASE_URL);

    // Create marketing tables if they don't exist
    console.log('📦 Creating marketing tables...');

    // Create consultants table
    await sql`
      CREATE TABLE IF NOT EXISTS consultants (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        skills TEXT[],
        status TEXT DEFAULT 'Active' NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create requirements table
    await sql`
      CREATE TABLE IF NOT EXISTS requirements (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        skills_required TEXT[],
        experience_level TEXT,
        location TEXT,
        status TEXT DEFAULT 'Active' NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create interviews table
    await sql`
      CREATE TABLE IF NOT EXISTS interviews (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        consultant_id UUID REFERENCES consultants(id),
        requirement_id UUID REFERENCES requirements(id),
        interview_date TIMESTAMP WITH TIME ZONE NOT NULL,
        status TEXT DEFAULT 'Scheduled' NOT NULL,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create indexes
    console.log('📇 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_consultants_created_by ON consultants(created_by)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_consultants_status ON consultants(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_requirements_created_by ON requirements(created_by)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_interviews_created_by ON interviews(created_by)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_interviews_interview_date ON interviews(interview_date)`;

    console.log('✅ Marketing tables created successfully!');

    // Verify tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('consultants', 'requirements', 'interviews')
    `;

    const existingTables = tables.map((t: any) => t.table_name);
    console.log('✅ Verified tables:', existingTables);

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();