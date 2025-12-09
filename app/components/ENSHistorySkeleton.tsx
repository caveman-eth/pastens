"use client";

export default function ENSHistorySkeleton() {
  return (
    <div className="space-y-6 md:space-y-10 animate-pulse">
      {/* Current Owner Skeleton */}
      <div className="pb-6 md:pb-8 border-b border-gray-200">
        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-200"></div>
          <div className="h-6 md:h-7 w-32 bg-gray-200 rounded"></div>
        </div>
        <div className="space-y-2 md:space-y-3">
          <div className="h-4 md:h-5 w-64 bg-gray-200 rounded"></div>
          <div className="h-4 md:h-5 w-48 bg-gray-200 rounded"></div>
          <div className="h-4 md:h-5 w-40 bg-gray-200 rounded"></div>
        </div>
      </div>

      {/* Timeline Skeleton */}
      <div>
        <div className="mb-6 md:mb-8">
          <div className="h-7 md:h-8 w-48 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 w-64 bg-gray-200 rounded"></div>
        </div>
        
        {/* Vertical Timeline */}
        <div className="relative">
          {/* Vertical line - using same calculation as main component: (items - 1) * 12 + 6 rem */}
          {/* Skeleton shows 3 items, so: (3 - 1) * 12 + 6 = 30rem */}
          <div className="absolute left-1/2 top-0 transform -translate-x-1/2 w-0.5 bg-gray-200" style={{ height: '30rem', marginTop: '3rem' }}></div>
          
          <div className="space-y-4 md:space-y-6 relative">
            {[1, 2, 3].map((index) => (
              <div key={index} className="relative flex items-start gap-3 md:gap-6">
                {/* Timeline dot */}
                <div className="relative z-10 flex-shrink-0 flex flex-col items-center">
                  <div className="h-6 md:h-8 w-12 md:w-16 bg-gray-200 rounded mb-2"></div>
                  <div className="w-5 h-5 rounded-full bg-gray-200 border-2 border-white shadow-lg"></div>
                </div>
                
                {/* Content card skeleton */}
                <div className="flex-1 bg-white rounded-2xl p-4 md:p-7 border-2 border-gray-200 shadow-md">
                  <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-200 flex-shrink-0"></div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="h-5 md:h-6 w-48 bg-gray-200 rounded"></div>
                          <div className="h-4 w-64 bg-gray-200 rounded"></div>
                        </div>
                        <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <div className="h-4 w-56 bg-gray-200 rounded"></div>
                        <div className="h-4 w-52 bg-gray-200 rounded"></div>
                        <div className="h-4 w-48 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                    
                    <div className="w-8 h-8 bg-gray-200 rounded flex-shrink-0"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

