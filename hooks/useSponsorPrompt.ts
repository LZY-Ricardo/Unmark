'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';

export type SponsorTriggerSource = 'entry' | 'parse' | 'download';

type SponsorPromptState = {
  parseClicks: number;
  downloadClicks: number;
  lastPromptAt: number;
};

const STORAGE_KEY = 'unmark_sponsor_prompt_v1';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

const DEFAULT_STATE: SponsorPromptState = {
  parseClicks: 0,
  downloadClicks: 0,
  lastPromptAt: 0,
};

function readState(): SponsorPromptState {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_STATE;
    }

    const parsed = JSON.parse(raw) as Partial<SponsorPromptState>;
    return {
      parseClicks: Number.isFinite(parsed.parseClicks) ? Math.max(parsed.parseClicks ?? 0, 0) : 0,
      downloadClicks: Number.isFinite(parsed.downloadClicks) ? Math.max(parsed.downloadClicks ?? 0, 0) : 0,
      lastPromptAt: Number.isFinite(parsed.lastPromptAt) ? Math.max(parsed.lastPromptAt ?? 0, 0) : 0,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function track(event: string, properties: Record<string, string | number | boolean>): void {
  try {
    posthog.capture(event, properties);
  } catch {
    // Ignore analytics failures.
  }
}

export function useSponsorPrompt() {
  const stateRef = useRef<SponsorPromptState>(DEFAULT_STATE);
  const hydratedRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [triggerSource, setTriggerSource] = useState<SponsorTriggerSource>('entry');

  useEffect(() => {
    stateRef.current = readState();
    hydratedRef.current = true;
  }, []);

  const persist = useCallback(() => {
    if (!hydratedRef.current || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const openModal = useCallback((source: SponsorTriggerSource, mode: 'auto' | 'manual') => {
    setTriggerSource(source);
    setIsOpen(true);
    track('sponsor_modal_show', { source, mode });
  }, []);

  const canShowAutoPrompt = useCallback(() => {
    const now = Date.now();
    return now - stateRef.current.lastPromptAt >= COOLDOWN_MS;
  }, []);

  const markPromptShown = useCallback(() => {
    stateRef.current.lastPromptAt = Date.now();
    persist();
  }, [persist]);

  const handleParseAction = useCallback(() => {
    stateRef.current.parseClicks += 1;

    const shouldPrompt = stateRef.current.parseClicks >= 2 && stateRef.current.parseClicks % 2 === 0;
    if (shouldPrompt && canShowAutoPrompt()) {
      markPromptShown();
      openModal('parse', 'auto');
      return;
    }

    persist();
  }, [canShowAutoPrompt, markPromptShown, openModal, persist]);

  const handleDownloadAction = useCallback(() => {
    stateRef.current.downloadClicks += 1;

    const shouldPrompt =
      stateRef.current.downloadClicks === 1 || stateRef.current.downloadClicks % 3 === 0;

    if (shouldPrompt && canShowAutoPrompt()) {
      markPromptShown();
      openModal('download', 'auto');
      return;
    }

    persist();
  }, [canShowAutoPrompt, markPromptShown, openModal, persist]);

  const openManualPrompt = useCallback(() => {
    markPromptShown();
    openModal('entry', 'manual');
  }, [markPromptShown, openModal]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    track('sponsor_modal_dismiss', { source: triggerSource });
  }, [triggerSource]);

  const recordSponsorClick = useCallback(() => {
    track('sponsor_click', { source: triggerSource });
  }, [triggerSource]);

  return {
    isOpen,
    triggerSource,
    openManualPrompt,
    closeModal,
    recordSponsorClick,
    handleParseAction,
    handleDownloadAction,
  };
}
