import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, ArrowLeft, Key, CheckCircle, AlertCircle, ExternalLink, Loader2 } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();

  // Kroger state
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const { data: krogerStatus } = useQuery<{ configured: boolean; clientId: string | null }>({
    queryKey: ["/api/settings/kroger"],
  });
  const saveKrogerMutation = useMutation({
    mutationFn: async (data: { clientId: string; clientSecret: string }) => {
      const res = await apiRequest("POST", "/api/settings/kroger", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/kroger"] });
      setClientId("");
      setClientSecret("");
      toast({ title: "API connected", description: "Kroger API credentials verified and saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  // Costco / RapidAPI state
  const [rapidApiKey, setRapidApiKey] = useState("");
  const { data: costcoStatus } = useQuery<{ configured: boolean; keyPreview: string | null }>({
    queryKey: ["/api/settings/costco"],
  });
  const saveCostcoMutation = useMutation({
    mutationFn: async (data: { apiKey: string }) => {
      const res = await apiRequest("POST", "/api/settings/costco", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/costco"] });
      setRapidApiKey("");
      toast({ title: "Costco API connected", description: "RapidAPI key verified and saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  const handleKrogerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) return;
    saveKrogerMutation.mutate({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
  };

  const handleCostcoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rapidApiKey.trim()) return;
    saveCostcoMutation.mutate({ apiKey: rapidApiKey.trim() });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Kroger API Configuration */}
        <Card>
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center gap-3 mb-4">
              <Key className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-sm font-semibold">Kroger API Connection</h2>
                <p className="text-xs text-muted-foreground">Connect to get real-time grocery prices</p>
              </div>
              {krogerStatus?.configured && (
                <div className="ml-auto flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Connected
                </div>
              )}
            </div>

            {krogerStatus?.configured ? (
              <div className="space-y-3">
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                  <p className="text-sm text-green-800 dark:text-green-200 font-medium">API is connected</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                    Client ID: {krogerStatus.clientId}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  To update your credentials, enter new ones below.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Not connected
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    Connect the Kroger API to fetch real grocery prices automatically.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs font-medium mb-2">How to get your free API credentials:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>
                  Go to{" "}
                  <a
                    href="https://developer.kroger.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline inline-flex items-center gap-0.5"
                  >
                    developer.kroger.com <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </li>
                <li>Click "Create an Account" and verify your email</li>
                <li>Click "Register App" on the dashboard</li>
                <li>Name it anything (e.g. "GroceryTrack"), set redirect URI to http://localhost</li>
                <li>Copy your Client ID and Client Secret and paste them below</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">It's completely free — 10,000 API calls per day.</p>
            </div>

            <form onSubmit={handleKrogerSubmit} className="space-y-3">
              <div>
                <Label htmlFor="kroger-client-id" className="text-xs font-medium">Client ID</Label>
                <Input
                  id="kroger-client-id"
                  placeholder="Paste your Kroger Client ID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="mt-1 font-mono text-sm"
                  data-testid="input-kroger-client-id"
                />
              </div>
              <div>
                <Label htmlFor="kroger-client-secret" className="text-xs font-medium">Client Secret</Label>
                <Input
                  id="kroger-client-secret"
                  type="password"
                  placeholder="Paste your Kroger Client Secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="mt-1 font-mono text-sm"
                  data-testid="input-kroger-client-secret"
                />
              </div>
              <Button
                type="submit"
                disabled={saveKrogerMutation.isPending || !clientId.trim() || !clientSecret.trim()}
                data-testid="button-save-kroger"
              >
                {saveKrogerMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Key className="w-4 h-4 mr-1.5" />
                )}
                {saveKrogerMutation.isPending ? "Verifying..." : "Connect API"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Costco API Configuration */}
        <Card>
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center gap-3 mb-4">
              <Key className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-sm font-semibold">Costco API Connection</h2>
                <p className="text-xs text-muted-foreground">Connect to get real-time Costco prices</p>
              </div>
              {costcoStatus?.configured && (
                <div className="ml-auto flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Connected
                </div>
              )}
            </div>

            {costcoStatus?.configured ? (
              <div className="space-y-3">
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                  <p className="text-sm text-green-800 dark:text-green-200 font-medium">API is connected</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                    API Key: {costcoStatus.keyPreview}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  To update your key, enter a new one below.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Not connected
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    Connect a RapidAPI key to get Costco product prices. Add a Costco store to see its prices.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs font-medium mb-2">How to get your free API key:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>
                  Go to{" "}
                  <a
                    href="https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-costco-data"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline inline-flex items-center gap-0.5"
                  >
                    Real-Time Costco Data API on RapidAPI <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </li>
                <li>Create a free RapidAPI account (or sign in)</li>
                <li>Click "Subscribe" and select the free Basic plan</li>
                <li>Copy your RapidAPI key from the "Header Parameters" section</li>
                <li>Paste it below</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                Free plan includes 100 requests/month — enough for several price refreshes.
              </p>
            </div>

            <form onSubmit={handleCostcoSubmit} className="space-y-3">
              <div>
                <Label htmlFor="rapidapi-key" className="text-xs font-medium">RapidAPI Key</Label>
                <Input
                  id="rapidapi-key"
                  type="password"
                  placeholder="Paste your RapidAPI key"
                  value={rapidApiKey}
                  onChange={(e) => setRapidApiKey(e.target.value)}
                  className="mt-1 font-mono text-sm"
                  data-testid="input-rapidapi-key"
                />
              </div>
              <Button
                type="submit"
                disabled={saveCostcoMutation.isPending || !rapidApiKey.trim()}
                data-testid="button-save-costco"
              >
                {saveCostcoMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Key className="w-4 h-4 mr-1.5" />
                )}
                {saveCostcoMutation.isPending ? "Verifying..." : "Connect API"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
