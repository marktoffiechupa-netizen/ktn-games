// Network module using PeerJS
// We use the public PeerJS broker (no API key needed) for free signaling.
// Each user gets a random peer ID. The host generates a 6-character room code
// derived from their peer ID, and shares it + a password with their friend.

import Peer, { type DataConnection } from 'peerjs';

export type PeerJSInstance = InstanceType<typeof Peer>;
export type { DataConnection };

export async function createPeer(): Promise<PeerJSInstance> {
  // Generate a random ID for uniqueness
  const id = 'slapdash-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return new Peer(id, {
    debug: 0,
  });
}

export function generateRoomCode(peerId: string): string {
  // Take a chunk of the peer ID and make it readable
  return peerId.replace('slapdash-', '').slice(0, 6).toUpperCase();
}
