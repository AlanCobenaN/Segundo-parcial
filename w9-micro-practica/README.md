# 🛠️ Sistema de Gestión de Reparación de Equipos

Sistema de microservicios para gestionar equipos tecnológicos y sus órdenes de reparación, implementando el patrón Saga Orquestada con Temporal.io para garantizar consistencia en transacciones distribuidas.

## 📋 Tabla de Contenido

- [Descripción](#-descripción)
- [Arquitectura](#-arquitectura)
- [Tecnologías](#-tecnologías)
- [Microservicios](#-microservicios)
- [Patrones Implementados](#-patrones-implementados)
- [Configuración](#-configuración)
- [Instalación](#-instalación)
- [Endpoints API](#-endpoints-api)
- [Temporal.io y Saga](#-temporalio-y-saga)
- [Pruebas](#-pruebas)

---

## 🎯 Descripción

Este sistema permite:

- ✅ Registrar y gestionar equipos (laptops, impresoras, servidores, tablets, etc.)
- ✅ Crear órdenes de reparación con validación automática de disponibilidad
- ✅ Transacciones distribuidas con **compensación automática** si algo falla
- ✅ Comunicación asíncrona mediante **RabbitMQ**
- ✅ Persistencia de estado y reintentos con **Temporal.io**
- ✅ Combinación de datos de múltiples servicios en el Gateway

### Caso de Uso Principal

Un técnico intenta crear una orden de reparación para un equipo. El sistema:
1. Verifica que el equipo esté disponible
2. Lo reserva marcándolo como "EN REPARACIÓN"
3. Crea la orden en la base de datos
4. **Si algo falla, deshace automáticamente todos los cambios** (rollback distribuido)

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────┐
│         CLIENTE (Postman/Frontend)              │
└────────────────────┬────────────────────────────┘
                     │ HTTP REST
                     ↓
┌─────────────────────────────────────────────────┐
│        GATEWAY SERVICE (Puerto 3000)            │
│  - API REST pública                             │
│  - Enrutamiento                                 │
│  - Combinación de datos                         │
└──────────┬──────────────────────┬───────────────┘
           │ RabbitMQ             │ RabbitMQ
           ↓                      ↓
┌────────────────────┐   ┌───────────────────────┐
│ EQUIPMENTS SERVICE │   │ REPAIR-ORDERS SERVICE │
│                    │   │                       │
│ - CRUD equipos     │←──│ - CRUD órdenes        │
│ - Estados          │   │ - Saga Temporal       │
│ - Validaciones     │   │ - Compensación        │
│                    │   │                       │
│ SQLite             │   │ SQLite                │
└────────────────────┘   └───────┬───────────────┘
                                 │ gRPC
                                 ↓
                 ┌───────────────────────────────┐
                 │  TEMPORAL SERVER (7233/8080)  │
                 │  - Orquestación workflows     │
                 │  - Persistencia estado        │
                 │  - Reintentos automáticos     │
                 │                               │
                 │  PostgreSQL                   │
                 └───────────────────────────────┘
```

### Infraestructura

- **RabbitMQ Cloud** (CloudAMQP): Cola de mensajes persistente
- **Temporal Docker**: PostgreSQL + Servidor Temporal + UI Web
- **SQLite**: Base de datos local por servicio

---

## 💻 Tecnologías

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| **NestJS** | 11.0 | Framework principal |
| **TypeScript** | 5.7 | Lenguaje tipado |
| **Temporal.io** | 1.13 | Orquestación Saga |
| **RabbitMQ** | CloudAMQP | Mensajería asíncrona |
| **TypeORM** | 0.3 | ORM |
| **SQLite** | 5.1 | Base de datos |
| **PostgreSQL** | 12 | BD para Temporal |
| **Docker** | latest | Contenedores |

---

## 🔧 Microservicios

### 1. Gateway Service (Puerto 3000)

**Rol:** Punto de entrada único para todas las peticiones HTTP

**Responsabilidades:**
- Exponer API REST pública
- Enrutar peticiones a microservicios vía RabbitMQ
- Combinar datos de múltiples servicios
- Manejo centralizado de errores

**Endpoints principales:**
- `GET /api/equipments` - Listar equipos
- `POST /api/repair-orders` - Crear orden (inicia Saga)
- `GET /api/equipments/:id/repair-orders` - Datos combinados

### 2. Equipments Service

**Rol:** Gestión de equipos y su disponibilidad

**Responsabilidades:**
- CRUD de equipos
- Control de estados (AVAILABLE, IN_REPAIR, RETIRED)
- Validación de disponibilidad
- Cambio automático de estado mediante eventos

**Base de Datos:** `equipments.sqlite`

**Tabla equipment:**
```sql
id              UUID PRIMARY KEY
name            VARCHAR
brand           VARCHAR
model           VARCHAR
serialNumber    VARCHAR (nullable)
status          ENUM (AVAILABLE | IN_REPAIR | RETIRED)
createdAt       TIMESTAMP
```

**Message Patterns:**
- `equipment.create` - Crear equipo
- `equipment.find.all` - Listar todos
- `equipment.find.available` - Solo disponibles
- `equipment.find.one` - Buscar por ID
- `equipment.check.availability` - Validar disponibilidad

**Event Patterns:**
- `equipment.order.requested` - Marca equipo como IN_REPAIR
- `equipment.order.finished` - Marca equipo como AVAILABLE

**Seed Inicial:** 8 equipos de ejemplo (Laptops, impresoras, servidores, etc.)

### 3. Repair Orders Service

**Rol:** Gestión de órdenes de reparación con Saga orquestada

**Responsabilidades:**
- CRUD de órdenes
- Orquestación de Saga con Temporal.io
- Validación de disponibilidad
- Compensación automática en errores

**Base de Datos:** `orders.sqlite`

**Tabla repair_order:**
```sql
id                  UUID PRIMARY KEY
equipmentId         UUID (FK)
technicianId        VARCHAR
problemDescription  TEXT
diagnosis           TEXT (nullable)
estimatedCost       DECIMAL (nullable)
status              ENUM (PENDING | IN_REVIEW | IN_REPAIR | DELIVERED | FAILED)
failureReason       VARCHAR (nullable)
createdAt           TIMESTAMP
```

**Message Patterns:**
- `repair_order.create` - Inicia Saga
- `repair_order.find.all` - Listar todas
- `repair_order.find.active` - Solo IN_REVIEW e IN_REPAIR
- `repair_order.finish` - Finalizar y liberar equipo

**Arquitectura Temporal:**
```
src/temporal/
├── workflow.ts  → Define pasos del Saga
├── worker.ts    → Ejecuta actividades
└── client.ts    → Inicia workflows
```

---

## 🎯 Patrones Implementados

### 1. Saga Orquestada (Temporal.io)

**Problema:** Las transacciones distribuidas pueden fallar parcialmente

**Solución:** Orquestador central coordina pasos y ejecuta compensación

**Workflow:**
```typescript
1. checkEquipment(equipmentId)
   → Valida que equipo esté AVAILABLE
   
2. reserveEquipment(equipmentId)
   → Emite evento: equipment.order.requested
   → equipmentReserved = true
   
3. createOrder(input)
   → Inserta en repair_orders
   → orderId = resultado.id
   
✅ ÉXITO: Retorna { success: true, orderId }
```

**Compensación (si falla):**
```typescript
catch (error) {
  if (orderId) {
    await cancelOrder(orderId)  // Marca orden como FAILED
  }
  if (equipmentReserved) {
    await releaseEquipment(equipmentId)  // Vuelve a AVAILABLE
  }
  throw error
}
```

**Ventajas de Temporal:**
- ✅ Persistencia de estado (sobrevive a caídas)
- ✅ Reintentos automáticos (4 intentos con backoff)
- ✅ Timeline visual en UI
- ✅ Historial completo

### 2. Mensajería Asíncrona (RabbitMQ)

**Tipos de comunicación:**

**A) Request-Response (@MessagePattern):**
```typescript
// Gateway envía y espera respuesta
const response = await equipmentsClient.send('equipment.find.all', {})
```

**B) Fire-and-Forget (@EventPattern):**
```typescript
// Servicio emite evento sin esperar respuesta
equipmentsClient.emit('equipment.order.requested', { equipmentId })
```

**Configuración:**
```typescript
{
  urls: ['amqps://cloudamqp.com/...'],
  queue: 'equipments_queue',
  queueOptions: { durable: true },  // Persistencia en disco
  noAck: false,                      // Confirmación manual
  prefetchCount: 1                   // Procesar de a 1
}
```

### 3. API Gateway Pattern

**Beneficios:**
- ✅ Punto de entrada único
- ✅ Abstracción de arquitectura interna
- ✅ CORS centralizado
- ✅ Combinación de datos

### 4. Database per Service

Cada microservicio tiene su propia base de datos:
- `equipments-service` → `equipments.sqlite`
- `repair-orders-service` → `orders.sqlite`
- `temporal-server` → PostgreSQL

---

## ⚙️ Configuración

### Requisitos Previos

- Node.js 18+ (recomendado 20+)
- npm 9+
- Docker y Docker Compose
- Cuenta CloudAMQP (RabbitMQ en la nube)

### Variables de Entorno

**gateway-service/.env:**
```env
PORT=3000
RABBITMQ_URL=amqps://user:pass@server.rmq.cloudamqp.com/vhost
```

**equipments-service/.env:**
```env
RABBITMQ_URL=amqps://user:pass@server.rmq.cloudamqp.com/vhost
QUEUE_NAME=equipments_queue
DATABASE_NAME=equipments.sqlite
```

**repair-orders-service/.env:**
```env
RABBITMQ_URL=amqps://user:pass@server.rmq.cloudamqp.com/vhost
QUEUE_NAME=repair_orders_queue
DATABASE_NAME=orders.sqlite
```

---

## 🚀 Instalación

### Paso 1: Levantar infraestructura (Temporal + PostgreSQL)

```bash
cd w9-micro-practica
docker-compose up -d
```

Esto levanta:
- `temporal-db` (PostgreSQL en puerto 5432)
- `temporal` (Servidor Temporal en puerto 7233)
- `temporal-ui` (UI Web en puerto 8080)

### Paso 2: Instalar dependencias

```bash
# Gateway
cd gateway-service
npm install

# Equipments
cd ../equipments-service
npm install

# Repair Orders
cd ../repair-orders-service
npm install
```

### Paso 3: Configurar variables de entorno

Crear archivos `.env` en cada servicio con tu URL de RabbitMQ Cloud

### Paso 4: Iniciar microservicios

**Terminal 1 - Equipments:**
```bash
cd equipments-service
npm run start:dev
```

**Terminal 2 - Repair Orders:**
```bash
cd repair-orders-service
npm run start:dev
```

**Terminal 3 - Gateway:**
```bash
cd gateway-service
npm run start:dev
```

### Verificación

✓ Gateway: http://localhost:3000  
✓ Temporal UI: http://localhost:8080  
✓ Logs: "EQUIPMENTS-SERVICE iniciado", "Temporal Worker started"

---

## 🌐 Endpoints API

**Base URL:** `http://localhost:3000/api`

### Equipos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/equipments` | Listar todos los equipos |
| GET | `/equipments/available` | Solo equipos disponibles |
| GET | `/equipments/:id` | Obtener equipo por ID |
| POST | `/equipments` | Crear nuevo equipo |
| GET | `/equipments/:id/repair-orders` | Equipo con sus órdenes |

**Ejemplo - Crear equipo:**
```json
POST /api/equipments
{
  "name": "Laptop HP",
  "brand": "HP",
  "model": "ProBook 450",
  "serialNumber": "HP-450-123"
}
```

### Órdenes de Reparación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/repair-orders` | Listar todas las órdenes |
| GET | `/repair-orders/active` | Órdenes activas (IN_REVIEW, IN_REPAIR) |
| GET | `/repair-orders/:id` | Obtener orden por ID |
| POST | `/repair-orders` | Crear orden (SAGA) ⚡ |
| PATCH | `/repair-orders/:id` | Actualizar orden |
| PATCH | `/repair-orders/:id/finish` | Finalizar reparación |
| DELETE | `/repair-orders/:id` | Eliminar orden |

**Ejemplo - Crear orden (Saga):**
```json
POST /api/repair-orders
{
  "equipmentId": "uuid-del-equipo",
  "technicianId": "TECH-001",
  "problemDescription": "Pantalla rota"
}
```

**Este endpoint ejecuta la Saga completa:**
1. Valida disponibilidad del equipo
2. Reserva el equipo (marca como IN_REPAIR)
3. Crea la orden en BD
4. Si falla, deshace todo automáticamente

---

## 🎬 Temporal.io y Saga

### ¿Qué es Temporal?

Motor de orquestación de workflows que:
- Coordina múltiples pasos en orden
- Persiste el estado en cada paso
- Reintenta automáticamente si algo falla
- Permite deshacer cambios (compensación)
- Sobrevive a caídas del servidor

### Componentes

**A) Workflow (workflow.ts):**  
Define **QUÉ** hacer (la receta)

```typescript
export async function createRepairOrderSaga(input) {
  let equipmentReserved = false
  let orderId = null

  try {
    await checkEquipment(input.equipmentId)
    
    await reserveEquipment(input.equipmentId)
    equipmentReserved = true
    
    const order = await createOrder(input)
    orderId = order.id
    
    return { success: true, orderId }
  } catch (error) {
    // Compensación
    if (orderId) await cancelOrder(orderId)
    if (equipmentReserved) await releaseEquipment(input.equipmentId)
    throw error
  }
}
```

**B) Worker (worker.ts):**  
Ejecuta **CÓMO** hacer (implementación real)

```typescript
activities: {
  checkEquipment: async (equipmentId) => {
    // Consulta a equipments-service por RabbitMQ
    const result = await equipmentsClient.send('equipment.check.availability', { equipmentId })
    if (!result.available) throw new Error('Equipment not available')
  },
  
  reserveEquipment: async (equipmentId) => {
    // Emite evento
    equipmentsClient.emit('equipment.order.requested', { equipmentId })
  },
  
  // ... más actividades
}
```

**C) Client (client.ts):**  
Inicia workflows desde el controlador

```typescript
async startSaga(input) {
  const client = await this.init()
  const handle = await client.workflow.start('createRepairOrderSaga', {
    taskQueue: 'repair-orders',
    args: [input],
    workflowId: `order-${Date.now()}`
  })
  return await handle.result()
}
```

### Configuración de Reintentos

```typescript
retry: {
  maximumAttempts: 4,         // Intenta 4 veces
  initialInterval: '1s',      // 1 segundo antes del primer reintento
  maximumInterval: '6s',      // Máximo 6 segundos
  backoffCoefficient: 2       // Duplica tiempo: 1s, 2s, 4s
}
```

### Temporal UI

**URL:** http://localhost:8080

**Funcionalidades:**
- Ver workflows en ejecución
- Historial completo (aunque fallen)
- Timeline visual de cada actividad
- Reintentos con timestamps
- Estado persistido

---

## 🧪 Pruebas

### Prueba 1: Flujo exitoso completo

```bash
# 1. Listar equipos disponibles
GET http://localhost:3000/api/equipments/available

# 2. Copiar un equipmentId y crear orden
POST http://localhost:3000/api/repair-orders
{
  "equipmentId": "copiar-id-aqui",
  "technicianId": "TECH-001",
  "problemDescription": "Pantalla rota"
}

# 3. Ver en logs:
🔍 PASO 1/3: Verificando disponibilidad...
✅ PASO 1/3 COMPLETADO
🔒 PASO 2/3: Reservando equipo...
✅ PASO 2/3 COMPLETADO
💾 PASO 3/3: Creando orden...
✅ PASO 3/3 COMPLETADO

# 4. Verificar en Temporal UI
http://localhost:8080 → Buscar workflow order-*
```

### Prueba 2: Equipo no disponible (reintentos)

```bash
# Crear orden con equipo ya en reparación
POST http://localhost:3000/api/repair-orders
{
  "equipmentId": "equipo-con-orden-activa",
  "technicianId": "TECH-002",
  "problemDescription": "No enciende"
}

# Ver reintentos en logs:
🔍 PASO 1/3: Verificando...
❌ Equipo NO disponible
Intento 1: ❌
Intento 2: ❌ (después de 1s)
Intento 3: ❌ (después de 2s)
Intento 4: ❌ (después de 4s)

# Respuesta:
{
  "success": false,
  "error": "El equipo no está disponible..."
}
```

### Prueba 3: Persistencia de estado

```bash
# 1. Crear orden
POST /api/repair-orders

# 2. Ver logs iniciando PASO 1

# 3. APAGAR repair-orders-service (Ctrl+C)

# 4. Ir a Temporal UI
# → Workflow en estado "Running", pausado en PASO 1

# 5. Reiniciar repair-orders-service
npm run start:dev

# 6. Ver que CONTINÚA desde donde se quedó:
✅ PASO 1/3 COMPLETADO
🔒 PASO 2/3: Reservando...
✅ PASO 2/3 COMPLETADO
💾 PASO 3/3: Creando...
✅ PASO 3/3 COMPLETADO
```

### Prueba 4: Endpoint combinado

```bash
# Obtener equipo con todas sus órdenes
GET /api/equipments/{equipmentId}/repair-orders

# Respuesta:
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Laptop Dell",
    "status": "AVAILABLE",
    "repairOrders": [
      { "id": "order-1", "status": "DELIVERED", ... },
      { "id": "order-2", "status": "IN_REPAIR", ... }
    ]
  }
}
```

---

## 📊 Resumen Técnico

### Servicios

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| gateway-service | 3000 | API REST pública |
| equipments-service | - | Microservicio RabbitMQ |
| repair-orders-service | - | Microservicio RabbitMQ |
| temporal-server | 7233 | gRPC Temporal |
| temporal-ui | 8080 | Web UI workflows |
| temporal-db | 5432 | PostgreSQL |

### Bases de Datos

- `equipments.sqlite` → equipments-service
- `orders.sqlite` → repair-orders-service
- `temporal_db` (PostgreSQL) → temporal-server

### Conceptos Clave

1. **Saga Orquestada:** Transacciones distribuidas con compensación
2. **Temporal.io:** Persistencia de estado y reintentos
3. **RabbitMQ:** Mensajería asíncrona persistente
4. **API Gateway:** Punto de entrada único
5. **Event-Driven:** Comunicación mediante eventos
6. **Database per Service:** BD independiente por servicio

---

## 📚 Recursos

- [NestJS](https://docs.nestjs.com)
- [Temporal.io](https://docs.temporal.io)
- [RabbitMQ](https://www.rabbitmq.com/documentation.html)
- [TypeORM](https://typeorm.io)

---

## 👤 Autor

Sistema desarrollado con ❤️ usando NestJS, Temporal.io y RabbitMQ

## 📝 Licencia

UNLICENSED - Proyecto educativo
