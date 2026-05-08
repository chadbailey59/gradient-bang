import { useCallback, useEffect, useRef, useState } from "react"

import { type Participant, RTVIEvent } from "@pipecat-ai/client-js"
import { usePipecatClient, useRTVIClientEvent } from "@pipecat-ai/client-react"

import useGameStore from "@/stores/game"

export const PipecatClientAudio: React.FC = () => {
  const audioRefs = useRef(new Map<string, HTMLAudioElement>())
  const client = usePipecatClient()
  const [remoteAudioTracks, setRemoteAudioTracks] = useState<MediaStreamTrack[]>(() => {
    const track = client?.tracks().bot?.audio
    return track ? [track] : []
  })
  const volume = useGameStore((state) => state.settings.remoteAudioVolume)

  const addRemoteAudioTrack = useCallback((track: MediaStreamTrack, participant?: Participant) => {
    if (participant?.local || track.kind !== "audio") return
    setRemoteAudioTracks((tracks) => {
      if (tracks.some((existing) => existing.id === track.id)) return tracks
      return [...tracks, track]
    })
  }, [])

  const removeRemoteAudioTrack = useCallback((track: MediaStreamTrack) => {
    setRemoteAudioTracks((tracks) => tracks.filter((existing) => existing.id !== track.id))
  }, [])

  useRTVIClientEvent(RTVIEvent.TrackStarted, addRemoteAudioTrack)
  useRTVIClientEvent(RTVIEvent.TrackStopped, removeRemoteAudioTrack)

  useRTVIClientEvent(
    RTVIEvent.Disconnected,
    useCallback(() => {
      audioRefs.current.clear()
      setRemoteAudioTracks([])
    }, [])
  )

  // Attach each remote audio track to its own media element. Daily's Pipecat
  // adapter treats every remote participant as "bot", so a single bot track
  // would be replaced when commander joins.
  useEffect(() => {
    for (const track of remoteAudioTracks) {
      const el = audioRefs.current.get(track.id)
      if (!el) continue
      const existing = el.srcObject as MediaStream | null
      const oldTrack = existing?.getAudioTracks()[0]
      if (oldTrack?.id === track.id) continue
      el.srcObject = new MediaStream([track])
    }
  }, [remoteAudioTracks])

  // Bind store volume to each media element.
  useEffect(() => {
    for (const el of audioRefs.current.values()) {
      el.volume = volume
    }
  }, [volume])

  // Mirror PipecatClientAudio's speaker routing behavior. `setSinkId` returns
  // a Promise that can reject (unsupported deviceId, permission denied, etc.);
  // swallow and log so failures stay non-fatal and observable.
  useRTVIClientEvent(
    RTVIEvent.SpeakerUpdated,
    useCallback((speaker: MediaDeviceInfo) => {
      for (const el of audioRefs.current.values()) {
        if (typeof el.setSinkId !== "function") continue
        el.setSinkId(speaker.deviceId).catch((err: unknown) => {
          console.warn("PipecatClientAudio: setSinkId failed", err)
        })
      }
    }, [])
  )

  return (
    <>
      {remoteAudioTracks.map((track) => (
        <audio
          key={track.id}
          ref={(el) => {
            if (el) {
              el.volume = volume
              audioRefs.current.set(track.id, el)
            } else {
              audioRefs.current.delete(track.id)
            }
          }}
          autoPlay
        />
      ))}
    </>
  )
}

PipecatClientAudio.displayName = "PipecatClientAudio"

export default PipecatClientAudio
