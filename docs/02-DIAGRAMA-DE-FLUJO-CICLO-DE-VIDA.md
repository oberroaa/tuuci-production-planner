# TUUCI - Diagrama de Flujo: Ciclo de Vida de una Pieza
**Fecha de actualización:** Septiembre 2026  
**Versión:** 2.0 (De punta a punta: Entrada en Corte, Ejecución por Rutas y Finalización)

---

## 1. Alcance y Control por Rol y Línea

| Rol | Línea Asociada | Visibilidad en el Tablero | Filtro por Job |
| :--- | :--- | :--- | :---: |
| **Admin** | Ninguna (Sin filtro obligatorio) | Todas las Líneas, todas las Rutas y todos los estados (incluidos los técnicos/ocultos) | Disponible |
| **Supervisor** | Una Línea asignada | Su Línea asignada completa (incluidos estados internos no visibles para el Operador) | Disponible |
| **Operador** | Una Línea asignada (conmutable en sesión) | Su Línea activa, únicamente estaciones y estados con `visible_para_operador = 1` | Disponible |

---

## 2. Catálogo de Estados y Reglas de Transición

El motor de estados (`StateEngine`) no tiene estados fijos 'hardcoded', sino que evalúa dinámicamente las banderas configuradas en la base de datos:

| Nombre | Orden | Visible para Operador | Permite Escaneo | Dispara Activación Siguiente | Acción ante Escaneo |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **INACTIVO** | 1 | No | No | No | Rechaza escaneo con error. La pieza no ha llegado a esta estación. |
| **ESPERANDO** | 2 | Sí | Sí | No | **Abre la estación:** Cambia a `EN PROCESO`, arranca cronómetro de ciclo. |
| **EN PROCESO** | 3 | Sí | Sí | No | **Cierra la estación:** Cambia a `TERMINADA`, detiene cronómetro, activa siguiente estación. |
| **TERMINADA** | 4 | Sí | No | Sí | Ya finalizado en esta estación. No permite escaneo. |

---

## 3. Diagrama de Flujo General de una Pieza (End-to-End)

```mermaid
flowchart TD
    subgraph FASE_1["FASE 1: Estación de Corte (Modo LOTE con PC y Cámara USB)"]
        A1["1. Operador inicia sesión (SSO Microsoft)"] --> A2["2. Coloca orden de producción física bajo cámara cenital"]
        A2 --> A3["3. Captura OCR extrae Job ID, cantidad de piezas, modelo y specs"]
        A3 --> A4{"4. Pantalla de confirmación (3-4 seg)"}
        A4 -- "No / Reintentar" --> A2
        A4 -- "Sí / Confirmar" --> A5["5. Creación de Job en BD con su Línea y Ruta asignada"]
        A5 --> A6["6. Generación de N registros de Piezas con códigos QR únicos"]
        A6 --> A7["7. Impresora térmica emite las N etiquetas adhesivas"]
        A7 --> A8["8. Estación de Corte inicia en EN PROCESO para el lote completo"]
        A8 --> A9["9. Operador corta el lote físico y pulsa Cierre de Lote"]
        A9 --> A10["10. Corte pasa a TERMINADA para las N piezas simultáneamente"]
        A10 --> A11["11. Siguiente estación de la ruta pasa de INACTIVO a ESPERANDO para las N piezas"]
    end

    subgraph FASE_2["FASE 2: Estaciones Intermedias (Modo INDIVIDUAL con Escáner Wi-Fi + OLED)"]
        B1["12. Operario toma pieza y escanea su QR en terminal de estación"] --> B2{"13. Servidor consulta estado actual de la pieza en esta estación"}
        
        B2 -- "Estado = ESPERANDO" --> B3["APERTURA:<br>• Pasa a EN PROCESO<br>• Arranca reloj de ciclo<br>• OLED: 'SEND OK - abierto' (Bip verde)"]
        
        B2 -- "Estado = EN PROCESO" --> B4["CIERRE:<br>• Pasa a TERMINADA<br>• Registra duración exacta<br>• Activa siguiente estación a ESPERANDO<br>• OLED: 'SEND OK - cerrado' (Bip verde)"]
        
        B2 -- "Estado = INACTIVO o TERMINADA" --> B5["RECHAZO:<br>• Operación no permitida<br>• No modifica estado<br>• OLED: 'ERROR' (Bip rojo)"]
        
        B3 --> B6["14. Notificación WebSocket a Tablero Kanban en tiempo real"]
        B4 --> B6
    end

    subgraph CIERRE["CIERRE DEL LOTE FINAL Y RECONCILIACIÓN"]
        B4 --> C1{"¿Es la estación de cierre de la ruta?<br>(es_proceso_cierre = 1)"}
        C1 -- No --> B1
        C1 -- Sí --> C2["Solicitud de Cierre de Lote (Modo LOTE)"]
        C2 --> C3{"¿Todas las N piezas completaron el flujo normal?"}
        C3 -- Sí (Limpio) --> C4["JOB COMPLETADO (100% Terminadas)"]
        C3 -- No (Con Rezagadas) --> C5["Auditoría Automática: Identifica piezas rezagadas y pasos omitidos"]
        C5 --> C6["Supervisor ingresa Justificación Obligatoria"]
        C6 --> C7["Marca piezas.cierre_excepcion = 1"]
        C7 --> C8["Registra Evento Forense con pasos omitidos en evento_estados"]
        C8 --> C9["JOB COMPLETADO_CON_INCIDENCIAS"]
    end

    A11 --> B1
```

