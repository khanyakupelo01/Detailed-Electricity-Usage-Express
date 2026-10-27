const crypto = require('crypto');
const config = require('../config');

const decodeBase64Url = (value) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
};

const decodeJson = (value) => JSON.parse(decodeBase64Url(value).toString('utf8'));

const configurationError = () => {
  const error = new Error('JWT verification is not configured');
  error.status = 500;
  return error;
};

const forbiddenError = () => {
  const error = new Error('Client is not authorized to ingest transactions');
  error.status = 403;
  return error;
};

const verifyJwt = (token) => {
  if (!config.JWT_ISSUER || !config.JWT_AUDIENCE || !config.JWT_PUBLIC_KEY) {
    throw configurationError();
  }

  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return undefined;
  }

  let header;
  let claims;
  let signature;

  try {
    header = decodeJson(parts[0]);
    claims = decodeJson(parts[1]);
    signature = decodeBase64Url(parts[2]);
  } catch (error) {
    return undefined;
  }

  if (!header || header.alg !== 'RS256' || !claims || typeof claims !== 'object') {
    return undefined;
  }

  let signatureValid;
  try {
    signatureValid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      config.JWT_PUBLIC_KEY,
      signature,
    );
  } catch (error) {
    return undefined;
  }

  if (!signatureValid) {
    return undefined;
  }

  const now = Math.floor(Date.now() / 1000);
  const audienceMatches = claims.aud === config.JWT_AUDIENCE
    || (Array.isArray(claims.aud) && claims.aud.includes(config.JWT_AUDIENCE));
  const validExpiration = Number.isFinite(claims.exp) && now < claims.exp;
  const validNotBefore = claims.nbf === undefined
    || (Number.isFinite(claims.nbf) && now >= claims.nbf);
  const hasSubject = typeof claims.sub === 'string' && claims.sub.trim().length > 0;

  if (claims.iss !== config.JWT_ISSUER
      || !audienceMatches
      || !validExpiration
      || !validNotBefore
      || !hasSubject) {
    return undefined;
  }

  return claims;
};

const bearerAuth = (request) => {
  const { authorization } = request.headers;
  const match = typeof authorization === 'string'
    && authorization.match(/^Bearer ([^\s]+)$/i);

  if (!match) {
    return false;
  }

  const claims = verifyJwt(match[1]);
  if (!claims) {
    return false;
  }

  const scopes = typeof claims.scope === 'string'
    ? claims.scope.split(/\s+/)
    : [];

  if (!scopes.includes('transactions:write')) {
    throw forbiddenError();
  }

  return true;
};

module.exports = {
  bearerAuth,
};
