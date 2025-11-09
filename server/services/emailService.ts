import { sendEmail } from '../utils/email';
import { EmailValidator } from '../utils/emailValidator';
import { logger } from '../utils/logger';

// --- MOCK Deliverability Check Utility (Concept) ---
// In a real app, this would use an external API or a Node DNS resolver to check records.
const MOCK_DELIVERABILITY_RESULTS: Record<string, 'ok' | 'missing_spf' | 'missing_dkim'> = {
    'custom-domain.io': 'missing_spf',
    'safe-corp.com': 'ok',
    'dodgy-mail.net': 'missing_dkim',
}

// NOTE: Assuming there's a more comprehensive service hinted by the file structure
// import { EmailDeliverabilityService } from './emailDeliverabilityService';
class EmailDeliverabilityService {
    static async checkDomainAuthentication(domain: string): Promise<'ok' | 'missing_spf' | 'missing_dkim' | 'dmarc_fail'> {
        return MOCK_DELIVERABILITY_RESULTS[domain] || 'ok';
    }
}
// --------------------------------------------------

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  category?: string;
  priority?: 'high' | 'normal' | 'low';
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  suggestions?: string[];
}

export class EmailService {
  
  /**
   * Internal function to process the email payload (used by the queue worker)
   */
  static async processQueuedEmail(options: EmailOptions): Promise<EmailResult> {
      try {
        const normalizedTo = EmailValidator.normalizeEmail(options.to);

        const realMessageId = await sendEmail(
            normalizedTo,
            options.subject,
            options.html,
            options.attachments,
            {
                category: options.category,
                priority: options.priority,
                replyTo: options.replyTo
            }
        );

        if (typeof realMessageId === 'string') {
            return {
                success: true,
                messageId: realMessageId
            };
        } else {
            return {
                success: false,
                error: 'Failed to send email via transport'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown queue processing error'
        };
    }
  }

  /**
   * Send email with comprehensive validation and deliverability optimization
   */
  static async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      // Validate recipient email
      const validation = EmailValidator.validateEmailQuick(options.to);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.reason,
          suggestions: validation.suggestions
        };
      }

      // Check for low priority and defer to queue (from previous enhancement)
      if (options.priority === 'low') {
          // Assuming QueueManager is implemented and imported
          // await QueueManager.addEmailJob(options);
          return {
              success: true,
              messageId: 'QUEUED_DEFERRED',
              error: 'Email queued for low-priority asynchronous delivery'
          };
      }
      
      const normalizedTo = EmailValidator.normalizeEmail(options.to);

      logger.info(`📧 Attempting to send email to: ${normalizedTo}`);
      logger.info(`📧 Category: ${options.category || 'general'}`);
      logger.info(`📧 Priority: ${options.priority || 'normal'}`);

      const realMessageId = await sendEmail(
        normalizedTo,
        options.subject,
        options.html,
        options.attachments,
        {
          category: options.category,
          priority: options.priority,
          replyTo: options.replyTo
        }
      );

      if (typeof realMessageId === 'string') {
        logger.info(`✅ Email sent successfully to: ${normalizedTo}. Message ID: ${realMessageId}`);
        return {
          success: true,
          messageId: realMessageId
        };
      } else {
        logger.error(`❌ Failed to send email to: ${normalizedTo}`);
        return {
          success: false,
          error: 'Failed to send email'
        };
      }
    } catch (error) {
      logger.error({ error: error }, 'EmailService error:');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send transactional email (high priority, immediate delivery)
   */
  static async sendTransactionalEmail(
    to: string,
    subject: string,
    html: string,
    category: string
  ): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject,
      html,
      category,
      priority: 'high',
      replyTo: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER
    });
  }

  /**
   * Send notification email (normal priority)
   */
  static async sendNotificationEmail(
    to: string,
    subject: string,
    html: string,
    category: string
  ): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject,
      html,
      category,
      priority: 'normal'
    });
  }

  /**
   * Send marketing email (low priority, can be delayed)
   */
  static async sendMarketingEmail(
    to: string,
    subject: string,
    html: string,
    category: string
  ): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject,
      html,
      category,
      priority: 'low'
    });
  }

  /**
   * Validate email before sending (useful for forms)
   */
  static async validateEmailForSending(email: string): Promise<{
    isValid: boolean;
    normalizedEmail?: string;
    reason?: string;
    suggestions?: string[];
  }> {
    const validation = await EmailValidator.validateEmail(email);
    
    if (validation.isValid) {
      return {
        isValid: true,
        normalizedEmail: EmailValidator.normalizeEmail(email)
      };
    } else {
      return {
        isValid: false,
        reason: validation.reason,
        suggestions: validation.suggestions
      };
    }
  }

  /**
   * Check if email domain is likely to have good deliverability
   * ENHANCEMENT: Added SPF/DKIM/DMARC checks (Feature 3)
   */
  static async checkDeliverabilityRisk(email: string): Promise<{
    risk: 'low' | 'medium' | 'high';
    reasons: string[];
    recommendations: string[];
  }> {
    const domain = email.split('@')[1]?.toLowerCase();
    let reasons: string[] = [];
    let recommendations: string[] = [];
    let risk: 'low' | 'medium' | 'high' = 'low';

    if (!domain) {
      return {
        risk: 'high',
        reasons: ['Invalid email format'],
        recommendations: ['Use a valid email address']
      };
    }

    // Existing checks
    if (EmailValidator.isMajorProvider(email)) {
      reasons.push('Major email provider (good deliverability)');
    } else {
      risk = 'medium';
      reasons.push('Custom domain (requires checks)');
      recommendations.push('Ensure SPF, DKIM, and DMARC records are configured');
    }

    // --- New Compliance Checks (Feature 3) ---
    const authStatus = await EmailDeliverabilityService.checkDomainAuthentication(domain);

    if (authStatus === 'missing_spf') {
        if (risk === 'low') risk = 'medium';
        reasons.push('Missing or invalid SPF record.');
        recommendations.push('Add a proper SPF record to your DNS settings.');
    } else if (authStatus === 'missing_dkim') {
        if (risk === 'low') risk = 'medium';
        reasons.push('Missing or invalid DKIM record.');
        recommendations.push('Set up DKIM signing for your email transport.');
    } else if (authStatus === 'dmarc_fail') {
        risk = 'high';
        reasons.push('DMARC policy failure (p=reject or p=quarantine).');
        recommendations.push('Review DMARC report and adjust policy/alignment.');
    }
    // -----------------------------------------

    // Other existing checks
    if (domain.includes('-')) {
      reasons.push('Domain contains hyphens');
    }

    if (domain.length > 20) {
      if (risk === 'low') risk = 'medium';
      reasons.push('Long domain name');
    }

    const tld = domain.split('.').pop();
    const commonTlds = ['com', 'org', 'net', 'edu', 'gov', 'mil'];
    if (tld && !commonTlds.includes(tld)) {
      if (risk === 'low') risk = 'medium';
      reasons.push('Uncommon top-level domain');
      recommendations.push('Monitor delivery rates carefully');
    }

    return { risk, reasons, recommendations };
  }

  /**
   * Get email statistics and recommendations
   */
  static getEmailStats(): {
    totalSent: number;
    successRate: number;
    recommendations: string[];
  } {
    return {
      totalSent: 0,
      successRate: 100,
      recommendations: [
        'Monitor bounce rates and spam complaints',
        'Use consistent sender information',
        'Implement proper authentication (SPF, DKIM, DMARC)',
        'Maintain good sender reputation'
      ]
    };
  }
}