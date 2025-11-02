-- Create audit log table for role changes
CREATE TABLE IF NOT EXISTS role_change_audit (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    changed_by_user_id UUID NOT NULL,
    old_role VARCHAR(50) NOT NULL,
    new_role VARCHAR(50) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_role_change_audit_user_id ON role_change_audit(user_id);

-- Create a function to validate admin count
CREATE OR REPLACE FUNCTION check_admin_count()
RETURNS TRIGGER AS $$
BEGIN
    -- If updating from admin role to another role
    IF (OLD.role = 'admin' AND NEW.role != 'admin') THEN
        -- Check if this would remove the last admin
        IF (SELECT COUNT(*) FROM users WHERE role = 'admin' AND id != OLD.id) = 0 THEN
            RAISE EXCEPTION 'Cannot remove the last administrator';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent removing last admin
CREATE TRIGGER ensure_admin_exists
    BEFORE UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.role = 'admin' AND NEW.role != 'admin')
    EXECUTE FUNCTION check_admin_count();

-- Function to log role changes
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO role_change_audit (
        user_id,
        changed_by_user_id,
        old_role,
        new_role,
        reason
    ) VALUES (
        NEW.id,
        current_setting('app.current_user_id')::UUID,
        OLD.role,
        NEW.role,
        current_setting('app.change_reason', TRUE)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for role change auditing
CREATE TRIGGER audit_role_changes
    AFTER UPDATE OF role ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_role_change();

-- Add notification settings for admin role changes
ALTER TABLE users
ADD COLUMN IF NOT EXISTS notify_on_role_changes BOOLEAN DEFAULT true;