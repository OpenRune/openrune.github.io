"use client";

import {
  forwardRef,
  useCallback,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { GamevalType, useGamevals } from "@/lib/gamevals";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

export interface SearchModeOption {
  value: string;
  label: string;
  placeholder?: string;
}

export interface GamevalSuggestion {
  name: string;
  id: number;
}

const DEFAULT_OPTIONS: SearchModeOption[] = [
  { value: "gameval", label: "Gameval", placeholder: "Search by gameval..." },
  { value: "id", label: "ID", placeholder: "Search by ID..." },
];

interface GamevalIdSearchProps {
  mode: string;
  value: string;
  onValueChange: (value: string, mode: string) => void;
  onModeChange: (mode: string) => void;
  onEnter?: (value: string, mode: string) => void;
  onSuggestionSelect?: (
    suggestion: GamevalSuggestion,
    mode: string
  ) => boolean | void;
  modeOptions?: SearchModeOption[];
  disabledModes?: string[];
  placeholder?: string;
  gamevalType?: GamevalType;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  disabled?: boolean;
  suggestionLimit?: number;
  inputProps?: Omit<
    React.ComponentProps<typeof Input>,
    "value" | "onChange" | "onKeyDown" | "placeholder" | "ref" | "disabled"
  >;
}

export const GamevalIdSearch = forwardRef<HTMLInputElement, GamevalIdSearchProps>(
  (
    {
      mode,
      value,
      onValueChange,
      onModeChange,
      onEnter,
      onSuggestionSelect,
      modeOptions = DEFAULT_OPTIONS,
      disabledModes = [],
      placeholder,
      gamevalType,
      className,
      inputClassName,
      dropdownClassName,
      disabled,
      suggestionLimit = 10,
      inputProps,
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const [suggestions, setSuggestions] = useState<GamevalSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const { getGamevalEntries, loadGamevalType } = useGamevals();
    const deferredValue = useDeferredValue(value);

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const effectivePlaceholder = useMemo(() => {
      if (placeholder) return placeholder;
      const option = modeOptions.find((opt) => opt.value === mode);
      return option?.placeholder ?? "Search...";
    }, [placeholder, mode, modeOptions]);

    useEffect(() => {
      if (mode === "gameval" && gamevalType) {
        loadGamevalType(gamevalType).catch(console.error);
      }
    }, [mode, gamevalType, loadGamevalType]);

    const gamevalEntries = useMemo(() => {
      if (mode !== "gameval" || !gamevalType) return undefined;
      return getGamevalEntries(gamevalType);
    }, [mode, gamevalType, getGamevalEntries]);

    const updateSuggestions = useCallback(
      (query: string) => {
        if (mode !== "gameval" || !query.trim() || !gamevalEntries) {
          setSuggestions([]);
          setShowSuggestions(false);
          return;
        }

        const normalizedQuery = query.trim().replace(/\s+/g, "_");
        const normalizedLower = normalizedQuery.toLowerCase();
        const originalLower = query.trim().toLowerCase();

        const nextSuggestions = gamevalEntries
          .filter(({ lowerName }) => {
            return (
              lowerName.includes(normalizedLower) ||
              lowerName.includes(originalLower)
            );
          })
          .slice(0, suggestionLimit)
          .map(({ name, id }) => ({ name, id }));

        setSuggestions(nextSuggestions);
        setShowSuggestions(true);
      },
      [gamevalEntries, mode, suggestionLimit]
    );

    useEffect(() => {
      if (mode !== "gameval") {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, [mode]);

    useEffect(() => {
      if (mode === "gameval") {
        updateSuggestions(deferredValue);
      }
    }, [mode, deferredValue, updateSuggestions]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          suggestionsRef.current &&
          !suggestionsRef.current.contains(event.target as Node) &&
          inputRef.current &&
          !inputRef.current.contains(event.target as Node)
        ) {
          setShowSuggestions(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        let nextValue = event.target.value;

        if (mode === "id") {
          nextValue = nextValue.replace(/[^0-9+\s]/g, "");
          nextValue = nextValue.replace(/(?<!\d)\+/g, "");
          nextValue = nextValue.replace(/\+\+/g, "+");
        }

        onValueChange(nextValue, mode);

        if (mode !== "gameval") {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      },
      [mode, onValueChange]
    );

    const handleFocus = useCallback(() => {
        if (mode === "gameval") {
          if (suggestions.length > 0 || deferredValue.trim().length > 0) {
            setShowSuggestions(true);
          }
      }
    }, [mode, suggestions.length, deferredValue]);

    const handleBlur = useCallback(() => {
      window.setTimeout(() => setShowSuggestions(false), 150);
    }, []);

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
          if (onEnter) {
            event.preventDefault();
            onEnter(value.trim(), mode);
          }
        }
      },
      [onEnter, value, mode]
    );

    const handleSuggestionClick = useCallback(
      (suggestion: GamevalSuggestion) => {
        const handled = onSuggestionSelect?.(suggestion, mode);
        if (!handled) {
          const nextValue =
            mode === "gameval" ? suggestion.name : suggestion.id.toString();
          onValueChange(nextValue, mode);
        }
        setShowSuggestions(false);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      },
      [mode, onSuggestionSelect, onValueChange]
    );

    const currentOptions = modeOptions.length > 0 ? modeOptions : DEFAULT_OPTIONS;

    return (
      <div className={cn("relative w-full", className)}>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
          <Input
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={effectivePlaceholder}
            disabled={disabled}
            className={cn("pl-8 pr-24 h-9 text-sm", inputClassName)}
            {...inputProps}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "absolute right-0 top-1/2 -translate-y-1/2 h-8 px-3 min-w-[100px] rounded-l-none flex items-center justify-center border-l text-xs",
                  dropdownClassName
                )}
                disabled={disabled}
              >
                {currentOptions.find((opt) => opt.value === mode)?.label ?? "Mode"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" className="mt-1">
              {currentOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  disabled={disabledModes.includes(option.value)}
                  onClick={() => {
                    if (!disabledModes.includes(option.value)) {
                      onModeChange(option.value);
                    }
                  }}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {mode === "gameval" && showSuggestions && (
          <Command
            ref={suggestionsRef}
            className="absolute top-full z-50 mt-1 w-full h-auto max-h-56 overflow-hidden border bg-popover text-popover-foreground shadow-md"
          >
            <CommandList className="max-h-56 overflow-y-auto">
              {suggestions.length === 0 ? (
                <CommandEmpty className="px-3 py-2 text-sm text-muted-foreground">
                  No suggestions found.
                </CommandEmpty>
              ) : (
                <CommandGroup>
                  {suggestions.map((suggestion) => (
                    <CommandItem
                      key={`${suggestion.name}-${suggestion.id}`}
                      value={suggestion.name}
                      onSelect={() => handleSuggestionClick(suggestion)}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-mono"
                    >
                      <span className="truncate">{suggestion.name}</span>
                      <span className="text-muted-foreground">ID: {suggestion.id}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        )}
      </div>
    );
  }
);

GamevalIdSearch.displayName = "GamevalIdSearch";