---

## 4. Tabla Detallada de Eventos Paso a Paso

### FASE 1: Estación de Corte (Modo LOTE)
| Paso | Evento / Acción del Operador | Respuesta del Sistema | Impacto en Base de Datos |
| :---: | :--- | :--- | :--- |
| **1** | Operador inicia sesión con cuenta Microsoft. | Carga la Línea asignada por defecto (Clásica / Cantiléver / Cabaña / Mueble), con opción de cambiarla. | Identifica al usuario `usuarios.id`. |
| **2** | Apoya la orden física bajo la cámara cenital USB. | Iluminación cenital LED y captura de imagen en alta resolución. | Archiva imagen en `jobs.imagen_etiqueta_url`. |
| **3** | Módulo OCR procesa el documento. | Reconoce el código de barras 1D (`Job ID`), extrae cantidad de piezas desde `"Carton: X Of Y"`, modelo y especificaciones. | Almacena texto crudo en `jobs.specs_raw`. |
| **4** | Pantalla de confirmación con vista previa (3 seg). | Muestra Job ID, cantidad de piezas, modelo y Línea activa. Botones táctiles: "Sí, imprimir" o "No, repetir foto". | Si pulsa "No", no genera cambios y permite retomar la foto. |
| **5** | Operador presiona "Sí, imprimir". | Confirma la entrada de la orden al sistema de planta. | Crea fila en `jobs` asociada a `linea_id` y `ruta_id`. |
| **6** | Generación de piezas individuales. | Crea las $N$ piezas correlativas (`JOB-01`, `JOB-02`...). | Crea $N$ filas en `piezas`. |
| **7** | Instanciación de la ruta de manufactura. | Configura los pasos de la ruta: Corte inicia en `EN PROCESO`, los pasos restantes inician en `INACTIVO`. | Inserta filas en `pieza_procesos` para cada pieza y estación. |
| **8** | Impresión simultánea de etiquetas. | La impresora térmica saca las $N$ etiquetas adhesivas con código QR único para que el operador las pegue en los tubos/piezas. | Etiquetas físicas listas para colocación. |
| **9** | Finalización del corte de lote físico. | Operador pulsa "Cerrar Lote" en pantalla o escanea una etiqueta cualquiera del lote. | `pieza_procesos` para Corte pasa a `TERMINADA` para todas las piezas. |
| **10** | Activación descendente por lote. | Al pasar Corte a `TERMINADA` (bandera `dispara_activacion = 1`), la siguiente estación de la ruta pasa a `ESPERANDO` para las $N$ piezas. | Las piezas quedan listas en la cola de la estación siguiente. |

---

### FASE 2: Estaciones Intermedias (Modo INDIVIDUAL con Escáner Wi-Fi + OLED)
Este ciclo se repite en cada estación de la ruta (Fabricación, Maquinado, Ensamble, QC, Packing):

| Paso | Evento / Acción del Operario | Respuesta del Servidor | Mensaje en OLED | Tono Auditivo |
| :---: | :--- | :--- | :---: | :---: |
| **11** | Operario toma una pieza y escanea su código QR único. | El escáner envía `codigoEstacion` y `codigoQRUnico` al backend. | Procesando... | — |
| **12a** | La pieza estaba en estado `ESPERANDO` en esa estación. | **Apertura:** Pasa a `EN PROCESO`, registra `fecha_inicio`, `escaner_apertura_id` y arranca reloj de ciclo. | `SEND OK`<br>`abierto` | **Bip Verde** (Éxito) |
| **12b** | La pieza estaba en estado `EN PROCESO` en esa estación. | **Cierre:** Pasa a `TERMINADA`, registra `fecha_fin`, `escaner_cierre_id` y activa el siguiente paso de la ruta a `ESPERANDO`. | `SEND OK`<br>`cerrado` | **Bip Verde** (Éxito) |
| **12c** | La pieza está en `INACTIVO` (no ha pasado por estación previa) o ya está `TERMINADA`. | **Rechazo:** Operación inválida por secuencia o duplicidad. No modifica datos. | `ERROR`<br>`rechazado` | **Bip Rojo** (Alerta) |
| **13** | Sincronización en tiempo real. | Backend emite evento Socket.io que actualiza inmediatamente la tarjeta de la pieza en el Kanban de React. | — | — |

