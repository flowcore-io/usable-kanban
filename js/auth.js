/**
 * Usable OAuth Authentication (PKCE)
 * Handles Keycloak OAuth login for chat embed JWT authentication
 */

const UsableAuth = {
  // Keycloak configuration
  KEYCLOAK_BASE: 'https://auth.flowcore.io/realms/memory-mesh/protocol/openid-connect',
  CLIENT_ID: 'mcp_oauth_client',
  REDIRECT_URI: `${window.location.origin}/callback`,
  SCOPES: 'openid profile email',

  // Token state (in memory)
  _accessToken: null,
  _refreshToken: null,
  _refreshTimer: null,

  /**
   * Generate a random code verifier for PKCE
   * @returns {string} Base64url-encoded random string
   */
  generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this._base64UrlEncode(array);
  },

  /**
   * Generate a code challenge from a verifier (S256)
   * @param {string} verifier - The code verifier
   * @returns {Promise<string>} Base64url-encoded SHA-256 hash
   */
  async generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this._base64UrlEncode(new Uint8Array(digest));
  },

  /**
   * Base64url encode a Uint8Array
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  _base64UrlEncode(bytes) {
    let str = '';
    for (const b of bytes) str += String.fromCharCode(b);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },

  /**
   * Start the OAuth login flow
   */
  async login() {
    const verifier = this.generateCodeVerifier();
    const challenge = await this.generateCodeChallenge(verifier);

    sessionStorage.setItem('usable_pkce_verifier', verifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.CLIENT_ID,
      redirect_uri: this.REDIRECT_URI,
      scope: this.SCOPES,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });

    window.location.href = `${this.KEYCLOAK_BASE}/auth?${params}`;
  },

  /**
   * Handle the OAuth callback — exchange code for tokens
   * @returns {Promise<boolean>} true if callback was handled
   */
  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) return false;

    const verifier = sessionStorage.getItem('usable_pkce_verifier');
    if (!verifier) {
      console.error('UsableAuth: Missing PKCE verifier');
      return false;
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.CLIENT_ID,
        code: code,
        redirect_uri: this.REDIRECT_URI,
        code_verifier: verifier
      });

      const res = await fetch('/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Token exchange failed: ${err}`);
      }

      const tokens = await res.json();
      this._setTokens(tokens);

      // Clean up
      sessionStorage.removeItem('usable_pkce_verifier');
      window.history.replaceState({}, document.title, '/');

      return true;
    } catch (err) {
      console.error('UsableAuth: Token exchange error', err);
      return false;
    }
  },

  /**
   * Store tokens and schedule refresh
   * @param {Object} tokens - Token response from Keycloak
   */
  _setTokens(tokens) {
    this._accessToken = tokens.access_token;
    this._refreshToken = tokens.refresh_token;

    // Persist refresh token for session survival
    if (tokens.refresh_token) {
      localStorage.setItem('usable_refresh_token', tokens.refresh_token);
    }

    this.scheduleRefresh(tokens.expires_in || 300);
  },

  /**
   * Logout — clear tokens and redirect to Keycloak logout
   */
  logout() {
    this._accessToken = null;
    this._refreshToken = null;
    localStorage.removeItem('usable_refresh_token');

    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }

    const params = new URLSearchParams({
      client_id: this.CLIENT_ID,
      post_logout_redirect_uri: window.location.origin
    });

    window.location.href = `${this.KEYCLOAK_BASE}/logout?${params}`;
  },

  /**
   * Get the current access token
   * @returns {string|null}
   */
  getAccessToken() {
    return this._accessToken;
  },

  /**
   * Refresh the access token using the refresh token
   * @returns {Promise<string|null>} New access token or null
   */
  async refreshToken() {
    const rt = this._refreshToken || localStorage.getItem('usable_refresh_token');
    if (!rt) return null;

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.CLIENT_ID,
        refresh_token: rt
      });

      const res = await fetch('/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });

      if (!res.ok) {
        // Refresh token expired — clear state
        this._accessToken = null;
        this._refreshToken = null;
        localStorage.removeItem('usable_refresh_token');
        return null;
      }

      const tokens = await res.json();
      this._setTokens(tokens);
      return tokens.access_token;
    } catch (err) {
      console.error('UsableAuth: Token refresh error', err);
      return null;
    }
  },

  /**
   * Schedule a token refresh ~30s before expiry
   * @param {number} expiresIn - Token lifetime in seconds
   */
  scheduleRefresh(expiresIn) {
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
    }

    // Refresh 30s before expiry (minimum 10s)
    const delay = Math.max((expiresIn - 30) * 1000, 10000);

    this._refreshTimer = setTimeout(async () => {
      await this.refreshToken();
    }, delay);
  },

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!this._accessToken;
  },

  /**
   * Decode JWT payload to get user info
   * @returns {Object|null} Decoded payload with name/email
   */
  getUserInfo() {
    if (!this._accessToken) return null;

    try {
      const parts = this._accessToken.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return {
        name: payload.name || payload.preferred_username || 'User',
        email: payload.email || '',
        sub: payload.sub
      };
    } catch {
      return null;
    }
  },

  /**
   * Try to restore session from stored refresh token
   * @returns {Promise<boolean>} true if session was restored
   */
  async tryRestore() {
    const rt = localStorage.getItem('usable_refresh_token');
    if (!rt) return false;

    this._refreshToken = rt;
    const token = await this.refreshToken();
    return !!token;
  }
};
