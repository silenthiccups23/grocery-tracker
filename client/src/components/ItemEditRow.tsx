import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Item } from "@shared/schema";
import { TAG_OPTIONS, parseTags, UNITS, DEFAULT_UNITS, CATEGORY_ICONS, CATEGORY_UNITS } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";
import { CATEGORIES, unitLabels } from "@/lib/constants";

export function ItemEditRow({ item, onDone }: { item: Item; onDone: () => void }) {
  const { toast } = useToast();
  const [editName, setEditName] = useState(item.name);
  const [editCategory, setEditCategory] = useState(item.category || "");
  const [editTags, setEditTags] = useState<string[]>(parseTags(item));
  const [editUnit, setEditUnit] = useState(item.defaultUnit || "");

  const availableTags = editCategory ? (TAG_OPTIONS[editCategory] || TAG_OPTIONS["Other"]) : [];

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/items/${item.id}`, {
        name: editName.trim(),
        category: editCategory || null,
        tags: editTags.length > 0 ? JSON.stringify(editTags) : null,
        defaultUnit: editUnit || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      toast({ title: "Item updated" });
      onDone();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleTag = (tag: string) => {
    setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleCategoryChange = (cat: string) => {
    if (editCategory === cat) {
      setEditCategory("");
      setEditTags([]);
      setEditUnit("");
    } else {
      setEditCategory(cat);
      // Keep tags that exist in the new category, drop ones that don't
      const newAvailable = TAG_OPTIONS[cat] || [];
      setEditTags(prev => prev.filter(t => newAvailable.includes(t)));
      setEditUnit(DEFAULT_UNITS[cat] || "oz");
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-4 px-5 space-y-4">
        {/* Name */}
        <div>
          <Label htmlFor={`edit-name-input-${item.id}`} className="text-xs font-medium text-muted-foreground mb-1 block">Name</Label>
          <Input
            id={`edit-name-input-${item.id}`}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="text-sm w-full min-h-[44px] focus:ring-2 focus:ring-blue-500"
            aria-label={`Item name for ${item.name}`}
            data-testid={`edit-name-${item.id}`}
          />
        </div>

        {/* Category */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</Label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category selection">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className={`text-xs px-2.5 py-1.5 min-h-[44px] rounded-md border transition-colors focus:ring-2 focus:ring-blue-500 ${
                  editCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-muted"
                }`}
                aria-pressed={editCategory === cat}
                aria-label={`Set category to ${cat}`}
              >
                <span aria-hidden="true">{CATEGORY_ICONS[cat] || "📦"}</span> {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Unit */}
        {editCategory && (
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Measured in</Label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Unit of measurement selection">
              {(CATEGORY_UNITS[editCategory] || UNITS).map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setEditUnit(u)}
                  className={`text-xs px-2.5 py-1.5 min-h-[44px] rounded-md border transition-colors focus:ring-2 focus:ring-blue-500 ${
                    editUnit === u
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                  aria-pressed={editUnit === u}
                  aria-label={`Measure in ${unitLabels[u] || u}`}
                >
                  {unitLabels[u] || u}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {editCategory && availableTags.length > 0 && (
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</Label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Type tags">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-2.5 py-1.5 min-h-[44px] rounded-md border transition-colors focus:ring-2 focus:ring-blue-500 ${
                    editTags.includes(tag)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                  aria-pressed={editTags.includes(tag)}
                  aria-label={`${editTags.includes(tag) ? "Remove" : "Add"} tag: ${tag}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Save / Cancel */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !editName.trim()}
            className="min-h-[44px] focus:ring-2 focus:ring-blue-500"
            aria-label={updateMutation.isPending ? "Saving changes" : `Save changes to ${item.name}`}
            data-testid={`button-save-edit-${item.id}`}
          >
            <Check className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={onDone} className="min-h-[44px] focus:ring-2 focus:ring-blue-500" aria-label={`Cancel editing ${item.name}`} data-testid={`button-cancel-edit-${item.id}`}>
            <X className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
