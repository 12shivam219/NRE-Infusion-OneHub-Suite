import { logger } from './logger'; // Static import for logger

/**
 * Input Sanitization Utilities
 * Prevents XSS, SQL injection, and other malicious input
 */

/**
 * Sanitize HTML content to prevent XSS attacks
 * WARNING: Custom regex is highly prone to bypasses for XSS. 
 * For production environments allowing rich text, strongly prefer a well-maintained library (e.g., DOMPurify).
 */
export function sanitizeHTML(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    // Remove script content (often missed by simple tag stripping)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove all HTML tags (simplistic catch-all)
    .replace(/<[^>]*>/g, '')
    // Remove event handlers (e.g., onerror, onload)
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove data: protocol (can be used for XSS)
    .replace(/data:text\/html/gi, '')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize plain text input
 * Removes control characters and normalizes whitespace
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove other control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  
  return email
    .toLowerCase()
    .trim()
    // Remove any characters that aren't valid in email addresses
    .replace(/[^a-z0-9@._+-]/g, '');
}

/**
 * Sanitize phone number
 * Keeps only digits, spaces, parentheses, hyphens, and plus sign
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') return '';
  
  return phone
    .trim()
    // Keep only valid phone characters
    .replace(/[^0-9()\s+-]/g, '');
}

/**
 * Sanitize URL
 */
export function sanitizeURL(url: string): string {
  if (typeof url !== 'string' || !url) return '';
  
  try {
    // Basic prefix check before full parse attempt
    if (!url.toLowerCase().startsWith('http')) {
        url = `https://${url}`;
    }
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    
    return parsed.toString();
  } catch {
    // Invalid URL
    return '';
  }
}

/**
 * Sanitize SSN
 * Removes all non-digit characters
 */
export function sanitizeSSN(ssn: string): string {
  if (typeof ssn !== 'string') return '';
  
  // Keep only digits
  const digits = ssn.replace(/\D/g, '');
  
  // Format as XXX-XX-XXXX if 9 digits
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
  }
  
  return digits;
}

/**
 * Sanitize date input
 */
export function sanitizeDate(date: string | Date | undefined | null): string | null {
  if (!date) return null;
  
  try {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  } catch {
    return null;
  }
}

/**
 * Sanitize integer
 */
export function sanitizeInteger(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const num = parseInt(String(value), 10);
  if (isNaN(num)) {
    return null;
  }
  
  return num;
}

// FIX: Removed unsafe generic sanitizeObject and inferType helper functions.

/**
 * FIX: Comprehensive sanitization of consultant data for ALL fields.
 */
