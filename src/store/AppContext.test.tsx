import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider, useApp } from './AppContext';
import React from 'react';

// Mock firebase
vi.mock('../firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => () => {}),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
}));

describe('AppContext', () => {
  it('should toggle saved reel', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppProvider>{children}</AppProvider>
    );
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.toggleSavedReel('reel1');
    });
    expect(result.current.savedReels).toContain('reel1');

    act(() => {
      result.current.toggleSavedReel('reel1');
    });
    expect(result.current.savedReels).not.toContain('reel1');
  });
});
