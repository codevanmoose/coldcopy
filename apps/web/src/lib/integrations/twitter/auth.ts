import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import { TwitterAuthConfig } from './types';

// Twitter OAuth 1.0a endpoints
const TWITTER_REQUEST_TOKEN_URL = 'https://api.twitter.com/oauth/request_token';
const TWITTER_AUTHORIZE_URL = 'https://api.twitter.com/oauth/authorize';
const TWITTER_ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token';

interface TwitterTokens {
  oauth_token: string;
  oauth_token_secret: string;
  user_id: string;
  screen_name: string;
}

export class TwitterAuthService {
  private consumerKey: string;
  private consumerSecret: string;
  private callbackUrl: string;
  private oauth: OAuth;

  constructor() {
    this.consumerKey = process.env.NEXT_PUBLIC_TWITTER_CONSUMER_KEY!;
    this.consumerSecret = process.env.TWITTER_CONSUMER_SECRET!;
    this.callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations/twitter/callback`;

    // Initialize OAuth 1.0a
    this.oauth = new OAuth({
      consumer: {
        key: this.consumerKey,
        secret: this.consumerSecret,
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto
          .createHmac('sha1', key)
          .update(base_string)
          .digest('base64');
      },
    });
  }

  /**
   * Step 1: Get request token
   */
  async getRequestToken(): Promise<{ oauth_token: string; oauth_token_secret: string; oauth_callback_confirmed: string }> {
    const request_data = {
      url: TWITTER_REQUEST_TOKEN_URL,
      method: 'POST',
      data: {
        oauth_callback: this.callbackUrl,
      },
    };

    const token = {
      key: '',
      secret: '',
    };

    const headers = this.oauth.toHeader(this.oauth.authorize(request_data, token));

    const response = await fetch(TWITTER_REQUEST_TOKEN_URL, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `oauth_callback=${encodeURIComponent(this.callbackUrl)}`,
    });

    if (!response.ok) {
      throw new Error(`Failed to get request token: ${response.statusText}`);
    }

    const text = await response.text();
    const params = new URLSearchParams(text);

    return {
      oauth_token: params.get('oauth_token')!,
      oauth_token_secret: params.get('oauth_token_secret')!,
      oauth_callback_confirmed: params.get('oauth_callback_confirmed')!,
    };
  }

  /**
   * Step 2: Generate authorization URL
   */
  getAuthorizationUrl(oauth_token: string): string {
    return `${TWITTER_AUTHORIZE_URL}?oauth_token=${oauth_token}`;
  }

  /**
   * Step 3: Exchange verifier for access token
   */
  async getAccessToken(
    oauth_token: string,
    oauth_token_secret: string,
    oauth_verifier: string
  ): Promise<TwitterTokens> {
    const request_data = {
      url: TWITTER_ACCESS_TOKEN_URL,
      method: 'POST',
      data: {
        oauth_verifier,
      },
    };

    const token = {
      key: oauth_token,
      secret: oauth_token_secret,
    };

    const headers = this.oauth.toHeader(this.oauth.authorize(request_data, token));

    const response = await fetch(TWITTER_ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `oauth_verifier=${oauth_verifier}`,
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const text = await response.text();
    const params = new URLSearchParams(text);

    return {
      oauth_token: params.get('oauth_token')!,
      oauth_token_secret: params.get('oauth_token_secret')!,
      user_id: params.get('user_id')!,
      screen_name: params.get('screen_name')!,
    };
  }

  /**
   * Encrypt tokens for secure storage
   */
  encryptToken(token: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'base64');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      authTag: authTag.toString('hex'),
      iv: iv.toString('hex'),
    });
  }

  /**
   * Decrypt tokens for use
   */
  decryptToken(encryptedData: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'base64');
    
    const { encrypted, authTag, iv } = JSON.parse(encryptedData);
    
    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Store request token temporarily (in session or cache)
   */
  async storeRequestToken(
    oauth_token: string,
    oauth_token_secret: string
  ): Promise<void> {
    // In production, store in Redis or session
    // For now, we'll use a simple in-memory store
    // This should be replaced with proper session management
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        `twitter_request_${oauth_token}`,
        JSON.stringify({ oauth_token_secret })
      );
    }
  }

  /**
   * Retrieve request token secret
   */
  async getRequestTokenSecret(oauth_token: string): Promise<string | null> {
    if (typeof window !== 'undefined') {
      const data = sessionStorage.getItem(`twitter_request_${oauth_token}`);
      if (data) {
        const { oauth_token_secret } = JSON.parse(data);
        sessionStorage.removeItem(`twitter_request_${oauth_token}`);
        return oauth_token_secret;
      }
    }
    return null;
  }

  /**
   * Create OAuth headers for API requests
   */
  getAuthHeaders(
    url: string,
    method: string,
    oauth_token: string,
    oauth_token_secret: string,
    data?: any
  ): Record<string, string> {
    const token = {
      key: oauth_token,
      secret: oauth_token_secret,
    };

    const request_data = {
      url,
      method,
      data: data || {},
    };

    return this.oauth.toHeader(this.oauth.authorize(request_data, token));
  }
}

// Singleton instance
export const twitterAuth = new TwitterAuthService();