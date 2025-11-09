-- Reset authentication issues
UPDATE users 
SET failed_login_attempts = 0, 
    account_locked_until = NULL 
WHERE failed_login_attempts > 0 OR account_locked_until IS NOT NULL;

-- Clear rate limiting records
DELETE FROM auth_rate_limits;
DELETE FROM email_rate_limits;

-- Show results
SELECT email, failed_login_attempts, account_locked_until 
FROM users 
WHERE email IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;