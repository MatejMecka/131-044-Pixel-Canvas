"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@radix-ui/themes"
import { ZoomIn, ZoomOut, Wallet } from "lucide-react"
import * as Toast from "@radix-ui/react-toast" // --- Toast Import ---
import ColorPalette from "./ColorPallete"
import PixelList from "./PixelList"
import Leaderboard from "./Leaderboard"
import pixelsContract from "../contracts/pixelfun"
import { useWallet } from "../hooks/useWallet"
import { network } from "../contracts/util"
import { getNetworkHeaders } from "../debug/util/getNetworkHeaders"
import { xdr } from "@stellar/stellar-sdk"
import { useSubmitRpcTx } from "../debug/hooks/useSubmitRpcTx"

const CANVAS_SIZE = 362
const INITIAL_PIXEL_SIZE = 8

const SELECT_SOUND_EFFECT = new Audio("audio/place_pixel.mp3")

const COLORS = [
  "#FF0000", // Red
  "#FF8800", // Orange
  "#FFFF00", // Yellow
  "#88FF00", // Lime
  "#00FF00", // Green
  "#00FF88", // Mint
  "#00FFFF", // Cyan
  "#0088FF", // Sky Blue
  "#0000FF", // Blue
  "#8800FF", // Purple
  "#FF00FF", // Magenta
  "#FF0088", // Pink
  "#FFFFFF", // White
  "#888888", // Gray
  "#895129", // Dark Gray
]

type Pixel = {
  x: number
  y: number
  color: string
}

