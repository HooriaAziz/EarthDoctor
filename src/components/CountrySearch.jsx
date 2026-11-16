import { useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { EDGAR_COUNTRIES, getEdgarCountryProfile } from "../assets/edgarData";

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Country lookup over the bundled EDGAR country list (with aliases
// such as "USA" resolved by getEdgarCountryProfile).
export default function CountrySearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listId = useId();

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];

    const compact = q.replace(/\s/g, "");
    const matches = EDGAR_COUNTRIES.filter((country) => {
      const name = normalize(country.name);
      const code = String(country.code || "").toLowerCase();
      return name.includes(q) || code === compact;
    })
      .sort((a, b) => {
        const aStarts = normalize(a.name).startsWith(q) ? 0 : 1;
        const bStarts = normalize(b.name).startsWith(q) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name);
      })
      .slice(0, 8);

    const direct = getEdgarCountryProfile(query.trim());
    if (direct && !matches.some((item) => item.code === direct.code)) {
      return [direct, ...matches].slice(0, 8);
    }
    return matches;
  }, [query]);

  const showList = open && query.trim().length > 0;
  const safeIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));

  function choose(country) {
    onSelect(country);
    setQuery(country.name);
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      if (results[safeIndex]) {
        event.preventDefault();
        choose(results[safeIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="search" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Search countries
      </label>
      <Search size={14} className="search-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        className="search-input"
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck="false"
        placeholder="Search country…"
        value={query}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[safeIndex] ? `${listId}-${results[safeIndex].code}` : undefined}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {query ? (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
        >
          <X size={13} />
        </button>
      ) : (
        <kbd className="search-kbd" aria-hidden="true">
          ↵
        </kbd>
      )}

      {showList && (
        <ul className="search-results" id={listId} role="listbox" aria-label="Matching countries">
          {results.length > 0 ? (
            results.map((country, index) => (
              <li
                key={country.code}
                id={`${listId}-${country.code}`}
                role="option"
                aria-selected={index === safeIndex}
                className={index === safeIndex ? "is-active" : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(country)}
              >
                <span>{country.name}</span>
                <span className="mono search-code">{country.code}</span>
              </li>
            ))
          ) : (
            <li className="search-empty" role="option" aria-disabled="true" aria-selected="false">
              No matching country in the EDGAR list.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
