import { db } from '../db';
import { requirements } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function generateRequirementDisplayId(): Promise<string> {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `REQ-${year}${month}`;

    // Get the latest requirement ID for this month
    const [result] = await db
      .select({ 
        maxId: sql<string>`max(display_id)` 
      })
      .from(requirements)
      .where(
        and(
          sql`display_id like ${prefix + '-%'}`
        )
      );

    let sequence = 1;
    if (result.maxId) {
      // Extract the sequence number from the latest ID
      const lastSequence = parseInt(result.maxId.split('-')[2]);
      sequence = lastSequence + 1;
    }

    // Generate new ID with padded sequence number
    const newId = `${prefix}-${sequence.toString().padStart(4, '0')}`;
    return newId;

  } catch (error) {
    console.error('Error generating requirement ID:', error);
    throw new Error('Failed to generate requirement ID');
  }
}

// Function to validate requirement ID format
export function validateRequirementId(id: string): boolean {
  const pattern = /^REQ-\d{6}-\d{4}$/;
  return pattern.test(id);
}

// Function to get the next sequence for a specific year/month
export async function getNextSequence(year: number, month: number): Promise<number> {
  const prefix = `REQ-${year}${month.toString().padStart(2, '0')}`;
  
  const [result] = await db
    .select({
      maxSequence: sql<number>`COALESCE(MAX(CAST(SUBSTRING(display_id FROM 12) AS INTEGER)), 0)`
    })
    .from(requirements)
    .where(sql`display_id LIKE ${prefix + '-%'}`);

  return (result.maxSequence || 0) + 1;
}