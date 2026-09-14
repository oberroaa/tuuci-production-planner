# Documentación Técnica del Sistema - TUUCI Production Planner

Bienvenido a la documentación técnica y funcional del **Sistema de Trazabilidad y Control de Producción de TUUCI**.

---

## 📂 Estructura de Documentación Actualizada

1. [**01-ARQUITECTURA-SISTEMA-TRAZABILIDAD.md**](./01-ARQUITECTURA-SISTEMA-TRAZABILIDAD.md)  
   *Documento de Arquitectura de Alto Nivel.*  
   - Contexto del problema y restricciones operativas (ERP sin API, etiquetas 1D).
   - Roles, permisos y alcance por Línea (Admin, Supervisor, Operador con SSO Microsoft).
   - Catálogo de Líneas y **Soporte Multi-Ruta por Línea (Opción A)**.
   - Catálogo maestro de `TipoProceso` y dispositivos `Escaner` físicos.
   - Catálogo de `Estados` gobernado por banderas dinámicas de comportamiento.
   - Flujo de hardware Fase 1 (Corte con OCR y modo LOTE), Fase 2 (Estaciones con escáner Wi-Fi y modo INDIVIDUAL) y **Fase 3 (Cierre de Lote Final con Reconciliación de Piezas Rezagadas)**.
   - Auditoría y seguridad por dispositivo físico.

2. [**02-DIAGRAMA-DE-FLUJO-CICLO-DE-VIDA.md**](./02-DIAGRAMA-DE-FLUJO-CICLO-DE-VIDA.md)  
   *Diagrama de Flujo y Ciclo de Vida de una Pieza.*  
   - Diagrama Mermaid completo de punta a punta (Fase 1 $\to$ Fase 2 $\to$ Fase 3 Cierre Reconciliado).
   - Matriz paso a paso de eventos, acciones y transiciones de estado.
   - Respuestas visuales del escáner en pantalla OLED (`SEND OK - abierto`, `SEND OK - cerrado`, `ERROR`) y tonos acústicos.
   - Protocolo de pre-auditoría automática (`audit-lote`) y cierre atómico de lote con incidencias (`COMPLETADO_CON_INCIDENCIAS`).
   - Transiciones y activación automática por variante de Ruta.
   - Auditoría transversal y bitácora forense en tiempo real con campo `observacion`.

3. [**03-DIAGRAMA-ENTIDAD-RELACION-BASE-DE-DATOS.md**](./03-DIAGRAMA-ENTIDAD-RELACION-BASE-DE-DATOS.md)  
   *Diagrama Entidad-Relación y Diccionario de Datos.*  
   - Diagrama Mermaid ERD completo con las 11 entidades del sistema.
   - Diccionario de tablas, tipos de datos, llaves primarias, foráneas y restricciones únicas (`UNIQUE(ruta_id, orden)`, `UNIQUE(ruta_id, tipo_proceso_id)`, etc.).
   - Columnas de reconciliación y cierre: `jobs.estado_cierre`, `jobs.fecha_cierre`, `jobs.cerrado_por_usuario_id`, `jobs.notas_cierre`, `piezas.cierre_excepcion`, `evento_estados.observacion`.
   - Tabla completa de cardinalidades (1:N y N:M).

---

## 📁 Archivos Originales de Referencia

Los tres documentos PDF originales suministrados inicialmente se encuentran archivados en:
- [`docs/pdf_originales/01-Arquitectura-Original.pdf`](./pdf_originales/01-Arquitectura-Original.pdf)
- [`docs/pdf_originales/02-Diagrama-Flujo-Original.pdf`](./pdf_originales/02-Diagrama-Flujo-Original.pdf)
- [`docs/pdf_originales/03-Diagrama-Entidad-Relacion-Original.pdf`](./pdf_originales/03-Diagrama-Entidad-Relacion-Original.pdf)
