import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { deepmerge } from "deepmerge-ts"
import { motion } from "motion/react"
import { XIcon } from "@phosphor-icons/react"

import PlanetLoader from "@/assets/videos/planet-loader.mp4"
import { DottedTitle } from "@/components/DottedTitle"
import { FillCrossLoader } from "@/components/FullScreenLoader"
import { MapLegend } from "@/components/MapLegends"
import { MapZoomControls } from "@/components/MapZoomControls"
import { Divider } from "@/components/primitives/Divider"
import SectorMap, { type MapConfig } from "@/components/SectorMap"
import { NeuroSymbolicsIcon, QuantumFoamIcon, RetroOrganicsIcon } from "@/icons"
import useGameStore from "@/stores/game"
import { formatTimeAgoOrDate } from "@/utils/date"
import { getFetchBounds } from "@/utils/map"
import { getPortCode } from "@/utils/port"
import { cn } from "@/utils/tailwind"

import { DEFAULT_MAX_BOUNDS, PENDING_MAP_FETCH_STALE_MS } from "@/types/constants"

const MAP_CONFIG: MapConfig = {
  debug: false,
  camera_viewport_mode: "viewport_rect",
  highlight_center_sector: false,
  clickable: true,
  draggable: true,
  scrollZoom: true,
  show_sector_ids: false,
  show_partial_lanes: true,
  show_ports: true,
  show_grid: true,
  show_port_labels: true,
  uiStyles: {
    background: {
      color: "rgba(0,0,0,0.92)",
    },
    edgeFeather: {
      size: 140,
      falloff: 3,
    },
  },
  nodeStyles: {
    current: {
      glow: true,
      offset: true,
      outlineWidth: 6,
      borderPosition: "center",
    },
  },
}

const PLAYER_COLOR_STORAGE_KEY = "gradient-bang:map-player-colors:v1"
const PLAYER_COLOR_PALETTE = [
  { token: "--color-terminal", fallback: "#dcfd38" },
  { token: "--color-fuel", fallback: "#7dd3fc" },
  { token: "--color-success", fallback: "#34d399" },
  { token: "--color-warning", fallback: "#facc15" },
  { token: "--color-destructive", fallback: "#fb7185" },
  { token: "--color-terminal-subtle", fallback: "#86914e" },
  { token: "--color-fuel-subtle", fallback: "#38bdf8" },
  { token: "--color-success-foreground", fallback: "#bbf7d0" },
] as const

type PlayerColorToken = (typeof PLAYER_COLOR_PALETTE)[number]["token"]

let playerColorMemory: Record<string, PlayerColorToken> | null = null

function readPlayerColorMemory(): Record<string, PlayerColorToken> {
  if (playerColorMemory) return playerColorMemory
  if (typeof window === "undefined") {
    playerColorMemory = {}
    return playerColorMemory
  }

  try {
    const raw = window.localStorage.getItem(PLAYER_COLOR_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const validTokens = new Set(PLAYER_COLOR_PALETTE.map((color) => color.token))
    playerColorMemory = Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, PlayerColorToken] => {
        const [, value] = entry
        return typeof value === "string" && validTokens.has(value as PlayerColorToken)
      })
    )
  } catch {
    playerColorMemory = {}
  }
  return playerColorMemory
}

function writePlayerColorMemory(memory: Record<string, PlayerColorToken>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PLAYER_COLOR_STORAGE_KEY, JSON.stringify(memory))
  } catch {
    // Ignore storage failures; colors will remain stable for this render pass.
  }
}

function assignPlayerColorToken(playerKey: string): PlayerColorToken {
  const memory = readPlayerColorMemory()
  const existing = memory[playerKey]
  if (existing) return existing

  const usage = new Map<PlayerColorToken, number>()
  for (const color of Object.values(memory)) {
    usage.set(color, (usage.get(color) ?? 0) + 1)
  }
  const minUsage = Math.min(...PLAYER_COLOR_PALETTE.map((color) => usage.get(color.token) ?? 0))
  const candidates = PLAYER_COLOR_PALETTE.filter(
    (color) => (usage.get(color.token) ?? 0) === minUsage
  )
  const selected = candidates[Math.floor(Math.random() * candidates.length)].token
  memory[playerKey] = selected
  writePlayerColorMemory(memory)
  return selected
}

