import { useState, useEffect, useRef, useCallback } from 'react';
import type { Settings } from '@tracearr/shared';
import { useUpdateSettings } from './queries/useSettings';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseDebouncedSaveOptions {
  delay?: number;
  onSaved?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for debounced auto-saving of settings fields.
 * Saves automatically after the specified delay (default 1s) of inactivity.
 * Shows toast notifications for saved/error states.
 */
export function useDebouncedSave<K extends keyof Settings>(
  key: K,
  serverValue: Settings[K] | undefined,
  options: UseDebouncedSaveOptions = {}
) {
  const { delay = 500, onSaved, onError } = options;

  const [value, setValue] = useState<Settings[K] | undefined>(serverValue);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const updateSettings = useUpdateSettings();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<Settings[K] | undefined>(serverValue);

  // Sync with server value when it changes externally
  useEffect(() => {
    setValue(serverValue);
    lastSavedRef.current = serverValue;
  }, [serverValue]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Debounced save effect
  useEffect(() => {
    // Don't save if value matches last saved value
    if (value === lastSavedRef.current) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setStatus('saving');

    timeoutRef.current = setTimeout(() => {
      updateSettings.mutate({ [key]: value ?? null } as Partial<Settings>, {
        onSuccess: () => {
          lastSavedRef.current = value;
          setStatus('saved');
          onSaved?.();
          setTimeout(() => setStatus('idle'), 2000);
        },
        onError: (err) => {
          setStatus('error');
          onError?.(err);
        },
      });
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, key, delay, updateSettings, onSaved, onError]);

  // Force immediate save (useful for programmatic changes like "Detect" button)
  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (value !== lastSavedRef.current) {
      setStatus('saving');
      updateSettings.mutate({ [key]: value ?? null } as Partial<Settings>, {
        onSuccess: () => {
          lastSavedRef.current = value;
          setStatus('saved');
          onSaved?.();
          setTimeout(() => setStatus('idle'), 2000);
        },
        onError: (err) => {
          setStatus('error');
          onError?.(err);
        },
      });
    }
  }, [value, key, updateSettings, onSaved, onError]);

  return {
    value: value ?? ('' as Settings[K]),
    setValue,
    status,
    saveNow,
    isDirty: value !== lastSavedRef.current,
  };
}