export function sanitizeConsultantData(data: any): any {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid consultant data object');
  }
  
  const sanitized: any = {};
  
  try {
    sanitized.status = sanitizeText(data.status);
    sanitized.name = sanitizeText(data.name);
    sanitized.visaStatus = sanitizeText(data.visaStatus);
    sanitized.dateOfBirth = sanitizeDate(data.dateOfBirth);
    sanitized.address = sanitizeText(data.address);
    sanitized.email = sanitizeEmail(data.email);
    sanitized.phone = sanitizePhone(data.phone);
    sanitized.timezone = sanitizeText(data.timezone);
    sanitized.degreeName = sanitizeText(data.degreeName);
    sanitized.university = sanitizeText(data.university);
    sanitized.yearOfPassing = sanitizeText(data.yearOfPassing);
    sanitized.ssn = sanitizeSSN(data.ssn);
    sanitized.howDidYouGetVisa = sanitizeText(data.howDidYouGetVisa);
    sanitized.yearCameToUS = sanitizeText(data.yearCameToUS);
    sanitized.countryOfOrigin = sanitizeText(data.countryOfOrigin);
    sanitized.whyLookingForNewJob = sanitizeText(data.whyLookingForNewJob);
    
    // Non-content fields (IDs, etc.) - assume string IDs are safe for simple trimming/text sanitization if passed
    if (data.displayId) sanitized.displayId = sanitizeText(data.displayId);
    if (data.createdBy) sanitized.createdBy = sanitizeText(data.createdBy);

    return sanitized;
  } catch (error) {
    logger.error({ error, data }, 'Error sanitizing consultant data');
    throw new Error('Failed to sanitize consultant data: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * FIX: Comprehensive sanitization of requirement data for ALL fields.
 */
export function sanitizeRequirementData(data: any): any {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid requirement data object');
  }
    
  const sanitized: any = {};
  
  try {
    // Mandatory fields
    sanitized.consultantId = sanitizeText(data.consultantId);
    sanitized.jobTitle = sanitizeText(data.jobTitle);
    sanitized.appliedFor = sanitizeText(data.appliedFor);
    sanitized.completeJobDescription = sanitizeText(data.completeJobDescription); // FIX: Should use sanitizeText for job desc, or sanitizeHTML if rich text is permitted

    // Optional fields
    sanitized.status = sanitizeText(data.status);
    sanitized.nextStep = sanitizeText(data.nextStep);
    sanitized.rate = sanitizeText(data.rate);
    sanitized.remote = sanitizeText(data.remote);
    sanitized.duration = sanitizeText(data.duration);
    
    // Website/Email/Company fields
    sanitized.clientCompany = sanitizeText(data.clientCompany);
    sanitized.impName = sanitizeText(data.impName);
    sanitized.clientWebsite = sanitizeURL(data.clientWebsite);
    sanitized.impWebsite = sanitizeURL(data.impWebsite);
    sanitized.vendorCompany = sanitizeText(data.vendorCompany);
    sanitized.vendorWebsite = sanitizeURL(data.vendorWebsite);
    sanitized.vendorPersonName = sanitizeText(data.vendorPersonName);
    sanitized.vendorPhone = sanitizePhone(data.vendorPhone);
    sanitized.vendorEmail = sanitizeEmail(data.vendorEmail);
    sanitized.primaryTechStack = sanitizeText(data.primaryTechStack);
    
    // Date/Time fields
    sanitized.gotRequirement = sanitizeDate(data.gotRequirement);
    
    // Non-content fields
    if (data.displayId) sanitized.displayId = sanitizeText(data.displayId);
    if (data.createdBy) sanitized.createdBy = sanitizeText(data.createdBy);

    // Marketing Comments (if object/array, needs recursive sanitization)
    if (Array.isArray(data.marketingComments)) {
      sanitized.marketingComments = data.marketingComments.map((comment: any) => ({
        ...comment,
        comment: sanitizeText(comment.comment),
        userId: sanitizeText(comment.userId),
        // timestamp is assumed safe if generated server-side or sanitized as date
      }));
    } else if (data.marketingComments) {
      // Set to an empty array if invalid format to be safe
      sanitized.marketingComments = [];
    }

    return sanitized;
  } catch (error) {
    logger.error({ error, data }, 'Error sanitizing requirement data');
    throw new Error('Failed to sanitize requirement data: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * FIX: Comprehensive sanitization of interview data for ALL fields.
 */
export function sanitizeInterviewData(data: any): any {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid interview data object');
  }
  
  const sanitized: any = {};

  try {
    // Mandatory fields
    sanitized.requirementId = sanitizeText(data.requirementId);
    sanitized.consultantId = sanitizeText(data.consultantId);
    sanitized.interviewDate = sanitizeDate(data.interviewDate);
    sanitized.interviewTime = sanitizeText(data.interviewTime);

    // Optional fields
    sanitized.timezone = sanitizeText(data.timezone || 'EST');
    sanitized.interviewType = sanitizeText(data.interviewType);
    sanitized.status = sanitizeText(data.status || 'Confirmed');
    sanitized.marketingPersonId = sanitizeText(data.marketingPersonId);
    sanitized.vendorCompany = sanitizeText(data.vendorCompany);
    sanitized.interviewWith = sanitizeText(data.interviewWith);
    sanitized.result = sanitizeText(data.result);
    sanitized.round = sanitizeText(data.round);
    sanitized.mode = sanitizeText(data.mode);
    sanitized.meetingType = sanitizeText(data.meetingType);
    sanitized.duration = sanitizeText(data.duration);
    sanitized.subjectLine = sanitizeText(data.subjectLine);
    sanitized.interviewer = sanitizeText(data.interviewer);
    sanitized.interviewLink = sanitizeURL(data.interviewLink);
    sanitized.interviewFocus = sanitizeText(data.interviewFocus);
    sanitized.specialNote = sanitizeText(data.specialNote);
    sanitized.jobDescription = sanitizeText(data.jobDescription); // Should use sanitizeText/HTML based on storage format
    sanitized.feedbackNotes = sanitizeText(data.feedbackNotes);
    
    // Non-content fields
    if (data.displayId) sanitized.displayId = sanitizeText(data.displayId);
    if (data.createdBy) sanitized.createdBy = sanitizeText(data.createdBy);
    
    return sanitized;
  } catch (error) {
    logger.error({ error, data }, 'Error sanitizing interview data');
    throw new Error('Failed to sanitize interview data: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}