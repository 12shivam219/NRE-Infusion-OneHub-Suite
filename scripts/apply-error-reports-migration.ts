import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

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
    
    console.log('📦 Creating error_reports table...');
    
    // Create the table
    await sql`
      CREATE TABLE IF NOT EXISTS error_reports (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id VARCHAR REFERENCES users(id),
        user_email TEXT,
        error_message TEXT NOT NULL,
        error_stack TEXT,
        component_stack TEXT,
        user_description TEXT NOT NULL,
        screenshot_urls TEXT[],
        status TEXT NOT NULL DEFAULT 'new',
        admin_notes TEXT,
        url TEXT NOT NULL,
        user_agent TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `;

    // Create indexes
    console.log('📇 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS error_reports_user_id_idx ON error_reports(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS error_reports_status_idx ON error_reports(status)`;
    await sql`CREATE INDEX IF NOT EXISTS error_reports_created_at_idx ON error_reports(created_at DESC)`;

    console.log('✅ Migration completed successfully!');
    
    // Verify the table exists
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'error_reports'
      )
    `;
    
    if (result[0].exists) {
      console.log('✅ Verified: error_reports table exists');
    } else {
      console.error('❌ Verification failed: error_reports table not found');
    }
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();