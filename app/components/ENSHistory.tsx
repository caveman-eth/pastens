"use client";

import { Clock, User, ExternalLink, Circle } from "lucide-react";
import { useMemo } from "react";

export interface ENSOwner {
  address: string;
  ensName?: string;
  startDate: Date | string;
  endDate?: Date | string;
  transactionHash: string;
  isMarketplace?: boolean;
  marketplaceName?: string;
  avatar?: string;
}

interface ENSHistoryProps {
  ensName: string;
  owners: ENSOwner[];
  currentOwner?: ENSOwner;
  expiryDate?: string;
}

interface TimelinePeriod {
  owner: ENSOwner;
  startDate: Date;
  endDate: Date | null; // null means current/ongoing
  isDormant: boolean;
  isMarketplace?: boolean;
  marketplaceName?: string;
  duration: number; // in milliseconds
}

export default function ENSHistory({ ensName, owners, currentOwner, expiryDate }: ENSHistoryProps) {
  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "Unknown";
    
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return "Invalid date";
    }
    
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(dateObj);
  };

  const formatDateFull = (date: Date | string | undefined) => {
    if (!date) return "Unknown";
    
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return "Invalid date";
    }
    
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dateObj);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDuration = (ms: number) => {
    const totalDays = Math.floor(ms / (1000 * 60 * 60 * 24));
    const years = Math.floor(totalDays / 365);
    const remainingDaysAfterYears = totalDays % 365;
    const months = Math.floor(remainingDaysAfterYears / 30);
    const remainingDaysAfterMonths = remainingDaysAfterYears % 30;
    const weeks = Math.floor(remainingDaysAfterMonths / 7);
    const days = remainingDaysAfterMonths % 7;
    
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
    if (weeks > 0) parts.push(`${weeks} week${weeks > 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    
    if (parts.length === 0) return "Less than a day";
    
    // Join with commas and "and" for the last item
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  };

  // Build timeline with all periods including dormant gaps
  const timeline = useMemo(() => {
    const periods: TimelinePeriod[] = [];
    const now = new Date();
    
    // Combine all owners including current, but deduplicate by address AND start date
    // Same address can own at different times, so we need to check both
    const allOwners: ENSOwner[] = [...owners];
    if (currentOwner) {
      // Only add currentOwner if it's not already in the owners list with the same start date
      const currentStartDate = typeof currentOwner.startDate === "string" 
        ? currentOwner.startDate 
        : currentOwner.startDate.toISOString();
      const isDuplicate = owners.some(owner => {
        const ownerStartDate = typeof owner.startDate === "string" 
          ? owner.startDate 
          : owner.startDate.toISOString();
        return owner.address.toLowerCase() === currentOwner.address.toLowerCase() &&
               ownerStartDate === currentStartDate;
      });
      if (!isDuplicate) {
        allOwners.push(currentOwner);
      }
    }
    
    if (allOwners.length === 0) return periods;
    
    // Sort by start date
    const sortedOwners = [...allOwners].sort((a, b) => {
      const dateA = typeof a.startDate === "string" ? new Date(a.startDate) : a.startDate;
      const dateB = typeof b.startDate === "string" ? new Date(b.startDate) : b.startDate;
      return dateA.getTime() - dateB.getTime();
    });
    
    // Further deduplicate: if same address appears multiple times with same start date, keep only one
    const deduplicatedOwners: ENSOwner[] = [];
    const seen = new Set<string>();
    for (const owner of sortedOwners) {
      const key = `${owner.address.toLowerCase()}-${typeof owner.startDate === "string" ? owner.startDate : owner.startDate.toISOString()}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicatedOwners.push(owner);
      }
    }
    
    const finalOwners = deduplicatedOwners;
    
    // Find the earliest date
    const earliestDate = finalOwners[0] 
      ? (typeof finalOwners[0].startDate === "string" 
          ? new Date(finalOwners[0].startDate) 
          : finalOwners[0].startDate)
      : now;
    
    // Process each owner period
    for (let i = 0; i < finalOwners.length; i++) {
      const owner = finalOwners[i];
      const startDate = typeof owner.startDate === "string" 
        ? new Date(owner.startDate) 
        : owner.startDate;
      
      // Determine end date - use owner's endDate, or if it's the current owner, use their expiry date
      let endDate: Date | null = null;
      const isCurrentOwner = currentOwner && 
        owner.address.toLowerCase() === currentOwner.address.toLowerCase() &&
        (typeof owner.startDate === "string" ? owner.startDate : owner.startDate.toISOString()) ===
        (typeof currentOwner.startDate === "string" ? currentOwner.startDate : currentOwner.startDate.toISOString());
      
      if (owner.endDate) {
        endDate = typeof owner.endDate === "string" ? new Date(owner.endDate) : owner.endDate;
      } else if (isCurrentOwner && currentOwner.endDate) {
        // Current owner with expiry date - use expiry date as endDate for display
        endDate = typeof currentOwner.endDate === "string" 
          ? new Date(currentOwner.endDate) 
          : currentOwner.endDate;
      }
      
      // Calculate duration - for current owner, use elapsed time (now), not expiry date
      const duration = isCurrentOwner 
        ? now.getTime() - startDate.getTime()  // Elapsed time for current owner
        : (endDate ? endDate.getTime() - startDate.getTime() : now.getTime() - startDate.getTime());  // Full period for past owners
      
      // Skip zero-duration entries
      if (duration <= 0) {
        // Skip this entry if it has zero or negative duration
        continue;
      }
      
      // Add owner period
      periods.push({
        owner,
        startDate,
        endDate,
        isDormant: false,
        isMarketplace: owner.isMarketplace,
        marketplaceName: owner.marketplaceName,
        duration,
      });
      
      // Check for dormant period before next owner
      if (i < finalOwners.length - 1) {
        const nextOwner = finalOwners[i + 1];
        const nextStartDate = typeof nextOwner.startDate === "string"
          ? new Date(nextOwner.startDate)
          : nextOwner.startDate;
        
        const currentEndDate = endDate || now;
        
        // If there's a gap, add dormant period
        if (nextStartDate.getTime() > currentEndDate.getTime()) {
          periods.push({
            owner: {
              address: "0x0000000000000000000000000000000000000000",
              startDate: currentEndDate,
              endDate: nextStartDate,
              transactionHash: "",
            },
            startDate: currentEndDate,
            endDate: nextStartDate,
            isDormant: true,
            duration: nextStartDate.getTime() - currentEndDate.getTime(),
          });
        }
      }
    }
    
    return periods;
  }, [owners, currentOwner]);

  // Calculate total timeline span (from first registration to current date)
  const timelineSpan = useMemo(() => {
    if (timeline.length === 0) return { start: new Date(), end: new Date(), total: 0 };
    
    const now = new Date();
    // Get all start dates from timeline periods
    const startDates = timeline.map(p => p.startDate);
    const start = new Date(Math.min(...startDates.map(d => d.getTime())));
    // Use current date as end, not expiry date
    const end = now;
    const total = end.getTime() - start.getTime();
    
    return { start, end, total };
  }, [timeline]);

  // Get unique years from timeline for left-side markers
  const timelineYears = useMemo(() => {
    if (timeline.length === 0) return [];
    const years = new Set<number>();
    timeline.forEach(period => {
      years.add(period.startDate.getFullYear());
      if (period.endDate) {
        years.add(period.endDate.getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [timeline]);

  const getPeriodWidth = (period: TimelinePeriod) => {
    if (timelineSpan.total === 0) return 0;
    return (period.duration / timelineSpan.total) * 100;
  };

  const getPeriodOffset = (period: TimelinePeriod) => {
    if (timelineSpan.total === 0) return 0;
    const periodStart = period.startDate.getTime();
    const timelineStart = timelineSpan.start.getTime();
    return ((periodStart - timelineStart) / timelineSpan.total) * 100;
  };

  // Color palette for owners - returns gradient classes (using darker shades for better contrast)
  const getOwnerColor = (address: string, index: number) => {
    const gradients = [
      "from-blue-600 to-blue-700",
      "from-purple-600 to-purple-700",
      "from-pink-600 to-pink-700",
      "from-indigo-600 to-indigo-700",
      "from-cyan-600 to-cyan-700",
      "from-emerald-600 to-emerald-700",
      "from-amber-600 to-amber-700",
      "from-red-600 to-red-700",
      "from-violet-600 to-violet-700",
      "from-teal-600 to-teal-700",
    ];
    // Use address hash for consistent color per owner
    const hash = address.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return gradients[hash % gradients.length];
  };

  // Calculate total lifespan of the ENS name (from first registration to now)
  const ensLifespan = useMemo(() => {
    if (timeline.length === 0) return null;
    
    // Find the earliest start date from all ownership periods
    const earliestDate = timeline.reduce((earliest, period) => {
      return period.startDate < earliest ? period.startDate : earliest;
    }, timeline[0].startDate);
    
    // Calculate from first registration to now
    const now = new Date();
    const duration = now.getTime() - earliestDate.getTime();
    return duration;
  }, [timeline]);

  // Get the earliest date (born on date)
  const bornOnDate = useMemo(() => {
    if (timeline.length === 0) return null;
    return timeline.reduce((earliest, period) => {
      return period.startDate < earliest ? period.startDate : earliest;
    }, timeline[0].startDate);
  }, [timeline]);

  // Calculate approximate age in years for display
  const approximateAge = useMemo(() => {
    if (!ensLifespan) return null;
    const years = Math.floor(ensLifespan / (1000 * 60 * 60 * 24 * 365));
    return years;
  }, [ensLifespan]);

  return (
    <div className="space-y-6 md:space-y-10">
      {/* Current Owner - Fused with ENS name */}
      {currentOwner && (
        <div className="pb-6 md:pb-8 border-b border-gray-200 relative" style={{ zIndex: 1 }}>
          {/* Large lifespan display - behind content on mobile */}
          {approximateAge !== null && (
            <div className="absolute right-0 top-1/2" style={{ 
              color: '#011A25', 
              opacity: 0.1,
              transform: 'translateY(-50%) perspective(1000px)',
              transformStyle: 'preserve-3d',
              zIndex: 0,
              fontSize: 'clamp(8rem, 20vw, 14rem)',
              pointerEvents: 'none'
            }}>
              <div className="font-bold leading-none" style={{ 
                fontSize: 'inherit',
                transform: 'rotateX(20deg) rotateY(-10deg) translateZ(50px)',
                textShadow: '0 20px 40px rgba(0, 0, 0, 0.15), 0 10px 20px rgba(0, 0, 0, 0.1)',
                display: 'inline-block'
              }}>{approximateAge}</div>
            </div>
          )}
          
          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4 relative" style={{ zIndex: 2 }}>
            {currentOwner.avatar ? (
              <img 
                src={currentOwner.avatar} 
                alt={`${currentOwner.ensName || currentOwner.address} avatar`}
                className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border-2 border-blue-200 flex-shrink-0"
                onError={(e) => {
                  // Hide image and show fallback icon if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className={`w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 ${currentOwner.avatar ? 'hidden' : ''}`}
              style={{ display: currentOwner.avatar ? 'none' : 'flex' }}
            >
              <User className="text-blue-600" size={18} />
            </div>
            <h3 className="text-lg md:text-xl font-bold" style={{ color: '#011A25' }}>
              Current Owner
            </h3>
          </div>
          <div className="space-y-2 md:space-y-3 relative" style={{ zIndex: 2 }}>
            <div>
              <span className="text-xs md:text-sm font-medium" style={{ color: '#011A25', opacity: 0.8 }}>Address: </span>
              <span className="font-mono text-sm md:text-base font-semibold break-all" style={{ color: '#011A25' }}>
                {currentOwner.ensName || formatAddress(currentOwner.address)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs md:text-sm" style={{ color: '#011A25', opacity: 0.8 }}>
              <Clock size={16} className="text-gray-400 flex-shrink-0" />
              <span className="font-medium break-words">Owned since {formatDateFull(currentOwner.startDate)}</span>
            </div>
            {ensLifespan !== null && (
              <div className="flex items-center gap-2 text-xs md:text-sm relative" style={{ color: '#011A25', opacity: 0.8, zIndex: 3 }}>
                <span className="font-medium">Lifespan: </span>
                <span className="font-semibold break-words" style={{ color: '#011A25' }}>{formatDuration(ensLifespan)}</span>
              </div>
            )}
            {bornOnDate && (
              <div className="flex items-center gap-2 text-xs md:text-sm relative" style={{ color: '#011A25', opacity: 0.8, zIndex: 3 }}>
                <span className="font-medium">Born on: </span>
                <span className="font-semibold break-words" style={{ color: '#011A25' }}>{formatDate(bornOnDate)}</span>
              </div>
            )}
            {expiryDate && (
              <div className="flex items-center gap-2 text-xs md:text-sm relative" style={{ color: '#011A25', opacity: 0.8, zIndex: 3 }}>
                <span className="font-medium">Tentative Expiry: </span>
                <span className="font-semibold break-words" style={{ color: '#011A25' }}>{formatDate(expiryDate)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline Visualization */}
      {timeline.length > 0 && (
        <div>
          <div className="mb-6 md:mb-8">
            <h3 className="text-xl md:text-2xl font-bold mb-2" style={{ color: '#011A25' }}>
              Ownership Timeline
            </h3>
            <p className="text-xs md:text-sm" style={{ color: '#011A25', opacity: 0.7 }}>
              Chronological history of domain ownership
            </p>
          </div>
          
          {/* Vertical Timeline */}
          <div className="relative">
            {/* Vertical line connecting the markers in the center */}
            {/* Height calculation: Very generous to ensure it reaches all cards on both mobile and desktop
                - Mobile: space-y-4 (1rem) but cards stack vertically making them much taller
                - Desktop: space-y-6 (1.5rem) with more horizontal layout
                - Using 20rem per gap for mobile to account for tall stacked cards
                - Plus 10rem extra padding at the bottom for mobile
            */}
            <div 
              className="absolute left-1/2 top-0 transform -translate-x-1/2 w-0.5 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 md:hidden" 
              style={{ 
                height: timeline.length > 0 ? `${(timeline.length - 1) * 20 + 10}rem` : '0', 
                marginTop: '3rem' 
              }}
            ></div>
            <div 
              className="absolute left-1/2 top-0 transform -translate-x-1/2 w-0.5 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 hidden md:block" 
              style={{ 
                height: timeline.length > 0 ? `${(timeline.length - 1) * 12 + 6}rem` : '0', 
                marginTop: '3rem' 
              }}
            ></div>
            
            <div className="space-y-4 md:space-y-6 relative">
              {[...timeline].reverse().map((period, originalIndex) => {
                const index = timeline.length - 1 - originalIndex;
                const isMarketplace = period.isMarketplace || false;
                // Current owner is the first item in reversed timeline (most recent)
                const isCurrent = currentOwner && 
                  period.owner.address.toLowerCase() === currentOwner.address.toLowerCase() &&
                  (originalIndex === 0 || !period.endDate || (period.endDate && period.endDate > new Date()));
                
                // Determine color class
                let colorClass: string;
                if (isCurrent) {
                  colorClass = "bg-emerald-500";
                } else if (isMarketplace) {
                  colorClass = "bg-yellow-500";
                } else {
                  const gradient = getOwnerColor(period.owner.address, index);
                  colorClass = gradient.replace('from-', 'bg-').split(' ')[0];
                }
                
                if (period.isDormant) {
                  return (
                    <div key={`dormant-${index}`} className="relative flex items-start gap-6">
                      {/* Timeline dot with year label above */}
                      <div className="relative z-10 flex-shrink-0 flex flex-col items-center">
                      {/* Year label above the dot */}
                      <div className="text-xl md:text-2xl font-bold mb-2" style={{ color: '#9CA3AF' }}>
                        {period.startDate.getFullYear()}
                      </div>
                        <div className="w-4 h-4 rounded-full bg-gray-300 border-2 border-dashed border-gray-400"></div>
                      </div>
                      
                      {/* Content card */}
                      <div className="flex-1 bg-gray-50 rounded-lg p-4 border-2 border-dashed" style={{ borderColor: '#0080BC' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <Circle className="text-gray-400" size={16} />
                          <h4 className="font-semibold" style={{ color: '#011A25', opacity: 0.8 }}>
                            Dormant Period
                          </h4>
                        </div>
                        <div className="text-sm space-y-1" style={{ color: '#011A25', opacity: 0.8 }}>
                          <div className="flex items-center gap-2">
                            <Clock size={14} />
                            <span><span className="font-medium">From: </span>{formatDateFull(period.startDate)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={14} />
                            <span><span className="font-medium">To: </span>{formatDateFull(period.endDate!)}</span>
                          </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Owned for: </span>
                              {formatDuration(period.duration)}
                            </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div key={`owner-${index}`} className="relative flex items-start gap-3 md:gap-6">
                    {/* Timeline dot with year label above */}
                    <div className="relative z-10 flex-shrink-0 flex flex-col items-center">
                      {/* Year label above the dot */}
                      <div className="text-xl md:text-2xl font-bold mb-2" style={{ color: isCurrent ? '#0080BC' : '#9CA3AF' }}>
                        {isCurrent ? new Date().getFullYear() : period.startDate.getFullYear()}
                      </div>
                      <div className="relative">
                        <div className={`w-5 h-5 rounded-full border-2 border-white shadow-lg ${isCurrent ? 'ring-2 ring-emerald-300 animate-pulse' : ''}`} style={{ backgroundColor: isCurrent ? '#0080BC' : '#9CA3AF' }}></div>
                        {/* Show connecting line for all items except the top-most (most recent) one */}
                        {/* Line connects upward from bottom of dot to the next card above */}
                        {originalIndex !== 0 && (
                          <div className="absolute top-[1.25rem] left-1/2 transform -translate-x-1/2 w-0.5 bg-gray-200" style={{ height: '2.5rem', zIndex: 1 }}></div>
                        )}
                      </div>
                    </div>
                    
                    {/* Content card */}
                    <div className={`flex-1 bg-white rounded-2xl p-4 md:p-7 border-2 transition-all ${isCurrent ? 'shadow-xl ring-2 ring-emerald-100' : isMarketplace ? 'shadow-lg' : 'shadow-md'}`} style={{ borderColor: isCurrent ? '#0080BC' : '#9CA3AF' }}>
                      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 w-full">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-base md:text-lg shadow-md flex-shrink-0" style={{ backgroundColor: isCurrent ? '#0080BC' : '#9CA3AF', color: '#FFFFFF' }}>
                              {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-mono text-base md:text-lg font-semibold break-words" style={{ color: '#011A25' }}>
                                {isMarketplace 
                                  ? (period.marketplaceName || 'Marketplace Contract')
                                  : (period.owner.ensName || formatAddress(period.owner.address))}
                              </div>
                              <div className="text-xs md:text-sm font-mono break-all mt-1" style={{ color: '#011A25', opacity: 0.7 }}>
                                {period.owner.address}
                              </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              {isMarketplace && (
                                <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full shadow-sm">
                                  {period.marketplaceName || 'Marketplace'}
                                </span>
                              )}
                              {isCurrent && (
                                <span className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full shadow-sm">
                                  Current
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-3 text-xs md:text-sm">
                            <div className="flex items-center gap-2" style={{ color: '#011A25', opacity: 0.8 }}>
                              <Clock size={16} className="text-gray-400 flex-shrink-0" />
                              <div>
                                <span className="font-medium">From: </span>
                                <span className="font-mono">{formatDateFull(period.startDate)}</span>
                              </div>
                            </div>
                            {period.endDate ? (
                              <div className="flex items-center gap-2" style={{ color: '#011A25', opacity: 0.8 }}>
                                <Clock size={16} className="text-gray-400 flex-shrink-0" />
                                <div>
                                  <span className="font-medium">To: </span>
                                  <span className="font-mono">{formatDateFull(period.endDate)}</span>
                                  {isCurrent && (
                                    <span className="text-xs text-emerald-600 ml-2">(Expires)</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2" style={{ color: '#011A25', opacity: 0.8 }}>
                                <Clock size={16} className="text-gray-400 flex-shrink-0" />
                                <div>
                                  <span className="font-medium">To: </span>
                                  <span className="text-emerald-600 font-semibold">Ongoing</span>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-2" style={{ color: '#011A25', opacity: 0.8 }}>
                              <span className="font-medium">Owned for: </span>
                              <span className="font-semibold break-words" style={{ color: '#011A25' }}>{formatDuration(period.duration)}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* External link - only show if transaction hash exists */}
                        {period.owner.transactionHash && (
                          <a
                            href={`https://etherscan.io/tx/${period.owner.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 p-2 text-gray-400"
                            title="View transaction on Etherscan"
                          >
                            <ExternalLink size={20} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
          </div>
        </div>
      )}

      {/* Empty state - no timeline */}
      {timeline.length === 0 && (
        <div className="text-center py-12 md:py-16">
          <div className="max-w-md mx-auto">
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="text-gray-400" size={40} />
              </div>
            </div>
            <h3 className="text-xl md:text-2xl font-bold mb-3" style={{ color: '#011A25' }}>
              No Ownership History Found
            </h3>
            <p className="text-sm md:text-base mb-2" style={{ color: '#011A25', opacity: 0.7 }}>
              This ENS domain doesn't have any recorded ownership transfers yet.
            </p>
            <p className="text-xs md:text-sm" style={{ color: '#011A25', opacity: 0.6 }}>
              The domain may have been recently registered or hasn't changed hands.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
