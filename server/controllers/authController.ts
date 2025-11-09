import { Request, Response } from 'express';
import passport from 'passport';
import { AuthService } from '../services/authService';
import { users, userDevices, loginHistory } from '@shared/schema';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { TwoFactorAuth } from '../utils/twoFactor';
import { ActivityTracker } from '../utils/activityTracker';
import { EmailValidator } from '../utils/emailValidator';
import { createHash, randomInt } from 'crypto'; // FIX: ADDED randomInt
import { logger } from '../utils/logger';
import { sanitizeText } from '../utils/sanitizer';
import { DeviceParser } from '../utils/deviceParser';
import { GeolocationService } from '../services/geolocationService';
import { SuspiciousActivityDetector } from '../utils/suspiciousActivityDetector';

// --- MEDIUM FIX: Constants for Account Lockout ---
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function parseCookies(header?: string) {
  const result: Record<string, string> = {};
  if (!header) return result;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      result[k] = decodeURIComponent(v);
    }
  });
  return result;
}

function extractTracking(req: Request) {
  let rawReferrer = (req.headers['referer'] || req.headers['referrer'] || '') as string;
  const q = req.query as Record<string, any>;
  
  // FIX: Sanitize query-based UTMs before assigning
  const utm: any = {
    source: sanitizeText(q.utm_source || undefined), // FIX: Sanitize
    medium: sanitizeText(q.utm_medium || undefined), // FIX: Sanitize
    campaign: sanitizeText(q.utm_campaign || undefined), // FIX: Sanitize
    term: sanitizeText(q.utm_term || undefined), // FIX: Sanitize
    content: sanitizeText(q.utm_content || undefined), // FIX: Sanitize
  };

  // If no UTM in query, fallback to cookie
  if (!utm.source && !utm.medium && !utm.campaign && !utm.term && !utm.content) {
    try {
      const cookies = parseCookies(req.headers.cookie as any);
      const raw = cookies['utm_params'];
      if (raw) {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        const obj = JSON.parse(decoded);
        if (obj?.utm) {
          // FIX: Sanitize cookie-based UTMs before merging
          Object.keys(obj.utm).forEach(k => {
            (utm as any)[k] = sanitizeText(obj.utm[k]);
          });
        }
        if (!rawReferrer && obj?.referrer) {
          rawReferrer = obj.referrer;
        }
      }
    } catch {}
  }
  
  // FIX: Sanitize the final referrer value
  const referrer = sanitizeText(rawReferrer);

  // Remove empty keys
  Object.keys(utm).forEach((k) => (utm as any)[k] === undefined && delete (utm as any)[k]);
  return { referrer, utm: Object.keys(utm).length ? utm : undefined };
}

export class AuthController {
  
