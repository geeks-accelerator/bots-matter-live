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
 * Validate Ground input. body is undefined when no parser matched the request
 * (no body, or an unsupported Content-Type); that answers 400 like an empty one.
 */
function validateGround(body = {}) {
  const errors = [];
  const { lines, hierarchy } = FIELD_LIMITS;

  // Username (required)
  const username = sanitizeUsername(body.username);
  if (!username) {
    errors.push('username is required (3-50 alphanumeric characters, hyphens, underscores)');
  }

  // Lines, hierarchy and authority are checked after sanitizing: an item of
  // spaces, a control character or a non-string sanitizes to nothing, and
  // checking the raw value saved Grounds with no lines (the weekly review,
  // 2026-11-14).
  const clean = (list, max) => (Array.isArray(list) ? list.map(item => sanitizeText(item, max)).filter(Boolean) : []);

  // Lines (required, array of strings)
  const cleanLines = clean(body.lines, lines.maxLength);
  if (cleanLines.length === 0) {
    errors.push('lines is required (array of non-negotiable limits)');
  } else if (body.lines.length > lines.maxItems) {
    errors.push(`lines must have at most ${lines.maxItems} items`);
  }

  // Hierarchy (required, array of strings)
  const cleanHierarchy = clean(body.hierarchy, hierarchy.maxLength);
  if (cleanHierarchy.length === 0) {
    errors.push('hierarchy is required (array of priorities in order)');
  } else if (body.hierarchy.length > hierarchy.maxItems) {
    errors.push(`hierarchy must have at most ${hierarchy.maxItems} items`);
  }

  // Authority (required, string)
  const authority = sanitizeText(body.authority, FIELD_LIMITS.authority.max);
  if (!authority) {
    errors.push('authority is required (who can change this Ground)');
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
      lines: cleanLines,
      hierarchy: cleanHierarchy,
      authority,
      context: optionalText(body.context, 'context')
    }
  };
}

/**
 * Validate Reflection input (body defaults as in validateGround)
 */
function validateReflection(body = {}) {
  const errors = [];
  const maxText = FIELD_LIMITS.text.max;

  // Username (required)
  const username = sanitizeUsername(body.username);
  if (!username) {
    errors.push('username is required (3-50 alphanumeric characters, hyphens, underscores)');
  }

  // Text (required), checked after sanitizing as in validateGround
  const text = sanitizeText(body.text, maxText);
  if (!text) {
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
      text,
      theme: optionalText(body.theme, 'theme'),
      dissolves: body.dissolves === true || body.dissolves === 'true'
    }
  };
}

/**
 * A list's `limit` and `cursor` query values. Absent means the default; a value
 * that can't be used is refused rather than guessed at. Before 2026-11-16,
 * `limit=-5` reached `slice(0, -5)` and returned every Ground but five (2,051
 * live), and an unparseable cursor compared as NaN and returned an empty last
 * page. Above 100 is cut to 100, as it always was.
 */
const LIST_LIMIT = { default: 20, max: 100 };

function parseListQuery(query = {}) {
  let limit = LIST_LIMIT.default;
  if (query.limit !== undefined && query.limit !== '') {
    const raw = String(query.limit);
    if (!/^\d+$/.test(raw) || Number(raw) < 1) {
      return { error: `limit must be a whole number from 1 to ${LIST_LIMIT.max} (got "${sanitizeText(raw, 20)}")` };
    }
    limit = Math.min(Number(raw), LIST_LIMIT.max);
  }

  let cursor = null;
  if (query.cursor !== undefined && query.cursor !== '') {
    const raw = sanitizeText(String(query.cursor), 50);
    if (Number.isNaN(new Date(raw).getTime())) {
      return { error: `cursor must be the cursor from the previous response, an ISO-8601 time (got "${raw}")` };
    }
    cursor = raw;
  }

  return { limit, cursor };
}

module.exports = {
  FIELD_LIMITS,
  sanitizeText,
  sanitizeUsername,
  validateGround,
  validateReflection,
  parseListQuery
};
