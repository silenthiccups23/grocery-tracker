import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { PriceAlert } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellRing, X, Check, Trash2 } from "lucide-react";

interface PriceAlertButtonProps {
  itemId: number;
  itemName: string;
}

export function PriceAlertButton({ itemId, itemName }: PriceAlertButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState("");

  const { data: alerts = [] } = useQuery<PriceAlert[]>({
    queryKey: ["/api/alerts/item", itemId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/alerts/item/${itemId}`);
      return res.json();
    },
  });

  const activeAlert = alerts.find(a => a.active === 1);

  const createMutation = useMutation({
    mutationFn: async (price: number) => {
      const res = await apiRequest("POST", "/api/alerts", {
        itemId,
        targetPrice: price,
        active: 1,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/item", itemId] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setTargetPrice("");
      setOpen(false);
      toast({ title: "Price alert set", description: `You'll be notified when ${itemName} drops to $${parseFloat(targetPrice).toFixed(2)} or less.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, price }: { id: number; price: number }) => {
      const res = await apiRequest("PATCH", `/api/alerts/${id}`, { targetPrice: price });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/item", itemId] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setTargetPrice("");
      setOpen(false);
      toast({ title: "Alert updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/alerts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/item", itemId] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setOpen(false);
      toast({ title: "Alert removed" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) return;

    if (activeAlert) {
      updateMutation.mutate({ id: activeAlert.id, price });
    } else {
      createMutation.mutate(price);
    }
  };

  const hasAlert = !!activeAlert;

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen && activeAlert) {
        setTargetPrice(activeAlert.targetPrice.toFixed(2));
      } else if (!isOpen) {
        setTargetPrice("");
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 min-h-[44px] min-w-[44px] focus:ring-2 focus:ring-blue-500 ${
            hasAlert
              ? "text-amber-500 hover:text-amber-600"
              : "text-muted-foreground hover:text-primary"
          }`}
          aria-label={hasAlert ? `Price alert active for ${itemName} at $${activeAlert.targetPrice.toFixed(2)}` : `Set price alert for ${itemName}`}
          data-testid={`button-alert-${itemId}`}
        >
          {hasAlert ? (
            <BellRing className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Bell className="w-4 h-4" aria-hidden="true" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">{hasAlert ? "Edit" : "Set"} Price Alert</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get notified when {itemName} drops to your target price.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="pl-7 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-500"
                aria-label="Target price"
                data-testid={`input-alert-price-${itemId}`}
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={!targetPrice || parseFloat(targetPrice) <= 0 || createMutation.isPending || updateMutation.isPending}
                className="flex-1 min-h-[44px] focus:ring-2 focus:ring-blue-500"
                data-testid={`button-save-alert-${itemId}`}
              >
                <Check className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                {hasAlert ? "Update" : "Set Alert"}
              </Button>

              {hasAlert && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => deleteMutation.mutate(activeAlert.id)}
                  disabled={deleteMutation.isPending}
                  className="min-h-[44px] text-destructive hover:text-destructive focus:ring-2 focus:ring-blue-500"
                  aria-label="Remove alert"
                  data-testid={`button-delete-alert-${itemId}`}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </Button>
              )}
            </div>
          </form>

          {activeAlert && (
            <div className="pt-1 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Alert: notify when price ≤ <span className="font-medium text-foreground">${activeAlert.targetPrice.toFixed(2)}</span>
              </p>
              {activeAlert.lastTriggered && (
                <p className="text-xs text-green-600 mt-0.5">
                  Last triggered: {activeAlert.lastTriggered}
                </p>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