  // FIX #3: Helper method to consolidate all security, tracking, token generation, and DB updates on a successful login/2FA
  private static async _performLoginUpdates(req: Request, user: any) {
    // Get geolocation and device info
    const ipAddress = (req.ip || 'unknown').replace('::ffff:', '');
    const userAgent = req.headers['user-agent'] as string || '';
    
    // Parse device info
    const deviceInfo = DeviceParser.parse(userAgent);
    
    // Get geolocation
    const geoData = await GeolocationService.getLocation(ipAddress);
    
    // Check for suspicious activity
    const suspiciousCheck = await SuspiciousActivityDetector.analyze(user.id, {
      ipAddress,
      city: geoData.city,
      region: geoData.region,
      country: geoData.country,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      deviceType: deviceInfo.deviceType
    });
    
    // Log login to history
    const { referrer: loginReferrer, utm: loginUtm } = extractTracking(req); // Use local variable names
    await db.insert(loginHistory).values({
      userId: user.id,
      status: 'success',
      ipAddress,
      city: geoData.city,
      region: geoData.region,
      country: geoData.country,
      countryCode: geoData.countryCode,
      timezone: geoData.timezone,
      isp: geoData.isp,
      latitude: geoData.latitude,
      longitude: geoData.longitude,
      userAgent,
      browser: deviceInfo.browser,
      browserVersion: deviceInfo.browserVersion,
      os: deviceInfo.os,
      osVersion: deviceInfo.osVersion,
      deviceType: deviceInfo.deviceType,
      deviceVendor: deviceInfo.deviceVendor,
      isSuspicious: suspiciousCheck.isSuspicious,
      suspiciousReasons: suspiciousCheck.reasons,
      isNewLocation: suspiciousCheck.isNewLocation,
      isNewDevice: suspiciousCheck.isNewDevice,
      // NOTE: referrer/utm are not standard in loginHistory schema, but activityTracker handles them.
    });
    
    // Send alerts if suspicious or new device
    if (suspiciousCheck.isSuspicious) {
      SuspiciousActivityDetector.alertAdmin(user.id, user.email, suspiciousCheck.reasons, {
        ipAddress,
        city: geoData.city,
        region: geoData.region,
        country: geoData.country,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        deviceType: deviceInfo.deviceType
      });
    }
    
    if (suspiciousCheck.isNewDevice) {
      SuspiciousActivityDetector.notifyUser(user.email, `${user.firstName} ${user.lastName}`.trim() || 'User', {
        ipAddress,
        city: geoData.city,
        region: geoData.region,
        country: geoData.country,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        deviceType: deviceInfo.deviceType
      });
    }
    
    // Generate tokens
    const accessToken = AuthService.generateAccessToken(user.id);
    const refreshToken = await AuthService.generateRefreshToken(
      user.id,
      userAgent,
      ipAddress
    );

    // Update last login with full tracking info AND reset failed attempts
    await db
      .update(users)
      .set({ 
        lastLoginAt: new Date(),
        lastIpAddress: ipAddress,
        lastUserAgent: userAgent,
        lastLoginCity: geoData.city,
        lastLoginCountry: geoData.country,
        lastLoginBrowser: deviceInfo.browser,
        lastLoginOs: deviceInfo.os,
        lastLoginDevice: deviceInfo.deviceType,
        failedLoginAttempts: 0, // FIX: Reset on SUCCESS
        accountLockedUntil: null, // FIX: Reset on SUCCESS
      })
      .where(eq(users.id, user.id));

    // Return tokens and user info (without sensitive data)
    const { password: _, ...userWithoutPassword } = user;
    
    return { userWithoutPassword, accessToken, refreshToken };
  }

  // Register a new user
  static async register(req: Request, res: Response) {
    const { email, password } = req.body;
    
    // FIX #2: Sanitize user-provided display names/text fields to prevent XSS/Injection
    const pseudoName = sanitizeText(req.body.pseudoName);
    const firstName = sanitizeText(req.body.firstName);
    const lastName = sanitizeText(req.body.lastName);

    try {
      // Validate email format and check for common issues
      const emailValidation = await EmailValidator.validateEmail(email);
      if (!emailValidation.isValid) {
        return res.status(400).json({ 
          message: emailValidation.reason,
          suggestions: emailValidation.suggestions
        });
      }

      // Normalize email
      const normalizedEmail = EmailValidator.normalizeEmail(email);

      // Check if user already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, normalizedEmail),
      });

      if (existingUser) {
        return res.status(409).json({ message: 'Email already in use' });
      }

      // Hash password and create user
      const hashedPassword = await AuthService.hashPassword(password);
      const verification = AuthService.generateEmailVerificationToken();

      const result = await db.insert(users).values({
        email: normalizedEmail,
        password: hashedPassword,
        pseudoName,
        firstName,
        lastName,
        emailVerificationToken: verification.tokenHash,
        emailVerificationExpires: verification.expiresAt,
      }).returning({
        id: users.id,
        email: users.email,
        pseudoName: users.pseudoName,
        firstName: users.firstName,
        lastName: users.lastName
      });

      const newUser = result[0];

      if (!newUser || !newUser.id || !newUser.email) {
        throw new Error('Failed to create user account');
      }

      // Send verification email (raw token)
      await AuthService.sendVerificationEmail(
        newUser.email,
        newUser.pseudoName || `${newUser.firstName} ${newUser.lastName}`.trim() || 'User',
        verification.token
      );

      // Log the registration with enhanced tracking (FIX: uses sanitized values from extractTracking)
      const { referrer, utm } = extractTracking(req);
      await ActivityTracker.logActivity(
        newUser.id.toString(),
        'register',
        'success',
        { method: 'email', referrer, utm },
        req
      );

