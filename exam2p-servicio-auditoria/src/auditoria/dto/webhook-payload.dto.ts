export class WebhookPayloadDto {
  evento: string;
  fechaHora: Date;
  datos: {
    registroId: number;
    entidad: string;
    registroAfectadoId: number;
    usuario: string;
    detalle: string;
  };
}