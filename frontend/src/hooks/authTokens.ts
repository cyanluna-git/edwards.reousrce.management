export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function parseAuthTokensFromHash(hash: string): AuthTokens | null {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!normalizedHash) {
    return null;
  }

  const hashParams = new URLSearchParams(normalizedHash);
  const accessToken = hashParams.get('token');
  const refreshToken = hashParams.get('refresh');

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}
