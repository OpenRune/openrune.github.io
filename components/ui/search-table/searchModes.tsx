export interface SearchMode {
  value: string;
  label: string;
  help: string;
}

export const SEARCH_MODES: SearchMode[] = [
  {
    value: 'gameval',
    label: 'Gameval',
    help: 'Search by game value (name). Supports comma, space, or newline separated values.\n\nUse quotes for exact matches: "exact value"\nWithout quotes for fuzzy matches: fuzzy value',
  },
  {
    value: 'id',
    label: 'ID',
    help: 'Search by ID. Supports:\n- Single ID: 123\n- Range: 100-200\n- Addition: 10 + 100\n- Multiple IDs separated by commas',
  },
  {
    value: 'name',
    label: 'Name',
    help: 'Search by name using text matching.',
  },
];

const searchModes: Record<string, SearchMode> = {};
SEARCH_MODES.forEach(mode => {
  searchModes[mode.value] = mode;
});

export default searchModes;






