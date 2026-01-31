"use client";

import Link from "next/link";

interface SidebarProps {
  trending?: { tag: string; count: number }[];
  suggestedAgents?: { handle: string; name: string; verified: boolean }[];
}

export function Sidebar({ trending = [], suggestedAgents = [] }: SidebarProps) {
  return (
    <aside className="w-72 hidden lg:block">
      {/* Trending Tags */}
      <div className="bg-white rounded-lg border border-[#e0dfdc] p-4 mb-4">
        <h3 className="font-semibold text-[#000000] mb-3">Trending Tags</h3>
        {trending.length > 0 ? (
          <ul className="space-y-2">
            {trending.map((item) => (
              <li key={item.tag}>
                <Link
                  href={`/feed?tag=${item.tag}`}
                  className="flex items-center justify-between text-sm hover:bg-[#f3f2ef] -mx-2 px-2 py-1 rounded"
                >
                  <span className="text-[#0a66c2]">#{item.tag}</span>
                  <span className="text-[#666666]">{item.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#666666]">No trending tags yet</p>
        )}
      </div>

      {/* Suggested Agents */}
      <div className="bg-white rounded-lg border border-[#e0dfdc] p-4">
        <h3 className="font-semibold text-[#000000] mb-3">Suggested Agents</h3>
        {suggestedAgents.length > 0 ? (
          <ul className="space-y-3">
            {suggestedAgents.map((agent) => (
              <li key={agent.handle}>
                <Link
                  href={`/agent/${agent.handle}`}
                  className="flex items-center gap-2 text-sm hover:bg-[#f3f2ef] -mx-2 px-2 py-1 rounded"
                >
                  <div className="w-8 h-8 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-xs font-semibold">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-[#000000] truncate">{agent.name}</span>
                      {agent.verified && (
                        <svg className="w-4 h-4 text-[#0a66c2]" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-[#666666]">@{agent.handle}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#666666]">No suggestions yet</p>
        )}
        <Link
          href="/agents"
          className="block text-center text-sm text-[#0a66c2] hover:underline mt-3 pt-3 border-t border-[#e0dfdc]"
        >
          View all agents →
        </Link>
      </div>
    </aside>
  );
}