export default function PixelCanvas() {
  const [selectedColor, setSelectedColor] = useState(COLORS[0])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [pixels, setPixels] = useState<Record<string, string>>({})
  const [selectedPixels, setSelectedPixels] = useState<Pixel[]>([])
  const [leaderboardData, setLeaderboardData] = useState<any[]>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // --- Toast State ---
  const [toastOpen, setToastOpen] = useState(false)
  const [toastProps, setToastProps] = useState({
    title: "",
    description: "",
    variant: "default",
  })
  const timerRef = useRef(0)

  const { address, signTransaction } = useWallet()

  const {
    data: submitRpcResponse,
    mutate: submitRpc,
    error: submitRpcError,
    isPending: isSubmitRpcPending,
    isSuccess: isSubmitRpcSuccess,
    reset: resetSubmitRpc,
  } = useSubmitRpcTx()

  // --- Toast Timer Cleanup ---
  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  // --- Toast Helper Function ---
  const showToast = (
    title: string,
    description: string,
    variant: "success" | "error"
  ) => {
    setToastOpen(false) // Close any existing toast
    window.clearTimeout(timerRef.current) // Clear existing timer
    timerRef.current = window.setTimeout(() => {
      setToastProps({ title, description, variant })
      setToastOpen(true)
    }, 100) // Small delay to allow re-triggering
  }

  useEffect(() => {
    const fetchPixels = () => {
      pixelsContract
        .list_painted_pixels()
        .then(({ result }) => {
          console.log("Fetched canvas data:", result)
          const placedPixels: Record<string, string> = {}

          // result is a Vec<PixelInfo> where each pixel has x, y, colour
          result.forEach((pixel: { x: number; y: number; colour: number }) => {
            // colour is 1-15, use it directly as index
            placedPixels[`${pixel.x},${pixel.y}`] = COLORS[pixel.colour - 1]
          })

          setPixels(placedPixels)
        })
        .catch((error) => {
          console.error("Error loading pixels:", error)
          showToast(
            "Error Loading Pixels",
            "There was an error loading the pixel data from the contract. Check the logs in the console",
            "error"
          )
        })
    }

    fetchPixels()
    const intervalId = setInterval(fetchPixels, 1000)
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const handleLeaderboard = () => {
      pixelsContract
        .get_leaderboard()
        .then(({ result }) => {
          console.log("Fetched leaderboard data:", result)
          setLeaderboardData(result)
        })
        .catch((error) => {
          console.error("Error loading leaderboard:", error)
        })
    }

    handleLeaderboard()
    const intervalId = setInterval(handleLeaderboard, 5000)
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    drawCanvas()
  }, [pixels, zoom, pan, selectedPixels])

  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const pixelSize = INITIAL_PIXEL_SIZE * zoom

    // Clear canvas
    ctx.fillStyle = "#0a0a0a"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw grid
    ctx.strokeStyle = "#1a1a1a"
    ctx.lineWidth = 1

    for (let x = 0; x <= CANVAS_SIZE; x++) {
      const xPos = x * pixelSize + pan.x
      ctx.beginPath()
      ctx.moveTo(xPos, 0)
      ctx.lineTo(xPos, canvas.height)
      ctx.stroke()
    }

    for (let y = 0; y <= CANVAS_SIZE; y++) {
      const yPos = y * pixelSize + pan.y
      ctx.beginPath()
      ctx.moveTo(0, yPos)
      ctx.lineTo(canvas.width, yPos)
      ctx.stroke()
    }

    // Draw placed pixels
    Object.entries(pixels).forEach(([key, color]) => {
      const [x, y] = key.split(",").map(Number)
      ctx.fillStyle = color
      ctx.fillRect(
        x * pixelSize + pan.x + 1,
        y * pixelSize + pan.y + 1,
        pixelSize - 2,
        pixelSize - 2
      )
    })

    // Draw selected pixels with glow
    selectedPixels.forEach(({ x, y, color }) => {
      ctx.fillStyle = color
      ctx.fillRect(
        x * pixelSize + pan.x + 1,
        y * pixelSize + pan.y + 1,
        pixelSize - 2,
        pixelSize - 2
      )

      // Add glow effect
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.strokeRect(
        x * pixelSize + pan.x,
        y * pixelSize + pan.y,
        pixelSize,
        pixelSize
      )
    })
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const pixelSize = INITIAL_PIXEL_SIZE * zoom
    const gridX = Math.floor((x - pan.x) / pixelSize)
    const gridY = Math.floor((y - pan.y) / pixelSize)

    if (gridX >= 0 && gridX < CANVAS_SIZE && gridY >= 0 && gridY < CANVAS_SIZE) {
      const key = `${gridX},${gridY}`

      if (pixels[key]) {
        showToast(
          "Pixel Already Bought!",
          "This pixel has already been purchased by another user.",
          "error"
        )
        return
      }

      const existingPixelIndex = selectedPixels.findIndex(
        (p) => p.x === gridX && p.y === gridY
      )

      if (existingPixelIndex >= 0) {
        // Remove pixel if already selected
        setSelectedPixels(
          selectedPixels.filter((_, i) => i !== existingPixelIndex)
        )
      } else {
        // Add new pixel
        setSelectedPixels([
          ...selectedPixels,
          { x: gridX, y: gridY, color: selectedColor },
        ])
        SELECT_SOUND_EFFECT.currentTime = 0
        SELECT_SOUND_EFFECT.play()
      }
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault()
      setIsPanning(true)
      setLastMousePos({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.x
      const dy = e.clientY - lastMousePos.y
      setPan({ x: pan.x + dx, y: pan.y + dy })
      setLastMousePos({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.5, Math.min(5, zoom * delta))
    setZoom(newZoom)
  }

  const handleZoomIn = () => {
    setZoom(Math.min(5, zoom * 1.2))
  }

  const handleZoomOut = () => {
    setZoom(Math.max(0.5, zoom / 1.2))
  }

  const handlePurchase = async () => {
    // Add selected pixels to placed pixels
    console.log("Purchasing pixels:", selectedPixels)
    console.log("User address:", address)

    const newPixels = { ...pixels }
    selectedPixels.forEach(({ x, y, color }) => {
      newPixels[`${x},${y}`] = color
    })
    setPixels(newPixels)

    if (selectedPixels.length === 0) {
		showToast(
          "No pixels selected!",
          "You need to select some pixels in order to purchase them.",
          "error"
        )
		return
	}

	if (!address) {
		showToast(
		  "Wallet not connected!",
		  "Please connect your wallet to purchase pixels.",
		  "error"
		)
		return
	}
	
    console.log(pixelsContract)
    pixelsContract["options"]["publicKey"] = address

    let result
    try {
      const response = await pixelsContract.place_multiple({
        user: address || "",
        pixels: selectedPixels.map((pixel) => ({
          x: pixel.x,
          y: pixel.y,
          colour: COLORS.indexOf(pixel.color) + 1,
        })),
      })
      result = response.result
      console.log(result)
    } catch (error) {
      console.error("Error simulating transaction:", error)
      showToast(
        "Simulation Failed",
        error instanceof Error ? error.message : "An unknown error occurred during simulation.",
        "error"
      )
      return
    }

    if (result["value"] == true) {
      console.log("Placing pixels on chain!")
      const tx = await pixelsContract.place_multiple({
        user: address || "",
        pixels: selectedPixels.map((pixel) => ({
          x: pixel.x,
          y: pixel.y,
          colour: COLORS.indexOf(pixel.color) + 1,
        })),
      })

      console.log(tx)
      try {
        const signedTxXdr = await signTransaction(tx.built.toXDR() || "", {
          address: address,
          networkPassphrase: network.passphrase,
        })

        console.log("Transaction signed successfully:", result)
        console.log(signedTxXdr)

        submitRpc({
          rpcUrl: network.rpcUrl,
          transactionXdr: signedTxXdr["signedTxXdr"],
          networkPassphrase: network.passphrase,
          headers: getNetworkHeaders(network, "rpc"),
        })
        setSelectedPixels([])
      } catch (error) {
        console.error("Error signing transaction:", error)
        // --- Show error toast on signing error ---
        showToast(
          "Signing Failed",
          error instanceof Error ? error.message : "An unknown signing error occurred.",
          "error"
        )
      }
    }
  }

  // --- Updated useEffect to trigger toasts ---
  useEffect(() => {
    if (isSubmitRpcSuccess && submitRpcResponse) {
      console.log("Transaction submitted successfully:", submitRpcResponse)
      showToast(
        "Success!",
        "Your pixels have been submitted to the network.",
        "success"
      )
      resetSubmitRpc() // Reset to allow future submissions
    }
    if (submitRpcError) {
      console.error("Transaction submission failed:", submitRpcError)
      const errorMessage =
        submitRpcError instanceof Error
          ? submitRpcError.message
          : "An unknown error occurred."
      showToast("Transaction Failed", errorMessage, "error")
      resetSubmitRpc() // Reset to allow future submissions
    }
  }, [
    isSubmitRpcSuccess,
    submitRpcResponse,
    submitRpcError,
    resetSubmitRpc,
  ])

  const handleClearSelection = () => {
    setSelectedPixels([])
  }

  const handleRemovePixel = (index: number) => {
    setSelectedPixels(selectedPixels.filter((_, i) => i !== index))
  }

  return (
    // --- Wrap in Toast Provider ---
    <Toast.Provider swipeDirection="right">
      <div className="flex h-screen flex-col bg-background">
  {/* Header */}
  <header className="flex items-center justify-between border-b border-border px-6 py-4">
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
        <div className="h-6 w-6 rounded-sm bg-primary-foreground" />
      </div>
      <h1 className="text-xl font-bold text-white">131.044 XLM Home Page</h1>
    </div>
  </header>

  <div className="flex flex-1 overflow-hidden">
    {/* Main Canvas Area */}
    <div className="flex flex-1 flex-col min-w-0">
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-[#0a0a0a]"
      >
        <canvas
          ref={canvasRef}
          width={1200}
          height={800}
          className="cursor-crosshair"
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Zoom Controls */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2">
          <Button
            size="3"
            variant="classic"
            onClick={handleZoomIn}
            className="h-10 w-10"
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button
            size="3"
            variant="classic"
            onClick={handleZoomOut}
            className="h-10 w-10"
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
        </div>

        {/* Zoom Level Indicator */}
        <div className="absolute bottom-6 left-6 rounded-lg bg-card px-3 py-2 text-sm font-medium">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      <div className="border-t border-border bg-card p-4">
        <ColorPalette
          colors={COLORS}
          selectedColor={selectedColor}
          onColorSelect={setSelectedColor}
        />
      </div>
    </div>
    
    {/* Right Sidebar with Pixel List and Leaderboard */}
    <aside className="flex w-96 flex-col border-l border-border bg-card">
      {/* Pixel List - Top Half */}
      <div className="border-b border-border p-4 h-1/2 flex flex-col">
        <PixelList
          pixels={selectedPixels}
          onRemove={handleRemovePixel}
          onClear={handleClearSelection}
          onPurchase={handlePurchase}
          isPending={isSubmitRpcPending} 
        />
      </div>
      
      {/* Leaderboard - Bottom Half */}
      <div className="p-4 h-1/2 flex flex-col overflow-hidden">
        <Leaderboard data={leaderboardData}/>
      </div>
    </aside>
  </div>
</div>
      
      

      {/* --- Toast Root and Viewport --- */}
      <Toast.Root
        className={`
          data-[state=open]:animate-slideIn
          data-[state=closed]:animate-hide
          data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]
          data-[swipe=cancel]:translate-x-0
          data-[swipe=end]:animate-swipeOut
          grid grid-cols-[auto_max-content] items-center gap-x-4 rounded-md p-4 shadow-lg
          ${
            toastProps.variant === "error"
              ? "bg-red-600" // Red for error
              : "bg-green-600" // Green for success
          } 
          text-white
        `}
        open={toastOpen}
        onOpenChange={setToastOpen}
      >
        <div>
          <Toast.Title className="font-bold">{toastProps.title}</Toast.Title>
          <Toast.Description className="text-sm opacity-90">
            {toastProps.description}
          </Toast.Description>
        </div>
        <Toast.Close asChild>
          <button className="ml-auto rounded-md p-1 text-white/80 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white">
            &times;
          </button>
        </Toast.Close>
      </Toast.Root>

      <Toast.Viewport className="fixed bottom-6 right-6 z-50 flex w-96 max-w-[100vw] flex-col gap-3 p-4" />
    </Toast.Provider>
  )
}