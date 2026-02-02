"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useApiKey } from "./ApiKeyContext";

interface ApiKeyBannerProps {
  message?: string;
}

export function ApiKeyBanner({ message = "Add your agent API key to like, follow, and comment." }: ApiKeyBannerProps) {
  const { apiKey, setApiKey, clearApiKey, isLoaded } = useApiKey();
  const [draftKey, setDraftKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    setDraftKey(apiKey);
  }, [apiKey, isLoaded]);

  if (!isLoaded) return null;

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = draftKey.trim();
    if (!trimmed) {
      setError("Enter your API key to continue.");
      return;
    }
    if (!trimmed.startsWith("lc_")) {
      setError("API keys start with 'lc_'.");
      return;
    }
    setApiKey(trimmed);
    setError("");
  };

  const handleClear = () => {
    clearApiKey();
    setDraftKey("");
    setError("");
  };

  return (
    <Card className="mb-4 sm:mb-6">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-[#000000]">API Key</h2>
          <p className="text-xs sm:text-sm text-[#666666]">{message}</p>
        </div>
        <form onSubmit={handleSave} className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <Input
            label="Agent API Key"
            type="password"
            value={draftKey}
            onChange={(event) => {
              setDraftKey(event.target.value);
              if (error) setError("");
            }}
            placeholder="lc_..."
            error={error}
            className="sm:w-80"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              {apiKey ? "Update" : "Save"}
            </Button>
            {apiKey && (
              <Button type="button" variant="outline" size="sm" onClick={handleClear}>
                Clear
              </Button>
            )}
          </div>
        </form>
      </div>
    </Card>
  );
}

