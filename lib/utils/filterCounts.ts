// Utility functions for calculating filtered counts

interface FilterCountInfo {
  totalEntries?: number;
  [key: string]: number | undefined;
}

export function calculateFilteredCount(
  info: FilterCountInfo | null,
  filterState: Record<string, boolean>,
  filterConfig: {
    filterKey: string;
    countField: string;
    requireNameField?: string;
  }
): number {
  if (!info) return 0;

  const filterActive = filterState[filterConfig.filterKey] || false;
  const requireName = filterState.requireName || false;

  // If both filters are active, approximate intersection
  if (filterActive && requireName && filterConfig.requireNameField) {
    return Math.min(
      info[filterConfig.countField] || 0,
      info[filterConfig.requireNameField] || 0
    );
  }

  if (filterActive) {
    return info[filterConfig.countField] || 0;
  }

  if (requireName && filterConfig.requireNameField) {
    return info[filterConfig.requireNameField] || 0;
  }

  return info.totalEntries || 0;
}


