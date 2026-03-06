import { expect, test } from '@playwright/test';

import { parseAuthTokensFromHash } from '../src/hooks/authTokens';

test('parses access and refresh tokens from URL fragment', () => {
  const parsed = parseAuthTokensFromHash(
    '#token=access.jwt.token&refresh=refresh.jwt.token',
  );

  expect(parsed).toEqual({
    accessToken: 'access.jwt.token',
    refreshToken: 'refresh.jwt.token',
  });
});

test('returns null when fragment does not contain both tokens', () => {
  expect(parseAuthTokensFromHash('#token=only-access')).toBeNull();
  expect(parseAuthTokensFromHash('')).toBeNull();
});
