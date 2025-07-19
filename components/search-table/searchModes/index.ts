import gameval, { SearchModeConfig } from "./gameval";
import id from "./id";
import name from "./name";
import regex from "./regex";

const searchModes: Record<string, SearchModeConfig> = {
    gameval,
    id,
    name,
    regex,
};

export const SEARCH_MODES: SearchModeConfig[] = Object.values(searchModes);
export default searchModes; 