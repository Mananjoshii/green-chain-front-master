export interface VerificationResponse {
  waste_present_in_after: boolean;
  same_location: boolean;
  confidence: number;
  before_description: string;
  after_description: string;
  reasoning: string;
  red_flags: string[];
}

export interface VerificationResult {
  decision: 'confirmed' | 'failed' | 'uncertain';
  confidence: number;
  reasoning: string;
  red_flags: string[];
}

export type VerificationStatus = 'not_started' | 'pending' | 'confirmed' | 'failed' | 'manual_review';