function resolvePlayerColor(token: PlayerColorToken): string {
  const paletteColor = PLAYER_COLOR_PALETTE.find((color) => color.token === token)
  if (typeof window === "undefined") return paletteColor?.fallback ?? "#ffffff"
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return resolved || paletteColor?.fallback || "#ffffff"
}

function getPlayerInitials(name: string | null | undefined): string {
  const trimmed = name?.trim()
  if (!trimmed) return "?"
  const letters = trimmed
    .split(/\s+/)
    .map((part) => part.match(/[A-Za-z]/)?.[0])
    .filter((letter): letter is string => Boolean(letter))
  if (letters.length >= 2) {
    return `${letters[0]}${letters[1]}`.toUpperCase()
  }
  return (letters[0] ?? "?").toUpperCase()
}

const CommodityRow = ({
  icon,
  label,
  state,
}: {
  icon: React.ReactNode
  label: string
  state: "buy" | "sell"
}) => (
  <div className="flex flex-row justify-between gap-2">
    <dt className="font-bold text-xs inline-flex items-center gap-1">
      {icon} {label}
    </dt>
    <dd className={cn(state === "buy" ? "text-success" : "text-warning", "text-xxs uppercase")}>
      {state}
    </dd>
  </div>
)

const MapNodeDetails = ({ node }: { node?: MapSectorNode | null }) => {
  if (!node) return null

  const portCode = getPortCode(node.port ?? null)
  const qf_state = portCode[0] === "B" ? "buy" : "sell"
  const ro_state = portCode[1] === "B" ? "buy" : "sell"
  const ns_state = portCode[2] === "B" ? "buy" : "sell"

  return (
    <aside className="z-90 absolute top-ui-sm left-0 w-70 h-fit flex flex-row gap-4 bg-background border border-border border-l-0 p-ui-sm shadow-long shadow-black/25 pointer-events-none">
      <Divider
        orientation="vertical"
        variant="dashed"
        className="h-auto w-3 self-stretch text-accent"
      />
      <div className="flex flex-col gap-2 flex-1">
        <DottedTitle title={`Sector ${node.id.toString()}`} textColor="text-foreground" />
        <dl className="flex flex-col gap-2 uppercase text-xxs text-foreground">
          <div className="flex flex-row justify-between gap-2">
            <dt className="font-bold">Region</dt>
            <dd className="text-muted-foreground">{node.region}</dd>
          </div>
          <div className="flex flex-row justify-between gap-2">
            <dt className="font-bold">Visited</dt>
            <dd className="text-muted-foreground">
              {node.visited ? node.source : <XIcon size={16} className="text-accent-foreground" />}
            </dd>
          </div>
          <div className="flex flex-row justify-between gap-2">
            <dt className="font-bold">Adjacent sectors</dt>
            <dd className="text-muted-foreground">
              {node.lanes?.map((lane) => lane.to).join(",")}
            </dd>
          </div>
          <div className="flex flex-row justify-between gap-2">
            <dt className="font-bold">Hops from center</dt>
            <dd className="text-muted-foreground">{node.hops_from_center?.toString()}</dd>
          </div>
          <div className="flex flex-row justify-between gap-2">
            <dt className="font-bold">Last visited</dt>
            <dd className="text-muted-foreground">
              {node.last_visited ? formatTimeAgoOrDate(node.last_visited) : "Never"}
            </dd>
          </div>
        </dl>
        {portCode && (
          <dl className="flex flex-col gap-2">
            <DottedTitle title={`Port ${portCode.toUpperCase()}`} textColor="text-white" />
            <CommodityRow icon={<QuantumFoamIcon size={16} />} label="QF" state={qf_state} />
            <CommodityRow icon={<RetroOrganicsIcon size={16} />} label="RO" state={ro_state} />
            <CommodityRow icon={<NeuroSymbolicsIcon size={16} />} label="NS" state={ns_state} />
          </dl>
        )}
      </div>
    </aside>
  )
}

