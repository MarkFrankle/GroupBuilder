/**
 * Tests for recentUploads utility functions.
 *
 * Tests localStorage management for recent uploads.
 */

import {
  saveRecentUpload,
  getRecentUploadIds,
  removeRecentUpload,
  clearRecentUploads
} from '../recentUploads'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    }
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('recentUploads utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('saveRecentUpload', () => {
    it('should save a new upload ID', () => {
      saveRecentUpload('session-123')

      const ids = getRecentUploadIds()
      expect(ids).toEqual(['session-123'])
    })

    it('should add new IDs to the front of the list', () => {
      saveRecentUpload('session-1')
      saveRecentUpload('session-2')
      saveRecentUpload('session-3')

      const ids = getRecentUploadIds()
      expect(ids).toEqual(['session-3', 'session-2', 'session-1'])
    })

    it('should remove duplicates and move to front', () => {
      saveRecentUpload('session-1')
      saveRecentUpload('session-2')
      saveRecentUpload('session-1')  // Duplicate

      const ids = getRecentUploadIds()
      expect(ids).toEqual(['session-1', 'session-2'])
      expect(ids.length).toBe(2)
    })

    it('should limit to MAX_RECENT_UPLOADS (10)', () => {
      // Add 12 uploads
      for (let i = 1; i <= 12; i++) {
        saveRecentUpload(`session-${i}`)
      }

      const ids = getRecentUploadIds()
      expect(ids.length).toBe(10)
      // Should keep the 10 most recent (12 down to 3)
      expect(ids[0]).toBe('session-12')
      expect(ids[9]).toBe('session-3')
    })

    it('should handle errors gracefully', () => {
      // Mock localStorage.setItem to throw
      const originalSetItem = localStorage.setItem
      localStorage.setItem = jest.fn(() => {
        throw new Error('Storage quota exceeded')
      })

      // Should not throw
      expect(() => saveRecentUpload('session-error')).not.toThrow()

      // Restore
      localStorage.setItem = originalSetItem
    })
  })

  describe('getRecentUploadIds', () => {
    it('should return empty array when no uploads', () => {
      const ids = getRecentUploadIds()
      expect(ids).toEqual([])
    })

    it('should return saved upload IDs', () => {
      saveRecentUpload('session-1')
      saveRecentUpload('session-2')

      const ids = getRecentUploadIds()
      expect(ids).toEqual(['session-2', 'session-1'])
    })

    it('should handle corrupted data gracefully', () => {
      // Set invalid JSON
      localStorage.setItem('groupbuilder_recent_uploads', 'invalid json')

      const ids = getRecentUploadIds()
      expect(ids).toEqual([])
    })

    it('should handle errors gracefully', () => {
      // Mock localStorage.getItem to throw
      const originalGetItem = localStorage.getItem
      localStorage.getItem = jest.fn(() => {
        throw new Error('Storage error')
      })

      // Should not throw
      expect(() => getRecentUploadIds()).not.toThrow()
      expect(getRecentUploadIds()).toEqual([])

      // Restore
      localStorage.getItem = originalGetItem
    })
  })

  describe('removeRecentUpload', () => {
    it('should remove specified upload ID', () => {
      saveRecentUpload('session-1')
      saveRecentUpload('session-2')
      saveRecentUpload('session-3')

      removeRecentUpload('session-2')

      const ids = getRecentUploadIds()
      expect(ids).toEqual(['session-3', 'session-1'])
    })

    it('should handle removing nonexistent ID', () => {
      saveRecentUpload('session-1')

      removeRecentUpload('session-nonexistent')

      const ids = getRecentUploadIds()
      expect(ids).toEqual(['session-1'])
    })

    it('should handle errors gracefully', () => {
      // Mock localStorage.setItem to throw
      const originalSetItem = localStorage.setItem
      localStorage.setItem = jest.fn(() => {
        throw new Error('Storage error')
      })

      // Should not throw
      expect(() => removeRecentUpload('session-1')).not.toThrow()

      // Restore
      localStorage.setItem = originalSetItem
    })
  })

  describe('clearRecentUploads', () => {
    it('should clear all uploads', () => {
      saveRecentUpload('session-1')
      saveRecentUpload('session-2')

      clearRecentUploads()

      const ids = getRecentUploadIds()
      expect(ids).toEqual([])
    })

    it('should handle errors gracefully', () => {
      // Mock localStorage.removeItem to throw
      const originalRemoveItem = localStorage.removeItem
      localStorage.removeItem = jest.fn(() => {
        throw new Error('Storage error')
      })

      // Should not throw
      expect(() => clearRecentUploads()).not.toThrow()

      // Restore
      localStorage.removeItem = originalRemoveItem
    })
  })

  describe('integration', () => {
    it('should handle complete workflow', () => {
      // Save multiple uploads
      saveRecentUpload('session-1')
      saveRecentUpload('session-2')
      saveRecentUpload('session-3')

      // Check they're all there
      expect(getRecentUploadIds().length).toBe(3)

      // Remove one
      removeRecentUpload('session-2')
      expect(getRecentUploadIds().length).toBe(2)
      expect(getRecentUploadIds()).not.toContain('session-2')

      // Add duplicate (should move to front)
      saveRecentUpload('session-1')
      expect(getRecentUploadIds()[0]).toBe('session-1')
      expect(getRecentUploadIds().length).toBe(2)

      // Clear all
      clearRecentUploads()
      expect(getRecentUploadIds()).toEqual([])
    })
  })
})
