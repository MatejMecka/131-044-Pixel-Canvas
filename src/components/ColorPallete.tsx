"use client"

type ColorPaletteProps = {
  colors: string[]
  selectedColor: string
  onColorSelect: (color: string) => void
}

export default function ColorPalette({ colors, selectedColor, onColorSelect }: ColorPaletteProps) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">Color Palette</h2>
      <div className="flex gap-2">
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => onColorSelect(color)}
            className="group relative h-12 w-12 flex-shrink-0 rounded-md transition-transform hover:scale-105"
            style={{ backgroundColor: color }}
            title={color}
          >
            {selectedColor === color && (
              <div className="absolute inset-0 rounded-md ring-2 ring-primary ring-offset-2 ring-offset-card" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
