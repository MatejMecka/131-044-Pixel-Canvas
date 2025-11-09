"use client"
import * as React from "react"
import * as ScrollArea from "@radix-ui/react-scroll-area"
import { Trophy, Medal, Award } from "lucide-react"

type LeaderboardEntry = {
  address: string
  pixel_count: number
}

type LeaderboardProps = {
  data: LeaderboardEntry[]
}

export default function Leaderboard({ data }: LeaderboardProps) {
  const sorted = [...data].sort((a, b) => b.pixel_count - a.pixel_count)

  const getMedalIcon = (rank: number) => {
    if (rank === 0) return <Trophy className="h-4 w-4 text-yellow-500" />
    if (rank === 1) return <Medal className="h-4 w-4 text-gray-400" />
    if (rank === 2) return <Award className="h-4 w-4 text-amber-600" />
    return null
  }

  const getRankBg = (rank: number) => {
    if (rank === 0) return "bg-gradient-to-r from-yellow-900/30 to-amber-900/30 border-l-2 border-yellow-500"
    if (rank === 1) return "bg-gradient-to-r from-gray-800/30 to-slate-800/30 border-l-2 border-gray-400"
    if (rank === 2) return "bg-gradient-to-r from-orange-900/30 to-amber-900/30 border-l-2 border-amber-600"
    return ""
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Trophy className="h-5 w-5 text-yellow-500" />
        <h2 className="text-lg font-bold text-white">Leaderboard</h2>
      </div>
      
      <ScrollArea.Root className="flex-1 overflow-hidden rounded-lg border border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <ScrollArea.Viewport className="w-full h-full">
          <table className="w-full text-xs">
            <thead className="bg-gray-800 text-gray-300 sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Rank</th>
                <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Address</th>
                <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider">Pixels</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-white-500 text-sm">
                    No data available yet
                  </td>
                </tr>
              ) : (
                sorted.map((entry, index) => (
                  <tr
                    key={entry.address}
                    className={`
                      transition-colors hover:bg-gray-800/70
                      ${getRankBg(index)}
                    `}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {getMedalIcon(index)}
                        <span className={`font-bold ${index < 3 ? 'text-sm text-white' : 'text-xs text-white'}`}>
                          {index + 1}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <code className="font-mono text-xs bg-gray-800/50 px-2 py-0.5 rounded text-gray-300 border border-gray-700">
                        {entry.address.slice(0, 6)}...{entry.address.slice(-6)}
                      </code>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-semibold ${index < 3 ? 'text-sm text-white' : 'text-gray-300'}`}>
                        {entry.pixel_count.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar 
          orientation="vertical" 
          className="flex select-none touch-none p-0.5 bg-gray-800/50 transition-colors w-2"
        >
          <ScrollArea.Thumb className="flex-1 bg-gray-600 rounded-full hover:bg-gray-500 transition-colors" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  )
}