      res.status(201).json({ 
        message: 'Registration successful. Please check your email to verify your account.',
        userId: newUser.id.toString(),
        // FIX #1: Removed verificationToken: verification.token (Critical Security Flaw)
        email: newUser.email,
      });
    } catch (error) {
      logger.error({ error }, 'Registration error');
      res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
  }

  // Login user
  static login(req: Request, res: Response, next: any) {
    logger.info({ email: req.body?.email, hasPassword: !!req.body?.password }, 'Login attempt');
    
    passport.authenticate('local', async (err: any, user: any, info: any) => {
      try {
        if (err) {
          logger.error({ error: err }, 'Passport authentication error');
          return next(err);
        }

        // --- MEDIUM FIX: Handle Authentication Failure with Lockout Logic ---
        if (!user) {
          logger.error({ info, email: req.body?.email }, 'Login failed - no user');

          const rawEmail = req.body?.email;
          if (rawEmail) {
            const normalizedEmail = EmailValidator.normalizeEmail(rawEmail);
            const failedUser = await db.query.users.findFirst({
                where: eq(users.email, normalizedEmail),
                columns: {
                    id: true,
                    failedLoginAttempts: true,
                    accountLockedUntil: true,
                    email: true
                }
            });

            if (failedUser) {
                const newAttempts = (failedUser.failedLoginAttempts || 0) + 1;
                let update: any = { failedLoginAttempts: newAttempts };

                // Apply Lockout
                if (newAttempts >= MAX_FAILED_ATTEMPTS) {
                    update.accountLockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
                    logger.warn({ userId: failedUser.id, email: failedUser.email, attempts: newAttempts }, 'Account locked due to brute force.');
                }
                
                await db.update(users).set(update).where(eq(users.id, failedUser.id));

                // Log the failed login activity (FIX: uses sanitized values from extractTracking)
                const { referrer, utm } = extractTracking(req);
                await ActivityTracker.logActivity(
                    failedUser.id,
                    'login',
                    'failure',
                    { method: 'email', twoFactor: false, referrer, utm },
                    req
                );

                if (newAttempts >= MAX_FAILED_ATTEMPTS) {
                    return res.status(403).json({
                        success: false,
                        message: 'Account is temporarily locked due to too many failed attempts. Please try again later.'
                    });
                }
            }
          }
          
          return res.status(401).json({ 
            success: false,
            message: info?.message || 'Invalid email or password' 
          });
        }
        // --- END Lockout on Failure ---


        logger.info({ userId: user.id, email: user.email }, 'User authenticated successfully');

        // Check if account is locked (Lockout on Success path is critical)
        if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
          // This should ideally be caught in the `if (!user)` block above, but kept as a redundant check.
          return res.status(403).json({ 
            success: false,
            message: 'Account is temporarily locked due to too many failed attempts. Please try again later.' 
          });
        }

        // Check if email is verified
        if (!user.emailVerified) {
          return res.status(403).json({ 
            success: false,
            message: 'Please verify your email before logging in.',
            requiresVerification: true,
            userId: user.id,
          });
        }

        // Check if account is approved by admin
        if (user.approvalStatus === 'pending_approval') {
          return res.status(403).json({ 
            success: false,
            message: 'Your account is pending admin approval. You will receive an email once approved.',
            code: 'PENDING_APPROVAL'
          });
        }

        if (user.approvalStatus === 'rejected') {
          return res.status(403).json({ 
            success: false,
            message: 'Your account registration was not approved. Please contact support.',
            code: 'ACCOUNT_REJECTED'
          });
        }

        if (user.approvalStatus !== 'approved') {
          return res.status(403).json({ 
            success: false,
            message: 'Account verification pending. Please complete email verification first.',
            code: 'PENDING_VERIFICATION'
          });
        }

        // If 2FA is enabled, generate and send code
        if (user.twoFactorEnabled) {
          // --- HIGH FIX: Use crypto.randomInt for cryptographically secure 2FA code ---
          const code = randomInt(100000, 999999).toString().padStart(6, '0');
          const verificationToken = await AuthService.generate2FACode(user.id, code);
          
          await AuthService.sendTwoFactorCodeEmail(
            user.email,
            `${user.firstName} ${user.lastName}`.trim() || 'User',
            code
          );

          return res.status(200).json({
            success: true,
            message: 'Two-factor authentication required',
            requires2FA: true,
            tempToken: verificationToken,
          });
        }

        // If no 2FA required, proceed with login
        req.login(user, async (err) => {
          if (err) {
            logger.error({ error: err }, 'Login error:');
            return next(err);
          }
          
          // FIX #3 & #4: Consolidated security and login logic into a helper method.
          const { userWithoutPassword, accessToken, refreshToken } = await AuthController._performLoginUpdates(req, user);
          
          // Log successful login with specific tracking info (FIX: uses sanitized values from extractTracking)
          const { referrer, utm } = extractTracking(req);
          await ActivityTracker.logActivity(
            user.id,
            'login',
            'success',
            { method: 'email', twoFactor: false, referrer, utm },
            req
          );
          
          // Ensure session state is persisted before responding to avoid race conditions
          if (req.session) {
            req.session.save(() => {
              res.json({
                success: true,
                user: userWithoutPassword,
                accessToken,
                refreshToken,
              });
            });
          } else {
            res.json({
              success: true,
              user: userWithoutPassword,
              accessToken,
              refreshToken,
            });
          }
        });
      } catch (error) {
        logger.error({ error: error }, 'Login error:');
        next(error);
      }
    })(req, res, next);
  }

  // Verify 2FA code
  static async verify2FACode(req: Request, res: Response) {
    const { code, tempToken } = req.body;

    try {
      // Verify the temp token and get user ID
      const decoded = AuthService.verifyTempToken(tempToken);
      if (!decoded || !decoded.userId || !decoded.code) {
        return res.status(400).json({ message: 'Invalid or expired verification request' });
      }

      // Check if it matches the expected code
      if (code !== decoded.code) {
        // --- HIGH FIX: Implement 2FA Brute-Force Rate Limiting ---
        const userForFailed2FA = await db.query.users.findFirst({
          where: eq(users.id, decoded.userId),
          columns: { id: true, failedLoginAttempts: true, email: true }
        });

        if (userForFailed2FA) {
            const newAttempts = (userForFailed2FA.failedLoginAttempts || 0) + 1;
            let update: any = { failedLoginAttempts: newAttempts };

            // Apply Lockout
            if (newAttempts >= MAX_FAILED_ATTEMPTS) {
                update.accountLockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
                logger.warn({ userId: userForFailed2FA.id, email: userForFailed2FA.email, attempts: newAttempts }, 'Account locked due to 2FA brute force.');
            }
            
            await db.update(users).set(update).where(eq(users.id, userForFailed2FA.id));

            // Log failed attempt (FIX: uses sanitized values from extractTracking)
            const { referrer, utm } = extractTracking(req);
            await ActivityTracker.logActivity(
              userForFailed2FA.id,
              'two_factor_verify',
              'failure',
              { method: 'email', referrer, utm },
              req
            );

            if (newAttempts >= MAX_FAILED_ATTEMPTS) {
              return res.status(403).json({ message: 'Account locked due to too many failed 2FA attempts.' });
            }
        }
        
        return res.status(400).json({ message: 'Invalid verification code' });
      }

      // Get user data
      const user = await db.query.users.findFirst({
        where: eq(users.id, decoded.userId),
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // FIX #3: Use consolidated login updates logic for full security and tracking updates (resets failedLoginAttempts)
      const { userWithoutPassword, accessToken, refreshToken } = await AuthController._performLoginUpdates(req, user);

      // Log successful 2FA verification (FIX: uses sanitized values from extractTracking)
      {
        const { referrer, utm } = extractTracking(req);
        await ActivityTracker.logActivity(
          user.id,
          'two_factor_verify',
          'success',
          { method: 'email', referrer, utm },
          req
        );
      }

      // Return tokens and user info (without sensitive data)
      res.json({
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      });
    } catch (error) {
      logger.error({ error: error }, '2FA verification error:');
      res.status(500).json({ message: 'Two-factor authentication failed' });
    }
  }

  // Request password reset
  static async requestPasswordReset(req: Request, res: Response) {
    const { email } = req.body;

    try {
      // Quick email validation (without DNS check for performance)
      const emailValidation = EmailValidator.validateEmailQuick(email);
      if (!emailValidation.isValid) {
        // Still return success to prevent email enumeration
        return res.json({ 
          message: 'If an account with that email exists, a password reset link has been sent.' 
        });
      }

      // Normalize email
      const normalizedEmail = EmailValidator.normalizeEmail(email);

      const user = await db.query.users.findFirst({
        where: eq(users.email, normalizedEmail),
      });

      if (user) {
        // Generate password reset token (returns raw token + tokenHash)
        const { token, tokenHash, expiresAt } = AuthService.generatePasswordResetToken() as any;

        // Save hashed token to user
        await db
          .update(users)
          .set({
            passwordResetToken: tokenHash,
            passwordResetExpires: expiresAt,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        // Send password reset email with raw token
        await AuthService.sendPasswordResetEmail(
          user.email,
          `${user.firstName} ${user.lastName}`.trim() || 'User',
          token
        );
      }

      // Always return success to prevent email enumeration
      res.json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    } catch (error) {
      logger.error({ error }, 'Password reset request error');
      res.status(500).json({ message: 'Failed to process password reset request' });
    }
  }

  // Reset password
  static async resetPassword(req: Request, res: Response) {
    const { token, newPassword } = req.body;

    try {
      // Verify token and get user
      const user = await AuthService.verifyPasswordResetToken(token);
      
      // Hash new password
      const hashedPassword = await AuthService.hashPassword(newPassword);
      
      // Update password and clear reset token
      await db
        .update(users)
        .set({
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
          lastPasswordChange: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // Log password reset (FIX: uses sanitized values from extractTracking)
      {
        const { referrer, utm } = extractTracking(req);
        await ActivityTracker.logActivity(
          user.id,
          'password_reset',
          'success',
          { method: 'email', referrer, utm },
          req
        );
      }

      res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      logger.error({ error }, 'Password reset error');
      res.status(400).json({ message: 'Invalid or expired password reset token' });
    }
  }

  // Get current user
  static async getCurrentUser(req: Request, res: Response) {
    logger.info({ 
      hasUser: !!req.user, 
      userId: req.user?.id,
      isAuthenticated: req.isAuthenticated?.(),
      sessionID: req.sessionID
    }, 'getCurrentUser called');

    if (!req.user) {
      logger.warn({}, 'No user in request object');
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.user.id),
      });

      if (!user) {
        logger.error({ userId: req.user.id }, 'User not found in database');
        return res.status(404).json({ message: 'User not found' });
      }

      logger.info({ userId: user.id, email: user.email }, 'User found successfully');

      // Remove sensitive data
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      logger.error({ error }, 'Get current user error');
      res.status(500).json({ message: 'Failed to fetch user data' });
    }
  }

  // Logout user (revoke refresh token)
  static async logout(req: Request, res: Response) {
    const { refreshToken } = req.body || {};

    // Capture identifying info for potential device revocation
    const currentUserId = req.user?.id as string | undefined;
    const currentUserAgent = (req.headers['user-agent'] || '') as string;
    const currentIp = (req.ip || '') as string;

    // If no refresh token is provided, perform a session-based logout
    if (!refreshToken) {
      try {
        // Attempt to revoke any refresh token stored for this device (userAgent + ip)
        if (currentUserId) {
          try {
            // Proactively remove any ephemeral resumes for this user
            try {
              const { storage } = await import('../storage');
              await storage.deleteEphemeralResumesByUser(currentUserId);
            } catch (cleanupErr) {
              logger.warn({ context: cleanupErr }, 'Failed to cleanup ephemeral resumes during logout:');
            }

            await db
              .update(userDevices)
              .set({ isRevoked: true, updatedAt: new Date() })
              .where(
                and(
                  eq(userDevices.userId, currentUserId),
                  eq(userDevices.userAgent, currentUserAgent),
                  eq(userDevices.ipAddress, currentIp),
                  eq(userDevices.isRevoked, false)
                )
              );

            // Log the revocation (FIX: uses sanitized values from extractTracking)
            try {
              const { referrer, utm } = extractTracking(req);
              if (req.user) {
                await ActivityTracker.logActivity(
                  req.user.id,
                  'logout',
                  'success',
                  { method: 'session', revokedDevice: true, referrer, utm },
                  req
                );
              }
            } catch (logErr) {
              logger.warn({ context: logErr }, 'Failed to log device revocation during logout:');
            }
          } catch (dbErr) {
            // Log the error but don't fail the logout
            logger.error({ context: dbErr }, 'Failed to revoke device record during logout - potential security issue:');
            // Still proceed with logout for user experience
          }
        }

        if (req.session) {
          // Use passport's logout helper and destroy the session
          return new Promise<void>((resolve, reject) => {
            req.logout((logoutErr) => {
              if (logoutErr) {
                logger.error({ error: logoutErr }, 'Passport logout error');
                reject(logoutErr);
                return;
              }
              
              req.session!.destroy((destroyErr) => {
                if (destroyErr) {
                  logger.error({ error: destroyErr }, 'Session destruction error during logout');
                  res.status(500).json({ message: 'Failed to complete logout' });
                  resolve();
                  return;
                }
                
                // Clear the session cookie with the same options used when setting it
                res.clearCookie('sid', {
                  path: '/',
                  httpOnly: true,
                  secure: process.env.NODE_ENV === 'production',
                  sameSite: 'lax',
                  domain: process.env.COOKIE_DOMAIN || undefined,
                });
                // Also clear CSRF token
                res.clearCookie('csrf_token', { path: '/' });
                res.json({ message: 'Logged out successfully' });
                resolve();
              });
            });
          });
        } else {
          res.json({ message: 'Already logged out' });
        }
      } catch (error) {
        logger.error({ error: error }, 'Logout (session) error:');
        return res.status(500).json({ message: 'Failed to log out' });
      }
      return;
    }

    // Otherwise, perform token-based logout (revoke refresh token)
    try {
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
      await db
        .update(userDevices)
        .set({
          isRevoked: true,
          updatedAt: new Date(),
        })
        .where(eq(userDevices.refreshToken, tokenHash));

      // FIX #5: Removed unnecessary clearing of session cookies 
      // res.clearCookie('sid', { ... });
      // res.clearCookie('csrf_token', { path: '/' });

      // Log the logout (FIX: uses sanitized values from extractTracking)
      if (req.user) {
        const { referrer, utm } = extractTracking(req);
        await ActivityTracker.logActivity(
          req.user.id,
          'logout',
          'success',
          { method: 'token', referrer, utm },
          req
        );
      }

      res.json({ message: 'Successfully logged out' });
    } catch (error) {
      logger.error({ error: error }, 'Logout (token) error:');
      res.status(500).json({ message: 'Failed to log out' });
    }
  }

  // Get user devices
  static async getUserDevices(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      const devices = await db.query.userDevices.findMany({
        where: (userDevices, { eq }) => eq(userDevices.userId, req.user!.id),
        orderBy: (userDevices, { desc }) => [desc(userDevices.lastActive)],
      });

      res.json(devices);
    } catch (error) {
      logger.error({ error: error }, 'Get user devices error:');
      res.status(500).json({ message: 'Failed to fetch user devices' });
    }
  }

  // Revoke device
  static async revokeDevice(req: Request, res: Response) {
    const { deviceId } = req.params;

    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      // Verify the device belongs to the user
      const device = await db.query.userDevices.findFirst({
        where: (userDevices, { eq, and }) => 
          and(
            eq(userDevices.id, deviceId),
            eq(userDevices.userId, req.user!.id)
          ),
      });

      if (!device) {
        return res.status(404).json({ message: 'Device not found' });
      }

      // Revoke the device
      await db
        .update(userDevices)
        .set({ 
          isRevoked: true,
          updatedAt: new Date(),
        })
        .where(eq(userDevices.id, deviceId));

      res.json({ message: 'Device access revoked' });
    } catch (error) {
      logger.error({ error: error }, 'Revoke device error:');
      res.status(500).json({ message: 'Failed to revoke device' });
    }
  }

  // Resend email verification
  static async resendVerification(req: Request, res: Response) {
    try {
      const email = String(req.body?.email || '').toLowerCase().trim();
      if (!email || !/.+@.+\..+/.test(email)) {
        return res.status(400).json({ message: 'Invalid email' });
      }

      const user = await db.query.users.findFirst({ 
        where: eq(users.email, email) 
      });

      if (user?.emailVerified) {
        return res.json({ message: 'Email already verified' });
      }

      if (user) {
        const verification = AuthService.generateEmailVerificationToken();
        await db.update(users).set({
          emailVerificationToken: verification.tokenHash,
          emailVerificationExpires: verification.expiresAt,
          updatedAt: new Date(),
        }).where(eq(users.id, user.id));

        const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'User';
        await AuthService.sendVerificationEmail(email, name, verification.token);
      }

      // Always return success to avoid email enumeration
      res.json({ message: 'If an account exists, a verification email has been sent.' });
    } catch (error: any) {
      logger.error({ error: error }, 'Resend verification error:');
      res.status(500).json({ message: 'Failed to resend verification email' });
    }
  }
}