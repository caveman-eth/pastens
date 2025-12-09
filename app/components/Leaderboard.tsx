"use client";

import { Trophy, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

interface LeaderboardEntry {
  name: string;
  transferCount: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  totalTransfersAnalyzed: number;
}

interface LeaderboardProps {
  onDomainClick: (name: string) => void;
}

export default function Leaderboard({ onDomainClick }: LeaderboardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    // Only fetch when expanded and we haven't fetched yet
    if (isExpanded && !hasFetched) {
      const fetchLeaderboard = async () => {
        try {
          setLoading(true);
          setError(null);
          const response = await fetch("/api/leaderboard");

          if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 429) {
              setError(
                errorData.error ||
                  "Rate limit exceeded. Please wait a moment and try again."
              );
            } else {
              setError(errorData.error || "Failed to fetch leaderboard");
            }
            return;
          }

          const leaderboardData = await response.json();
          setData(leaderboardData);
          setHasFetched(true);
        } catch (err: any) {
          console.error("Error fetching leaderboard:", err);
          setError(err.message || "Failed to fetch leaderboard");
        } finally {
          setLoading(false);
        }
      };

      fetchLeaderboard();
    }
  }, [isExpanded, hasFetched]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (rank === 2) return "bg-gray-100 text-gray-800 border-gray-300";
    if (rank === 3) return "bg-orange-100 text-orange-800 border-orange-300";
    return "bg-blue-50 text-blue-800 border-blue-200";
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={toggleExpanded}
        className="w-full p-6 md:p-8 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Trophy className="text-yellow-500" size={24} />
          <h2 className="text-2xl font-bold" style={{ color: "#011A25" }}>
            Top 10 Most Traded ENS Names
          </h2>
        </div>
        {isExpanded ? (
          <ChevronUp className="text-gray-400" size={24} />
        ) : (
          <ChevronDown className="text-gray-400" size={24} />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 md:px-8 pb-6 md:pb-8">
          {loading ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                >
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600">{error}</p>
            </div>
          ) : !data || data.leaderboard.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No leaderboard data available</p>
            </div>
          ) : (
            <>
              <p className="text-sm mb-6" style={{ color: "#011A25", opacity: 0.7 }}>
                Domains ranked by number of ownership transitions (based on sampled transfers)
              </p>

              <div className="space-y-3">
                {data.leaderboard.map((entry, index) => {
                  const rank = index + 1;
                  const rankIcon = getRankIcon(rank);

                  return (
                    <button
                      key={entry.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDomainClick(entry.name);
                      }}
                      className="w-full text-left block group"
                    >
                      <div
                        className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer ${getRankColor(
                          rank
                        )}`}
                      >
                        {/* Rank */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-2 bg-white">
                          {rankIcon || rank}
                        </div>

                        {/* Domain Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg font-mono" style={{ color: "#011A25" }}>
                              {entry.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 text-sm" style={{ color: "#011A25", opacity: 0.7 }}>
                            <TrendingUp size={14} />
                            <span className="font-semibold">
                              {entry.transferCount} ownership transition{entry.transferCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {data.totalTransfersAnalyzed > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-xs text-center" style={{ color: "#011A25", opacity: 0.6 }}>
                    Based on analysis of {data.totalTransfersAnalyzed.toLocaleString()} recent transfers
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

