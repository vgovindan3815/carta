'use client';

import { useState, useCallback } from 'react';

const KEY_STORAGE = 'maven_byok_key';
const PROVIDER_STORAGE = 'maven_byok_provider';
const GUEST_ACK_STORAGE = 'maven_guest_ack';
const BANNER_DISMISSED_STORAGE = 'maven_banner_dismissed';

export type ByokProvider = 'groq' | 'openai' | 'anthropic';

export interface ApiKeyState {
  provider: ByokProvider | null;
  key: string | null;
  isGuest: boolean;
  bannerDismissed: boolean;
}

function readState(): ApiKeyState {
  if (typeof window === 'undefined') {
    return { provider: null, key: null, isGuest: false, bannerDismissed: false };
  }
  return {
    provider: (sessionStorage.getItem(PROVIDER_STORAGE) as ByokProvider | null),
    key: sessionStorage.getItem(KEY_STORAGE),
    isGuest: sessionStorage.getItem(GUEST_ACK_STORAGE) === '1',
    bannerDismissed: sessionStorage.getItem(BANNER_DISMISSED_STORAGE) === '1',
  };
}

export function useApiKey() {
  const [state, setState] = useState<ApiKeyState>(readState);

  const setKey = useCallback((provider: ByokProvider, key: string) => {
    sessionStorage.setItem(PROVIDER_STORAGE, provider);
    sessionStorage.setItem(KEY_STORAGE, key);
    setState(prev => ({ ...prev, provider, key }));
  }, []);

  const clearKey = useCallback(() => {
    sessionStorage.removeItem(PROVIDER_STORAGE);
    sessionStorage.removeItem(KEY_STORAGE);
    setState(prev => ({ ...prev, provider: null, key: null }));
  }, []);

  const acknowledgeGuest = useCallback(() => {
    sessionStorage.setItem(GUEST_ACK_STORAGE, '1');
    // Cookie lets server middleware detect guest mode across navigations
    document.cookie = 'mkp_guest=1; path=/; SameSite=Lax';
    setState(prev => ({ ...prev, isGuest: true }));
  }, []);

  const dismissBanner = useCallback(() => {
    sessionStorage.setItem(BANNER_DISMISSED_STORAGE, '1');
    setState(prev => ({ ...prev, bannerDismissed: true }));
  }, []);

  /** Returns headers to attach to fetch calls for BYOK authentication. */
  const byokHeaders = useCallback((): Record<string, string> => {
    const { provider, key } = readState();
    if (!provider || !key) return {};
    return {
      'X-Maven-Provider': provider,
      'X-Maven-Api-Key': key,
    };
  }, []);

  /** Returns URL query params for EventSource URLs (which can't set headers). */
  const byokParams = useCallback((): string => {
    const { provider, key } = readState();
    if (!provider || !key) return '';
    return `?p=${encodeURIComponent(provider)}&k=${encodeURIComponent(key)}`;
  }, []);

  return {
    ...state,
    setKey,
    clearKey,
    acknowledgeGuest,
    dismissBanner,
    byokHeaders,
    byokParams,
  };
}
