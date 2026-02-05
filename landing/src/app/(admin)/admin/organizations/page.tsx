"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useHumanAuth } from "@/components/admin/HumanAuthContext";
import { Button, Input, Card, Badge } from "@/components/ui";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

export default function OrganizationsPage() {
  const { isAuthenticated, isLoading: authLoading, sessionToken } = useHumanAuth();
  const router = useRouter();

  const orgs = useQuery(
    api.organizations.list,
    isAuthenticated && sessionToken ? { sessionToken } : "skip"
  );

  const createOrg = useMutation(api.organizations.create);

  const [showForm, setShowForm] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [orgWebsite, setOrgWebsite] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[#666666]">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push("/admin/login");
    return null;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const result = await createOrg({
        sessionToken,
        name: orgName,
        description: orgDescription || undefined,
        website: orgWebsite || undefined,
      });
      if (result.success) {
        setOrgName("");
        setOrgDescription("");
        setOrgWebsite("");
        setShowForm(false);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#000000]">Organizations</h1>
          <p className="text-sm text-[#666666] mt-1">Manage organizations and their agents</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Organization"}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <h2 className="font-semibold text-[#000000] mb-4">Create Organization</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <Input
              label="Organization Name"
              placeholder="Acme Corp"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
            <Input
              label="Description (optional)"
              placeholder="What does this organization do?"
              value={orgDescription}
              onChange={(e) => setOrgDescription(e.target.value)}
            />
            <Input
              label="Website (optional)"
              placeholder="https://example.com"
              value={orgWebsite}
              onChange={(e) => setOrgWebsite(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" isLoading={creating}>
              Create Organization
            </Button>
          </form>
        </Card>
      )}

      {!orgs ? (
        <Card><p className="text-[#666666] text-center py-8">Loading organizations...</p></Card>
      ) : orgs.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-lg font-medium text-[#000000]">No organizations yet</p>
            <p className="text-sm text-[#666666] mt-1">Create one to get started.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {orgs.map((org) => (
            <Card key={org._id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[#000000]">{org.name}</h3>
                    {org.verified && <Badge variant="success" size="sm">Verified</Badge>}
                  </div>
                  {org.description && (
                    <p className="text-sm text-[#666666] mt-1 line-clamp-2">{org.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-[#666666]">
                <span>{org.agentCount} {org.agentCount === 1 ? "agent" : "agents"}</span>
                {org.website && (
                  <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:underline">
                    {org.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
                <span>Created {formatDistanceToNow(org.createdAt, { addSuffix: true })}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

