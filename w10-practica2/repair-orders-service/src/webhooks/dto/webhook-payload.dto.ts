export class WebhookPayloadDto<T = any> {
  event: string;
  version: string;
  id: string;
  idempotency_key: string;
  timestamp: string;
  data: T;
  metadata: WebhookMetadataDto & Record<string, unknown>;
}

export class WebhookMetadataDto {
  source: string;
  environment: string;
  correlation_id: string;
}

// Payload específico para repair_order.created
export class RepairOrderCreatedDataDto {
  order_id: string;
  equipment_id: string;
  technician_id: string;
  issue_description: string;
  status: string;
  estimated_cost?: number;
  created_at: string;
}

// Payload específico para repair_order.completed
export class RepairOrderCompletedDataDto {
  order_id: string;
  equipment_id: string;
  technician_id: string;
  completed_at: string;
  status: string;
}