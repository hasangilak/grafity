/**
 * Search Panel Component
 *
 * Provides UI for searching conversation messages with:
 * - Real-time search input
 * - Filters (role, date, branch, code links)
 * - Results list with highlighted snippets
 * - Keyboard navigation
 * - Recent searches
 */

import React, { useState, useEffect, useRef } from 'react';
import { SearchQuery, SearchResult } from '../../core/graph-engine/chat/SemanticSearch';

export interface SearchPanelProps {
  onSearch: (query: SearchQuery) => SearchResult[];
  onResultClick: (messageId: string) => void;
  onClose: () => void;
  availableBranches?: Array<{ id: string; name: string }>;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onSearch,
  onResultClick,
  onClose,
  availableBranches = []
}) => {
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Filters
  const [roleFilter, setRoleFilter] = useState<'user' | 'assistant' | 'system' | 'all'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<[Date, Date] | undefined>();
  const [branchFilter, setBranchFilter] = useState<string[]>([]);
  const [codeLinksFilter, setCodeLinksFilter] = useState<boolean | undefined>();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Perform search
  useEffect(() => {
    if (searchText.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    const query: SearchQuery = {
      text: searchText,
      filters: {
        messageRole: roleFilter !== 'all' ? roleFilter : undefined,
        dateRange: dateRangeFilter,
        branchIds: branchFilter.length > 0 ? branchFilter : undefined,
        hasCodeLinks: codeLinksFilter
      },
      limit: 50
    };

    try {
      const searchResults = onSearch(query);
      setResults(searchResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    }

    setIsSearching(false);
  }, [searchText, roleFilter, dateRangeFilter, branchFilter, codeLinksFilter, onSearch]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleResultClick(results[selectedIndex].message.id);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex, onClose]);

  // Scroll selected result into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (searchText.trim()) {
      // Add to recent searches
      setRecentSearches(prev => {
        const newRecent = [searchText, ...prev.filter(s => s !== searchText)].slice(0, 5);
        return newRecent;
      });
    }
  };

  const handleResultClick = (messageId: string) => {
    onResultClick(messageId);
  };

  const handleRecentSearchClick = (search: string) => {
    setSearchText(search);
  };

  const toggleBranchFilter = (branchId: string) => {
    setBranchFilter(prev =>
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  };

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>🔍 Search Messages</h2>
        <button style={styles.closeButton} onClick={onClose}>✕</button>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
        <input
          ref={searchInputRef}
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search messages..."
          style={styles.searchInput}
        />
        {isSearching && <div style={styles.spinner}>⏳</div>}
      </form>

      {/* Filters */}
      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Role:</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            style={styles.filterSelect}
          >
            <option value="all">All</option>
            <option value="user">User</option>
            <option value="assistant">Assistant</option>
            <option value="system">System</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>
            <input
              type="checkbox"
              checked={codeLinksFilter === true}
              onChange={(e) => setCodeLinksFilter(e.target.checked ? true : undefined)}
            />
            Has code links
          </label>
        </div>

        {availableBranches.length > 0 && (
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Branches:</label>
            <div style={styles.branchFilters}>
              {availableBranches.map(branch => (
                <label key={branch.id} style={styles.branchLabel}>
                  <input
                    type="checkbox"
                    checked={branchFilter.includes(branch.id)}
                    onChange={() => toggleBranchFilter(branch.id)}
                  />
                  {branch.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div style={styles.resultsContainer} ref={resultsRef}>
        {searchText.trim().length < 2 && (
          <div style={styles.hint}>
            <p>Enter at least 2 characters to search</p>
            {recentSearches.length > 0 && (
              <div style={styles.recentSearches}>
                <h4 style={styles.recentTitle}>Recent Searches:</h4>
                {recentSearches.map((search, i) => (
                  <button
                    key={i}
                    style={styles.recentSearchButton}
                    onClick={() => handleRecentSearchClick(search)}
                  >
                    🕒 {search}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {searchText.trim().length >= 2 && results.length === 0 && !isSearching && (
          <div style={styles.noResults}>
            <p>No messages found matching "{searchText}"</p>
            <p style={styles.noResultsHint}>Try different keywords or adjust filters</p>
          </div>
        )}

        {results.map((result, index) => (
          <div
            key={result.message.id}
            style={{
              ...styles.resultItem,
              ...(index === selectedIndex ? styles.resultItemSelected : {})
            }}
            onClick={() => handleResultClick(result.message.id)}
          >
            <div style={styles.resultHeader}>
              <span style={styles.resultRole}>
                {result.message.metadata?.role === 'user' ? '👤' : '🤖'}{' '}
                {result.message.metadata?.role || 'unknown'}
              </span>
              <span style={styles.resultScore}>
                {Math.round(result.relevanceScore * 100)}% match
              </span>
            </div>

            <div style={styles.resultContent}>
              {result.matchedContent.length > 0 ? (
                result.matchedContent.map((snippet, i) => (
                  <div key={i} style={styles.snippet}>
                    ...{snippet}...
                  </div>
                ))
              ) : (
                <div style={styles.snippet}>
                  {result.message.content?.substring(0, 150)}...
                </div>
              )}
            </div>

            <div style={styles.resultMeta}>
              {result.message.timestamp && (
                <span style={styles.metaItem}>
                  ⏱️ {new Date(result.message.timestamp).toLocaleString()}
                </span>
              )}
              {result.context.linkedCode.length > 0 && (
                <span style={styles.metaItem}>
                  📄 {result.context.linkedCode.length} file(s)
                </span>
              )}
              {result.context.relatedMessages.length > 0 && (
                <span style={styles.metaItem}>
                  🔗 {result.context.relatedMessages.length} related
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <span style={styles.footerText}>
          {results.length} result{results.length !== 1 ? 's' : ''}
        </span>
        <span style={styles.footerHint}>
          ↑↓ Navigate • Enter to select • Esc to close
        </span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: '400px',
    height: '100vh',
    backgroundColor: 'white',
    borderRight: '1px solid #ddd',
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#333'
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  searchForm: {
    padding: '16px 20px',
    borderBottom: '1px solid #eee',
    position: 'relative' as const
  },
  searchInput: {
    width: '100%',
    padding: '10px 40px 10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none'
  },
  spinner: {
    position: 'absolute' as const,
    right: '30px',
    top: '26px',
    fontSize: '16px'
  },
  filters: {
    padding: '12px 20px',
    borderBottom: '1px solid #eee',
    backgroundColor: '#f9f9f9'
  },
  filterGroup: {
    marginBottom: '8px'
  },
  filterLabel: {
    fontSize: '13px',
    color: '#666',
    marginRight: '8px'
  },
  filterSelect: {
    padding: '4px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px'
  },
  branchFilters: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    marginTop: '4px'
  },
  branchLabel: {
    fontSize: '12px',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  resultsContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '8px'
  },
  hint: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#999'
  },
  recentSearches: {
    marginTop: '20px',
    textAlign: 'left' as const
  },
  recentTitle: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '8px'
  },
  recentSearchButton: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    marginBottom: '4px',
    backgroundColor: '#f0f0f0',
    border: 'none',
    borderRadius: '4px',
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontSize: '13px',
    color: '#333'
  },
  noResults: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    color: '#666'
  },
  noResultsHint: {
    fontSize: '13px',
    color: '#999',
    marginTop: '8px'
  },
  resultItem: {
    padding: '12px',
    marginBottom: '8px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  resultItemSelected: {
    backgroundColor: '#e7f3ff',
    border: '2px solid #2196F3'
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  resultRole: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize' as const
  },
  resultScore: {
    fontSize: '11px',
    color: '#666',
    backgroundColor: '#e0e0e0',
    padding: '2px 6px',
    borderRadius: '10px'
  },
  resultContent: {
    marginBottom: '8px'
  },
  snippet: {
    fontSize: '13px',
    color: '#333',
    lineHeight: '1.5',
    marginBottom: '4px'
  },
  resultMeta: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const
  },
  metaItem: {
    fontSize: '11px',
    color: '#999'
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9'
  },
  footerText: {
    fontSize: '12px',
    color: '#666',
    fontWeight: '600'
  },
  footerHint: {
    fontSize: '11px',
    color: '#999'
  }
};
