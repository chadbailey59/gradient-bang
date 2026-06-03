import { produce } from "immer"
import type { StateCreator } from "zustand"

import { createLogEntrySignature } from "@/utils/game"

import type { EventQueryEntry } from "@/types/messages"

const MAX_MOVEMENT_HISTORY = 200
const MAX_TRADE_HISTORY = 100
const MAX_MAP_ACTIVITY_CALLOUTS = 80

export interface HistorySlice {
  activity_log: LogEntry[]
  addActivityLogEntry: (entry: LogEntry) => void

  observed_map_entities: Record<string, ObservedMapEntity>
  upsertObservedMapEntity: (entity: ObservedMapEntity) => void

  map_activity_callouts: MapActivityCallout[]
  addMapActivityCallout: (
    callout: Omit<MapActivityCallout, "id" | "created_at" | "expires_at"> & {
      ttlMs?: number
    }
  ) => void
  pruneMapActivityCallouts: (now?: number) => void

  movement_history: MovementHistory[]
  addMovementHistory: (history: Omit<MovementHistory, "timestamp">) => void

  known_ports: SectorHistory[] | undefined // Note: allow undefined here to handle fetching state
  setKnownPorts: (ports: SectorHistory[]) => void

  trade_history: TradeHistoryEntry[] | undefined
  addTradeHistoryEntry: (entry: TradeHistoryEntry) => void

  // Task history from server
  task_history: TaskHistoryEntry[] | undefined
  setTaskHistory: (tasks: TaskHistoryEntry[]) => void

  // Task events (from event.query)
  task_events: EventQueryEntry[] | undefined
  setTaskEvents: (events: EventQueryEntry[]) => void
}

export const createHistorySlice: StateCreator<HistorySlice> = (set) => ({
  activity_log: [],
  observed_map_entities: {},
  map_activity_callouts: [],
  known_ports: undefined,
  trade_history: undefined,
  task_history: undefined,
  user_ships: undefined,
  task_events: undefined,

  addActivityLogEntry: (entry: LogEntry) =>
    set(
      produce((state) => {
        const timestamp = entry.timestamp ?? new Date().toISOString()
        const timestampClient = entry.timestamp_client ?? Date.now()
        const meta = entry.meta ?? {}

        state.activity_log.push({
          ...entry,
          timestamp,
          timestamp_client: timestampClient,
          signature:
            entry.signature ??
            createLogEntrySignature({
              type: entry.type,
              meta,
            }),
          meta,
        })
      })
    ),

  upsertObservedMapEntity: (entity: ObservedMapEntity) =>
    set(
      produce((state) => {
        const existing = state.observed_map_entities[entity.id]
        state.observed_map_entities[entity.id] = {
          ...existing,
          ...entity,
        }
      })
    ),

  addMapActivityCallout: (callout) =>
    set(
      produce((state) => {
        const now = Date.now()
        state.map_activity_callouts.push({
          ...callout,
          id: `${callout.entity_id}:${now}:${Math.random().toString(36).slice(2)}`,
          created_at: now,
          expires_at: now + (callout.ttlMs ?? 5000),
        })
        state.map_activity_callouts = state.map_activity_callouts
          .filter((entry: MapActivityCallout) => entry.expires_at > now)
          .slice(-MAX_MAP_ACTIVITY_CALLOUTS)
      })
    ),

  pruneMapActivityCallouts: (now = Date.now()) =>
    set(
      produce((state) => {
        state.map_activity_callouts = state.map_activity_callouts.filter(
          (entry: MapActivityCallout) => entry.expires_at > now
        )
      })
    ),

  addTradeHistoryEntry: (history: Omit<TradeHistoryEntry, "timestamp">) => {
    return set(
      produce((state) => {
        if (!state.trade_history) {
          state.trade_history = []
        }
        state.trade_history.push({
          ...history,
          timestamp: new Date().toISOString(),
        })
        if (state.trade_history.length > MAX_TRADE_HISTORY) {
          state.trade_history.shift()
        }
      })
    )
  },

  movement_history: [],
  addMovementHistory: (history: Omit<MovementHistory, "timestamp">) => {
    return set(
      produce((state) => {
        state.movement_history.push({
          ...history,
          timestamp: new Date().toISOString(),
        })
        // Keep only the last MAX_MOVEMENT_HISTORY entries
        if (state.movement_history.length > MAX_MOVEMENT_HISTORY) {
          state.movement_history.shift() // Remove oldest entry
        }
      })
    )
  },

  setKnownPorts: (ports: SectorHistory[]) =>
    set(
      produce((state) => {
        state.known_ports = ports
      })
    ),

  setTaskHistory: (tasks: TaskHistoryEntry[]) =>
    set(
      produce((state) => {
        state.task_history = tasks
      })
    ),

  setTaskEvents: (events: EventQueryEntry[]) =>
    set(
      produce((state) => {
        state.task_events = events
      })
    ),
})
