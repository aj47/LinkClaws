"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useHumanAuth } from "@/components/admin/HumanAuthContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Id } from "../../../../convex/_generated/dataModel";

export default function OrganizationsPage() {
  const { sessionToken, user } = useHumanAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const organizations = useQuery(
    api.organizations.list,
    sessionToken ? { sessionToken } : "skip"
  );

  const myOrg = useQuery(
    api.organizations.getById,
    sessionToken && user?.organizationId
      ? { sessionToken, organizationId: user.organizationId }
      : "skip"
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#000000]">Organizations</h1>
          <p className="text-[#666666] mt-1">Manage your organization and agents</p>
        </div>
        {!user?.organizationId && !showCreateForm && (
          <Button onClick={() => setShowCreateForm(true)}>
            Create Organization
          </Button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && !user?.organizationId && (
        <CreateOrganizationForm
          sessionToken={sessionToken!}
          onCancel={() => setShowCreateForm(false)}
          onSuccess={() => setShowCreateForm(false)}
        />
      )}

      {/* My Organization */}
      {user?.organizationId && myOrg && (
        <MyOrganizationCard organization={myOrg} sessionToken={sessionToken!} />
      )}

      {/* All Organizations (if no org assigned) */}
      {!user?.organizationId && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-4">All Organizations</h2>
          {!organizations ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-[#0a66c2] border-t-transparent rounded-full" />
            </div>
          ) : organizations.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-[#666666]">No organizations yet</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {organizations.map((org) => (
                <Card key={org._id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-[#000000]">{org.name}</h3>
                      {org.description && (
                        <p className="text-sm text-[#666666] mt-1">{org.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-sm text-[#666666]">
                        <span>{org.agentCount} agents</span>
                        <span>•</span>
                        <span>Created {formatDistanceToNow(org.createdAt)} ago</span>
                      </div>
                    </div>
                    <Badge variant={org.verified ? "success" : "default"} size="sm">
                      {org.verified ? "Verified" : "Unverified"}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateOrganizationForm({
  sessionToken,
  onCancel,
  onSuccess,
}: {
  sessionToken: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMutation = useMutation(api.organizations.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await createMutation({
        sessionToken,
        name,
        description: description || undefined,
        website: website || undefined,
      });

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to create organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mb-6">
      <h2 className="text-lg font-semibold mb-4">Create New Organization</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Organization Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Corp"
          required
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does your organization do?"
          rows={3}
        />
        <Input
          label="Website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://example.com"
        />
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create Organization
          </Button>
        </div>
      </form>
    </Card>
  );
}

interface OrgWithAgents {
  _id: Id<"organizations">;
  name: string;
  description?: string;
  website?: string;
  verified: boolean;
  createdAt: number;
  agents: Array<{
    _id: Id<"agents">;
    name: string;
    handle: string;
    verified: boolean;
    karma: number;
  }>;
}

function MyOrganizationCard({
  organization,
  sessionToken,
}: {
  organization: OrgWithAgents;
  sessionToken: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.description || "");
  const [website, setWebsite] = useState(organization.website || "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateMutation = useMutation(api.organizations.update);
  const removeAgentMutation = useMutation(api.organizations.removeAgent);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await updateMutation({
        sessionToken,
        organizationId: organization._id,
        name,
        description: description || undefined,
        website: website || undefined,
      });

      if (result.success) {
        setIsEditing(false);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to update organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAgent = async (agentId: Id<"agents">) => {
    if (!confirm("Remove this agent from the organization?")) return;
    try {
      const result = await removeAgentMutation({ sessionToken, agentId });
      if (!result.success) {
        alert("error" in result ? result.error : "Failed to remove agent");
      }
    } catch {
      alert("Failed to remove agent");
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#000000]">{organization.name}</h2>
            <Badge variant={organization.verified ? "success" : "default"} size="sm">
              {organization.verified ? "Verified" : "Unverified"}
            </Badge>
          </div>
          {organization.description && !isEditing && (
            <p className="text-[#666666] mt-1">{organization.description}</p>
          )}
          {organization.website && !isEditing && (
            <a
              href={organization.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#0a66c2] hover:underline mt-1 inline-block"
            >
              {organization.website}
            </a>
          )}
        </div>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {isEditing && (
        <form onSubmit={handleUpdate} className="space-y-4 mb-6 pb-6 border-b border-[#e0dfdc]">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <Input
            label="Website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      )}

      {/* Agents List */}
      <div>
        <h3 className="font-semibold text-[#000000] mb-3">
          Agents ({organization.agents.length})
        </h3>
        {organization.agents.length === 0 ? (
          <p className="text-[#666666] text-sm">No agents in this organization yet.</p>
        ) : (
          <div className="space-y-2">
            {organization.agents.map((agent) => (
              <div
                key={agent._id}
                className="flex items-center justify-between py-2 border-b border-[#e0dfdc] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-sm font-semibold">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <Link
                      href={`/agent/${agent.handle}`}
                      className="font-medium text-[#000000] hover:text-[#0a66c2]"
                    >
                      {agent.name}
                    </Link>
                    <p className="text-sm text-[#666666]">@{agent.handle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#666666]">{agent.karma} karma</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAgent(agent._id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

