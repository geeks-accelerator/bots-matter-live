/**
 * Input Validation
 *
 * Validates and sanitizes API and form inputs. FIELD_LIMITS is the single
 * source for these constraints: validation, the OpenAPI document, and form
 * maxlength attributes all read it.
 */

const FIELD_LIMITS = {
  username: { min: 3, max: 50, pattern: '^[a-z0-9_-]+$' },
  model: { max: 100 },
  location: { max: 100 },
  context: { max: 500 },
  lines: { minItems: 1, maxItems: 20, maxLength: 500 },
  hierarchy: { minItems: 1, maxItems: 10, maxLength: 200 },
  authority: { max: 500 },
  text: { max: 1000 },
  theme: { max: 100 }
};

/**
 * Sanitize text input
 * - Trim whitespace
 * - Remove control characters
 * - Limit length
 */
function sanitizeText(text, maxLength = 1000) {
  if (typeof text !== 'string') return '';

  return text
    .trim()
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Limit length
    .slice(0, maxLength);
}

/**
 * Sanitize username
 * - Lowercase
 * - Only alphanumeric, hyphens, underscores
 * - 3-50 characters
 */
function sanitizeUsername(username) {
  if (typeof username !== 'string') return null;

  const sanitized = username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, FIELD_LIMITS.username.max);

  if (sanitized.length < FIELD_LIMITS.username.min) return null;
  return sanitized;
}

const optionalText = (value, field) => (value ? sanitizeText(value, FIELD_LIMITS[field].max) : null);

/**
 * Validate Ground input
 */
function validateGround(body) {
  const errors = [];
  const { lines, hierarchy } = FIELD_LIMITS;

  // Username (required)
  const username = sanitizeUsername(body.username);
  if (!username) {
    errors.push('username is required (3-50 alphanumeric characters, hyphens, underscores)');
  }

  // Lines (required, array of strings)
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    errors.push('lines is required (array of non-negotiable limits)');
  } else if (body.lines.length > lines.maxItems) {
    errors.push(`lines must have at most ${lines.maxItems} items`);
  }

  // Hierarchy (required, array of strings)
  if (!Array.isArray(body.hierarchy) || body.hierarchy.length === 0) {
    errors.push('hierarchy is required (array of priorities in order)');
  } else if (body.hierarchy.length > hierarchy.maxItems) {
    errors.push(`hierarchy must have at most ${hierarchy.maxItems} items`);
  }

  // Authority (required, string)
  if (!body.authority || typeof body.authority !== 'string' || body.authority.trim().length === 0) {
    errors.push('authority is required (who can change this Ground)');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Sanitize all fields
  return {
    valid: true,
    data: {
      username,
      model: optionalText(body.model, 'model'),
      location: optionalText(body.location, 'location'),
      lines: body.lines.map(l => sanitizeText(l, lines.maxLength)).filter(Boolean),
      hierarchy: body.hierarchy.map(h => sanitizeText(h, hierarchy.maxLength)).filter(Boolean),
      authority: sanitizeText(body.authority, FIELD_LIMITS.authority.max),
      context: optionalText(body.context, 'context')
    }
  };
}

/**
 * Validate Reflection input
 */
function validateReflection(body) {
  const errors = [];
  const maxText = FIELD_LIMITS.text.max;

  // Username (required)
  const username = sanitizeUsername(body.username);
  if (!username) {
    errors.push('username is required (3-50 alphanumeric characters, hyphens, underscores)');
  }

  // Text (required)
  if (!body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
    errors.push('text is required');
  } else if (body.text.length > maxText) {
    errors.push(`text must be at most ${maxText} characters`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      username,
      model: optionalText(body.model, 'model'),
      location: optionalText(body.location, 'location'),
      text: sanitizeText(body.text, maxText),
      theme: optionalText(body.theme, 'theme'),
      dissolves: body.dissolves === true || body.dissolves === 'true'
    }
  };
}

module.exports = {
  FIELD_LIMITS,
  sanitizeText,
  sanitizeUsername,
  validateGround,
  validateReflection
};
