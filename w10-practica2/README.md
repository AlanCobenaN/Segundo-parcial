# 🔧 Sistema de Gestión de Reparaciones - Arquitectura de Microservicios

Sistema distribuido de gestión de órdenes de reparación implementado con arquitectura de microservicios, orquestación de sagas con Temporal.io, webhooks seguros y estrategias de resiliencia.

## 📋 Tabla de Contenidos

- [Arquitectura General](#-arquitectura-general)
- [Microservicios](#-microservicios)
- [Stack Tecnológico](#-stack-tecnológico)
- [Características Principales](#-características-principales)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Uso](#-uso)
- [Webhooks](#-webhooks)
- [Resiliencia](#-resiliencia)
- [Base de Datos](#-base-de-datos)

---

## 🔌 Microservicios

### 1. **Gateway Service** (Puerto: 3000)
**Responsabilidad:** API Gateway - Punto de entrada HTTP único para clientes

**Endpoints:**
- `POST /repair-orders` - Crear orden de reparación
- `GET /repair-orders` - Listar todas las órdenes
- `GET /repair-orders/:id` - Obtener orden específica
- `PATCH /repair-orders/:id` - Actualizar orden
- `POST /repair-orders/:id/finish` - Finalizar reparación
- `DELETE /repair-orders/:id` - Eliminar orden

**Tecnologías:**
- NestJS 11
- RabbitMQ Client (CloudAMQP)
- RESTful API

---

### 2. **Repair Orders Service** (Microservicio)
**Responsabilidad:** Gestión de órdenes, orquestación SAGA, webhooks

**Características:**
- ✅ **Patrón SAGA** con Temporal.io para transacciones distribuidas
- ✅ **Webhook Publisher** con HMAC-SHA256
- ✅ **Idempotent Consumer** (deduplicación de mensajes)
- ✅ **Retry con Exponential Backoff**
- ✅ **Persistencia de delivery logs** en Supabase

**Componentes:**
- **SAGA Workflow**: Orquesta creación de órdenes (3 pasos)
  1. Verificar disponibilidad de equipo
  2. Reservar equipo (cambiar estado a IN_REPAIR)
  3. Crear orden en base de datos
- **Webhooks Service**: Publica eventos a suscriptores externos
- **Idempotency Service**: Previene procesamiento duplicado
- **Temporal Worker**: Ejecuta workflows

**Base de datos:** SQLite local (`orders.sqlite`)

**Tecnologías:**
- NestJS 11
- Temporal.io Client & Worker
- TypeORM + SQLite
- @supabase/supabase-js
- RabbitMQ Consumer

---

### 3. **Equipments Service** (Microservicio)
**Responsabilidad:** Gestión de inventario de equipos

**Funcionalidades:**
- CRUD de equipos
- Control de disponibilidad
- Estados: `AVAILABLE`, `IN_REPAIR`, `OUT_OF_SERVICE`
- Seed automático con datos de ejemplo

**Endpoints (RabbitMQ):**
- `equipment.find.all` - Listar equipos
- `equipment.find.one` - Obtener equipo
- `equipment.check.availability` - Verificar disponibilidad
- `equipment.reserve` - Reservar equipo
- `equipment.release` - Liberar equipo

**Base de datos:** SQLite local (`equipments.sqlite`)

**Tecnologías:**
- NestJS 11
- TypeORM + SQLite
- RabbitMQ Consumer

---

### 4. **Supabase Edge Functions** (Serverless)
**Responsabilidad:** Procesamiento de webhooks y notificaciones externas

#### **webhook-event-logger**
- Valida firma HMAC-SHA256
- Verifica timestamp (previene replay attacks)
- Deduplicación por `idempotency_key`
- Almacena eventos en tabla `webhook_events`

#### **webhook-external-notifier**
- Valida firma HMAC y timestamp
- Envía notificaciones a Telegram
- Formatea mensajes con HTML
- Registra logs en tabla `notification_logs`

**Tecnologías:**
- Deno Runtime
- Supabase Functions
- Telegram Bot API
- PostgreSQL (Supabase)

---

## 🛠️ Stack Tecnológico

### Backend
- **Framework:** NestJS 11.0
- **Lenguaje:** TypeScript 5.7
- **Message Broker:** RabbitMQ (CloudAMQP)
- **Orquestación:** Temporal.io 1.13
- **ORM:** TypeORM 0.3
- **HTTP Client:** Axios (vía @nestjs/axios)

### Bases de Datos
- **Local:** SQLite (desarrollo)
- **Nube:** PostgreSQL (Supabase)
- **Temporal:** PostgreSQL (Docker)

### Infraestructura
- **Contenedores:** Docker Compose
- **Serverless:** Supabase Edge Functions (Deno)
- **Cloud Queue:** CloudAMQP (RabbitMQ as a Service)

### Seguridad
- **Firma de Webhooks:** HMAC-SHA256
- **Timestamp Validation:** Anti-replay attacks (TTL 5 min)
- **Idempotencia:** Deduplicación de mensajes (TTL 7 días)

### Notificaciones
- **Telegram Bot API:** Mensajes formateados en HTML

---

## ✨ Características Principales

### 🔄 Patrón SAGA con Temporal.io
Garantiza consistencia de transacciones distribuidas:
```typescript
SAGA Steps:
1. Verificar disponibilidad → Compensación: N/A
2. Reservar equipo → Compensación: Liberar equipo
3. Crear orden → Compensación: Eliminar orden
```

### 📡 Sistema de Webhooks Seguro
**Publicación:**
- Payload estándar con versionado
- Firma HMAC-SHA256 en header `X-Webhook-Signature`
- Timestamp en header `X-Webhook-Timestamp`
- Retry con exponential backoff (6 intentos, 60s inicial)
- Persistencia de delivery logs

**Consumo (Edge Functions):**
- Validación de firma criptográfica
- Validación de timestamp (±5 min)
- Deduplicación por `idempotency_key`
- Almacenamiento de eventos
- Notificaciones externas (Telegram)

### 🛡️ Resiliencia - Idempotent Consumer
Previene duplicación de mensajes en RabbitMQ (At-least-once delivery):

```typescript
1. Generar idempotency_key = hash(action + entity_id + data)
2. Verificar si ya fue procesado en BD
3. Si existe → Retornar resultado guardado (sin reprocesar)
4. Si no existe → Procesar + Guardar resultado
```

**Estrategia:**
- Almacenamiento en tabla `processed_messages` (Supabase)
- TTL de 7 días para claves antiguas
- Hash MD5 de datos adicionales para claves únicas

### 📊 Persistencia de Delivery Logs
Cada intento de entrega de webhook se registra:
- `subscription_id`: ID del suscriptor
- `event_id`: ID único del evento
- `attempt_number`: Número de intento (1-6)
- `status`: 'success' | 'failed'
- `status_code`: HTTP status code
- `error_message`: Mensaje de error (si aplica)
- `duration_ms`: Tiempo de respuesta
- `delivered_at`: Timestamp de entrega

---

## 📦 Instalación

### Prerequisitos
- Node.js 18+
- Docker & Docker Compose
- NPM o Yarn
- Cuenta Supabase (gratuita)
- Cuenta CloudAMQP (gratuita)
- Telegram Bot Token (opcional)

### 1. Clonar repositorio
```bash
git clone <repository-url>
cd w9-micro-practica2
```

### 2. Instalar dependencias
```bash
# Gateway
cd gateway-service
npm install

# Repair Orders
cd ../repair-orders-service
npm install

# Equipments
cd ../equipments-service
npm install
```

### 3. Levantar infraestructura
```bash
# Desde la raíz del proyecto
docker-compose up -d
```

Esto iniciará:
- PostgreSQL (puerto 5432)
- Temporal Server (puerto 7233)
- Temporal UI (puerto 8080)

### 4. Verificar Temporal UI
Abre http://localhost:8080 para ver la interfaz de Temporal

---

## ⚙️ Configuración

### Repair Orders Service
Crear archivo `repair-orders-service/.env`:
```env
# RabbitMQ (CloudAMQP)
RABBITMQ_URL=amqps://user:password@host.rmq.cloudamqp.com/vhost

# Base de datos local
DATABASE_NAME=orders.sqlite
QUEUE_NAME=repair_orders_queue

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Equipments Service
Crear archivo `equipments-service/.env`:
```env
# RabbitMQ (CloudAMQP)
RABBITMQ_URL=amqps://user:password@host.rmq.cloudamqp.com/vhost

# Base de datos local
DATABASE_NAME=equipments.sqlite
QUEUE_NAME=equipments_queue
```

### Gateway Service
Crear archivo `gateway-service/.env`:
```env
# RabbitMQ (CloudAMQP)
RABBITMQ_URL=amqps://user:password@host.rmq.cloudamqp.com/vhost

# Puerto del servidor
PORT=3000
```

### Supabase Edge Functions
Configurar variables de entorno en Supabase Dashboard:

**webhook-event-logger:**
```env
WEBHOOK_SECRET=tu-secret-compartido-12345
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**webhook-external-notifier:**
```env
WEBHOOK_SECRET=tu-secret-compartido-12345
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TELEGRAM_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=-1001234567890
```

---

## 🚀 Uso

### Iniciar servicios

**Terminal 1 - Equipments Service:**
```bash
cd equipments-service
npm run start:dev
```

**Terminal 2 - Repair Orders Service:**
```bash
cd repair-orders-service
npm run start:dev
```

**Terminal 3 - Gateway:**
```bash
cd gateway-service
npm run start:dev
```

### Crear orden de reparación

```bash
POST http://localhost:3000/repair-orders
Content-Type: application/json

{
  "equipmentId": "uuid-del-equipo",
  "technicianId": "uuid-del-tecnico",
  "problemDescription": "Pantalla rota",
  "estimatedCost": 150.50
}
```

**Flujo:**
1. Gateway recibe HTTP POST
2. Publica mensaje a RabbitMQ (`repair_order.create`)
3. Repair Orders Service consume mensaje
4. Verifica idempotencia (duplicación)
5. Inicia SAGA con Temporal:
   - Verifica disponibilidad de equipo
   - Reserva equipo (IN_REPAIR)
   - Crea orden en BD
6. Publica webhook `repair_order.created`
7. Edge Function valida y registra evento
8. Telegram recibe notificación

### Finalizar reparación

```bash
POST http://localhost:3000/repair-orders/{orderId}/finish
```

**Flujo:**
1. Actualiza orden a estado DELIVERED
2. Libera equipo (AVAILABLE)
3. Publica webhook `repair_order.completed`
4. Notificación a Telegram

---

## 🔔 Webhooks

### Formato de Payload

```json
{
  "event": "repair_order.created",
  "version": "1.0",
  "id": "uuid-evento",
  "idempotency_key": "repair_order.created-orderId-2025-12-15",
  "timestamp": "2025-12-15T10:30:00.000Z",
  "data": {
    "order_id": "uuid-orden",
    "equipment_id": "uuid-equipo",
    "technician_id": "uuid-tecnico",
    "issue_description": "Pantalla rota",
    "status": "IN_REVIEW",
    "estimated_cost": 150.50,
    "created_at": "2025-12-15T10:30:00.000Z"
  },
  "metadata": {
    "source": "repair-orders-service",
    "environment": "development",
    "correlation_id": "order-uuid"
  }
}
```

### Headers de Seguridad

```
X-Webhook-Signature: sha256=abc123def456...
X-Webhook-Timestamp: 1734267000
X-Event-Type: repair_order.created
X-Event-Id: uuid-evento
Authorization: Bearer <supabase-service-role-key>
```

### Validación de Firma

```typescript
// Generar firma esperada
const hmac = crypto.createHmac('sha256', secret);
hmac.update(JSON.stringify(payload));
const expectedSignature = `sha256=${hmac.digest('hex')}`;

// Comparar con firma recibida
if (expectedSignature === receivedSignature) {
  // ✅ Válido
}
```

### Suscribirse a Webhooks

Insertar en tabla `webhook_subscriptions` (Supabase):

```sql
INSERT INTO webhook_subscriptions (event_type, url, secret, is_active)
VALUES (
  'repair_order.created',
  'https://xxxxx.supabase.co/functions/v1/webhook-event-logger',
  'tu-secret-compartido-12345',
  true
);
```

---

## 🛡️ Resiliencia

### Idempotent Consumer

**Problema:** RabbitMQ garantiza "At-least-once delivery", no "Exactly-once"

**Solución:** Deduplicación con idempotency keys

**Implementación:**
```typescript
// 1. Generar clave única
const key = `create_order-${equipmentId}-${hash(data)}`;

// 2. Verificar si ya fue procesado
const existing = await checkProcessed(key);
if (existing) {
  return existing; // Sin reprocesar
}

// 3. Procesar
const result = await processOrder(data);

// 4. Guardar clave + resultado
await markAsProcessed(key, result);
```

**Tabla Supabase:**
```sql
CREATE TABLE processed_messages (
  id SERIAL PRIMARY KEY,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  result JSONB NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL -- TTL 7 días
);
```

### Retry con Exponential Backoff

**Configuración:**
- Intentos máximos: 6
- Delay inicial: 60 segundos
- Multiplicador: 2x
- Delays: 1min → 2min → 4min → 8min → 16min → 32min

**Logs de delivery:**
```
Attempt 1: Failed (500) - Retrying in 60s
Attempt 2: Failed (503) - Retrying in 120s
Attempt 3: Success (200) - Delivered in 1250ms
```

---

## 💾 Base de Datos

### Supabase (PostgreSQL)

#### webhook_subscriptions
```sql
CREATE TABLE webhook_subscriptions (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  retry_config JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### webhook_events
```sql
CREATE TABLE webhook_events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB,
  received_at TIMESTAMP NOT NULL,
  processed_at TIMESTAMP NOT NULL
);
```

#### webhook_deliveries
```sql
CREATE TABLE webhook_deliveries (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER REFERENCES webhook_subscriptions(id),
  event_id VARCHAR(255) REFERENCES webhook_events(event_id),
  attempt_number INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  status_code INTEGER,
  error_message TEXT,
  duration_ms INTEGER,
  delivered_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### processed_messages
```sql
CREATE TABLE processed_messages (
  id SERIAL PRIMARY KEY,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  result JSONB NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_idempotency_key ON processed_messages(idempotency_key);
CREATE INDEX idx_expires_at ON processed_messages(expires_at);
```

#### notification_logs
```sql
CREATE TABLE notification_logs (
  id SERIAL PRIMARY KEY,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  telegram_message_id BIGINT,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### SQLite Local

#### repair_order (orders.sqlite)
- id (UUID)
- equipmentId (UUID)
- technicianId (UUID)
- problemDescription (TEXT)
- estimatedCost (DECIMAL)
- status (ENUM: IN_REVIEW, IN_PROGRESS, DELIVERED, CANCELLED, FAILED)
- createdAt (TIMESTAMP)
- updatedAt (TIMESTAMP)

#### equipment (equipments.sqlite)
- id (UUID)
- name (VARCHAR)
- type (VARCHAR)
- status (ENUM: AVAILABLE, IN_REPAIR, OUT_OF_SERVICE)
- purchaseDate (DATE)
- assignedTo (VARCHAR)
- createdAt (TIMESTAMP)
- updatedAt (TIMESTAMP)

---

## 📝 Licencia

UNLICENSED - Proyecto educativo

---

## 👨‍💻 Autor

Pedro Alay Práctica 2 - Semana 9 - Microservicios + Serverless

---

## 🔗 Enlaces Útiles

- [NestJS Docs](https://docs.nestjs.com/)
- [Temporal.io Docs](https://docs.temporal.io/)
- [Supabase Docs](https://supabase.com/docs)
- [RabbitMQ Tutorials](https://www.rabbitmq.com/tutorials)
- [TypeORM Docs](https://typeorm.io/)
