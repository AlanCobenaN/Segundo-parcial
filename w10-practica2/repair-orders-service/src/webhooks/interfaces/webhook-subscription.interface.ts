export interface WebhookSubscription {
  id: number;
  event_type: string;
  url: string;
  secret: string;
  is_active: boolean;
  retry_config: {
    max_attempts: number;
    backoff_type: 'exponential' | 'linear';
    initial_delay_ms: number;
  };
}

export interface WebhookDeliveryResult {
  subscription_id: number;
  event_id: string;
  attempt_number: number;
  status_code: number | null;
  status: 'success' | 'failed' | 'pending';
  error_message: string | null;
  duration_ms: number;
}