export const BigMapPanel = ({ config }: { config?: MapConfig }) => {
  const sector = useGameStore.use.sector?.()
  const mapData = useGameStore.use.regional_map_data?.()
  const coursePlot = useGameStore.use.course_plot?.()
  const ships = useGameStore.use.ships?.()
  const player = useGameStore.use.player?.()
  const observedMapEntities = useGameStore.use.observed_map_entities?.()
  const mapActivityCallouts = useGameStore.use.map_activity_callouts?.()
  const pruneMapActivityCallouts = useGameStore.use.pruneMapActivityCallouts?.()
  const combatSectorsRecord = useGameStore((state) => state.combat_sectors)
  const mapCenterSector = useGameStore((state) => state.mapCenterSector)
  const mapZoomLevel = useGameStore((state) => state.mapZoomLevel)
  const mapCenterWorld = useGameStore((state) => state.mapCenterWorld)
  const mapFitBoundsWorld = useGameStore((state) => state.mapFitBoundsWorld)
  const mapFitEpoch = useGameStore((state) => state.mapFitEpoch)
  const mapResetEpoch = useGameStore((state) => state.mapResetEpoch)
  const dispatchAction = useGameStore.use.dispatchAction?.()
  const setMapCenterSector = useGameStore.use.setMapCenterSector?.()
  const setMapCenterWorld = useGameStore.use.setMapCenterWorld?.()
  const requestMapFetch = useGameStore.use.requestMapFetch?.()

  const [hoveredNode, setHoveredNode] = useState<MapSectorNode | null>(null)
  const [isFetching, setIsFetching] = useState(false)

  const initialFetchRef = useRef(false)
  const [hadMapDataOnMount] = useState(() => mapData !== undefined)

  const coursePlotZoomEnabled = useGameStore((state) => state.coursePlotZoomEnabled)

  const mapConfig = useMemo(() => {
    const base = config ? (deepmerge(MAP_CONFIG, config) as MapConfig) : MAP_CONFIG
    return { ...base, coursePlotZoomEnabled }
  }, [config, coursePlotZoomEnabled])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      pruneMapActivityCallouts?.()
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [pruneMapActivityCallouts])

  const shipSectors = useMemo(() => {
    const byId = new Map<
      string,
      {
        sector: number
        ship_name: string
        ship_type: string
        player_name?: string | null
        player_initials?: string
        player_color?: string
        kind?: ObservedMapEntity["kind"]
      }
    >()

    for (const ship of ships?.data ?? []) {
      if (typeof ship.sector !== "number") continue
      const playerName =
        ship.owner_type === "personal" ?
          player?.name
        : (ship.current_task_actor?.character_name ??
          ship.current_task_actor_name ??
          ship.byoa?.owner_character_name ??
          null)
      const colorKey = ship.owner_type === "personal" ? player?.id || playerName : playerName
      const colorToken = assignPlayerColorToken(colorKey || ship.ship_id)
      byId.set(ship.ship_id, {
        sector: ship.sector,
        ship_name: ship.ship_name || player?.name || "Unknown ship",
        ship_type: ship.ship_type || "unknown",
        player_name: playerName,
        player_initials: getPlayerInitials(playerName || ship.ship_name),
        player_color: resolvePlayerColor(colorToken),
        kind: ship.owner_type === "corporation" ? "corp_ship" : "player",
      })
    }

    for (const entity of Object.values(observedMapEntities ?? {})) {
      if (typeof entity.sector !== "number") continue
      const id = entity.ship_id ?? entity.id
      const playerName = entity.player_name ?? entity.name
      const colorToken = assignPlayerColorToken(entity.player_id || playerName || id)
      byId.set(id, {
        sector: entity.sector,
        ship_name: entity.ship_name || entity.name,
        ship_type: entity.ship_type || "unknown",
        player_name: playerName,
        player_initials: getPlayerInitials(playerName),
        player_color: resolvePlayerColor(colorToken),
        kind: entity.kind,
      })
    }

    return Array.from(byId.values())
  }, [observedMapEntities, player?.id, player?.name, ships?.data])

  const combatSectorsSet = useMemo(() => {
    const ids = new Set<number>()
    for (const id of Object.values(combatSectorsRecord)) ids.add(id)
    return ids
  }, [combatSectorsRecord])

  // Initial fetch of map data
  useEffect(() => {
    if (initialFetchRef.current) return

    const initialCenter = mapCenterSector ?? sector?.id
    if (initialCenter !== undefined) {
      initialFetchRef.current = true

      const state = useGameStore.getState()
      const initBounds = getFetchBounds(state.mapZoomLevel ?? DEFAULT_MAX_BOUNDS)

      console.debug(
        `%c[GAME MAP SCREEN] Initial fetch for current sector ${initialCenter} with bounds ${initBounds}`,
        "font-weight: bold; color: #4CAF50;"
      )

      queueMicrotask(() => setIsFetching(true))
      dispatchAction({
        type: "get-my-map",
        payload: {
          center_sector: initialCenter,
          bounds: initBounds,
        },
      })
    }
  }, [mapCenterSector, sector, dispatchAction])

  const updateCenterSector = useCallback(
    (node: MapSectorNode | null) => {
      // Ignore empty-space clicks to avoid accidental recenter
      if (!node) return
      setMapCenterWorld?.(undefined)
      setMapCenterSector?.(node.id)
    },
    [setMapCenterSector, setMapCenterWorld]
  )

  // Handles fetching map data when SectorMap signals a viewport intent change
  const handleMapFetch = useCallback(
    (centerSectorId: number, bounds: number) => {
      if (!initialFetchRef.current) return

      const didFetch = requestMapFetch?.(centerSectorId, bounds)
      if (didFetch) {
        setIsFetching(true)
      }
    },
    [requestMapFetch, setIsFetching]
  )

  // When map data mutates after a fetch, set loading to false
  useEffect(() => {
    if (mapData !== undefined) {
      queueMicrotask(() => setIsFetching(false))
    }
  }, [mapData])

  // Ensure transient request state does not keep controls disabled indefinitely
  useEffect(() => {
    if (!isFetching) return
    const timeoutId = window.setTimeout(() => {
      setIsFetching(false)
    }, PENDING_MAP_FETCH_STALE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [isFetching])

  return (
    <div className="group relative flex flex-row gap-3 w-full h-full">
      <div className="flex-1 relative">
        <MapNodeDetails node={hoveredNode} />
        <header className="absolute top-ui-sm right-ui-sm flex flex-col gap-ui-xs w-fit h-fit z-20">
          <MapZoomControls disabled={isFetching || !mapData} />
        </header>

        <footer className="absolute bottom-ui-xs left-ui-xs w-full h-fit z-20">
          <MapLegend />
        </footer>

        {mapData && isFetching && (
          <FillCrossLoader
            message="Fetching map data"
            className="bg-transparent pointer-events-none"
          />
        )}

        {mapData ?
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: hadMapDataOnMount ? 1 : 0, scale: hadMapDataOnMount ? 1 : 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: hadMapDataOnMount ? 0 : 2, delay: hadMapDataOnMount ? 0 : 1 }}
          >
            <SectorMap
              center_sector_id={mapCenterSector ?? sector?.id}
              current_sector_id={sector ? sector.id : undefined}
              config={mapConfig}
              map_data={mapData ?? []}
              maxDistance={mapZoomLevel ?? DEFAULT_MAX_BOUNDS}
              showLegend={false}
              onNodeClick={updateCenterSector}
              onNodeEnter={(node) => {
                setHoveredNode(node)
              }}
              onNodeExit={() => {
                setHoveredNode(null)
              }}
              onMapFetch={handleMapFetch}
              coursePlot={coursePlot ?? null}
              ships={shipSectors}
              mapActivityCallouts={mapActivityCallouts}
              combatSectors={combatSectorsSet}
              center_world={mapCenterWorld}
              fit_bounds_world={mapFitBoundsWorld}
              mapFitEpoch={mapFitEpoch}
              mapResetEpoch={mapResetEpoch}
            />
          </motion.div>
        : <div className="relative w-full h-full flex items-center justify-center cross-lines-white/50 cross-lines-offset-12">
            <div className="elbow relative z-99 flex flex-col gap-3 bg-black border border-border p-6 animate-in fade-in-0 duration-300">
              <video
                src={PlanetLoader}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                aria-hidden="true"
                className="w-30 h-30 object-contain mx-auto"
              />

              <span className="text-muted-foreground text-sm uppercase animate-pulse">
                Awaiting map data...
              </span>
            </div>
          </div>
        }
      </div>
    </div>
  )
}
