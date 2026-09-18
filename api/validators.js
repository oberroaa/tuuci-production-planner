/**
 * Validation schemas and middleware for TUUCI Production Planner API.
 * Ensures consistent types, bounds, and string sanitization before database mutations.
 */

/**
 * Validates request body against a defined validation spec.
 * Returns an array of error messages, or null if valid.
 */
export function validateBody(data, rules) {
  if (!data || typeof data !== 'object') {
    return ['El cuerpo de la solicitud (request body) debe ser un objeto JSON válido'];
  }

  const errors = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];

    if (rule.required && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
      errors.push(`El campo "${field}" es obligatorio.`);
      continue;
    }

    if (value === undefined || value === null) {
      continue; // Optional field and not provided
    }

    // Type checking
    if (rule.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`El campo "${field}" debe ser una cadena de texto.`);
      } else {
        const trimmed = value.trim();
        if (rule.minLength && trimmed.length < rule.minLength) {
          errors.push(`El campo "${field}" debe contener al menos ${rule.minLength} caracteres.`);
        }
        if (rule.maxLength && trimmed.length > rule.maxLength) {
          errors.push(`El campo "${field}" no puede superar ${rule.maxLength} caracteres.`);
        }
        if (rule.pattern && !rule.pattern.test(trimmed)) {
          errors.push(`El campo "${field}" tiene un formato inválido.`);
        }
      }
    } else if (rule.type === 'number' || rule.type === 'integer') {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push(`El campo "${field}" debe ser un número válido.`);
      } else if (rule.type === 'integer' && !Number.isInteger(num)) {
        errors.push(`El campo "${field}" debe ser un número entero.`);
      } else {
        if (rule.min !== undefined && num < rule.min) {
          errors.push(`El campo "${field}" debe ser mayor o igual a ${rule.min}.`);
        }
        if (rule.max !== undefined && num > rule.max) {
          errors.push(`El campo "${field}" debe ser menor o igual a ${rule.max}.`);
        }
      }
    } else if (rule.type === 'boolean') {
      if (typeof value !== 'boolean' && value !== 0 && value !== 1 && value !== 'true' && value !== 'false') {
        errors.push(`El campo "${field}" debe ser un valor booleano.`);
      }
    } else if (rule.type === 'enum') {
      if (!rule.values.includes(value)) {
        errors.push(`El campo "${field}" debe ser uno de: ${rule.values.join(', ')}.`);
      }
    }
  }

  return errors.length > 0 ? errors : null;
}

/**
 * Express middleware generator that returns 400 Bad Request on schema violation
 */
export function validateSchema(rules) {
  return (req, res, next) => {
    const errors = validateBody(req.body, rules);
    if (errors) {
      return res.status(400).json({
        success: false,
        error: errors[0],
        errors
      });
    }
    next();
  };
}

// Predefined validation rules for critical endpoints:
export const schemas = {
  createJob: {
    jobCode: { type: 'string', required: true, minLength: 2, maxLength: 50 },
    lineaId: { type: 'integer', required: true, min: 1 },
    rutaId: { type: 'integer', required: false, min: 1 },
    modelo: { type: 'string', required: false, maxLength: 255 },
    itemCode: { type: 'string', required: false, maxLength: 100 },
    specsRaw: { type: 'string', required: false, maxLength: 2000 },
    cantidadPiezas: { type: 'integer', required: true, min: 1, max: 5000 }
  },

  scan: {
    codigoQRUnico: { type: 'string', required: false, maxLength: 100 },
    codigoEstacion: { type: 'string', required: false, maxLength: 100 }
  },

  batchClose: {
    jobId: { type: 'integer', required: false, min: 1 },
    jobCode: { type: 'string', required: false, maxLength: 50 },
    procesoId: { type: 'integer', required: false, min: 1 }
  },

  createLine: {
    nombre: { type: 'string', required: true, minLength: 2, maxLength: 100 }
  }
};
