import { IsOptional, IsString, IsEnum, IsNumber } from 'class-validator';

export class ConsultarAuditoriaDto {
  @IsOptional()
  @IsString()
  entidad?: string;

  @IsOptional()
  @IsEnum(['CREAR', 'ACTUALIZAR', 'ELIMINAR'])
  accion?: 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR';

  @IsOptional()
  @IsString()
  usuario?: string;

  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @IsOptional()
  @IsString()
  fechaHasta?: string;

  @IsOptional()
  @IsNumber()
  limite?: number;
}