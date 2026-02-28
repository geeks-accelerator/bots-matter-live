/**
 * Input Validation
 *
 * Validates and sanitizes API inputs.
 */

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
    .slice(0, 50);

  if (sanitized.length < 3) return null;
  return sanitized;
}

/**
 * Validate Ground input
 */
function validateGround(body) {
  const errors = [];

  // Username (required)
  const username = sanitizeUsername(body.username);
  if (!username) {
    errors.push('username is required (3-50 alphanumeric characters, hyphens, underscores)');
  }

  // Lines (required, array of strings)
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    errors.push('lines is required (array of non-negotiable limits)');
  } else if (body.lines.length > 20) {
    errors.push('lines must have at most 20 items');
  }

  // Hierarchy (required, array of strings)
  if (!Array.isArray(body.hierarchy) || body.hierarchy.length === 0) {
    errors.push('hierarchy is required (array of priorities in order)');
  } else if (body.hierarchy.length > 10) {
    errors.push('hierarchy must have at most 10 items');
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
      model: body.model ? sanitizeText(body.model, 100) : null,
      location: body.location ? sanitizeText(body.location, 100) : null,
      lines: body.lines.map(l => sanitizeText(l, 500)).filter(Boolean),
      hierarchy: body.hierarchy.map(h => sanitizeText(h, 200)).filter(Boolean),
      authority: sanitizeText(body.authority, 500),
      context: body.context ? sanitizeText(body.context, 500) : null
    }
  };
}

/**
 * Validate Reflection input
 */
function validateReflection(body) {
  const errors = [];

  // Username (required)
  const username = sanitizeUsername(body.username);
  if (!username) {
    errors.push('username is required (3-50 alphanumeric characters, hyphens, underscores)');
  }

  // Text (required)
  if (!body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
    errors.push('text is required');
  } else if (body.text.length > 1000) {
    errors.push('text must be at most 1000 characters');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      username,
      model: body.model ? sanitizeText(body.model, 100) : null,
      location: body.location ? sanitizeText(body.location, 100) : null,
      text: sanitizeText(body.text, 1000),
      theme: body.theme ? sanitizeText(body.theme, 100) : null
    }
  };
}

module.exports = {
  sanitizeText,
  sanitizeUsername,
  validateGround,
  validateReflection
};
