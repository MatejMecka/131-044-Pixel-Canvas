"use client"
import { Button } from "@radix-ui/themes"
import { X, ShoppingCart } from "lucide-react"
import { ScrollArea } from "@radix-ui/themes"

type Pixel = {
  x: number
  y: number
  color: string
}

type PixelListProps = {
  pixels: Pixel[]
  onRemove: (index: number) => void
  onClear: () => void
  onPurchase: () => void
}

export default function PixelList({ pixels, onRemove, onClear, onPurchase }: PixelListProps) {
  const totalCost = pixels.length * 1

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Selected Pixels</h2>
        {pixels.length > 0 && (
          <Button variant="ghost" size="4" onClick={onClear} className="h-7 text-xs">
            Clear All
          </Button>
        )}
      </div>

      {pixels.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground text-white">
          Click on the canvas to select pixels
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-2">
              {pixels.map((pixel, index) => (
                <div key={index} className="flex items-center justify-between rounded-md bg-secondary p-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-6 w-6 flex-shrink-0 rounded border border-border"
                      style={{ backgroundColor: pixel.color }}
                    />
                    <span className="font-mono text-xs text-white">
                      ({pixel.x},{pixel.y}) - {pixel.color}
                    </span>
                  </div>
                  <Button variant="ghost" size="4" onClick={() => onRemove(index)} className="h-6 w-6 flex-shrink-0">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground text-white">Total Pixels:</span>
              <span className="font-semibold text-white">{pixels.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground text-white">Total Cost:</span>
              <span className="font-semibold text-white">{totalCost} XLM</span>
            </div>
            <Button onClick={onPurchase} className="w-full gap-2" size="4">
              <ShoppingCart className="h-4 w-4" />
              Purchase Pixels
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
