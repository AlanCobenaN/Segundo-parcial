import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class RegistroEliminadoDto {
  @IsString()
  @IsNotEmpty()
  entidad: string;

  @IsNumber()
  @IsNotEmpty()
  registroAfectadoId: number;

  @IsString()
  @IsNotEmpty()
  usuario: string;

  @IsString()
  @IsOptional()
  detalle?: string;
}