---

### FASE 3: Estación de Cierre y Reconciliación Forense de Lote (Configurable vía `es_proceso_cierre = 1`)
Ocurre en la estación configurada administrativamente como paso de cierre de la ruta (por defecto la última como Packing / Done, o cualquier estación designada con `es_proceso_cierre = 1`):

| Paso | Evento / Acción del Supervisor | Respuesta del Sistema | Impacto en Base de Datos |
| :---: | :--- | :--- | :--- |
| **14** | Usuario pulsa "Cerrar Lote Final" en la tarjeta o lista del Job. | Backend ejecuta pre-auditoría (`GET /api/jobs/:id/audit-lote`) comparando el historial de cada pieza contra las estaciones de la ruta. | Ninguno (consulta en solo lectura). |
| **15a** | **Caso Limpio:** Las $N$ piezas pasaron por todas las estaciones. | Modal muestra alerta verde: *"100% de piezas listas"*. Permite cierre directo con un clic. | `jobs.estado_cierre = 'COMPLETADO'`. Todas las piezas pasan a `TERMINADA`. |
| **15b** | **Caso con Incidencias:** Una o más piezas (ej. `JOBxxx-05`) se quedaron en estaciones previas. | Modal muestra alerta ámbar/roja con desglose exacto: QR de la pieza rezagada, última estación alcanzada y lista de estaciones omitidas. Exige justificación obligatoria. | Muestra tabla de incidencias al supervisor. |
| **16** | Supervisor escribe justificación (ej. *"Pieza 05 retenida por daño en tela; lote cerrado para entrega"*) y confirma. | Ejecuta transacción atómica: piezas listas pasan a `TERMINADA`; piezas rezagadas se marcan con `cierre_excepcion = 1`; se registra evento con pasos omitidos en `evento_estados.observacion`. | `jobs.estado_cierre = 'COMPLETADO_CON_INCIDENCIAS'`, `fecha_cierre = NOW()`, `cerrado_por_usuario_id`, `notas_cierre`. |
| **17** | Actualización y Auditoría Permanente. | Notificación Socket.io refresca tableros y KPIs. La orden queda rotulada con badge ámbar *"CON INCIDENCIAS"*. | Queda disponible botón "Auditoría" para inspección forense en cualquier momento. |

---

## 5. Variantes de Ruta por Línea de Producto (Arquitectura Opción A)

Cada pieza sigue la ruta asignada a su respectivo Job:
1. Si un Job de la línea **Clásica** usa la **Ruta Estándar**:
   `Corte` $\to$ `Fabricación` $\to$ `Packing` $\to$ `Done`
2. Si un Job de la línea **Clásica** usa la **Ruta con Maquinado**:
   `Corte` $\to$ `Fabricación` $\to$ `Maquinado` $\to$ `Packing` $\to$ `Done`

El motor de avance calcula dinámicamente la estación siguiente mediante la consulta:
```sql
SELECT id FROM procesos 
WHERE ruta_id = ? AND orden > ? 
ORDER BY orden ASC LIMIT 1;
```
Esto asegura que las piezas transiten exclusivamente por las estaciones definidas para su ruta, sin riesgo de desviaciones accidentales.

---

## 6. Auditoría y Trazabilidad Transversal

En cada escaneo o cambio de estado, el sistema registra una entrada inmutable en la tabla `evento_estados`:
- `pieza_proceso_id`: Registro de la pieza en la estación específica.
- `estado_anterior_id`: Estado previo antes del escaneo.
- `estado_nuevo_id`: Estado alcanzado (`EN PROCESO` o `TERMINADA`).
- `escaner_id`: Identificador del terminal físico Wi-Fi que capturó el código (en Fase 2).
- `usuario_id`: Identificador del operador con sesión Microsoft (en Fase 1 y Fase 3).
- `observacion`: Registro explícito de excepciones, pasos omitidos por cierre forzado o notas técnicas.
- `timestamp`: Marca de tiempo precisa en formato ISO 8601 UTC.
