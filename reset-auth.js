// Reset authentication issues
import { db } from './server/db.js';
import { users, authRateLimits, emailRateLimits } from './shared/schema.js';
import { eq } from 'drizzle-orm';

const resetAuth = async () => {
  try {
    console.log('Resetting authentication issues...');
    
    // Reset all failed login attempts
    const resetUsers = await db
      .update(users)
      .set({ 
        failedLoginAttempts: 0, 
        accountLockedUntil: null 
      })
      .returning({ id: users.id, email: users.email });
    
    console.log(`Reset failed login attempts for ${resetUsers.length} users`);
    
    // Clear all rate limiting records
    const deletedAuthLimits = await db.delete(authRateLimits);
    console.log('Cleared auth rate limits');
    
    const deletedEmailLimits = await db.delete(emailRateLimits);
    console.log('Cleared email rate limits');
    
    console.log('✓ Authentication reset complete');
    
    // Test the auth endpoint again
    console.log('\nTesting auth endpoint after reset...');
    const authResponse = await fetch('http://localhost:5000/api/auth/user', {
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    console.log('Auth endpoint status:', authResponse.status, authResponse.statusText);
    
    if (authResponse.status === 401) {
      console.log('✓ Auth endpoint working correctly');
    } else {
      console.log('Auth response:', await authResponse.text());
    }
    
  } catch (error) {
    console.error('Error resetting auth:', error);
  } finally {
    process.exit(0);
  }
};

resetAuth();