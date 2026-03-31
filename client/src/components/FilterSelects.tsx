import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, ChevronDown, Ruler } from "lucide-react";
import { formatSize } from "@shared/schema";
import { parseSizeKey } from "@/lib/priceUtils";

export function TagMultiSelect({
  allTags,
  selectedTags,
  onToggle,
  onClear,
}: {
  allTags: string[];
  selectedTags: Set<string>;
  onToggle: (tag: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedCount = allTags.filter((t) => selectedTags.has(t)).length;
  const selectedLabels = allTags
    .filter((t) => selectedTags.has(t))
    .join(", ");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs justify-between w-full sm:w-auto min-w-[140px] max-w-[280px] focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          data-testid="button-tag-filter"
          aria-label={selectedCount === 0 ? "Filter by product type" : `Filter by type: ${selectedLabels}`}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <Filter className="w-3 h-3 mr-1.5 shrink-0 opacity-50" aria-hidden="true" />
          <span className="truncate text-left">
            {selectedCount === 0
              ? "Filter by type..."
              : selectedLabels}
          </span>
          <ChevronDown className="w-3.5 h-3.5 ml-1.5 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <p className="text-xs font-medium text-muted-foreground px-2 mb-1.5">
          Must match ALL selected
        </p>
        <div className="space-y-1">
          {allTags.map((tag) => {
            const isChecked = selectedTags.has(tag);
            return (
              <label
                key={tag}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
                data-testid={`checkbox-tag-${tag}`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggle(tag)}
                />
                <span className={isChecked ? "font-medium" : ""}>{tag}</span>
              </label>
            );
          })}
        </div>
        {selectedCount > 0 && (
          <div className="border-t border-border mt-1.5 pt-1.5 px-2">
            <button
              className="text-xs text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              onClick={onClear}
              data-testid="button-clear-filter"
              aria-label="Clear type filter"
            >
              Clear filter
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function SizeMultiSelect({
  allSizes,
  selectedSizes,
  onToggle,
  onClear,
}: {
  allSizes: string[]; // sizeKey strings
  selectedSizes: Set<string>;
  onToggle: (key: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedCount = allSizes.filter((s) => selectedSizes.has(s)).length;
  const selectedLabels = allSizes
    .filter((s) => selectedSizes.has(s))
    .map((s) => {
      const parsed = parseSizeKey(s);
      return parsed ? formatSize(parsed.size, parsed.unit) : s;
    })
    .join(", ");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs justify-between w-full sm:w-auto min-w-[120px] max-w-[240px] focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          data-testid="button-size-filter"
          aria-label={selectedCount === 0 ? "Filter by size" : `Filter by size: ${selectedLabels}`}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <Ruler className="w-3 h-3 mr-1.5 shrink-0 opacity-50" aria-hidden="true" />
          <span className="truncate text-left">
            {selectedCount === 0
              ? "Filter by size..."
              : selectedLabels}
          </span>
          <ChevronDown className="w-3.5 h-3.5 ml-1.5 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <p className="text-xs font-medium text-muted-foreground px-2 mb-1.5">
          Show selected sizes
        </p>
        <div className="space-y-1">
          {allSizes.map((sk) => {
            const parsed = parseSizeKey(sk);
            const label = parsed ? formatSize(parsed.size, parsed.unit) : sk;
            const isChecked = selectedSizes.has(sk);
            return (
              <label
                key={sk}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
                data-testid={`checkbox-size-${sk}`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggle(sk)}
                />
                <span className={isChecked ? "font-medium" : ""}>{label}</span>
              </label>
            );
          })}
        </div>
        {selectedCount > 0 && (
          <div className="border-t border-border mt-1.5 pt-1.5 px-2">
            <button
              className="text-xs text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              onClick={onClear}
              data-testid="button-clear-size-filter"
              aria-label="Clear size filter"
            >
              Clear filter
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
