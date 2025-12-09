"use client";

import { useState } from "react";
import { Search, Volume2 } from "lucide-react";
import ENSHistory, { ENSOwner } from "./components/ENSHistory";
import ENSHistorySkeleton from "./components/ENSHistorySkeleton";

export default function Home() {
  const [ensName, setEnsName] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<{
    name: string;
    owners: ENSOwner[];
    currentOwner?: ENSOwner;
  } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ensName.trim()) return;
    
    // Add .eth suffix if not present
    let searchName = ensName.trim();
    if (!searchName.endsWith('.eth')) {
      searchName = searchName + '.eth';
    }
    
    setIsSearching(true);
    setSearchResults(null);
    setError(null);
    
    try {
      // Call the API route to fetch ENS history
      const response = await fetch(`/api/ens?name=${encodeURIComponent(searchName)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle rate limiting specifically
        if (response.status === 429) {
          setError(
            errorData.error || 
            "Rate limit exceeded. The Graph API is temporarily rate-limiting requests. Please wait a few moments and try again."
          );
        } else {
          // Handle all other errors by setting error state instead of throwing
          setError(errorData.error || "Failed to fetch ENS history. Please try again.");
        }
        return;
      }
      
      const data = await response.json();
      setSearchResults(data);
    } catch (error: any) {
      console.error("Error fetching ENS history:", error);
      setError(error.message || "Failed to fetch ENS history. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-16">
            {/* Dictionary Header */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Dictionary
              </div>
              <div className="text-xs text-gray-500 mb-6">
                Definitions from <a href="https://ens.domains" className="text-blue-600 hover:text-blue-700 hover:underline transition-colors">ENS Domains</a>
                <span aria-hidden="true"> · </span>
                <a href="https://app.ens.domains/" className="text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap transition-colors">Get a name</a>
              </div>

              {/* Word Entry */}
              <div className="mb-6">
                <div className="flex items-start gap-4 mb-3">
                  {/* Audio Button */}
                  <button
                    type="button"
                    className="mt-1 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors flex-shrink-0"
                    title="Listen"
                    aria-label="Listen"
                    onClick={() => {
                      // Text-to-speech for pronunciation
                      if ('speechSynthesis' in window) {
                        const utterance = new SpeechSynthesisUtterance('past tense');
                        utterance.lang = 'en-GB';
                        speechSynthesis.speak(utterance);
                      }
                    }}
                  >
                    <Volume2 size={22} className="text-white" />
                  </button>
                  
                  {/* Word and Pronunciation */}
                  <div className="flex-1">
                    <div className="mb-2" style={{ marginBottom: 0, lineHeight: 'normal' }}>
                      <h1 className="text-5xl font-normal text-gray-900 tracking-tight" style={{ lineHeight: '1.1', marginBottom: 0 }}>
                        pastens
                      </h1>
                    </div>
                    <div className="text-xl text-gray-500 font-mono mt-2">
                      /<span className="text-gray-700">pæst tɛns</span>/
                    </div>
                  </div>
                </div>
                
                {/* Part of Speech */}
                <div className="mt-5 flex items-center gap-3">
                  <span className="text-sm italic text-gray-600 font-medium">noun</span>
                  <span className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                    ENS
                  </span>
                </div>
              </div>

              {/* Definition */}
              <div className="mt-6">
                <ol className="space-y-5" style={{ marginLeft: '20px', paddingLeft: 0 }}>
                  <li>
                    <div style={{ marginLeft: '-20px' }}>
                      <div className="text-lg text-gray-900 leading-relaxed inline">
                        <span>a tool for exploring the ownership history of ENS domains, showing past and current owners with detailed timeline information.</span>
                      </div>
                      <div className="mt-3 text-sm text-gray-500 italic leading-relaxed">
                        "I use <b className="font-semibold text-gray-700">pastens</b> to understand the journey of an ENS name"
                      </div>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-16">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={ensName}
                  onChange={(e) => setEnsName(e.target.value)}
                  placeholder="Enter ENS name (e.g., ens.eth)"
                  className="w-full px-6 py-4 text-lg rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:shadow-md"
                  disabled={isSearching}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <Search size={24} />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSearching || !ensName.trim()}
                style={{ backgroundColor: '#093C52' }}
                className="px-8 py-4 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
            </div>
          </form>

          {/* Results Area */}
          <div className="bg-white rounded-2xl shadow-xl p-4 md:p-8 border border-gray-200 overflow-hidden">
            {error ? (
              <div className="text-center text-red-600">
                <p className="text-lg font-semibold">Error</p>
                <p className="text-sm mt-2">{error}</p>
              </div>
            ) : isSearching ? (
              <>
                {/* ENS Name Label Skeleton */}
                <div className="mb-8 text-left animate-pulse">
                  <div className="h-10 w-48 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
                <ENSHistorySkeleton />
              </>
            ) : searchResults ? (
              <>
                {/* ENS Name Label */}
                <div className="mb-8 text-left">
                  <h2 className="text-4xl font-bold mb-2" style={{ color: '#011A25' }}>
                    {searchResults.name}
                  </h2>
                  <p className="text-sm" style={{ color: '#011A25', opacity: 0.7 }}>
                    Ownership history
                  </p>
                </div>
                <ENSHistory
                  ensName={searchResults.name}
                  owners={searchResults.owners}
                  currentOwner={searchResults.currentOwner}
                />
              </>
            ) : (
              <div className="text-center text-gray-500">
                <p className="text-lg">Enter an ENS name above to view its ownership history</p>
                <p className="text-sm mt-2">See who owned the domain and when ownership changed</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
